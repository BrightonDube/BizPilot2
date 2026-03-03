"""
Conflict resolution service for offline sync.

Handles data conflicts when the same entity is modified both
locally (offline client) and remotely (server) between syncs.

Three resolution strategies:
1. Server-wins — server version always takes precedence
2. Client-wins — client version always takes precedence
3. Last-write-wins — most recent updated_at timestamp wins

Why configurable strategies?
Different entity types have different conflict semantics. Orders should
use server-wins (authoritative financial data), while drafts might use
client-wins (user intent matters more). Configurable strategies avoid
a one-size-fits-all approach that would be wrong for some entity types.
"""

from datetime import datetime
from typing import Optional, Dict, Any


class ConflictStrategy:
    """Enum-like constants for conflict resolution strategies."""
    SERVER_WINS = "server_wins"
    CLIENT_WINS = "client_wins"
    LAST_WRITE_WINS = "last_write_wins"


# Default strategies per entity type.
# Why these defaults?
# - orders: financial data must be authoritative → server wins
# - products: pricing changes are critical → server wins
# - customers: contact info updates are usually local → client wins
# - drafts: user intent matters most → client wins
DEFAULT_STRATEGIES: Dict[str, str] = {
    "orders": ConflictStrategy.SERVER_WINS,
    "products": ConflictStrategy.SERVER_WINS,
    "inventory": ConflictStrategy.SERVER_WINS,
    "invoices": ConflictStrategy.SERVER_WINS,
    "customers": ConflictStrategy.CLIENT_WINS,
    "suppliers": ConflictStrategy.CLIENT_WINS,
    "drafts": ConflictStrategy.CLIENT_WINS,
}


def resolve_conflict(
    entity_type: str,
    server_data: Dict[str, Any],
    client_data: Dict[str, Any],
    strategy: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Resolve a sync conflict between server and client versions.

    Args:
        entity_type: The type of entity being synced.
        server_data: The current server-side data (must include 'updated_at').
        client_data: The client-side data (must include 'updated_at').
        strategy: Override the default strategy for this entity type.

    Returns:
        The winning data dict (either server_data or client_data).

    Why return the entire dict instead of merging?
    Field-level merging is error-prone: two users might change related
    fields (e.g., quantity and total) in incompatible ways. Picking a
    winner at the entity level is simpler, safer, and easier to audit.
    """
    effective_strategy = strategy or DEFAULT_STRATEGIES.get(
        entity_type, ConflictStrategy.SERVER_WINS
    )

    if effective_strategy == ConflictStrategy.SERVER_WINS:
        return server_data

    if effective_strategy == ConflictStrategy.CLIENT_WINS:
        return client_data

    if effective_strategy == ConflictStrategy.LAST_WRITE_WINS:
        server_ts = _parse_timestamp(server_data.get("updated_at"))
        client_ts = _parse_timestamp(client_data.get("updated_at"))

        if server_ts is None and client_ts is None:
            # Both missing timestamps: default to server
            return server_data
        if server_ts is None:
            return client_data
        if client_ts is None:
            return server_data

        # Tie-break: server wins (authoritative)
        return client_data if client_ts > server_ts else server_data

    # Unknown strategy: default to server wins (safest)
    return server_data


def _parse_timestamp(value: Any) -> Optional[datetime]:
    """Parse a timestamp from various formats."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except (ValueError, TypeError):
            return None
    return None
