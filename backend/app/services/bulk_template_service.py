"""Service for managing reusable bulk operation templates.

Templates allow users to save field mappings, validation rules, and
default values for repeated import/export operations.  System templates
(is_system_template=True) are shared across all businesses, while
user-created templates are scoped to a single business.
"""

import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.bulk_operation import BulkTemplate

logger = logging.getLogger(__name__)


class BulkTemplateService:
    """CRUD service for bulk operation templates."""

    def __init__(self, db: Session):
        self.db = db

    def create_template(
        self,
        *,
        name: str,
        operation_type: str,
        template_data: Dict[str, Any],
        business_id: Optional[str] = None,
        created_by: Optional[str] = None,
        description: Optional[str] = None,
        is_system_template: bool = False,
    ) -> BulkTemplate:
        """Create a new template."""
        template = BulkTemplate(
            id=uuid.uuid4(),
            name=name,
            operation_type=operation_type,
            template_data=template_data,
            business_id=business_id,
            created_by=created_by,
            description=description,
            is_system_template=is_system_template,
        )
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        return template

    def get_template(self, template_id: str) -> Optional[BulkTemplate]:
        """Get a template by ID."""
        return self.db.query(BulkTemplate).filter(
            and_(
                BulkTemplate.id == template_id,
                BulkTemplate.deleted_at.is_(None),
            )
        ).first()

    def list_templates(
        self,
        business_id: str,
        *,
        operation_type: Optional[str] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[BulkTemplate], int]:
        """List templates visible to a business.

        Returns both business-specific and system templates.
        """
        query = self.db.query(BulkTemplate).filter(
            and_(
                BulkTemplate.deleted_at.is_(None),
                # Show templates belonging to this business OR system templates
                (BulkTemplate.business_id == business_id) | (BulkTemplate.is_system_template),
            )
        )

        if operation_type:
            query = query.filter(BulkTemplate.operation_type == operation_type)

        total = query.count()
        items = (
            query.order_by(BulkTemplate.name)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def update_template(
        self,
        template_id: str,
        *,
        name: Optional[str] = None,
        description: Optional[str] = None,
        template_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[BulkTemplate]:
        """Update an existing template.  Returns None if not found."""
        template = self.get_template(template_id)
        if not template:
            return None

        if name is not None:
            template.name = name
        if description is not None:
            template.description = description
        if template_data is not None:
            template.template_data = template_data

        self.db.commit()
        self.db.refresh(template)
        return template

    def delete_template(self, template_id: str) -> bool:
        """Soft-delete a template.  Returns False if not found."""
        template = self.get_template(template_id)
        if not template:
            return False

        template.soft_delete()
        self.db.commit()
        return True
