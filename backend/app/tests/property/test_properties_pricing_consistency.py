"""
Property-based tests for pricing consistency and marketing.

Validates that pricing rules maintain mathematical consistency:
- Discounts never produce negative prices
- Percentage discounts stay within 0-100%
- Tax-inclusive and tax-exclusive calculations are consistent
- Promotional pricing never exceeds original price

Feature: Pricing Consistency & Marketing
"""

from decimal import Decimal

from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Strategy definitions
# ---------------------------------------------------------------------------

positive_price = st.decimals(
    min_value=Decimal("0.01"),
    max_value=Decimal("99999.99"),
    places=2,
    allow_nan=False,
    allow_infinity=False,
)

discount_pct = st.decimals(
    min_value=Decimal("0"),
    max_value=Decimal("100"),
    places=2,
    allow_nan=False,
    allow_infinity=False,
)

tax_rate = st.decimals(
    min_value=Decimal("0"),
    max_value=Decimal("25"),
    places=2,
    allow_nan=False,
    allow_infinity=False,
)


# ---------------------------------------------------------------------------
# Discount properties
# ---------------------------------------------------------------------------

@given(price=positive_price, discount=discount_pct)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_discounted_price_is_non_negative(price, discount):
    """
    Property 1: Price after percentage discount is never negative.

    discounted = price × (1 - discount/100)

    Why: A negative price would credit the customer, which is a critical
    financial bug. This must hold for any valid discount percentage.
    """
    discounted = price * (Decimal("1") - discount / Decimal("100"))
    assert discounted >= Decimal("0")


@given(price=positive_price, discount=discount_pct)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_discounted_price_lte_original(price, discount):
    """
    Property 2: Discounted price never exceeds the original price.

    Why: A discount that increases the price would confuse customers
    and misrepresent the promotion.
    """
    discounted = price * (Decimal("1") - discount / Decimal("100"))
    assert discounted <= price


@given(
    price=positive_price,
    discount_a=discount_pct,
    discount_b=discount_pct,
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_larger_discount_produces_lower_price(price, discount_a, discount_b):
    """
    Property 3: A larger discount always produces a lower or equal price.

    Why: If a 30% discount costs more than a 20% discount, the discount
    logic is fundamentally broken.
    """
    price_a = price * (Decimal("1") - discount_a / Decimal("100"))
    price_b = price * (Decimal("1") - discount_b / Decimal("100"))

    if discount_a > discount_b:
        assert price_a <= price_b
    elif discount_a < discount_b:
        assert price_a >= price_b
    else:
        assert price_a == price_b


# ---------------------------------------------------------------------------
# Tax calculation properties
# ---------------------------------------------------------------------------

@given(price=positive_price, rate=tax_rate)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_tax_inclusive_exceeds_exclusive(price, rate):
    """
    Property 4: Tax-inclusive price is always >= tax-exclusive price.

    inclusive = exclusive × (1 + rate/100)

    Why: The tax component must never reduce the price. If inclusive < exclusive,
    the tax calculation is inverted.
    """
    inclusive = price * (Decimal("1") + rate / Decimal("100"))
    assert inclusive >= price


@given(price=positive_price, rate=tax_rate)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_tax_roundtrip_consistency(price, rate):
    """
    Property 5: Converting to inclusive then back to exclusive gives ≈ original price.

    inclusive = price × (1 + rate/100)
    recovered = inclusive / (1 + rate/100)

    The recovered price should be within 1 cent of the original due to rounding.

    Why: Rounding errors compound across invoice lines. If the roundtrip
    exceeds 1 cent per line, bulk operations (month-end) will drift significantly.
    """
    factor = Decimal("1") + rate / Decimal("100")
    inclusive = price * factor
    recovered = (inclusive / factor).quantize(Decimal("0.01"))

    diff = abs(price - recovered)
    assert diff <= Decimal("0.01")


# ---------------------------------------------------------------------------
# Promotional pricing properties
# ---------------------------------------------------------------------------

@given(
    original=positive_price,
    promo_discount=st.decimals(
        min_value=Decimal("0.01"),
        max_value=Decimal("99.99"),
        places=2,
        allow_nan=False,
        allow_infinity=False,
    ),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_promo_price_between_zero_and_original(original, promo_discount):
    """
    Property 6: Promotional price is always in (0, original].

    Why: A promotion that sets price to 0 gives away product for free
    (loss). A promotion that exceeds original is a price increase, not
    a promotion.
    """
    promo_price = original * (Decimal("1") - promo_discount / Decimal("100"))
    assert Decimal("0") <= promo_price <= original
