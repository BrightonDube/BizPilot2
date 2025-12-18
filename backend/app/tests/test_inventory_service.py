import uuid
from decimal import Decimal

import pytest

from app.models.inventory import InventoryItem, InventoryTransaction, TransactionType
from app.schemas.inventory import InventoryAdjustment, InventoryItemCreate
from app.services.inventory_service import InventoryService


class FakeQuery:
    def __init__(self, items):
        self._items = list(items)
        self._offset = 0
        self._limit = None

    def filter(self, *args, **kwargs):
        return self

    def count(self):
        return len(self._items)

    def order_by(self, *args, **kwargs):
        return self

    def offset(self, n):
        self._offset = n
        return self

    def limit(self, n):
        self._limit = n
        return self

    def all(self):
        items = self._items[self._offset :]
        if self._limit is not None:
            items = items[: self._limit]
        return items

    def first(self):
        return self._items[0] if self._items else None

    def scalar(self):
        # Used by get_inventory_summary() when querying func.sum(...)
        if not self._items:
            return None
        return self._items[0]


class FakeSession:
    def __init__(self, data_by_model=None):
        self.data_by_model = data_by_model or {}
        self.added = []
        self.deleted = []
        self.commits = 0
        self.refreshed = []

    def query(self, model_or_expr):
        return FakeQuery(self.data_by_model.get(model_or_expr, []))

    def add(self, obj):
        if getattr(obj, "id", None) is None:
            try:
                obj.id = uuid.uuid4()
            except Exception:
                pass
        self.added.append(obj)

    def delete(self, obj):
        self.deleted.append(obj)

    def commit(self):
        self.commits += 1

    def refresh(self, obj):
        self.refreshed.append(obj)


@pytest.fixture
def business_id():
    return str(uuid.uuid4())


@pytest.fixture
def product_id():
    return str(uuid.uuid4())


def _make_item(business_id: str, product_id: str, *, qty=10, reorder_point=10, avg_cost=Decimal("2")):
    item = InventoryItem(
        business_id=business_id,
        product_id=product_id,
        quantity_on_hand=qty,
        quantity_reserved=0,
        quantity_incoming=0,
        reorder_point=reorder_point,
        reorder_quantity=50,
        location=None,
        bin_location=None,
        average_cost=avg_cost,
        last_cost=avg_cost,
    )
    item.id = uuid.uuid4()
    return item


def test_get_inventory_items_paginates_and_returns_total(business_id, product_id):
    items = [
        _make_item(business_id, str(uuid.uuid4()), qty=5),
        _make_item(business_id, str(uuid.uuid4()), qty=6),
        _make_item(business_id, str(uuid.uuid4()), qty=7),
    ]
    db = FakeSession(data_by_model={InventoryItem: items})
    svc = InventoryService(db)

    page_items, total = svc.get_inventory_items(business_id=business_id, page=2, per_page=2)

    assert total == 3
    assert len(page_items) == 1


def test_create_inventory_item_adds_and_commits(business_id, product_id):
    db = FakeSession(data_by_model={})
    svc = InventoryService(db)

    created = svc.create_inventory_item(
        business_id,
        InventoryItemCreate(
            product_id=product_id,
            quantity_on_hand=3,
            quantity_reserved=0,
            quantity_incoming=0,
            reorder_point=2,
            reorder_quantity=10,
            location="Main",
            bin_location="A1",
            average_cost=Decimal("5"),
            last_cost=Decimal("5"),
        ),
    )

    assert db.commits >= 1
    assert created.business_id == business_id
    assert str(created.product_id) == product_id


def test_adjust_inventory_raises_when_below_zero(business_id, product_id):
    item = _make_item(business_id, product_id, qty=1)
    db = FakeSession()
    svc = InventoryService(db)

    with pytest.raises(ValueError, match="below zero"):
        svc.adjust_inventory(item, InventoryAdjustment(quantity_change=-2, reason="test"))


def test_adjust_inventory_creates_transaction_and_updates_quantity(business_id, product_id):
    item = _make_item(business_id, product_id, qty=10)
    db = FakeSession()
    svc = InventoryService(db)

    tx = svc.adjust_inventory(
        item,
        InventoryAdjustment(quantity_change=-3, reason="Damage", notes="Broken"),
        user_id=str(uuid.uuid4()),
    )

    assert item.quantity_on_hand == 7
    assert tx.transaction_type == TransactionType.ADJUSTMENT
    assert tx.quantity_before == 10
    assert tx.quantity_after == 7
    assert tx.quantity_change == -3


def test_record_sale_returns_none_when_item_missing(business_id, product_id):
    db = FakeSession(data_by_model={InventoryItem: []})
    svc = InventoryService(db)

    tx = svc.record_sale(product_id=product_id, business_id=business_id, quantity=1, unit_price=Decimal("10"))

    assert tx is None


def test_record_sale_raises_on_insufficient_inventory(business_id, product_id):
    item = _make_item(business_id, product_id, qty=1)

    class OneItemService(InventoryService):
        def get_inventory_by_product(self, _product_id, _business_id):
            return item

    svc = OneItemService(FakeSession())

    with pytest.raises(ValueError, match="Insufficient inventory"):
        svc.record_sale(product_id=product_id, business_id=business_id, quantity=2, unit_price=Decimal("10"))


def test_record_sale_creates_transaction_and_updates_quantity(business_id, product_id, monkeypatch):
    item = _make_item(business_id, product_id, qty=10, avg_cost=Decimal("2"))

    class OneItemService(InventoryService):
        def get_inventory_by_product(self, _product_id, _business_id):
            return item

    db = FakeSession()
    svc = OneItemService(db)

    # Freeze utc_now
    monkeypatch.setattr("app.services.inventory_service.utc_now", lambda: "NOW")

    tx = svc.record_sale(product_id=product_id, business_id=business_id, quantity=4, unit_price=Decimal("10"))

    assert item.quantity_on_hand == 6
    assert item.last_sold_at == "NOW"
    assert tx.transaction_type == TransactionType.SALE
    assert tx.quantity_change == -4
    assert tx.total_cost == Decimal("2") * 4


def test_record_purchase_updates_weighted_average_cost_and_creates_tx(business_id, product_id, monkeypatch):
    item = _make_item(business_id, product_id, qty=10, avg_cost=Decimal("2"))

    class OneItemService(InventoryService):
        def get_inventory_by_product(self, _product_id, _business_id):
            return item

    db = FakeSession()
    svc = OneItemService(db)

    monkeypatch.setattr("app.services.inventory_service.utc_now", lambda: "NOW")

    tx = svc.record_purchase(
        product_id=product_id,
        business_id=business_id,
        quantity=10,
        unit_cost=Decimal("4"),
    )

    assert item.quantity_on_hand == 20
    assert item.last_received_at == "NOW"
    # (10*2 + 10*4) / 20 = 3
    assert item.average_cost == Decimal("3")
    assert item.last_cost == Decimal("4")
    assert tx.transaction_type == TransactionType.PURCHASE
    assert tx.quantity_change == 10
    assert tx.total_cost == Decimal("4") * 10
