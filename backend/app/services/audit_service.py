"""Audit service for user activity tracking."""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.audit_log import AuditAction, UserAuditLog


class AuditService:
    """Service for audit log operations."""

    def __init__(self, db: Session):
        self.db = db

    def log_action(
        self,
        business_id: str,
        user_id: Optional[str],
        action: AuditAction,
        resource_type: str,
        resource_id: Optional[str] = None,
        description: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> UserAuditLog:
        """Create an audit log entry."""
        entry = UserAuditLog(
            business_id=business_id,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata_json=json.dumps(metadata) if metadata else None,
        )
        self.db.add(entry)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def get_user_activity(
        self,
        business_id: str,
        user_id: Optional[str] = None,
        action: Optional[AuditAction] = None,
        resource_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[UserAuditLog], int]:
        """Get filtered activity logs with pagination."""
        query = (
            self.db.query(UserAuditLog)
            .filter(
                UserAuditLog.business_id == business_id,
                UserAuditLog.deleted_at.is_(None),
            )
        )
        if user_id:
            query = query.filter(UserAuditLog.user_id == user_id)
        if action:
            query = query.filter(UserAuditLog.action == action)
        if resource_type:
            query = query.filter(UserAuditLog.resource_type == resource_type)
        if start_date:
            query = query.filter(UserAuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(UserAuditLog.created_at <= end_date)

        total = query.count()
        items = (
            query.order_by(UserAuditLog.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_login_history(
        self,
        business_id: str,
        user_id: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[UserAuditLog], int]:
        """Get login/logout events."""
        query = (
            self.db.query(UserAuditLog)
            .filter(
                UserAuditLog.business_id == business_id,
                UserAuditLog.action.in_([AuditAction.LOGIN, AuditAction.LOGOUT]),
                UserAuditLog.deleted_at.is_(None),
            )
        )
        if user_id:
            query = query.filter(UserAuditLog.user_id == user_id)

        total = query.count()
        items = (
            query.order_by(UserAuditLog.created_at.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_activity_summary(
        self,
        business_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Summary: actions by type, by user, by resource."""
        base = (
            self.db.query(UserAuditLog)
            .filter(
                UserAuditLog.business_id == business_id,
                UserAuditLog.deleted_at.is_(None),
            )
        )
        if start_date:
            base = base.filter(UserAuditLog.created_at >= start_date)
        if end_date:
            base = base.filter(UserAuditLog.created_at <= end_date)

        # Actions by type
        by_action = (
            base.with_entities(UserAuditLog.action, func.count())
            .group_by(UserAuditLog.action)
            .all()
        )

        # Actions by user
        by_user = (
            base.with_entities(UserAuditLog.user_id, func.count())
            .group_by(UserAuditLog.user_id)
            .all()
        )

        # Actions by resource type
        by_resource = (
            base.with_entities(UserAuditLog.resource_type, func.count())
            .group_by(UserAuditLog.resource_type)
            .all()
        )

        return {
            "by_action": {str(a.value) if hasattr(a, "value") else str(a): c for a, c in by_action},
            "by_user": {str(u) if u else "system": c for u, c in by_user},
            "by_resource": {r: c for r, c in by_resource},
            "total": base.count(),
        }

    def export_activity_csv(
        self,
        business_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """Returns list of dicts for CSV export."""
        query = (
            self.db.query(UserAuditLog)
            .filter(
                UserAuditLog.business_id == business_id,
                UserAuditLog.deleted_at.is_(None),
            )
        )
        if start_date:
            query = query.filter(UserAuditLog.created_at >= start_date)
        if end_date:
            query = query.filter(UserAuditLog.created_at <= end_date)

        rows = query.order_by(UserAuditLog.created_at.desc()).all()
        return [
            {
                "id": str(r.id),
                "user_id": str(r.user_id) if r.user_id else "",
                "action": r.action.value if r.action else "",
                "resource_type": r.resource_type,
                "resource_id": r.resource_id or "",
                "description": r.description or "",
                "ip_address": r.ip_address or "",
                "created_at": r.created_at.isoformat() if r.created_at else "",
            }
            for r in rows
        ]
