"""Modifier pricing service.

Calculates modifier prices using three pricing strategies (Requirement 5
of the addons-modifiers spec):

- **free**: No additional cost.
- **fixed**: Flat additional amount.
- **percentage**: Percentage of the base item price.

Also supports "first N free" and tiered pricing rules for businesses
that want to encourage customisation (e.g. "first 2 toppings free,
R5 each additional").

Why a separate service instead of methods on the Modifier model?
Pricing logic involves business rules that combine data from multiple
models (modifier, product, group configuration).  A service keeps
the model layer thin and the pricing rules testable in isolation.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import List, NamedTuple, Optional


class PricingTier(NamedTuple):
    """A quantity-based pricing tier.

    Applies when the number of selected modifiers falls within
    [min_quantity, max_quantity].  max_quantity of None means "and above".
    """

    min_quantity: int
    max_quantity: Optional[int]
    price_per_item: Decimal


class ModifierPricingService:
    """Stateless service for modifier price calculations.

    All methods are pure functions — they take inputs and return results
    without database access.  This makes them easy to unit test and
    safe to call from any context (sync or async).
    """

    TWO_PLACES = Decimal("0.01")

    @staticmethod
    def calculate_modifier_price(
        pricing_type: str,
        price_value: Decimal,
        base_item_price: Decimal,
        quantity: int = 1,
    ) -> Decimal:
        """Calculate the total price for a modifier selection.

        Args:
            pricing_type: 'free', 'fixed', or 'percentage'.
            price_value: The price amount or percentage value from the
                modifier record.
            base_item_price: The price of the product the modifier is
                being applied to (needed for percentage calculations).
            quantity: How many of this modifier are selected.

        Returns:
            The total additional cost, rounded to 2 decimal places.

        Raises:
            ValueError: If pricing_type is not recognised.
        """
        if pricing_type == "free":
            return Decimal("0.00")

        if pricing_type == "fixed":
            total = price_value * quantity
        elif pricing_type == "percentage":
            # price_value is stored as a percentage (e.g. 10 = 10%).
            per_unit = (base_item_price * price_value / Decimal("100"))
            total = per_unit * quantity
        else:
            raise ValueError(f"Unknown pricing_type: {pricing_type!r}")

        return total.quantize(ModifierPricingService.TWO_PLACES, rounding=ROUND_HALF_UP)

    @staticmethod
    def calculate_total_modifier_price(
        selections: List[dict],
        base_item_price: Decimal,
    ) -> Decimal:
        """Calculate the combined price for a list of modifier selections.

        Each selection dict must contain:
        - pricing_type: str
        - price_value: Decimal
        - quantity: int (defaults to 1)

        Nested selections are handled recursively if a 'nested_selections'
        key is present.

        Args:
            selections: List of modifier selection dicts.
            base_item_price: Base product price for percentage calculations.

        Returns:
            Total price for all selections, rounded to 2 decimal places.
        """
        total = Decimal("0.00")
        for sel in selections:
            total += ModifierPricingService.calculate_modifier_price(
                pricing_type=sel.get("pricing_type", "free"),
                price_value=Decimal(str(sel.get("price_value", 0))),
                base_item_price=base_item_price,
                quantity=sel.get("quantity", 1),
            )
            # Recurse into nested modifier selections
            nested = sel.get("nested_selections", [])
            if nested:
                total += ModifierPricingService.calculate_total_modifier_price(
                    nested, base_item_price
                )
        return total.quantize(ModifierPricingService.TWO_PLACES, rounding=ROUND_HALF_UP)

    @staticmethod
    def apply_first_n_free_rule(
        quantities: int,
        free_count: int,
        price_per_additional: Decimal,
    ) -> Decimal:
        """Apply "first N free" pricing rule.

        Common in restaurants: "First 2 toppings free, R5 each after."

        Args:
            quantities: Total number of modifiers selected.
            free_count: How many are included at no charge.
            price_per_additional: Price for each modifier beyond free_count.

        Returns:
            Total additional charge.
        """
        if quantities <= free_count:
            return Decimal("0.00")
        chargeable = quantities - free_count
        total = price_per_additional * chargeable
        return total.quantize(ModifierPricingService.TWO_PLACES, rounding=ROUND_HALF_UP)

    @staticmethod
    def apply_tiered_pricing(
        quantity: int,
        tiers: List[PricingTier],
    ) -> Decimal:
        """Apply tiered pricing based on quantity selected.

        Example tiers:
        - 1-2 items: R10 each
        - 3-5 items: R8 each
        - 6+: R5 each

        Tiers must be sorted by min_quantity ascending.  The tier whose
        range contains the given quantity is applied.

        Args:
            quantity: Number of modifiers selected.
            tiers: Sorted list of PricingTier tuples.

        Returns:
            Total price based on the matching tier.

        Raises:
            ValueError: If no tier matches the given quantity.
        """
        for tier in tiers:
            if tier.min_quantity <= quantity and (
                tier.max_quantity is None or quantity <= tier.max_quantity
            ):
                total = tier.price_per_item * quantity
                return total.quantize(
                    ModifierPricingService.TWO_PLACES, rounding=ROUND_HALF_UP
                )
        raise ValueError(
            f"No pricing tier matches quantity={quantity}. "
            f"Check tier configuration."
        )
