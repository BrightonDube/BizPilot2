"""Addon / modifier-group service."""

from typing import Any, List, Optional

from sqlalchemy.orm import Session

from app.models.addon import ProductModifierGroup, SelectionType
from app.models.menu import Modifier, ModifierGroup


class AddonService:
    """Service for product addon and modifier operations."""

    def __init__(self, db: Session):
        self.db = db

    # ── Modifier Groups ──────────────────────────────────────────

    def create_modifier_group(
        self,
        business_id: str,
        name: str,
        selection_type: str = SelectionType.SINGLE,
        is_required: bool = False,
        min_selections: int = 0,
        max_selections: Optional[int] = None,
        description: Optional[str] = None,
    ) -> ModifierGroup:
        """Create a modifier group."""
        group = ModifierGroup(
            business_id=business_id,
            name=name,
            selection_type=selection_type,
            is_required=is_required,
            min_selections=min_selections,
            max_selections=max_selections,
            description=description,
        )
        self.db.add(group)
        self.db.commit()
        self.db.refresh(group)
        return group

    def list_modifier_groups(self, business_id: str) -> List[ModifierGroup]:
        """List all modifier groups with modifiers for a business."""
        return (
            self.db.query(ModifierGroup)
            .filter(
                ModifierGroup.business_id == business_id,
                ModifierGroup.deleted_at.is_(None),
            )
            .order_by(ModifierGroup.sort_order.asc(), ModifierGroup.name.asc())
            .all()
        )

    def get_modifier_group(
        self, group_id: str, business_id: str
    ) -> Optional[ModifierGroup]:
        """Get a single modifier group with its modifiers."""
        return (
            self.db.query(ModifierGroup)
            .filter(
                ModifierGroup.id == group_id,
                ModifierGroup.business_id == business_id,
                ModifierGroup.deleted_at.is_(None),
            )
            .first()
        )

    def update_modifier_group(
        self, group_id: str, business_id: str, **kwargs: Any
    ) -> Optional[ModifierGroup]:
        """Update a modifier group."""
        group = self.get_modifier_group(group_id, business_id)
        if not group:
            return None
        for field, value in kwargs.items():
            if hasattr(group, field):
                setattr(group, field, value)
        self.db.commit()
        self.db.refresh(group)
        return group

    def delete_modifier_group(
        self, group_id: str, business_id: str
    ) -> Optional[ModifierGroup]:
        """Soft-delete a modifier group."""
        group = self.get_modifier_group(group_id, business_id)
        if not group:
            return None
        group.soft_delete()
        self.db.commit()
        return group

    # ── Modifiers ────────────────────────────────────────────────

    def add_modifier(
        self,
        group_id: str,
        name: str,
        price_adjustment: float = 0,
        is_default: bool = False,
        sort_order: int = 0,
    ) -> Modifier:
        """Add a modifier to a group."""
        group = (
            self.db.query(ModifierGroup)
            .filter(
                ModifierGroup.id == group_id,
                ModifierGroup.deleted_at.is_(None),
            )
            .first()
        )
        if not group:
            raise ValueError("Modifier group not found")

        modifier = Modifier(
            group_id=group_id,
            business_id=str(group.business_id),
            name=name,
            price_adjustment=price_adjustment,
            is_default=is_default,
            sort_order=sort_order,
        )
        self.db.add(modifier)
        self.db.commit()
        self.db.refresh(modifier)
        return modifier

    def update_modifier(
        self, modifier_id: str, **kwargs: Any
    ) -> Optional[Modifier]:
        """Update a modifier."""
        modifier = (
            self.db.query(Modifier)
            .filter(
                Modifier.id == modifier_id,
                Modifier.deleted_at.is_(None),
            )
            .first()
        )
        if not modifier:
            return None
        for field, value in kwargs.items():
            if hasattr(modifier, field):
                setattr(modifier, field, value)
        self.db.commit()
        self.db.refresh(modifier)
        return modifier

    def delete_modifier(self, modifier_id: str) -> Optional[Modifier]:
        """Soft-delete a modifier."""
        modifier = (
            self.db.query(Modifier)
            .filter(
                Modifier.id == modifier_id,
                Modifier.deleted_at.is_(None),
            )
            .first()
        )
        if not modifier:
            return None
        modifier.soft_delete()
        self.db.commit()
        return modifier

    # ── Product ↔ ModifierGroup linking ───────────────────────────

    def assign_group_to_product(
        self,
        product_id: str,
        modifier_group_id: str,
        sort_order: int = 0,
    ) -> ProductModifierGroup:
        """Link a modifier group to a product."""
        existing = (
            self.db.query(ProductModifierGroup)
            .filter(
                ProductModifierGroup.product_id == product_id,
                ProductModifierGroup.modifier_group_id == modifier_group_id,
                ProductModifierGroup.deleted_at.is_(None),
            )
            .first()
        )
        if existing:
            return existing

        link = ProductModifierGroup(
            product_id=product_id,
            modifier_group_id=modifier_group_id,
            sort_order=sort_order,
        )
        self.db.add(link)
        self.db.commit()
        self.db.refresh(link)
        return link

    def remove_group_from_product(
        self, product_id: str, modifier_group_id: str
    ) -> bool:
        """Unlink a modifier group from a product (soft-delete)."""
        link = (
            self.db.query(ProductModifierGroup)
            .filter(
                ProductModifierGroup.product_id == product_id,
                ProductModifierGroup.modifier_group_id == modifier_group_id,
                ProductModifierGroup.deleted_at.is_(None),
            )
            .first()
        )
        if not link:
            return False
        link.soft_delete()
        self.db.commit()
        return True

    def get_product_modifiers(
        self, product_id: str
    ) -> List[ModifierGroup]:
        """Get all modifier groups (with modifiers) for a product."""
        links = (
            self.db.query(ProductModifierGroup)
            .filter(
                ProductModifierGroup.product_id == product_id,
                ProductModifierGroup.deleted_at.is_(None),
            )
            .order_by(ProductModifierGroup.sort_order.asc())
            .all()
        )
        group_ids = [str(link.modifier_group_id) for link in links]
        if not group_ids:
            return []
        return (
            self.db.query(ModifierGroup)
            .filter(
                ModifierGroup.id.in_(group_ids),
                ModifierGroup.deleted_at.is_(None),
            )
            .all()
        )
