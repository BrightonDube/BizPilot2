"""Modifier validation service.

Validates modifier selections against group configuration rules
(Requirements 1.4, 7.1 of the addons-modifiers spec).  Used at cart
add-time to ensure the customer's choices satisfy all constraints
before an order is placed.

Why a separate validation service?
Validation logic is reusable across the POS cart, order creation,
and the mobile sync flow.  Keeping it in a dedicated service avoids
duplicating these rules in multiple places.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.addon import ProductModifierGroup
from app.models.menu import Modifier, ModifierGroup


@dataclass
class ValidationError:
    """A single validation failure for a modifier group."""

    group_id: str
    group_name: str
    message: str
    error_type: str  # 'min_not_met' | 'max_exceeded' | 'required_missing'


@dataclass
class ValidationResult:
    """Outcome of validating modifier selections for a product."""

    is_valid: bool
    errors: List[ValidationError] = field(default_factory=list)


class ModifierValidationService:
    """Validates modifier selections against group rules.

    Operates against the database to fetch group configuration, then
    checks that the provided selections satisfy all constraints.
    """

    def __init__(self, db: Session):
        self.db = db

    def validate_selections(
        self,
        product_id: str,
        selections: Dict[str, List[str]],
    ) -> ValidationResult:
        """Validate all modifier selections for a product.

        Args:
            product_id: The product being added to the cart.
            selections: Dict mapping group_id -> list of modifier_ids.
                Missing groups are treated as empty (no selection).

        Returns:
            ValidationResult with is_valid=True if all constraints pass,
            or is_valid=False with a list of errors.
        """
        errors: List[ValidationError] = []

        # Fetch all modifier groups assigned to this product
        links = (
            self.db.query(ProductModifierGroup)
            .filter(
                ProductModifierGroup.product_id == product_id,
                ProductModifierGroup.deleted_at.is_(None),
            )
            .all()
        )
        group_ids = [str(link.modifier_group_id) for link in links]
        if not group_ids:
            # No modifier groups assigned — any selection is trivially valid
            return ValidationResult(is_valid=True)

        groups = (
            self.db.query(ModifierGroup)
            .filter(
                ModifierGroup.id.in_(group_ids),
                ModifierGroup.deleted_at.is_(None),
            )
            .all()
        )

        for group in groups:
            group_selections = selections.get(str(group.id), [])
            group_errors = self.validate_group_selection(group, group_selections)
            errors.extend(group_errors)

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
        )

    def validate_group_selection(
        self,
        group: ModifierGroup,
        selected_modifier_ids: List[str],
    ) -> List[ValidationError]:
        """Validate selections for a single modifier group.

        Checks:
        1. Required groups must have at least one selection.
        2. Selection count must be >= min_selections.
        3. Selection count must be <= max_selections (if set).

        Args:
            group: The modifier group being validated.
            selected_modifier_ids: List of modifier IDs selected for
                this group.

        Returns:
            List of ValidationError instances (empty if valid).
        """
        errors: List[ValidationError] = []
        count = len(selected_modifier_ids)
        group_id_str = str(group.id)

        # Check required constraint
        if group.is_required and count == 0:
            errors.append(
                ValidationError(
                    group_id=group_id_str,
                    group_name=group.name,
                    message=f"'{group.name}' is required — please make a selection.",
                    error_type="required_missing",
                )
            )

        # Check minimum selections
        if count > 0 and count < group.min_selections:
            errors.append(
                ValidationError(
                    group_id=group_id_str,
                    group_name=group.name,
                    message=(
                        f"'{group.name}' requires at least "
                        f"{group.min_selections} selection(s), got {count}."
                    ),
                    error_type="min_not_met",
                )
            )

        # Check maximum selections (None means unlimited)
        if group.max_selections is not None and count > group.max_selections:
            errors.append(
                ValidationError(
                    group_id=group_id_str,
                    group_name=group.name,
                    message=(
                        f"'{group.name}' allows at most "
                        f"{group.max_selections} selection(s), got {count}."
                    ),
                    error_type="max_exceeded",
                )
            )

        return errors

    def has_required_modifiers(self, product_id: str) -> bool:
        """Check whether a product has any required modifier groups.

        Used to decide whether to show the modifier selection UI before
        adding the product to the cart.
        """
        links = (
            self.db.query(ProductModifierGroup)
            .filter(
                ProductModifierGroup.product_id == product_id,
                ProductModifierGroup.deleted_at.is_(None),
            )
            .all()
        )
        if not links:
            return False

        group_ids = [str(link.modifier_group_id) for link in links]
        required_count = (
            self.db.query(ModifierGroup)
            .filter(
                ModifierGroup.id.in_(group_ids),
                ModifierGroup.deleted_at.is_(None),
                ModifierGroup.is_required.is_(True),
            )
            .count()
        )
        return required_count > 0

    def get_default_selections(
        self, product_id: str
    ) -> Dict[str, List[str]]:
        """Get default modifier selections for a product.

        Returns a dict of group_id -> [modifier_ids] for modifiers
        that are flagged as is_default=True.  Used for "quick add"
        when the customer skips modifier selection.
        """
        links = (
            self.db.query(ProductModifierGroup)
            .filter(
                ProductModifierGroup.product_id == product_id,
                ProductModifierGroup.deleted_at.is_(None),
            )
            .all()
        )
        if not links:
            return {}

        group_ids = [str(link.modifier_group_id) for link in links]
        defaults: Dict[str, List[str]] = {}

        default_modifiers = (
            self.db.query(Modifier)
            .filter(
                Modifier.group_id.in_(group_ids),
                Modifier.deleted_at.is_(None),
                Modifier.is_default.is_(True),
            )
            .all()
        )

        for mod in default_modifiers:
            gid = str(mod.group_id)
            if gid not in defaults:
                defaults[gid] = []
            defaults[gid].append(str(mod.id))

        return defaults
