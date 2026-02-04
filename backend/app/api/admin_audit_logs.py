"""
SuperAdmin API endpoints for audit log management.

This module provides SuperAdmin-only endpoints for querying audit logs
of subscription and permission changes with filtering and pagination.

Feature: granular-permissions-subscription
Task: 7.3 Implement audit log endpoint
Requirements: 15.5
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, and_

from app.api.deps import require_superadmin, get_db
from app.models.user import User
from app.models.subscription import AuditLog
from app.schemas.subscription import AuditLogSchema

router = APIRouter(
    prefix="/admin/audit-logs",
    tags=["admin-audit-logs"],
    dependencies=[Depends(require_superadmin)]
)


@router.get("", response_model=dict)
async def get_audit_logs(
    business_id: Optional[UUID] = Query(None, description="Filter by business ID"),
    admin_user_id: Optional[UUID] = Query(None, description="Filter by admin user ID"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    limit: int = Query(100, ge=1, le=1000, description="Number of results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    current_user: User = Depends(require_superadmin),
    db=Depends(get_db)
):
    """
    Get audit logs with filtering and pagination.
    
    SuperAdmin only endpoint to query audit logs of all subscription and
    permission changes. Supports filtering by business, admin user, date range,
    and action type.
    
    Query Parameters:
        business_id: Filter logs for specific business
        admin_user_id: Filter logs by admin who made changes
        start_date: Filter logs after this date (inclusive)
        end_date: Filter logs before this date (inclusive)
        action: Filter by action type (e.g., 'subscription_created', 'override_added')
        limit: Maximum number of results (1-1000, default 100)
        offset: Number of results to skip for pagination (default 0)
    
    Returns:
        Dictionary containing:
        - logs: List of AuditLogSchema objects
        - total: Total number of matching logs
        - limit: Applied limit
        - offset: Applied offset
    
    Raises:
        HTTPException 403: If user is not SuperAdmin
    
    Validates: Requirement 15.5
    """
    # Build query with filters
    query = select(AuditLog)
    
    filters = []
    
    if business_id:
        filters.append(AuditLog.business_id == business_id)
    
    if admin_user_id:
        filters.append(AuditLog.admin_user_id == admin_user_id)
    
    if start_date:
        filters.append(AuditLog.created_at >= start_date)
    
    if end_date:
        filters.append(AuditLog.created_at <= end_date)
    
    if action:
        filters.append(AuditLog.action == action)
    
    if filters:
        query = query.where(and_(*filters))
    
    # Get total count
    count_query = select(AuditLog.id)
    if filters:
        count_query = count_query.where(and_(*filters))
    
    count_result = await db.execute(count_query)
    total = len(count_result.all())
    
    # Apply ordering, pagination
    query = query.order_by(AuditLog.created_at.desc())
    query = query.limit(limit).offset(offset)
    
    # Execute query
    result = await db.execute(query)
    logs = result.scalars().all()
    
    # Convert to schemas
    log_schemas = [AuditLogSchema.model_validate(log) for log in logs]
    
    return {
        "logs": log_schemas,
        "total": total,
        "limit": limit,
        "offset": offset,
        "page": (offset // limit) + 1 if limit > 0 else 1,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 1
    }


@router.get("/actions", response_model=List[str])
async def get_audit_log_actions(
    current_user: User = Depends(require_superadmin),
    db=Depends(get_db)
):
    """
    Get list of all unique action types in audit logs.
    
    SuperAdmin only endpoint to retrieve all distinct action types
    that have been logged. Useful for filtering and understanding
    available audit log categories.
    
    Returns:
        List of unique action type strings
    
    Raises:
        HTTPException 403: If user is not SuperAdmin
    """
    from sqlalchemy import distinct
    
    query = select(distinct(AuditLog.action)).order_by(AuditLog.action)
    result = await db.execute(query)
    actions = [row[0] for row in result.all()]
    
    return actions


@router.get("/{log_id}", response_model=AuditLogSchema)
async def get_audit_log_by_id(
    log_id: int,
    current_user: User = Depends(require_superadmin),
    db=Depends(get_db)
):
    """
    Get a specific audit log entry by ID.
    
    SuperAdmin only endpoint to retrieve detailed information
    about a specific audit log entry.
    
    Args:
        log_id: ID of the audit log entry
        current_user: Authenticated SuperAdmin user
        db: Database session
    
    Returns:
        AuditLogSchema with full details
    
    Raises:
        HTTPException 404: If log entry not found
        HTTPException 403: If user is not SuperAdmin
    """
    from fastapi import HTTPException, status
    
    query = select(AuditLog).where(AuditLog.id == log_id)
    result = await db.execute(query)
    log = result.scalar_one_or_none()
    
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audit log entry {log_id} not found"
        )
    
    return AuditLogSchema.model_validate(log)
