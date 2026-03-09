"""Unit tests for CustomerDisplayService.

Tests cover:
- Display CRUD (register, list, get, update, soft-delete)
- Heartbeat tracking
- Display config CRUD (create, get, update)
- Not-found / missing-entity edge cases
- kwargs filtering (None values, nonexistent attributes)
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.models.customer_display import CustomerDisplay, DisplayConfig
from app.services.customer_display_service import CustomerDisplayService


# ══════════════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════════════

BIZ = uuid.uuid4()


def _svc():
    db = MagicMock()
    return CustomerDisplayService(db), db


def _chain(first=None, rows=None, count=0):
    """Return a chainable mock that mimics a SQLAlchemy query."""
    q = MagicMock()
    q.filter = MagicMock(return_value=q)
    q.order_by = MagicMock(return_value=q)
    q.offset = MagicMock(return_value=q)
    q.limit = MagicMock(return_value=q)
    q.all = MagicMock(return_value=rows if rows is not None else [])
    q.first = MagicMock(return_value=first)
    q.count = MagicMock(return_value=count)
    return q


def _mock_display(**kwargs):
    """Create a mock CustomerDisplay."""
    d = MagicMock(spec=CustomerDisplay)
    d.id = kwargs.get("id", uuid.uuid4())
    d.business_id = kwargs.get("business_id", BIZ)
    d.name = kwargs.get("name", "Front Counter Display")
    d.display_type = kwargs.get("display_type", "tablet")
    d.terminal_id = kwargs.get("terminal_id", None)
    d.status = kwargs.get("status", "offline")
    d.last_seen_at = kwargs.get("last_seen_at", None)
    d.deleted_at = kwargs.get("deleted_at", None)
    return d


def _mock_config(**kwargs):
    """Create a mock DisplayConfig."""
    c = MagicMock(spec=DisplayConfig)
    c.id = kwargs.get("id", uuid.uuid4())
    c.display_id = kwargs.get("display_id", uuid.uuid4())
    c.layout = kwargs.get("layout", "standard")
    c.orientation = kwargs.get("orientation", "landscape")
    c.theme = kwargs.get("theme", None)
    c.features = kwargs.get("features", None)
    c.language = kwargs.get("language", "en")
    return c


# ══════════════════════════════════════════════════════════════════════════════
# register_display
# ══════════════════════════════════════════════════════════════════════════════


class TestRegisterDisplay:
    """Tests for CustomerDisplayService.register_display."""

    def test_register_display_success(self):
        svc, db = _svc()
        result = svc.register_display(
            BIZ, name="Checkout 1", display_type="tablet",
        )
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, CustomerDisplay)
        assert added.name == "Checkout 1"
        assert added.display_type == "tablet"
        assert added.status == "offline"
        assert added.business_id == BIZ
        assert added.terminal_id is None

    def test_register_display_with_terminal_id(self):
        svc, db = _svc()
        result = svc.register_display(
            BIZ, name="Bar Display", display_type="monitor", terminal_id="T-42",
        )
        added = db.add.call_args[0][0]
        assert added.terminal_id == "T-42"

    def test_register_display_generates_uuid(self):
        svc, db = _svc()
        svc.register_display(BIZ, name="D1", display_type="web")
        added = db.add.call_args[0][0]
        assert added.id is not None
        assert isinstance(added.id, uuid.UUID)


# ══════════════════════════════════════════════════════════════════════════════
# list_displays
# ══════════════════════════════════════════════════════════════════════════════


class TestListDisplays:
    """Tests for CustomerDisplayService.list_displays."""

    def test_list_returns_items_and_total(self):
        svc, db = _svc()
        rows = [_mock_display(name="A"), _mock_display(name="B")]
        db.query.return_value = _chain(rows=rows, count=2)

        items, total = svc.list_displays(BIZ)
        assert items == rows
        assert total == 2

    def test_list_empty(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[], count=0)

        items, total = svc.list_displays(BIZ)
        assert items == []
        assert total == 0

    def test_list_pagination_offset_limit(self):
        svc, db = _svc()
        q = _chain(rows=[], count=5)
        db.query.return_value = q

        svc.list_displays(BIZ, page=3, per_page=10)
        q.offset.assert_called_once_with(20)
        q.limit.assert_called_once_with(10)

    def test_list_default_pagination(self):
        svc, db = _svc()
        q = _chain(rows=[], count=0)
        db.query.return_value = q

        svc.list_displays(BIZ)
        q.offset.assert_called_once_with(0)
        q.limit.assert_called_once_with(20)

    def test_list_orders_by_name(self):
        svc, db = _svc()
        q = _chain(rows=[], count=0)
        db.query.return_value = q

        svc.list_displays(BIZ)
        q.order_by.assert_called_once()


# ══════════════════════════════════════════════════════════════════════════════
# get_display
# ══════════════════════════════════════════════════════════════════════════════


class TestGetDisplay:
    """Tests for CustomerDisplayService.get_display."""

    def test_get_display_found(self):
        svc, db = _svc()
        display = _mock_display()
        db.query.return_value = _chain(first=display)

        result = svc.get_display(display.id)
        assert result is display

    def test_get_display_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.get_display(uuid.uuid4())
        assert result is None


# ══════════════════════════════════════════════════════════════════════════════
# update_display
# ══════════════════════════════════════════════════════════════════════════════


class TestUpdateDisplay:
    """Tests for CustomerDisplayService.update_display."""

    def test_update_display_success(self):
        svc, db = _svc()
        display = _mock_display(name="Old Name")
        db.query.return_value = _chain(first=display)

        result = svc.update_display(display.id, name="New Name")
        assert result is display
        assert display.name == "New Name"
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(display)

    def test_update_display_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.update_display(uuid.uuid4(), name="X")
        assert result is None
        db.commit.assert_not_called()

    def test_update_skips_none_values(self):
        svc, db = _svc()
        display = _mock_display(name="Keep Me")
        db.query.return_value = _chain(first=display)

        svc.update_display(display.id, name=None, display_type="monitor")
        # name should not have been set to None
        assert display.name == "Keep Me"
        assert display.display_type == "monitor"

    def test_update_skips_nonexistent_attrs(self):
        svc, db = _svc()
        display = _mock_display()
        db.query.return_value = _chain(first=display)

        svc.update_display(display.id, nonexistent_field="ignored")
        db.commit.assert_called_once()

    def test_update_multiple_fields(self):
        svc, db = _svc()
        display = _mock_display()
        db.query.return_value = _chain(first=display)

        svc.update_display(
            display.id, name="Updated", display_type="web", terminal_id="T-99",
        )
        assert display.name == "Updated"
        assert display.display_type == "web"
        assert display.terminal_id == "T-99"


# ══════════════════════════════════════════════════════════════════════════════
# delete_display
# ══════════════════════════════════════════════════════════════════════════════


class TestDeleteDisplay:
    """Tests for CustomerDisplayService.delete_display."""

    def test_delete_display_success(self):
        svc, db = _svc()
        display = _mock_display()
        db.query.return_value = _chain(first=display)

        result = svc.delete_display(display.id)
        assert result is True
        display.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_delete_display_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.delete_display(uuid.uuid4())
        assert result is False
        db.commit.assert_not_called()


# ══════════════════════════════════════════════════════════════════════════════
# heartbeat
# ══════════════════════════════════════════════════════════════════════════════


class TestHeartbeat:
    """Tests for CustomerDisplayService.heartbeat."""

    def test_heartbeat_sets_online(self):
        svc, db = _svc()
        display = _mock_display(status="offline")
        db.query.return_value = _chain(first=display)

        result = svc.heartbeat(display.id)
        assert result is display
        assert display.status == "online"
        assert display.last_seen_at is not None
        assert display.last_seen_at.tzinfo is not None
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(display)

    def test_heartbeat_updates_last_seen_at(self):
        svc, db = _svc()
        old_ts = datetime(2024, 1, 1, tzinfo=timezone.utc)
        display = _mock_display(last_seen_at=old_ts)
        db.query.return_value = _chain(first=display)

        svc.heartbeat(display.id)
        assert display.last_seen_at != old_ts

    def test_heartbeat_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.heartbeat(uuid.uuid4())
        assert result is None
        db.commit.assert_not_called()


# ══════════════════════════════════════════════════════════════════════════════
# create_config
# ══════════════════════════════════════════════════════════════════════════════


class TestCreateConfig:
    """Tests for CustomerDisplayService.create_config."""

    def test_create_config_defaults(self):
        svc, db = _svc()
        display_id = uuid.uuid4()

        result = svc.create_config(display_id)
        db.add.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once()
        added = db.add.call_args[0][0]
        assert isinstance(added, DisplayConfig)
        assert added.display_id == display_id
        assert added.layout == "standard"
        assert added.orientation == "landscape"
        assert added.theme is None
        assert added.features is None
        assert added.language == "en"

    def test_create_config_custom_values(self):
        svc, db = _svc()
        display_id = uuid.uuid4()
        theme = {"primary": "#FF0000"}
        features = {"show_total": True, "show_items": True}

        svc.create_config(
            display_id,
            layout="compact",
            orientation="portrait",
            theme=theme,
            features=features,
            language="af",
        )
        added = db.add.call_args[0][0]
        assert added.layout == "compact"
        assert added.orientation == "portrait"
        assert added.theme == theme
        assert added.features == features
        assert added.language == "af"

    def test_create_config_generates_uuid(self):
        svc, db = _svc()
        svc.create_config(uuid.uuid4())
        added = db.add.call_args[0][0]
        assert added.id is not None
        assert isinstance(added.id, uuid.UUID)


# ══════════════════════════════════════════════════════════════════════════════
# get_config
# ══════════════════════════════════════════════════════════════════════════════


class TestGetConfig:
    """Tests for CustomerDisplayService.get_config."""

    def test_get_config_found(self):
        svc, db = _svc()
        config = _mock_config()
        db.query.return_value = _chain(first=config)

        result = svc.get_config(config.display_id)
        assert result is config

    def test_get_config_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.get_config(uuid.uuid4())
        assert result is None


# ══════════════════════════════════════════════════════════════════════════════
# update_config
# ══════════════════════════════════════════════════════════════════════════════


class TestUpdateConfig:
    """Tests for CustomerDisplayService.update_config."""

    def test_update_config_success(self):
        svc, db = _svc()
        config = _mock_config(layout="standard")
        db.query.return_value = _chain(first=config)

        result = svc.update_config(config.display_id, layout="compact")
        assert result is config
        assert config.layout == "compact"
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(config)

    def test_update_config_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.update_config(uuid.uuid4(), layout="compact")
        assert result is None
        db.commit.assert_not_called()

    def test_update_config_skips_none_values(self):
        svc, db = _svc()
        config = _mock_config(layout="standard", language="en")
        db.query.return_value = _chain(first=config)

        svc.update_config(config.display_id, layout=None, language="zu")
        assert config.layout == "standard"
        assert config.language == "zu"

    def test_update_config_skips_nonexistent_attrs(self):
        svc, db = _svc()
        config = _mock_config()
        db.query.return_value = _chain(first=config)

        svc.update_config(config.display_id, bogus_field="nope")
        db.commit.assert_called_once()

    def test_update_config_theme_and_features(self):
        svc, db = _svc()
        config = _mock_config()
        db.query.return_value = _chain(first=config)

        new_theme = {"bg": "#000"}
        new_features = {"feedback": True}
        svc.update_config(config.display_id, theme=new_theme, features=new_features)
        assert config.theme == new_theme
        assert config.features == new_features
