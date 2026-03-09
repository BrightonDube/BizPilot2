import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.services.bulk_template_service import BulkTemplateService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _chain(first=None, rows=None, count=0):
    """Helper to mock SQLAlchemy query chains."""
    c = MagicMock()
    c.filter.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    return c


BIZ_ID = str(uuid.uuid4())
USER_ID = str(uuid.uuid4())
TPL_ID = str(uuid.uuid4())


@pytest.fixture
def db():
    return MagicMock()


@pytest.fixture
def service(db):
    return BulkTemplateService(db)


# ---------------------------------------------------------------------------
# create_template
# ---------------------------------------------------------------------------

class TestCreateTemplate:
    def test_creates_with_all_params(self, service, db):
        """Template is created with all provided parameters."""
        data = {"field_map": {"A": "name"}}
        result = service.create_template(
            name="My Template",
            operation_type="product_import",
            template_data=data,
            business_id=BIZ_ID,
            created_by=USER_ID,
            description="A test template",
            is_system_template=False,
        )

        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(result)
        assert result.name == "My Template"
        assert result.operation_type == "product_import"
        assert result.template_data == data
        assert result.business_id == BIZ_ID
        assert result.created_by == USER_ID
        assert result.description == "A test template"
        assert result.is_system_template is False

    def test_creates_with_optional_params_none(self, service, db):
        """Optional params default to None / False."""
        result = service.create_template(
            name="Minimal",
            operation_type="expense_import",
            template_data={"cols": []},
        )

        db.add.assert_called_once()
        db.commit.assert_called_once()
        assert result.business_id is None
        assert result.created_by is None
        assert result.description is None
        assert result.is_system_template is False


# ---------------------------------------------------------------------------
# get_template
# ---------------------------------------------------------------------------

class TestGetTemplate:
    def test_returns_found_template(self, service, db):
        """Returns template when it exists and is not soft-deleted."""
        tpl = MagicMock()
        db.query.return_value = _chain(first=tpl)

        result = service.get_template(TPL_ID)
        assert result is tpl

    def test_returns_none_when_not_found(self, service, db):
        """Returns None when template does not exist."""
        db.query.return_value = _chain(first=None)

        result = service.get_template(TPL_ID)
        assert result is None


# ---------------------------------------------------------------------------
# list_templates
# ---------------------------------------------------------------------------

class TestListTemplates:
    def test_returns_items_and_total(self, service, db):
        """Returns matching templates and total count."""
        tpl1, tpl2 = MagicMock(), MagicMock()
        tpl1.name = "A"
        tpl2.name = "B"
        db.query.return_value = _chain(rows=[tpl1, tpl2], count=2)

        items, total = service.list_templates(BIZ_ID)
        assert items == [tpl1, tpl2]
        assert total == 2

    def test_filters_by_operation_type(self, service, db):
        """Adds an extra filter when operation_type is provided."""
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        service.list_templates(BIZ_ID, operation_type="product_import")

        # Initial filter + operation_type filter = 2 filter calls
        assert chain.filter.call_count == 2

    def test_pagination_offset_limit(self, service, db):
        """Applies correct offset and limit for pagination."""
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        service.list_templates(BIZ_ID, page=3, per_page=10)

        chain.offset.assert_called_once_with(20)  # (3-1)*10
        chain.limit.assert_called_once_with(10)

    def test_empty_results(self, service, db):
        """Returns empty list and zero total when nothing matches."""
        db.query.return_value = _chain(rows=[], count=0)

        items, total = service.list_templates(BIZ_ID)
        assert items == []
        assert total == 0


# ---------------------------------------------------------------------------
# update_template
# ---------------------------------------------------------------------------

class TestUpdateTemplate:
    def test_updates_name_only(self, service, db):
        """Only name is updated when other params are None."""
        tpl = MagicMock()
        tpl.name = "Old"
        tpl.description = "Old desc"
        tpl.template_data = {"old": True}
        db.query.return_value = _chain(first=tpl)

        result = service.update_template(TPL_ID, name="New")

        assert result is tpl
        assert tpl.name == "New"
        # Unchanged fields should remain as-is
        assert tpl.description == "Old desc"
        assert tpl.template_data == {"old": True}
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(tpl)

    def test_updates_all_fields(self, service, db):
        """All provided fields are updated."""
        tpl = MagicMock()
        db.query.return_value = _chain(first=tpl)

        new_data = {"field": "value"}
        result = service.update_template(
            TPL_ID,
            name="Updated",
            description="Updated desc",
            template_data=new_data,
        )

        assert result is tpl
        assert tpl.name == "Updated"
        assert tpl.description == "Updated desc"
        assert tpl.template_data == new_data
        db.commit.assert_called_once()

    def test_returns_none_when_not_found(self, service, db):
        """Returns None when template does not exist."""
        db.query.return_value = _chain(first=None)

        result = service.update_template(TPL_ID, name="X")
        assert result is None
        db.commit.assert_not_called()


# ---------------------------------------------------------------------------
# delete_template
# ---------------------------------------------------------------------------

class TestDeleteTemplate:
    def test_soft_deletes_and_commits(self, service, db):
        """Calls soft_delete() and commits the session."""
        tpl = MagicMock()
        db.query.return_value = _chain(first=tpl)

        result = service.delete_template(TPL_ID)

        assert result is True
        tpl.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_returns_false_when_not_found(self, service, db):
        """Returns False when template does not exist."""
        db.query.return_value = _chain(first=None)

        result = service.delete_template(TPL_ID)
        assert result is False
        db.commit.assert_not_called()
