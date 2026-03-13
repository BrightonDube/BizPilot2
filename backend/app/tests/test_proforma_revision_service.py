"""Unit tests for ProformaRevisionService.

Tests revision snapshot creation, listing, retrieval, and counting
with auto-incrementing revision numbers.
"""

import os
import uuid
from unittest.mock import MagicMock


os.environ.setdefault("SECRET_KEY", "test-secret-key")

# The service imports ProformaInvoiceRevision from app.models.proforma,
# but the actual model class is ProformaRevision.  Inject a mock so the
# import succeeds without hitting the real module at all.
_MockRevisionModel = MagicMock()

# Pre-patch the symbol on the *real* proforma module so that
# ``from app.models.proforma import ProformaInvoiceRevision`` resolves.
import app.models.proforma as _proforma_mod  # noqa: E402

_proforma_mod.ProformaInvoiceRevision = _MockRevisionModel

from app.services.proforma_revision_service import ProformaRevisionService  # noqa: E402


# ── Helpers ───────────────────────────────────────────────────────────


def _chain(first=None, rows=None, count=0):
    """Build a fluent SQLAlchemy-query mock that supports chaining."""
    chain = MagicMock()
    chain.filter.return_value = chain
    chain.order_by.return_value = chain
    chain.offset.return_value = chain
    chain.limit.return_value = chain
    chain.all.return_value = rows or []
    chain.first.return_value = first
    chain.count.return_value = count
    chain.scalar.return_value = count  # for func.max / func.count queries
    return chain


def _make_revision(**overrides):
    """Build a minimal ProformaInvoiceRevision-like mock."""
    rev = MagicMock()
    rev.id = overrides.get("id", uuid.uuid4())
    rev.proforma_id = overrides.get("proforma_id", uuid.uuid4())
    rev.revision_number = overrides.get("revision_number", 1)
    rev.quote_number = overrides.get("quote_number", "QT-001")
    rev.status = overrides.get("status", "draft")
    rev.subtotal = overrides.get("subtotal", 100.0)
    rev.tax_amount = overrides.get("tax_amount", 15.0)
    rev.total = overrides.get("total", 115.0)
    rev.items_snapshot = overrides.get("items_snapshot", [])
    rev.notes = overrides.get("notes", None)
    rev.terms = overrides.get("terms", None)
    rev.change_summary = overrides.get("change_summary", None)
    rev.created_by = overrides.get("created_by", uuid.uuid4())
    return rev


# ══════════════════════════════════════════════════════════════════════
# create_revision
# ══════════════════════════════════════════════════════════════════════


class TestCreateRevision:
    """Tests for ProformaRevisionService.create_revision."""

    def _setup_db_for_create(self, max_rev_scalar):
        """Return (db, fresh model mock) wired for create_revision."""
        db = MagicMock()
        scalar_chain = _chain()
        scalar_chain.scalar.return_value = max_rev_scalar
        db.query.return_value = scalar_chain
        return db

    def test_creates_first_revision_with_number_one(self):
        """When no revisions exist (scalar→None→0), revision_number should be 1."""
        db = self._setup_db_for_create(max_rev_scalar=None)
        proforma_id = uuid.uuid4()
        created_by = uuid.uuid4()

        _MockRevisionModel.reset_mock()
        instance = MagicMock()
        _MockRevisionModel.return_value = instance

        service = ProformaRevisionService(db)
        service.create_revision(proforma_id=proforma_id, created_by=created_by)

        _MockRevisionModel.assert_called_once()
        kwargs = _MockRevisionModel.call_args[1]
        assert kwargs["revision_number"] == 1
        assert kwargs["proforma_id"] == proforma_id
        assert kwargs["created_by"] == created_by

    def test_increments_revision_number(self):
        """When max existing revision is 3, new revision should be 4."""
        db = self._setup_db_for_create(max_rev_scalar=3)

        _MockRevisionModel.reset_mock()
        _MockRevisionModel.return_value = MagicMock()

        service = ProformaRevisionService(db)
        service.create_revision(proforma_id=uuid.uuid4(), created_by=uuid.uuid4())

        assert _MockRevisionModel.call_args[1]["revision_number"] == 4

    def test_passes_all_optional_params(self):
        """All optional parameters should be forwarded to the model constructor."""
        db = self._setup_db_for_create(max_rev_scalar=None)
        items = [{"desc": "Widget", "qty": 2}]

        _MockRevisionModel.reset_mock()
        _MockRevisionModel.return_value = MagicMock()

        service = ProformaRevisionService(db)
        service.create_revision(
            proforma_id=uuid.uuid4(),
            created_by=uuid.uuid4(),
            quote_number="QT-999",
            status="sent",
            subtotal=200.0,
            tax_amount=30.0,
            total=230.0,
            items_snapshot=items,
            notes="Rush order",
            terms="Net 30",
            change_summary="Updated pricing",
        )

        kwargs = _MockRevisionModel.call_args[1]
        assert kwargs["quote_number"] == "QT-999"
        assert kwargs["status"] == "sent"
        assert kwargs["subtotal"] == 200.0
        assert kwargs["tax_amount"] == 30.0
        assert kwargs["total"] == 230.0
        assert kwargs["items_snapshot"] == items
        assert kwargs["notes"] == "Rush order"
        assert kwargs["terms"] == "Net 30"
        assert kwargs["change_summary"] == "Updated pricing"

    def test_calls_db_add_commit_refresh(self):
        """create_revision must persist via add → commit → refresh."""
        db = self._setup_db_for_create(max_rev_scalar=0)

        _MockRevisionModel.reset_mock()
        instance = MagicMock()
        _MockRevisionModel.return_value = instance

        service = ProformaRevisionService(db)
        result = service.create_revision(proforma_id=uuid.uuid4(), created_by=uuid.uuid4())

        db.add.assert_called_once_with(instance)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(instance)
        assert result is instance


# ══════════════════════════════════════════════════════════════════════
# list_revisions
# ══════════════════════════════════════════════════════════════════════


class TestListRevisions:
    """Tests for ProformaRevisionService.list_revisions."""

    def test_returns_items_and_total(self):
        revisions = [_make_revision(revision_number=2), _make_revision(revision_number=1)]
        db = MagicMock()
        chain = _chain(rows=revisions, count=2)
        db.query.return_value = chain

        service = ProformaRevisionService(db)
        items, total = service.list_revisions(proforma_id=uuid.uuid4())

        assert items == revisions
        assert total == 2

    def test_pagination_offset_limit(self):
        """Page 3 with per_page=5 should offset by 10 and limit 5."""
        db = MagicMock()
        chain = _chain(rows=[], count=25)
        db.query.return_value = chain

        service = ProformaRevisionService(db)
        service.list_revisions(proforma_id=uuid.uuid4(), page=3, per_page=5)

        chain.offset.assert_called_once_with(10)  # (3-1)*5
        chain.limit.assert_called_once_with(5)

    def test_empty_results(self):
        db = MagicMock()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        service = ProformaRevisionService(db)
        items, total = service.list_revisions(proforma_id=uuid.uuid4())

        assert items == []
        assert total == 0


# ══════════════════════════════════════════════════════════════════════
# get_revision
# ══════════════════════════════════════════════════════════════════════


class TestGetRevision:
    """Tests for ProformaRevisionService.get_revision."""

    def test_returns_matching_revision(self):
        rev = _make_revision(revision_number=2)
        db = MagicMock()
        chain = _chain(first=rev)
        db.query.return_value = chain

        service = ProformaRevisionService(db)
        result = service.get_revision(proforma_id=uuid.uuid4(), revision_number=2)

        assert result is rev

    def test_returns_none_when_not_found(self):
        db = MagicMock()
        chain = _chain(first=None)
        db.query.return_value = chain

        service = ProformaRevisionService(db)
        result = service.get_revision(proforma_id=uuid.uuid4(), revision_number=99)

        assert result is None


# ══════════════════════════════════════════════════════════════════════
# get_latest_revision
# ══════════════════════════════════════════════════════════════════════


class TestGetLatestRevision:
    """Tests for ProformaRevisionService.get_latest_revision."""

    def test_returns_most_recent(self):
        latest = _make_revision(revision_number=5)
        db = MagicMock()
        chain = _chain(first=latest)
        db.query.return_value = chain

        service = ProformaRevisionService(db)
        result = service.get_latest_revision(proforma_id=uuid.uuid4())

        assert result is latest

    def test_returns_none_when_no_revisions(self):
        db = MagicMock()
        chain = _chain(first=None)
        db.query.return_value = chain

        service = ProformaRevisionService(db)
        result = service.get_latest_revision(proforma_id=uuid.uuid4())

        assert result is None


# ══════════════════════════════════════════════════════════════════════
# get_revision_count
# ══════════════════════════════════════════════════════════════════════


class TestGetRevisionCount:
    """Tests for ProformaRevisionService.get_revision_count."""

    def test_returns_count(self):
        db = MagicMock()
        chain = _chain(count=7)
        db.query.return_value = chain

        service = ProformaRevisionService(db)
        result = service.get_revision_count(proforma_id=uuid.uuid4())

        assert result == 7

    def test_returns_zero_when_no_revisions(self):
        """When scalar returns None, the `or 0` fallback should yield 0."""
        db = MagicMock()
        chain = _chain()
        chain.scalar.return_value = None
        db.query.return_value = chain

        service = ProformaRevisionService(db)
        result = service.get_revision_count(proforma_id=uuid.uuid4())

        assert result == 0
