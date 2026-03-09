"""Unit tests for PMSService."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.services.pms_service import PMSService


BIZ = uuid4()
CONN = uuid4()
USR = uuid4()
CHG = uuid4()


def _svc():
    db = MagicMock()
    return PMSService(db), db


def _chain(first=None, rows=None, count=0):
    c = MagicMock()
    c.filter.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    return c


# ── Connections ──────────────────────────────────────────────────────


class TestConnections:
    def test_create(self):
        svc, db = _svc()
        svc.create_connection(BIZ, "opera", "Hotel PMS", "https://pms.example.com")
        assert db.add.call_count >= 2  # connection + audit log
        db.commit.assert_called()

    def test_get(self):
        svc, db = _svc()
        conn = MagicMock()
        db.query.return_value = _chain(first=conn)
        assert svc.get_connection(BIZ, CONN) == conn

    def test_get_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.get_connection(BIZ, CONN) is None

    def test_list(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[MagicMock()], count=1)
        items, total = svc.list_connections(BIZ)
        assert total == 1

    def test_update(self):
        svc, db = _svc()
        conn = MagicMock()
        db.query.return_value = _chain(first=conn)
        result = svc.update_connection(BIZ, CONN, host_url="https://new.example.com")
        assert result == conn
        assert db.add.call_count >= 1  # audit log

    def test_update_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.update_connection(BIZ, CONN, host_url="x") is None

    def test_delete(self):
        svc, db = _svc()
        conn = MagicMock()
        db.query.return_value = _chain(first=conn)
        assert svc.delete_connection(BIZ, CONN) is True
        conn.soft_delete.assert_called_once()

    def test_delete_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.delete_connection(BIZ, CONN) is False


# ── Charges ──────────────────────────────────────────────────────────


class TestCharges:
    def test_create(self):
        svc, db = _svc()
        svc.create_charge(BIZ, CONN, "101", Decimal("250.00"))
        assert db.add.call_count >= 2  # charge + audit
        db.commit.assert_called()

    def test_get(self):
        svc, db = _svc()
        chg = MagicMock()
        db.query.return_value = _chain(first=chg)
        assert svc.get_charge(BIZ, CHG) == chg

    def test_list(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[MagicMock()], count=3)
        items, total = svc.list_charges(BIZ)
        assert total == 3

    def test_list_with_filters(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.list_charges(BIZ, connection_id=CONN, status="pending")
        assert chain.filter.call_count >= 1


# ── Reversals ────────────────────────────────────────────────────────


class TestReversals:
    def test_create_reversal(self):
        svc, db = _svc()
        charge = MagicMock()
        charge.status = "posted"
        charge.connection_id = CONN
        db.query.return_value = _chain(first=charge)
        result = svc.create_reversal(BIZ, CHG, "Wrong room")
        assert result is not None
        db.commit.assert_called()

    def test_reversal_not_posted(self):
        svc, db = _svc()
        charge = MagicMock()
        charge.status = "pending"
        db.query.return_value = _chain(first=charge)
        assert svc.create_reversal(BIZ, CHG, "reason") is None

    def test_reversal_charge_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.create_reversal(BIZ, CHG, "reason") is None


# ── Guest search ─────────────────────────────────────────────────────


class TestGuests:
    def test_search(self):
        svc, db = _svc()
        guest = MagicMock()
        db.query.return_value = _chain(rows=[guest])
        items, total = svc.search_guests(CONN, search="Smith")
        assert total == 1

    def test_search_by_room(self):
        svc, db = _svc()
        chain = _chain(rows=[])
        db.query.return_value = chain
        svc.search_guests(CONN, room_number="101")
        assert chain.filter.call_count >= 1


# ── Reconciliation ───────────────────────────────────────────────────


class TestReconciliation:
    def test_start(self):
        svc, db = _svc()
        svc.start_reconciliation(BIZ, CONN, date(2025, 1, 15))
        assert db.add.call_count >= 2
        db.commit.assert_called()

    def test_get_session(self):
        svc, db = _svc()
        sess = MagicMock()
        db.query.return_value = _chain(first=sess)
        assert svc.get_reconciliation_session(BIZ, uuid4()) == sess

    def test_resolve_item(self):
        svc, db = _svc()
        item = MagicMock()
        db.query.return_value = _chain(first=item)
        result = svc.resolve_reconciliation_item(uuid4(), "Matched manually")
        assert result.status == "resolved"

    def test_resolve_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.resolve_reconciliation_item(uuid4(), "x") is None


# ── Audit logs ───────────────────────────────────────────────────────


class TestAuditLogs:
    def test_list(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[MagicMock()], count=5)
        items, total = svc.list_audit_logs(BIZ)
        assert total == 5

    def test_list_filtered(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.list_audit_logs(BIZ, entity_type="charge")
        assert chain.filter.call_count >= 1
