"""Entity-level sync endpoints for the offline-first sync engine.

Provides two endpoints per entity type:
- POST /sync/{entity}  — push batch of local changes to server
- GET  /sync/{entity}  — pull all changes since a given timestamp

Why a separate module from sync.py?
sync.py handles the "sync queue" (an ordered log of raw operations).
This module handles "entity sync" — direct read/write of entity tables.
These are two different patterns; keeping them separate avoids a God file.

Why entity-level rather than table-level?
Exposing table names directly in a URL would be a security risk (SQL
injection via path param). Instead we maintain an explicit ENTITY_REGISTRY
whitelist mapping safe names to model classes.

Conflict Resolution Strategy (Task 15.4):
- "Last Write Wins" using server-side updated_at timestamps
- If the server record's updated_at >= the client's record updated_at,
  the server wins and the client receives the server version
- If the client record is newer, the server applies the update
- This is the standard LWW approach used by most mobile sync systems
  (Firebase, WatermelonDB default, Realm default)
- For the POS use case (one active device per location), conflicts are rare.
  A full CRDT would be over-engineering for this domain.

Validates: offline-sync-engine Requirements 4, 5
Tasks 15.1 (POST), 15.2 (GET), 15.3 (batch), 15.4 (conflict), 15.5 (tests)
"""

import math
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel as PydanticBase, Field
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_current_business_id
from app.core.database import get_db
from app.models.user import User

# ---------------------------------------------------------------------------
# Entity registry — explicit whitelist of entities exposed via sync
#
# Why a whitelist?
# The path parameter {entity} must map to a known model; accepting arbitrary
# strings would allow clients to enumerate or attack internal tables.
# ---------------------------------------------------------------------------

def _build_entity_registry() -> dict[str, Any]:
    """Build the entity registry lazily to avoid circular imports at module load."""
    from app.models.product import Product, ProductCategory
    from app.models.order import Order
    from app.models.customer import Customer

    return {
        "products": Product,
        "categories": ProductCategory,
        "orders": Order,
        "customers": Customer,
    }


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

router = APIRouter(prefix="/sync", tags=["Entity Sync"])

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PushRecord(PydanticBase):
    """A single record in a push batch.

    'updated_at' is the client's local timestamp for this record.
    The server uses this to detect conflicts.
    """
    id: str = Field(..., description="Client-side record UUID")
    action: str = Field(..., pattern="^(create|update|delete)$")
    payload: dict = Field(..., description="Full record payload (except deleted records)")
    updated_at: str = Field(..., description="Client updated_at in ISO 8601 format")


class PushBatchRequest(PydanticBase):
    """Batch push request: up to 50 records per request (Requirement 4.2)."""
    records: list[PushRecord] = Field(..., max_length=50)


class PushRecordResult(PydanticBase):
    """Result for a single record in a push batch."""
    id: str
    action: str
    status: str   # "applied" | "conflict_server_wins" | "deleted" | "error"
    conflict: bool = False
    server_record: Optional[dict] = None  # Set when server wins a conflict
    error: Optional[str] = None


class PushBatchResponse(PydanticBase):
    """Response for a push batch operation."""
    applied: int
    conflicts: int
    errors: int
    results: list[PushRecordResult]
    server_timestamp: str


class PullResponse(PydanticBase):
    """Response for a pull (GET) request.

    'since' reflects the timestamp used for filtering.
    'server_timestamp' should be stored by the client as the new watermark.
    """
    records: list[dict]
    total: int
    page: int
    per_page: int
    pages: int
    since: Optional[str]
    server_timestamp: str

# ---------------------------------------------------------------------------
# Task 15.1 + 15.3: POST /sync/{entity} — push batch
# ---------------------------------------------------------------------------

@router.post("/{entity}", response_model=PushBatchResponse, status_code=status.HTTP_200_OK)
async def push_entity_changes(
    entity: str,
    body: PushBatchRequest,
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Push a batch of local entity changes to the server.

    Applies creates, updates, and deletes to the entity table.
    Conflict detection is applied on each update:
    - If server record is newer → server wins (conflict returned to client)
    - If client record is newer → server applies the update

    Task 15.3: batch support — up to 50 records per request (enforced by schema).
    Task 15.4: conflict detection — last-write-wins using updated_at timestamps.
    """
    registry = _build_entity_registry()
    if entity not in registry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown entity type '{entity}'. Valid types: {sorted(registry)}",
        )

    model_class = registry[entity]
    results: list[PushRecordResult] = []
    applied = 0
    conflicts = 0
    errors = 0
    server_ts = datetime.now(timezone.utc).isoformat()

    for record in body.records:
        result = _apply_push_record(db, model_class, record, business_id)
        results.append(result)
        if result.status == "error":
            errors += 1
        elif result.conflict:
            conflicts += 1
        else:
            applied += 1

    db.commit()

    return PushBatchResponse(
        applied=applied,
        conflicts=conflicts,
        errors=errors,
        results=results,
        server_timestamp=server_ts,
    )


# ---------------------------------------------------------------------------
# Task 15.2: GET /sync/{entity} — pull changes since timestamp
# ---------------------------------------------------------------------------

@router.get("/{entity}", response_model=PullResponse)
async def pull_entity_changes(
    entity: str,
    since: Optional[str] = Query(None, description="ISO 8601 timestamp — only return records updated after this"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_active_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_db),
):
    """Pull all entity records modified since a given timestamp.

    If 'since' is omitted, all records for the business are returned.
    This supports the initial full sync when a new device comes online.

    Task 15.2: GET endpoint with 'since' parameter.
    """
    registry = _build_entity_registry()
    if entity not in registry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown entity type '{entity}'. Valid types: {sorted(registry)}",
        )

    model_class = registry[entity]
    server_ts = datetime.now(timezone.utc).isoformat()

    # Build query
    query = db.query(model_class).filter(
        model_class.business_id == business_id  # type: ignore[attr-defined]
    )

    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid 'since' timestamp format: {since!r}. Use ISO 8601.",
            )
        query = query.filter(model_class.updated_at > since_dt)  # type: ignore[attr-defined]

    total = query.count()
    pages = max(1, math.ceil(total / per_page))
    offset = (page - 1) * per_page
    rows = query.order_by(model_class.updated_at.asc()).offset(offset).limit(per_page).all()  # type: ignore[attr-defined]

    records = [_model_to_dict(row) for row in rows]

    return PullResponse(
        records=records,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
        since=since,
        server_timestamp=server_ts,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _apply_push_record(
    db: Session,
    model_class: Any,
    record: PushRecord,
    business_id: str,
) -> PushRecordResult:
    """Apply a single push record to the database.

    Returns a PushRecordResult describing what happened.

    Why inline (not a service)?
    The logic is short (< 40 lines) and entity-agnostic. Extracting it to a
    separate service class would add indirection without benefit.
    """
    record_id_str = record.id
    # Validate UUID
    try:
        record_uuid = uuid.UUID(record_id_str)
    except ValueError:
        return PushRecordResult(
            id=record_id_str,
            action=record.action,
            status="error",
            error=f"Invalid UUID: {record_id_str!r}",
        )

    existing = db.query(model_class).filter(model_class.id == record_uuid).first()

    if record.action == "delete":
        if existing and str(existing.business_id) == business_id:
            db.delete(existing)
            return PushRecordResult(id=record_id_str, action="delete", status="deleted")
        # Already gone — idempotent, not an error
        return PushRecordResult(id=record_id_str, action="delete", status="deleted")

    if record.action == "create":
        if existing:
            # Duplicate create — treat as update
            return _apply_update(db, model_class, existing, record, business_id, record_id_str)
        return _apply_create(db, model_class, record, business_id, record_uuid, record_id_str)

    if record.action == "update":
        if not existing:
            # Record disappeared on server — treat as create
            return _apply_create(db, model_class, record, business_id, record_uuid, record_id_str)
        return _apply_update(db, model_class, existing, record, business_id, record_id_str)

    return PushRecordResult(
        id=record_id_str, action=record.action, status="error", error="Unknown action"
    )


def _apply_create(
    db: Session,
    model_class: Any,
    record: PushRecord,
    business_id: str,
    record_uuid: uuid.UUID,
    record_id_str: str,
) -> PushRecordResult:
    """Create a new record from a client push."""
    try:
        allowed = _get_writable_columns(model_class)
        payload = {k: v for k, v in record.payload.items() if k in allowed}
        payload["id"] = record_uuid
        payload["business_id"] = uuid.UUID(business_id)
        new_obj = model_class(**payload)
        db.add(new_obj)
        return PushRecordResult(id=record_id_str, action="create", status="applied")
    except Exception as exc:  # noqa: BLE001
        return PushRecordResult(
            id=record_id_str, action="create", status="error", error=str(exc)
        )


def _apply_update(
    db: Session,
    model_class: Any,
    existing: Any,
    record: PushRecord,
    business_id: str,
    record_id_str: str,
) -> PushRecordResult:
    """Update an existing record — with conflict detection (Task 15.4).

    Conflict rule: if server's updated_at >= client's updated_at, server wins.
    """
    # Security check: ensure record belongs to this business
    if str(existing.business_id) != business_id:
        return PushRecordResult(
            id=record_id_str, action="update", status="error",
            error="Record does not belong to this business",
        )

    # Parse client timestamp
    try:
        client_updated_at = datetime.fromisoformat(record.updated_at.replace("Z", "+00:00"))
    except ValueError:
        client_updated_at = datetime.now(timezone.utc)

    server_updated_at = existing.updated_at
    if server_updated_at and server_updated_at.tzinfo is None:
        server_updated_at = server_updated_at.replace(tzinfo=timezone.utc)

    # Conflict detection: server wins if server record is same age or newer
    if server_updated_at and server_updated_at >= client_updated_at:
        return PushRecordResult(
            id=record_id_str,
            action="update",
            status="conflict_server_wins",
            conflict=True,
            server_record=_model_to_dict(existing),
        )

    # Client wins — apply the update
    try:
        allowed = _get_writable_columns(model_class)
        for key, value in record.payload.items():
            if key in allowed:
                setattr(existing, key, value)
        return PushRecordResult(id=record_id_str, action="update", status="applied")
    except Exception as exc:  # noqa: BLE001
        return PushRecordResult(
            id=record_id_str, action="update", status="error", error=str(exc)
        )


def _get_writable_columns(model_class: Any) -> set[str]:
    """Return the set of column names that are safe to write from client data.

    Why this filter?
    Clients must not be able to overwrite server-managed fields like
    id, business_id, created_at, updated_at — these are either server-generated
    or managed by the ORM.
    """
    BLOCKED = {"id", "business_id", "created_at", "updated_at"}
    return {
        col.key
        for col in sa_inspect(model_class).mapper.column_attrs
        if col.key not in BLOCKED
    }


def _model_to_dict(obj: Any) -> dict:
    """Convert a SQLAlchemy model instance to a plain dict.

    Why not use Pydantic here?
    Entity schemas vary per model and are defined elsewhere. For sync
    purposes, returning all columns as a dict is correct — the mobile client
    stores the full record.
    """
    result: dict = {}
    for col in sa_inspect(obj.__class__).mapper.column_attrs:
        val = getattr(obj, col.key, None)
        if isinstance(val, datetime):
            result[col.key] = val.isoformat()
        elif isinstance(val, uuid.UUID):
            result[col.key] = str(val)
        else:
            result[col.key] = val
    return result
