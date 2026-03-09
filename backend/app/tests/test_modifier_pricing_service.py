import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

import pytest
from decimal import Decimal

from app.services.modifier_pricing_service import (
    ModifierPricingService,
    PricingTier,
)


# ---------------------------------------------------------------------------
# TestCalculateModifierPrice
# ---------------------------------------------------------------------------
class TestCalculateModifierPrice:
    """Tests for ModifierPricingService.calculate_modifier_price."""

    # -- free pricing type --------------------------------------------------

    def test_free_returns_zero(self):
        result = ModifierPricingService.calculate_modifier_price(
            "free", Decimal("5.00"), Decimal("100.00")
        )
        assert result == Decimal("0.00")

    def test_free_ignores_price_value(self):
        result = ModifierPricingService.calculate_modifier_price(
            "free", Decimal("999.99"), Decimal("50.00"), quantity=10
        )
        assert result == Decimal("0.00")

    # -- fixed pricing type -------------------------------------------------

    def test_fixed_single_quantity(self):
        result = ModifierPricingService.calculate_modifier_price(
            "fixed", Decimal("5.00"), Decimal("100.00")
        )
        assert result == Decimal("5.00")

    def test_fixed_multiple_quantity(self):
        result = ModifierPricingService.calculate_modifier_price(
            "fixed", Decimal("3.50"), Decimal("100.00"), quantity=4
        )
        assert result == Decimal("14.00")

    def test_fixed_zero_price_value(self):
        result = ModifierPricingService.calculate_modifier_price(
            "fixed", Decimal("0.00"), Decimal("100.00"), quantity=5
        )
        assert result == Decimal("0.00")

    def test_fixed_zero_quantity(self):
        result = ModifierPricingService.calculate_modifier_price(
            "fixed", Decimal("10.00"), Decimal("100.00"), quantity=0
        )
        assert result == Decimal("0.00")

    def test_fixed_rounding(self):
        result = ModifierPricingService.calculate_modifier_price(
            "fixed", Decimal("1.333"), Decimal("0"), quantity=3
        )
        assert result == Decimal("4.00")

    # -- percentage pricing type --------------------------------------------

    def test_percentage_basic(self):
        # 10% of R100 = R10
        result = ModifierPricingService.calculate_modifier_price(
            "percentage", Decimal("10"), Decimal("100.00")
        )
        assert result == Decimal("10.00")

    def test_percentage_multiple_quantity(self):
        # 10% of R100 = R10 per unit, ×3 = R30
        result = ModifierPricingService.calculate_modifier_price(
            "percentage", Decimal("10"), Decimal("100.00"), quantity=3
        )
        assert result == Decimal("30.00")

    def test_percentage_rounding(self):
        # 10% of R9.99 = 0.999 → rounds to 1.00 (ROUND_HALF_UP)
        result = ModifierPricingService.calculate_modifier_price(
            "percentage", Decimal("10"), Decimal("9.99")
        )
        assert result == Decimal("1.00")

    def test_percentage_complex_rounding(self):
        # 15% of R7.99 = 1.1985 → rounds to 1.20
        result = ModifierPricingService.calculate_modifier_price(
            "percentage", Decimal("15"), Decimal("7.99")
        )
        assert result == Decimal("1.20")

    def test_percentage_zero_base_price(self):
        result = ModifierPricingService.calculate_modifier_price(
            "percentage", Decimal("50"), Decimal("0.00")
        )
        assert result == Decimal("0.00")

    def test_percentage_zero_price_value(self):
        result = ModifierPricingService.calculate_modifier_price(
            "percentage", Decimal("0"), Decimal("100.00")
        )
        assert result == Decimal("0.00")

    def test_percentage_zero_quantity(self):
        result = ModifierPricingService.calculate_modifier_price(
            "percentage", Decimal("10"), Decimal("100.00"), quantity=0
        )
        assert result == Decimal("0.00")

    def test_percentage_100_percent(self):
        result = ModifierPricingService.calculate_modifier_price(
            "percentage", Decimal("100"), Decimal("49.99")
        )
        assert result == Decimal("49.99")

    # -- unknown pricing type -----------------------------------------------

    def test_unknown_type_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown pricing_type"):
            ModifierPricingService.calculate_modifier_price(
                "bulk", Decimal("5.00"), Decimal("100.00")
            )

    def test_empty_string_type_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown pricing_type"):
            ModifierPricingService.calculate_modifier_price(
                "", Decimal("5.00"), Decimal("100.00")
            )

    # -- return type --------------------------------------------------------

    def test_returns_decimal(self):
        result = ModifierPricingService.calculate_modifier_price(
            "fixed", Decimal("3.50"), Decimal("100.00")
        )
        assert isinstance(result, Decimal)

    def test_free_returns_decimal(self):
        result = ModifierPricingService.calculate_modifier_price(
            "free", Decimal("0"), Decimal("0")
        )
        assert isinstance(result, Decimal)


# ---------------------------------------------------------------------------
# TestCalculateTotalModifierPrice
# ---------------------------------------------------------------------------
class TestCalculateTotalModifierPrice:
    """Tests for ModifierPricingService.calculate_total_modifier_price."""

    def test_empty_selections(self):
        result = ModifierPricingService.calculate_total_modifier_price(
            [], Decimal("100.00")
        )
        assert result == Decimal("0.00")

    def test_single_fixed_selection(self):
        selections = [
            {"pricing_type": "fixed", "price_value": Decimal("5.00"), "quantity": 1}
        ]
        result = ModifierPricingService.calculate_total_modifier_price(
            selections, Decimal("100.00")
        )
        assert result == Decimal("5.00")

    def test_multiple_selections(self):
        selections = [
            {"pricing_type": "fixed", "price_value": Decimal("5.00"), "quantity": 2},
            {"pricing_type": "fixed", "price_value": Decimal("3.00"), "quantity": 1},
        ]
        result = ModifierPricingService.calculate_total_modifier_price(
            selections, Decimal("100.00")
        )
        assert result == Decimal("13.00")

    def test_mixed_pricing_types(self):
        selections = [
            {"pricing_type": "fixed", "price_value": Decimal("5.00"), "quantity": 1},
            {"pricing_type": "percentage", "price_value": Decimal("10"), "quantity": 1},
            {"pricing_type": "free", "price_value": Decimal("0"), "quantity": 1},
        ]
        # fixed: 5.00, percentage: 10% of 100 = 10.00, free: 0
        result = ModifierPricingService.calculate_total_modifier_price(
            selections, Decimal("100.00")
        )
        assert result == Decimal("15.00")

    def test_default_quantity_is_one(self):
        selections = [
            {"pricing_type": "fixed", "price_value": Decimal("7.50")}
        ]
        result = ModifierPricingService.calculate_total_modifier_price(
            selections, Decimal("100.00")
        )
        assert result == Decimal("7.50")

    def test_default_pricing_type_is_free(self):
        selections = [
            {"price_value": Decimal("10.00"), "quantity": 1}
        ]
        result = ModifierPricingService.calculate_total_modifier_price(
            selections, Decimal("100.00")
        )
        assert result == Decimal("0.00")

    def test_default_price_value_is_zero(self):
        selections = [
            {"pricing_type": "fixed", "quantity": 1}
        ]
        result = ModifierPricingService.calculate_total_modifier_price(
            selections, Decimal("100.00")
        )
        assert result == Decimal("0.00")

    def test_price_value_coerced_from_string(self):
        selections = [
            {"pricing_type": "fixed", "price_value": "4.50", "quantity": 2}
        ]
        result = ModifierPricingService.calculate_total_modifier_price(
            selections, Decimal("100.00")
        )
        assert result == Decimal("9.00")

    # -- nested selections --------------------------------------------------

    def test_nested_selections(self):
        selections = [
            {
                "pricing_type": "fixed",
                "price_value": Decimal("5.00"),
                "quantity": 1,
                "nested_selections": [
                    {
                        "pricing_type": "fixed",
                        "price_value": Decimal("2.00"),
                        "quantity": 1,
                    }
                ],
            }
        ]
        result = ModifierPricingService.calculate_total_modifier_price(
            selections, Decimal("100.00")
        )
        assert result == Decimal("7.00")

    def test_deeply_nested_selections(self):
        selections = [
            {
                "pricing_type": "fixed",
                "price_value": Decimal("10.00"),
                "quantity": 1,
                "nested_selections": [
                    {
                        "pricing_type": "fixed",
                        "price_value": Decimal("5.00"),
                        "quantity": 1,
                        "nested_selections": [
                            {
                                "pricing_type": "fixed",
                                "price_value": Decimal("2.00"),
                                "quantity": 1,
                            }
                        ],
                    }
                ],
            }
        ]
        result = ModifierPricingService.calculate_total_modifier_price(
            selections, Decimal("100.00")
        )
        assert result == Decimal("17.00")

    def test_nested_with_percentage(self):
        selections = [
            {
                "pricing_type": "fixed",
                "price_value": Decimal("5.00"),
                "quantity": 1,
                "nested_selections": [
                    {
                        "pricing_type": "percentage",
                        "price_value": Decimal("10"),
                        "quantity": 1,
                    }
                ],
            }
        ]
        # 5.00 + 10% of 100 = 15.00
        result = ModifierPricingService.calculate_total_modifier_price(
            selections, Decimal("100.00")
        )
        assert result == Decimal("15.00")

    def test_empty_nested_selections(self):
        selections = [
            {
                "pricing_type": "fixed",
                "price_value": Decimal("3.00"),
                "quantity": 1,
                "nested_selections": [],
            }
        ]
        result = ModifierPricingService.calculate_total_modifier_price(
            selections, Decimal("100.00")
        )
        assert result == Decimal("3.00")

    def test_multiple_items_with_nested(self):
        selections = [
            {
                "pricing_type": "fixed",
                "price_value": Decimal("5.00"),
                "quantity": 1,
                "nested_selections": [
                    {
                        "pricing_type": "fixed",
                        "price_value": Decimal("1.00"),
                        "quantity": 2,
                    }
                ],
            },
            {
                "pricing_type": "percentage",
                "price_value": Decimal("5"),
                "quantity": 1,
            },
        ]
        # 5.00 + (1.00*2) + 5% of 100 = 5 + 2 + 5 = 12.00
        result = ModifierPricingService.calculate_total_modifier_price(
            selections, Decimal("100.00")
        )
        assert result == Decimal("12.00")

    def test_total_rounding(self):
        # Each 10% of 9.99 = 0.999, two of them = 1.998 → rounds to 2.00
        selections = [
            {"pricing_type": "percentage", "price_value": Decimal("10"), "quantity": 1},
            {"pricing_type": "percentage", "price_value": Decimal("10"), "quantity": 1},
        ]
        result = ModifierPricingService.calculate_total_modifier_price(
            selections, Decimal("9.99")
        )
        assert result == Decimal("2.00")

    def test_returns_decimal(self):
        result = ModifierPricingService.calculate_total_modifier_price(
            [], Decimal("100.00")
        )
        assert isinstance(result, Decimal)


# ---------------------------------------------------------------------------
# TestApplyFirstNFreeRule
# ---------------------------------------------------------------------------
class TestApplyFirstNFreeRule:
    """Tests for ModifierPricingService.apply_first_n_free_rule."""

    def test_all_free(self):
        result = ModifierPricingService.apply_first_n_free_rule(
            quantities=2, free_count=3, price_per_additional=Decimal("5.00")
        )
        assert result == Decimal("0.00")

    def test_exact_boundary_free(self):
        result = ModifierPricingService.apply_first_n_free_rule(
            quantities=3, free_count=3, price_per_additional=Decimal("5.00")
        )
        assert result == Decimal("0.00")

    def test_one_over_free_count(self):
        result = ModifierPricingService.apply_first_n_free_rule(
            quantities=4, free_count=3, price_per_additional=Decimal("5.00")
        )
        assert result == Decimal("5.00")

    def test_several_over_free_count(self):
        result = ModifierPricingService.apply_first_n_free_rule(
            quantities=7, free_count=2, price_per_additional=Decimal("5.00")
        )
        assert result == Decimal("25.00")

    def test_free_count_zero(self):
        result = ModifierPricingService.apply_first_n_free_rule(
            quantities=3, free_count=0, price_per_additional=Decimal("4.00")
        )
        assert result == Decimal("12.00")

    def test_zero_quantities(self):
        result = ModifierPricingService.apply_first_n_free_rule(
            quantities=0, free_count=2, price_per_additional=Decimal("5.00")
        )
        assert result == Decimal("0.00")

    def test_zero_quantities_zero_free(self):
        result = ModifierPricingService.apply_first_n_free_rule(
            quantities=0, free_count=0, price_per_additional=Decimal("5.00")
        )
        assert result == Decimal("0.00")

    def test_rounding(self):
        result = ModifierPricingService.apply_first_n_free_rule(
            quantities=5,
            free_count=2,
            price_per_additional=Decimal("3.333"),
        )
        # 3 × 3.333 = 9.999 → rounds to 10.00 (ROUND_HALF_UP)
        assert result == Decimal("10.00")

    def test_returns_decimal(self):
        result = ModifierPricingService.apply_first_n_free_rule(
            quantities=1, free_count=0, price_per_additional=Decimal("1.00")
        )
        assert isinstance(result, Decimal)


# ---------------------------------------------------------------------------
# TestApplyTieredPricing
# ---------------------------------------------------------------------------
class TestApplyTieredPricing:
    """Tests for ModifierPricingService.apply_tiered_pricing."""

    STANDARD_TIERS = [
        PricingTier(min_quantity=1, max_quantity=2, price_per_item=Decimal("10.00")),
        PricingTier(min_quantity=3, max_quantity=5, price_per_item=Decimal("8.00")),
        PricingTier(min_quantity=6, max_quantity=None, price_per_item=Decimal("5.00")),
    ]

    def test_first_tier(self):
        result = ModifierPricingService.apply_tiered_pricing(1, self.STANDARD_TIERS)
        assert result == Decimal("10.00")

    def test_first_tier_upper_boundary(self):
        result = ModifierPricingService.apply_tiered_pricing(2, self.STANDARD_TIERS)
        assert result == Decimal("20.00")

    def test_middle_tier(self):
        result = ModifierPricingService.apply_tiered_pricing(4, self.STANDARD_TIERS)
        assert result == Decimal("32.00")

    def test_middle_tier_lower_boundary(self):
        result = ModifierPricingService.apply_tiered_pricing(3, self.STANDARD_TIERS)
        assert result == Decimal("24.00")

    def test_middle_tier_upper_boundary(self):
        result = ModifierPricingService.apply_tiered_pricing(5, self.STANDARD_TIERS)
        assert result == Decimal("40.00")

    def test_last_tier_unbounded(self):
        result = ModifierPricingService.apply_tiered_pricing(6, self.STANDARD_TIERS)
        assert result == Decimal("30.00")

    def test_last_tier_large_quantity(self):
        result = ModifierPricingService.apply_tiered_pricing(100, self.STANDARD_TIERS)
        assert result == Decimal("500.00")

    def test_no_matching_tier_raises_value_error(self):
        # quantity=0 doesn't match any tier (min_quantity starts at 1)
        with pytest.raises(ValueError, match="No pricing tier matches quantity=0"):
            ModifierPricingService.apply_tiered_pricing(0, self.STANDARD_TIERS)

    def test_gap_in_tiers_raises_value_error(self):
        gapped_tiers = [
            PricingTier(min_quantity=1, max_quantity=2, price_per_item=Decimal("10.00")),
            PricingTier(min_quantity=5, max_quantity=None, price_per_item=Decimal("5.00")),
        ]
        # quantity=3 falls in the gap
        with pytest.raises(ValueError, match="No pricing tier matches quantity=3"):
            ModifierPricingService.apply_tiered_pricing(3, gapped_tiers)

    def test_empty_tiers_raises_value_error(self):
        with pytest.raises(ValueError, match="No pricing tier matches"):
            ModifierPricingService.apply_tiered_pricing(1, [])

    def test_single_tier_covers_all(self):
        tiers = [
            PricingTier(min_quantity=1, max_quantity=None, price_per_item=Decimal("7.00")),
        ]
        assert ModifierPricingService.apply_tiered_pricing(1, tiers) == Decimal("7.00")
        assert ModifierPricingService.apply_tiered_pricing(50, tiers) == Decimal("350.00")

    def test_rounding(self):
        tiers = [
            PricingTier(
                min_quantity=1, max_quantity=None, price_per_item=Decimal("3.333")
            ),
        ]
        # 3 × 3.333 = 9.999 → rounds to 10.00
        result = ModifierPricingService.apply_tiered_pricing(3, tiers)
        assert result == Decimal("10.00")

    def test_returns_decimal(self):
        result = ModifierPricingService.apply_tiered_pricing(1, self.STANDARD_TIERS)
        assert isinstance(result, Decimal)


# ---------------------------------------------------------------------------
# TestPricingTier
# ---------------------------------------------------------------------------
class TestPricingTier:
    """Verify PricingTier NamedTuple behaves correctly."""

    def test_fields(self):
        tier = PricingTier(
            min_quantity=1, max_quantity=5, price_per_item=Decimal("10.00")
        )
        assert tier.min_quantity == 1
        assert tier.max_quantity == 5
        assert tier.price_per_item == Decimal("10.00")

    def test_none_max_quantity(self):
        tier = PricingTier(
            min_quantity=6, max_quantity=None, price_per_item=Decimal("5.00")
        )
        assert tier.max_quantity is None

    def test_tuple_unpacking(self):
        tier = PricingTier(
            min_quantity=1, max_quantity=10, price_per_item=Decimal("3.00")
        )
        mn, mx, price = tier
        assert mn == 1
        assert mx == 10
        assert price == Decimal("3.00")
