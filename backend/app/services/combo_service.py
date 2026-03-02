"""Combo deal service.

Provides CRUD operations for combo deals and their components, plus
pricing and validation logic (Requirement 4 of addons-modifiers spec).

A combo deal bundles multiple products at a discounted price.  Each
component is either a fixed product or a customer-choice slot.  The
service validates selections and calculates savings.

Why combine CRUD, pricing, and validation in one service?
Combo operations are tightly coupled — creating a combo requires
price calculation, and validating a selection requires knowing the
component configuration.  A single service avoids circular imports
and keeps the API layer thin.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.combo import ComboDeal, ComboComponent, ComboComponentType
from app.models.product import Product, ProductCategory


class ComboService:
    """Service for combo deal CRUD, pricing, and validation."""

    TWO_PLACES = Decimal("0.01")

    def __init__(self, db: Session):
        self.db = db

    # ── Combo Deal CRUD ──────────────────────────────────────────

    def get_combos(
        self,
        business_id: str,
        is_active: Optional[bool] = None,
        page: int = 1,
        per_page: int = 20,
    ) -> Tuple[List[ComboDeal], int]:
        """List combo deals with pagination and optional filtering.

        Returns:
            Tuple of (items, total_count) for pagination.
        """
        query = self.db.query(ComboDeal).filter(
            ComboDeal.business_id == business_id,
            ComboDeal.deleted_at.is_(None),
        )
        if is_active is not None:
            query = query.filter(ComboDeal.is_active == is_active)

        total = query.count()
        items = (
            query
            .order_by(ComboDeal.sort_order.asc(), ComboDeal.name.asc())
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )
        return items, total

    def get_combo_by_id(
        self, combo_id: str, business_id: str
    ) -> Optional[ComboDeal]:
        """Get a single combo deal with its components."""
        return (
            self.db.query(ComboDeal)
            .filter(
                ComboDeal.id == combo_id,
                ComboDeal.business_id == business_id,
                ComboDeal.deleted_at.is_(None),
            )
            .first()
        )

    def create_combo(
        self,
        business_id: str,
        name: str,
        display_name: str,
        combo_price: Decimal,
        original_price: Decimal,
        description: Optional[str] = None,
        image_url: Optional[str] = None,
        is_active: bool = True,
        start_date=None,
        end_date=None,
        location_ids: Optional[List[str]] = None,
        sort_order: int = 0,
        components: Optional[List[Dict[str, Any]]] = None,
    ) -> ComboDeal:
        """Create a new combo deal, optionally with components.

        If components are provided, they are created in the same
        transaction to ensure atomicity.
        """
        combo = ComboDeal(
            business_id=business_id,
            name=name,
            display_name=display_name,
            combo_price=combo_price,
            original_price=original_price,
            description=description,
            image_url=image_url,
            is_active=is_active,
            start_date=start_date,
            end_date=end_date,
            location_ids=location_ids,
            sort_order=sort_order,
        )
        self.db.add(combo)
        self.db.flush()  # Get the combo ID before creating components

        if components:
            for comp_data in components:
                component = ComboComponent(
                    combo_deal_id=combo.id,
                    name=comp_data["name"],
                    component_type=comp_data["component_type"],
                    fixed_product_id=comp_data.get("fixed_product_id"),
                    allowed_category_ids=comp_data.get("allowed_category_ids"),
                    allowed_product_ids=comp_data.get("allowed_product_ids"),
                    quantity=comp_data.get("quantity", 1),
                    sort_order=comp_data.get("sort_order", 0),
                    allow_modifiers=comp_data.get("allow_modifiers", True),
                )
                self.db.add(component)

        self.db.commit()
        self.db.refresh(combo)
        return combo

    def update_combo(
        self, combo_id: str, business_id: str, **kwargs: Any
    ) -> Optional[ComboDeal]:
        """Update a combo deal.  Only provided fields are changed."""
        combo = self.get_combo_by_id(combo_id, business_id)
        if not combo:
            return None
        for field, value in kwargs.items():
            if hasattr(combo, field):
                setattr(combo, field, value)
        self.db.commit()
        self.db.refresh(combo)
        return combo

    def delete_combo(
        self, combo_id: str, business_id: str
    ) -> Optional[ComboDeal]:
        """Soft-delete a combo deal."""
        combo = self.get_combo_by_id(combo_id, business_id)
        if not combo:
            return None
        combo.soft_delete()
        self.db.commit()
        return combo

    def get_active_combos_by_location(
        self, business_id: str, location_id: Optional[str] = None
    ) -> List[ComboDeal]:
        """Get all active combo deals, optionally filtered by location.

        Combos with NULL location_ids are available at all locations.
        Combos with a non-null location_ids array are only available if
        the given location_id is in the array.
        """
        query = self.db.query(ComboDeal).filter(
            ComboDeal.business_id == business_id,
            ComboDeal.is_active.is_(True),
            ComboDeal.deleted_at.is_(None),
        )
        combos = query.order_by(ComboDeal.sort_order.asc()).all()

        if location_id is None:
            return combos

        # Filter client-side because ARRAY contains queries vary by driver.
        # The combo list is typically small (<50) so this is acceptable.
        return [
            c for c in combos
            if c.location_ids is None or location_id in [str(lid) for lid in c.location_ids]
        ]

    # ── Combo Component CRUD ─────────────────────────────────────

    def get_combo_components(self, combo_id: str) -> List[ComboComponent]:
        """Get all components for a combo deal."""
        return (
            self.db.query(ComboComponent)
            .filter(
                ComboComponent.combo_deal_id == combo_id,
                ComboComponent.deleted_at.is_(None),
            )
            .order_by(ComboComponent.sort_order.asc())
            .all()
        )

    def add_combo_component(
        self,
        combo_id: str,
        name: str,
        component_type: str,
        fixed_product_id: Optional[str] = None,
        allowed_category_ids: Optional[List[str]] = None,
        allowed_product_ids: Optional[List[str]] = None,
        quantity: int = 1,
        sort_order: int = 0,
        allow_modifiers: bool = True,
    ) -> ComboComponent:
        """Add a component to a combo deal."""
        # Verify the combo exists
        combo = (
            self.db.query(ComboDeal)
            .filter(ComboDeal.id == combo_id, ComboDeal.deleted_at.is_(None))
            .first()
        )
        if not combo:
            raise ValueError("Combo deal not found")

        component = ComboComponent(
            combo_deal_id=combo_id,
            name=name,
            component_type=component_type,
            fixed_product_id=fixed_product_id,
            allowed_category_ids=allowed_category_ids,
            allowed_product_ids=allowed_product_ids,
            quantity=quantity,
            sort_order=sort_order,
            allow_modifiers=allow_modifiers,
        )
        self.db.add(component)
        self.db.commit()
        self.db.refresh(component)
        return component

    def update_combo_component(
        self, component_id: str, **kwargs: Any
    ) -> Optional[ComboComponent]:
        """Update a combo component."""
        component = (
            self.db.query(ComboComponent)
            .filter(
                ComboComponent.id == component_id,
                ComboComponent.deleted_at.is_(None),
            )
            .first()
        )
        if not component:
            return None
        for field, value in kwargs.items():
            if hasattr(component, field):
                setattr(component, field, value)
        self.db.commit()
        self.db.refresh(component)
        return component

    def remove_combo_component(self, component_id: str) -> bool:
        """Soft-delete a combo component."""
        component = (
            self.db.query(ComboComponent)
            .filter(
                ComboComponent.id == component_id,
                ComboComponent.deleted_at.is_(None),
            )
            .first()
        )
        if not component:
            return False
        component.soft_delete()
        self.db.commit()
        return True

    # ── Pricing ──────────────────────────────────────────────────

    def calculate_combo_price(self, combo: ComboDeal) -> Decimal:
        """Get the combo's selling price.

        The combo_price is stored on the ComboDeal itself.  This method
        exists for interface consistency with the pricing service pattern.
        """
        return Decimal(str(combo.combo_price)).quantize(
            self.TWO_PLACES, rounding=ROUND_HALF_UP
        )

    def calculate_savings(self, combo: ComboDeal) -> Decimal:
        """Calculate savings = original_price - combo_price.

        Used by the frontend to display "Save R30!" messaging.
        """
        savings = Decimal(str(combo.original_price)) - Decimal(str(combo.combo_price))
        return max(savings, Decimal("0.00")).quantize(
            self.TWO_PLACES, rounding=ROUND_HALF_UP
        )

    # ── Validation ───────────────────────────────────────────────

    def validate_combo_selection(
        self,
        combo_id: str,
        component_selections: List[Dict[str, str]],
    ) -> Tuple[bool, List[str]]:
        """Validate that a customer's combo selections are valid.

        Each component_selection dict must contain:
        - component_id: str (the combo component being fulfilled)
        - selected_product_id: str (the product chosen for this slot)

        Returns:
            Tuple of (is_valid, list_of_error_messages).
        """
        errors: List[str] = []

        components = self.get_combo_components(combo_id)
        if not components:
            errors.append("Combo has no components configured.")
            return False, errors

        component_map = {str(c.id): c for c in components}

        # Check all components are fulfilled
        selected_component_ids = {s["component_id"] for s in component_selections}
        for comp in components:
            if str(comp.id) not in selected_component_ids:
                errors.append(f"Missing selection for component '{comp.name}'.")

        # Validate each selection
        for sel in component_selections:
            comp_id = sel["component_id"]
            product_id = sel["selected_product_id"]
            component = component_map.get(comp_id)

            if component is None:
                errors.append(f"Unknown component ID: {comp_id}")
                continue

            if component.component_type == ComboComponentType.FIXED.value:
                # Fixed components must use the designated product
                if component.fixed_product_id and str(component.fixed_product_id) != product_id:
                    errors.append(
                        f"Component '{component.name}' requires product "
                        f"{component.fixed_product_id}, got {product_id}."
                    )
            elif component.component_type == ComboComponentType.CHOICE.value:
                # Choice components: verify the product is in the allowed list
                if not self._is_product_allowed(component, product_id):
                    errors.append(
                        f"Product {product_id} is not allowed for "
                        f"component '{component.name}'."
                    )

        return len(errors) == 0, errors

    def _is_product_allowed(
        self, component: ComboComponent, product_id: str
    ) -> bool:
        """Check if a product is allowed for a choice-type component.

        A product is allowed if it's in allowed_product_ids, or if its
        category is in allowed_category_ids.
        """
        # Check direct product allowlist
        if component.allowed_product_ids:
            if product_id in [str(pid) for pid in component.allowed_product_ids]:
                return True

        # Check category allowlist
        if component.allowed_category_ids:
            product = (
                self.db.query(Product)
                .filter(Product.id == product_id)
                .first()
            )
            if product and product.category_id:
                if str(product.category_id) in [str(cid) for cid in component.allowed_category_ids]:
                    return True

        return False
