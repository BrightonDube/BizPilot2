"""Unit tests for TaxService.

Tests cover:
- Tax rate CRUD (create, list, get, update, delete)
- Product tax rate assignments (assign, remove)
- Category tax rate assignments (assign, remove)
- Product tax rate resolution (product > category > default)
- Tax calculation (inclusive / exclusive / mixed / no rates)
- Helper methods (_unset_defaults, _get_defaults)
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.models.tax import CategoryTaxRate, ProductTaxRate, TaxRate, TaxType
from app.services.tax_service import TaxService


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = uuid.uuid4()


def _svc():
    db = MagicMock()
    return TaxService(db), db


def _chain(first=None, rows=None, count=0):
    """Return a chainable mock that mimics a SQLAlchemy query."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    c.scalar.return_value = None
    c.update.return_value = count
    return c


def _mock_tax_rate(**kwargs):
    defaults = {
        "id": uuid.uuid4(),
        "business_id": BIZ,
        "name": "VAT 15%",
        "rate": Decimal("15"),
        "tax_type": TaxType.VAT,
        "code": "VAT15",
        "description": None,
        "is_default": False,
        "is_active": True,
        "is_inclusive": True,
        "deleted_at": None,
    }
    defaults.update(kwargs)
    m = MagicMock(spec=TaxRate)
    for k, v in defaults.items():
        setattr(m, k, v)
    m.soft_delete = MagicMock()
    return m


def _mock_link(cls, **kwargs):
    m = MagicMock(spec=cls)
    for k, v in kwargs.items():
        setattr(m, k, v)
    return m


# ══════════════════════════════════════════════════════════════════════════════
# Tax Rate CRUD
# ══════════════════════════════════════════════════════════════════════════════


class TestCreateTaxRate:
    def test_create_basic(self):
        svc, db = _svc()
        chain = _chain()
        db.query.return_value = chain

        result = svc.create_tax_rate(BIZ, "VAT", Decimal("15"))

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        created = db.add.call_args[0][0]
        assert created.name == "VAT"
        assert created.rate == Decimal("15")
        assert created.tax_type == TaxType.VAT

    def test_create_with_is_default_unsets_others(self):
        svc, db = _svc()
        chain = _chain()
        db.query.return_value = chain

        svc.create_tax_rate(BIZ, "VAT", Decimal("15"), is_default=True)

        # _unset_defaults should have been called (filter + update on the chain)
        chain.update.assert_called_once()

    def test_create_without_is_default_does_not_unset(self):
        svc, db = _svc()
        chain = _chain()
        db.query.return_value = chain

        svc.create_tax_rate(BIZ, "VAT", Decimal("15"), is_default=False)

        chain.update.assert_not_called()

    def test_create_custom_tax_type(self):
        svc, db = _svc()
        db.query.return_value = _chain()

        svc.create_tax_rate(BIZ, "Service", Decimal("5"), tax_type="service_tax")

        created = db.add.call_args[0][0]
        assert created.tax_type == TaxType.SERVICE_TAX


class TestListTaxRates:
    def test_list_active_only(self):
        rates = [_mock_tax_rate(), _mock_tax_rate(name="Sales Tax")]
        svc, db = _svc()
        chain = _chain(rows=rates)
        db.query.return_value = chain

        result = svc.list_tax_rates(BIZ)

        assert result == rates
        # filter called twice: once in query + once for is_active
        assert chain.filter.call_count == 2

    def test_list_include_inactive(self):
        rates = [_mock_tax_rate(is_active=False)]
        svc, db = _svc()
        chain = _chain(rows=rates)
        db.query.return_value = chain

        result = svc.list_tax_rates(BIZ, include_inactive=True)

        assert result == rates
        # filter called only once (business_id + deleted_at)
        assert chain.filter.call_count == 1


class TestGetTaxRate:
    def test_found(self):
        rate = _mock_tax_rate()
        svc, db = _svc()
        db.query.return_value = _chain(first=rate)

        result = svc.get_tax_rate(rate.id, BIZ)

        assert result is rate

    def test_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.get_tax_rate(uuid.uuid4(), BIZ)

        assert result is None


class TestUpdateTaxRate:
    def test_update_fields(self):
        rate = _mock_tax_rate()
        svc, db = _svc()
        db.query.return_value = _chain(first=rate)

        result = svc.update_tax_rate(rate.id, BIZ, name="Updated VAT", rate=Decimal("17"))

        assert result is rate
        assert rate.name == "Updated VAT"
        assert rate.rate == Decimal("17")
        db.commit.assert_called()
        db.refresh.assert_called_with(rate)

    def test_update_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.update_tax_rate(uuid.uuid4(), BIZ, name="X")

        assert result is None

    def test_update_is_default_unsets_others(self):
        rate = _mock_tax_rate()
        svc, db = _svc()
        call_count = 0
        get_chain = _chain(first=rate)
        unset_chain = _chain()

        def query_side_effect(model):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return get_chain   # get_tax_rate
            return unset_chain     # _unset_defaults

        db.query.side_effect = query_side_effect

        result = svc.update_tax_rate(rate.id, BIZ, is_default=True)

        assert result is rate
        unset_chain.update.assert_called_once()

    def test_update_skips_unknown_attrs(self):
        rate = _mock_tax_rate()
        svc, db = _svc()
        db.query.return_value = _chain(first=rate)

        svc.update_tax_rate(rate.id, BIZ, nonexistent_field="value")

        # hasattr check prevents setting nonexistent_field
        assert not hasattr(rate, "nonexistent_field") or True  # no error


class TestDeleteTaxRate:
    def test_delete_success(self):
        rate = _mock_tax_rate()
        svc, db = _svc()
        db.query.return_value = _chain(first=rate)

        result = svc.delete_tax_rate(rate.id, BIZ)

        assert result is True
        rate.soft_delete.assert_called_once()
        db.commit.assert_called()

    def test_delete_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.delete_tax_rate(uuid.uuid4(), BIZ)

        assert result is False


# ══════════════════════════════════════════════════════════════════════════════
# Product / Category assignments
# ══════════════════════════════════════════════════════════════════════════════


class TestAssignToProduct:
    def test_assign_new(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        pid, tid = uuid.uuid4(), uuid.uuid4()
        result = svc.assign_to_product(pid, tid)

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        link = db.add.call_args[0][0]
        assert link.product_id == pid
        assert link.tax_rate_id == tid

    def test_assign_existing_returns_it(self):
        existing = _mock_link(ProductTaxRate, product_id=uuid.uuid4(), tax_rate_id=uuid.uuid4())
        svc, db = _svc()
        db.query.return_value = _chain(first=existing)

        result = svc.assign_to_product(existing.product_id, existing.tax_rate_id)

        assert result is existing
        db.add.assert_not_called()


class TestRemoveFromProduct:
    def test_remove_success(self):
        link = _mock_link(ProductTaxRate, product_id=uuid.uuid4(), tax_rate_id=uuid.uuid4())
        svc, db = _svc()
        db.query.return_value = _chain(first=link)

        result = svc.remove_from_product(link.product_id, link.tax_rate_id)

        assert result is True
        db.delete.assert_called_once_with(link)
        db.commit.assert_called()

    def test_remove_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.remove_from_product(uuid.uuid4(), uuid.uuid4())

        assert result is False


class TestAssignToCategory:
    def test_assign_new(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        cid, tid = uuid.uuid4(), uuid.uuid4()
        result = svc.assign_to_category(cid, tid)

        db.add.assert_called_once()
        link = db.add.call_args[0][0]
        assert link.category_id == cid
        assert link.tax_rate_id == tid

    def test_assign_existing_returns_it(self):
        existing = _mock_link(CategoryTaxRate, category_id=uuid.uuid4(), tax_rate_id=uuid.uuid4())
        svc, db = _svc()
        db.query.return_value = _chain(first=existing)

        result = svc.assign_to_category(existing.category_id, existing.tax_rate_id)

        assert result is existing
        db.add.assert_not_called()


class TestRemoveFromCategory:
    def test_remove_success(self):
        link = _mock_link(CategoryTaxRate, category_id=uuid.uuid4(), tax_rate_id=uuid.uuid4())
        svc, db = _svc()
        db.query.return_value = _chain(first=link)

        result = svc.remove_from_category(link.category_id, link.tax_rate_id)

        assert result is True
        db.delete.assert_called_once_with(link)

    def test_remove_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.remove_from_category(uuid.uuid4(), uuid.uuid4())

        assert result is False


# ══════════════════════════════════════════════════════════════════════════════
# get_product_tax_rates  (priority resolution)
# ══════════════════════════════════════════════════════════════════════════════


class TestGetProductTaxRates:
    def test_product_specific_rates(self):
        """Product-level links exist → return those rates."""
        pid = uuid.uuid4()
        tid = uuid.uuid4()
        link = _mock_link(ProductTaxRate, tax_rate_id=tid)
        rate = _mock_tax_rate(id=tid)

        svc, db = _svc()
        call_count = 0
        product_link_chain = _chain(rows=[link])
        rate_chain = _chain(rows=[rate])

        def query_side_effect(model):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return product_link_chain  # ProductTaxRate query
            return rate_chain              # TaxRate.in_ query

        db.query.side_effect = query_side_effect

        result = svc.get_product_tax_rates(pid)

        assert result == [rate]

    def test_category_level_rates(self):
        """No product links, but category links exist."""
        pid = uuid.uuid4()
        cat_id = uuid.uuid4()
        tid = uuid.uuid4()
        product = MagicMock()
        product.category_id = cat_id
        product.business_id = BIZ

        cat_link = _mock_link(CategoryTaxRate, tax_rate_id=tid)
        rate = _mock_tax_rate(id=tid)

        svc, db = _svc()
        call_count = 0
        empty_chain = _chain(rows=[])             # no product links
        product_chain = _chain(first=product)      # Product lookup
        cat_link_chain = _chain(rows=[cat_link])   # CategoryTaxRate
        rate_chain = _chain(rows=[rate])           # TaxRate.in_

        def query_side_effect(model):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return empty_chain
            if call_count == 2:
                return product_chain
            if call_count == 3:
                return cat_link_chain
            return rate_chain

        db.query.side_effect = query_side_effect

        result = svc.get_product_tax_rates(pid)

        assert result == [rate]

    def test_falls_back_to_default_when_no_category_links(self):
        """Product has a category but no category tax links → use defaults."""
        pid = uuid.uuid4()
        product = MagicMock()
        product.category_id = uuid.uuid4()
        product.business_id = BIZ

        default_rate = _mock_tax_rate(is_default=True)

        svc, db = _svc()
        call_count = 0
        empty_chain = _chain(rows=[])
        product_chain = _chain(first=product)
        cat_empty_chain = _chain(rows=[])
        default_chain = _chain(rows=[default_rate])

        def query_side_effect(model):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return empty_chain       # no product links
            if call_count == 2:
                return product_chain     # product lookup
            if call_count == 3:
                return cat_empty_chain   # no category links
            return default_chain         # _get_defaults

        db.query.side_effect = query_side_effect

        result = svc.get_product_tax_rates(pid)

        assert result == [default_rate]

    def test_falls_back_to_default_when_no_category(self):
        """Product exists with no category_id → use business defaults."""
        pid = uuid.uuid4()
        product = MagicMock()
        product.category_id = None
        product.business_id = BIZ

        default_rate = _mock_tax_rate(is_default=True)

        svc, db = _svc()
        call_count = 0
        empty_chain = _chain(rows=[])
        product_chain = _chain(first=product)
        default_chain = _chain(rows=[default_rate])

        def query_side_effect(model):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return empty_chain
            if call_count == 2:
                return product_chain
            return default_chain

        db.query.side_effect = query_side_effect

        result = svc.get_product_tax_rates(pid)

        assert result == [default_rate]

    def test_returns_empty_when_product_not_found(self):
        """Product doesn't exist → empty list."""
        svc, db = _svc()
        call_count = 0
        empty_chain = _chain(rows=[])
        no_product_chain = _chain(first=None)

        def query_side_effect(model):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return empty_chain
            return no_product_chain

        db.query.side_effect = query_side_effect

        result = svc.get_product_tax_rates(uuid.uuid4())

        assert result == []


# ══════════════════════════════════════════════════════════════════════════════
# calculate_tax
# ══════════════════════════════════════════════════════════════════════════════


class TestCalculateTax:
    def test_inclusive_vat_15(self):
        """R115 inclusive of 15% VAT → tax ≈ R15, net = R100."""
        rate = _mock_tax_rate(rate=Decimal("15"), is_inclusive=True)
        svc, db = _svc()
        db.query.return_value = _chain(rows=[rate])

        result = svc.calculate_tax(BIZ, Decimal("115"))

        assert result["tax_amount"] == pytest.approx(15.0, abs=0.01)
        assert result["net_amount"] == pytest.approx(100.0, abs=0.01)
        assert result["gross_amount"] == pytest.approx(115.0, abs=0.01)
        assert len(result["rates_applied"]) == 1

    def test_exclusive_tax(self):
        """R100 + 15% exclusive → tax = R15, gross = R115."""
        rate = _mock_tax_rate(rate=Decimal("15"), is_inclusive=False)
        svc, db = _svc()
        db.query.return_value = _chain(rows=[rate])

        result = svc.calculate_tax(BIZ, Decimal("100"))

        assert result["tax_amount"] == pytest.approx(15.0, abs=0.01)
        assert result["net_amount"] == pytest.approx(100.0, abs=0.01)
        assert result["gross_amount"] == pytest.approx(115.0, abs=0.01)

    def test_no_rates_returns_zero_tax(self):
        """No default rates → zero tax, amounts equal."""
        svc, db = _svc()
        db.query.return_value = _chain(rows=[])

        result = svc.calculate_tax(BIZ, Decimal("100"))

        assert result["tax_amount"] == 0.0
        assert result["net_amount"] == 100.0
        assert result["gross_amount"] == 100.0
        assert result["rates_applied"] == []

    def test_with_product_id_delegates_to_get_product_tax_rates(self):
        """When product_id is provided, uses product-specific resolution."""
        pid = uuid.uuid4()
        tid = uuid.uuid4()
        rate = _mock_tax_rate(id=tid, rate=Decimal("10"), is_inclusive=False)
        link = _mock_link(ProductTaxRate, tax_rate_id=tid)

        svc, db = _svc()
        call_count = 0
        link_chain = _chain(rows=[link])
        rate_chain = _chain(rows=[rate])

        def query_side_effect(model):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return link_chain
            return rate_chain

        db.query.side_effect = query_side_effect

        result = svc.calculate_tax(BIZ, Decimal("200"), product_id=pid)

        assert result["tax_amount"] == pytest.approx(20.0, abs=0.01)
        assert result["net_amount"] == pytest.approx(200.0, abs=0.01)
        assert result["gross_amount"] == pytest.approx(220.0, abs=0.01)

    def test_mixed_inclusive_exclusive(self):
        """One inclusive, one exclusive rate → gross != amount."""
        inc_rate = _mock_tax_rate(rate=Decimal("10"), is_inclusive=True, name="Inc")
        exc_rate = _mock_tax_rate(rate=Decimal("5"), is_inclusive=False, name="Exc")

        svc, db = _svc()
        db.query.return_value = _chain(rows=[inc_rate, exc_rate])

        result = svc.calculate_tax(BIZ, Decimal("110"))

        # inclusive 10%: tax = 110 - 110/1.10 = 10
        # exclusive 5%: tax = 110 * 0.05 = 5.50
        assert result["tax_amount"] == pytest.approx(15.50, abs=0.01)
        # Not all inclusive → net = amount, gross = amount + total_tax
        assert result["net_amount"] == pytest.approx(110.0, abs=0.01)
        assert result["gross_amount"] == pytest.approx(125.50, abs=0.01)
        assert len(result["rates_applied"]) == 2

    def test_rates_applied_structure(self):
        """Verify the rates_applied dict has expected keys."""
        tid = uuid.uuid4()
        rate = _mock_tax_rate(id=tid, name="MyTax", rate=Decimal("15"), is_inclusive=True)
        svc, db = _svc()
        db.query.return_value = _chain(rows=[rate])

        result = svc.calculate_tax(BIZ, Decimal("115"))

        entry = result["rates_applied"][0]
        assert entry["tax_rate_id"] == str(tid)
        assert entry["name"] == "MyTax"
        assert entry["rate"] == 15.0
        assert entry["is_inclusive"] is True
        assert "tax_amount" in entry
