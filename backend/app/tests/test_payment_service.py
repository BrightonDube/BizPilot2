import uuid
from datetime import date

import pytest

from app.models.invoice import Invoice, InvoiceStatus
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.services.payment_service import PaymentService
from app.schemas.payment import PaymentCreate, PaymentUpdate
from app.models.customer import Customer
from app.models.business_user import BusinessUser


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


class FakeSession:
    def __init__(self, data_by_model=None):
        self.data_by_model = data_by_model or {}
        self.added = []
        self.commits = 0
        self.refreshed = []
        self.deleted = []

    def query(self, model):
        return FakeQuery(self.data_by_model.get(model, []))

    def add(self, obj):
        # Mimic SQLAlchemy default PK assignment (normally happens on flush/commit)
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
def user_id():
    return uuid.uuid4()


@pytest.fixture
def business_id():
    return uuid.uuid4()


def test_generate_payment_number_increments_with_count(business_id):
    db = FakeSession(data_by_model={Payment: [object(), object()]})
    svc = PaymentService(db)

    num = svc._generate_payment_number(business_id)

    assert num.startswith(f"PAY-{date.today().strftime('%Y%m%d')}-")
    assert num.endswith("00003")


def test_get_user_business_id_returns_none_when_not_found(user_id):
    db = FakeSession(data_by_model={BusinessUser: []})
    svc = PaymentService(db)

    assert svc._get_user_business_id(user_id) is None


def test_update_invoice_status_sets_paid_partial_sent(business_id):
    db = FakeSession()
    svc = PaymentService(db)

    invoice = Invoice(
        business_id=business_id,
        customer_id=None,
        order_id=None,
        invoice_number="INV-001",
        total=100,
        amount_paid=0,
        status=InvoiceStatus.SENT,
    )

    invoice.amount_paid = 0
    invoice.status = InvoiceStatus.PAID
    svc._update_invoice_status(invoice)
    assert invoice.status == InvoiceStatus.SENT

    invoice.amount_paid = 20
    svc._update_invoice_status(invoice)
    assert invoice.status == InvoiceStatus.PARTIAL

    invoice.amount_paid = 100
    svc._update_invoice_status(invoice)
    assert invoice.status == InvoiceStatus.PAID


def test_list_payments_returns_empty_when_user_has_no_business(user_id):
    db = FakeSession(data_by_model={BusinessUser: []})
    svc = PaymentService(db)

    items, total = svc.list_payments(user_id=user_id)

    assert items == []
    assert total == 0


def test_list_payments_maps_invoice_and_customer_fields(user_id, business_id):
    invoice_id = uuid.uuid4()
    customer_id = uuid.uuid4()

    bu = BusinessUser(user_id=user_id, business_id=business_id, role_id=uuid.uuid4())
    inv = Invoice(
        business_id=business_id,
        customer_id=customer_id,
        order_id=None,
        invoice_number="INV-123",
        total=100,
        amount_paid=0,
        status=InvoiceStatus.SENT,
    )
    inv.id = invoice_id

    cust = Customer(
        business_id=business_id,
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
    )
    cust.id = customer_id

    p = Payment(
        business_id=business_id,
        payment_number="PAY-001",
        invoice_id=invoice_id,
        customer_id=customer_id,
        amount=50,
        payment_method=PaymentMethod.CASH,
        status=PaymentStatus.COMPLETED,
        payment_date=date.today(),
        reference="ref",
        notes="note",
    )
    p.id = uuid.uuid4()

    db = FakeSession(data_by_model={BusinessUser: [bu], Payment: [p], Invoice: [inv], Customer: [cust]})
    svc = PaymentService(db)

    items, total = svc.list_payments(user_id=user_id)

    assert total == 1
    assert items[0].invoice_number == "INV-123"
    assert items[0].customer_name == "Ada Lovelace"
    assert items[0].payment_method == "cash"
    assert items[0].status == "completed"


def test_create_payment_requires_business(user_id):
    db = FakeSession(data_by_model={BusinessUser: []})
    svc = PaymentService(db)

    with pytest.raises(ValueError, match="not associated with a business"):
        svc.create_payment(PaymentCreate(amount=10), user_id=user_id)


def test_create_payment_updates_invoice_amount_paid_and_status(user_id, business_id, monkeypatch):
    invoice_id = uuid.uuid4()

    bu = BusinessUser(user_id=user_id, business_id=business_id, role_id=uuid.uuid4())

    invoice = Invoice(
        business_id=business_id,
        customer_id=None,
        order_id=None,
        invoice_number="INV-500",
        total=100,
        amount_paid=0,
        status=InvoiceStatus.SENT,
    )
    invoice.id = invoice_id

    db = FakeSession(data_by_model={BusinessUser: [bu], Invoice: [invoice], Payment: []})
    svc = PaymentService(db)

    # Make payment number deterministic
    monkeypatch.setattr(svc, "_generate_payment_number", lambda _business_id: "PAY-FIXED")

    created = svc.create_payment(
        PaymentCreate(
            invoice_id=invoice_id,
            amount=100,
            payment_method="cash",
            payment_date=date.today(),
        ),
        user_id=user_id,
    )

    assert created.payment_number == "PAY-FIXED"
    assert float(invoice.amount_paid) == 100.0
    assert invoice.status == InvoiceStatus.PAID


def test_update_payment_returns_none_when_not_found(user_id, business_id):
    bu = BusinessUser(user_id=user_id, business_id=business_id, role_id=uuid.uuid4())
    db = FakeSession(data_by_model={BusinessUser: [bu], Payment: []})
    svc = PaymentService(db)

    result = svc.update_payment(uuid.uuid4(), PaymentUpdate(notes="x"), user_id=user_id)

    assert result is None


def test_delete_payment_false_when_missing(user_id, business_id):
    bu = BusinessUser(user_id=user_id, business_id=business_id, role_id=uuid.uuid4())
    db = FakeSession(data_by_model={BusinessUser: [bu], Payment: []})
    svc = PaymentService(db)

    assert svc.delete_payment(uuid.uuid4(), user_id=user_id) is False
