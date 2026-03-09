"""Unit tests for PartnerService.

Every test uses MagicMock for the DB session — no real database required.
"""

import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.models.partner import (
    Partner,
    PartnerConfiguration,
    WhiteLabelConfig,
    PartnerUser,
)
from app.services.partner_service import PartnerService

PARTNER_ID = str(uuid.uuid4())
USER_ID = str(uuid.uuid4())
PARTNER_USER_ID = str(uuid.uuid4())
SLUG = "acme-corp"


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def _chain(first=None, rows=None, count=0):
    """Reusable mock that supports the common SQLAlchemy chained-call pattern."""
    c = MagicMock()
    c.filter.return_value = c
    c.join.return_value = c
    c.order_by.return_value = c
    c.offset.return_value = c
    c.limit.return_value = c
    c.all.return_value = rows if rows is not None else []
    c.first.return_value = first
    c.count.return_value = count
    return c


def _svc():
    db = MagicMock()
    return PartnerService(db), db


def _mock_partner(**overrides):
    p = MagicMock(spec=Partner)
    p.id = uuid.UUID(PARTNER_ID)
    p.partner_name = "Acme Corp"
    p.partner_slug = SLUG
    p.status = "active"
    p.deleted_at = None
    p.updated_at = None
    for k, v in overrides.items():
        setattr(p, k, v)
    return p


def _mock_config(**overrides):
    c = MagicMock(spec=PartnerConfiguration)
    c.id = uuid.uuid4()
    c.partner_id = uuid.UUID(PARTNER_ID)
    c.features_enabled = {}
    c.features_disabled = {}
    c.updated_at = None
    for k, v in overrides.items():
        setattr(c, k, v)
    return c


def _mock_white_label(**overrides):
    wl = MagicMock(spec=WhiteLabelConfig)
    wl.id = uuid.uuid4()
    wl.partner_id = uuid.UUID(PARTNER_ID)
    wl.brand_name = "Acme"
    wl.primary_color = "#FF0000"
    wl.updated_at = None
    for k, v in overrides.items():
        setattr(wl, k, v)
    return wl


def _mock_partner_user(**overrides):
    pu = MagicMock(spec=PartnerUser)
    pu.id = uuid.UUID(PARTNER_USER_ID)
    pu.partner_id = uuid.UUID(PARTNER_ID)
    pu.user_id = uuid.UUID(USER_ID)
    pu.partner_role = "viewer"
    pu.permissions = None
    pu.is_primary_contact = False
    pu.deleted_at = None
    pu.updated_at = None
    for k, v in overrides.items():
        setattr(pu, k, v)
    return pu


# -------------------------------------------------------------------
# Partner CRUD
# -------------------------------------------------------------------


class TestCreatePartner:
    def test_creates_partner_and_config(self):
        svc, db = _svc()
        partner_obj = MagicMock(spec=Partner)
        partner_obj.id = uuid.UUID(PARTNER_ID)

        with patch("app.services.partner_service.Partner", return_value=partner_obj):
            result = svc.create_partner(partner_name="Acme Corp")

        assert result is partner_obj
        assert db.add.call_count == 2  # partner + config
        db.flush.assert_called_once()
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(partner_obj)

    def test_config_uses_partner_id(self):
        svc, db = _svc()
        partner_obj = MagicMock(spec=Partner)
        partner_obj.id = uuid.UUID(PARTNER_ID)

        config_obj = MagicMock(spec=PartnerConfiguration)

        with patch("app.services.partner_service.Partner", return_value=partner_obj), \
             patch("app.services.partner_service.PartnerConfiguration", return_value=config_obj) as MockConfig:
            svc.create_partner(partner_name="Test")

        MockConfig.assert_called_once_with(
            partner_id=partner_obj.id,
            features_enabled={},
            features_disabled={},
        )


class TestGetPartner:
    def test_returns_partner_when_found(self):
        svc, db = _svc()
        partner = _mock_partner()
        db.query.return_value = _chain(first=partner)

        result = svc.get_partner(uuid.UUID(PARTNER_ID))

        assert result is partner
        db.query.assert_called_once_with(Partner)

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.get_partner(uuid.UUID(PARTNER_ID))

        assert result is None


class TestGetPartnerBySlug:
    def test_returns_partner_for_valid_slug(self):
        svc, db = _svc()
        partner = _mock_partner()
        db.query.return_value = _chain(first=partner)

        result = svc.get_partner_by_slug(SLUG)

        assert result is partner
        db.query.assert_called_once_with(Partner)

    def test_returns_none_for_unknown_slug(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.get_partner_by_slug("no-such-slug")

        assert result is None


class TestListPartners:
    def test_returns_items_and_total(self):
        svc, db = _svc()
        partners = [_mock_partner(), _mock_partner()]
        db.query.return_value = _chain(rows=partners, count=2)

        items, total = svc.list_partners()

        assert items == partners
        assert total == 2

    def test_applies_status_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_partners(status="active")

        # filter called twice: once for deleted_at, once for status
        assert chain.filter.call_count == 2

    def test_pagination_offset_and_limit(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_partners(page=3, per_page=10)

        chain.offset.assert_called_once_with(20)  # (3-1)*10
        chain.limit.assert_called_once_with(10)

    def test_no_status_filter_single_filter_call(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_partners(status=None)

        # Only the deleted_at filter should be applied
        assert chain.filter.call_count == 1


class TestUpdatePartner:
    def test_updates_fields_and_returns_partner(self):
        svc, db = _svc()
        partner = _mock_partner()
        db.query.return_value = _chain(first=partner)

        with patch("app.services.partner_service._utc_now") as mock_now:
            mock_now.return_value = datetime(2025, 1, 1, tzinfo=timezone.utc)
            result = svc.update_partner(uuid.UUID(PARTNER_ID), partner_name="New Name")

        assert result is partner
        assert partner.partner_name == "New Name"
        assert partner.updated_at == datetime(2025, 1, 1, tzinfo=timezone.utc)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(partner)

    def test_returns_none_when_partner_missing(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.update_partner(uuid.UUID(PARTNER_ID), partner_name="New")

        assert result is None
        db.commit.assert_not_called()

    def test_skips_none_values(self):
        svc, db = _svc()
        partner = _mock_partner()
        original_name = partner.partner_name
        db.query.return_value = _chain(first=partner)

        svc.update_partner(uuid.UUID(PARTNER_ID), partner_name=None)

        assert partner.partner_name == original_name


class TestDeletePartner:
    def test_soft_deletes_and_returns_true(self):
        svc, db = _svc()
        partner = _mock_partner()
        db.query.return_value = _chain(first=partner)

        result = svc.delete_partner(uuid.UUID(PARTNER_ID))

        assert result is True
        partner.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_returns_false_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.delete_partner(uuid.UUID(PARTNER_ID))

        assert result is False
        db.commit.assert_not_called()


# -------------------------------------------------------------------
# Partner Configuration
# -------------------------------------------------------------------


class TestGetConfiguration:
    def test_returns_config_when_found(self):
        svc, db = _svc()
        config = _mock_config()
        db.query.return_value = _chain(first=config)

        result = svc.get_configuration(uuid.UUID(PARTNER_ID))

        assert result is config
        db.query.assert_called_once_with(PartnerConfiguration)

    def test_returns_none_when_missing(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.get_configuration(uuid.UUID(PARTNER_ID))

        assert result is None


class TestUpdateConfiguration:
    def test_updates_and_returns_config(self):
        svc, db = _svc()
        config = _mock_config()
        db.query.return_value = _chain(first=config)

        with patch("app.services.partner_service._utc_now") as mock_now:
            mock_now.return_value = datetime(2025, 6, 1, tzinfo=timezone.utc)
            result = svc.update_configuration(
                uuid.UUID(PARTNER_ID),
                features_enabled={"billing": True},
            )

        assert result is config
        assert config.features_enabled == {"billing": True}
        assert config.updated_at == datetime(2025, 6, 1, tzinfo=timezone.utc)
        db.commit.assert_called_once()

    def test_returns_none_when_config_missing(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.update_configuration(uuid.UUID(PARTNER_ID), features_enabled={})

        assert result is None
        db.commit.assert_not_called()


# -------------------------------------------------------------------
# White Label Config
# -------------------------------------------------------------------


class TestCreateWhiteLabel:
    def test_creates_and_returns_white_label(self):
        svc, db = _svc()
        wl_obj = MagicMock(spec=WhiteLabelConfig)

        with patch("app.services.partner_service.WhiteLabelConfig", return_value=wl_obj) as MockWL:
            result = svc.create_white_label(
                uuid.UUID(PARTNER_ID), brand_name="Acme", primary_color="#000"
            )

        assert result is wl_obj
        MockWL.assert_called_once_with(
            partner_id=uuid.UUID(PARTNER_ID),
            brand_name="Acme",
            primary_color="#000",
        )
        db.add.assert_called_once_with(wl_obj)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(wl_obj)


class TestGetWhiteLabel:
    def test_returns_white_label_when_found(self):
        svc, db = _svc()
        wl = _mock_white_label()
        db.query.return_value = _chain(first=wl)

        result = svc.get_white_label(uuid.UUID(PARTNER_ID))

        assert result is wl
        db.query.assert_called_once_with(WhiteLabelConfig)

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.get_white_label(uuid.UUID(PARTNER_ID))

        assert result is None


class TestUpdateWhiteLabel:
    def test_updates_and_returns_white_label(self):
        svc, db = _svc()
        wl = _mock_white_label()
        db.query.return_value = _chain(first=wl)

        with patch("app.services.partner_service._utc_now") as mock_now:
            mock_now.return_value = datetime(2025, 3, 15, tzinfo=timezone.utc)
            result = svc.update_white_label(
                uuid.UUID(PARTNER_ID), brand_name="NewBrand"
            )

        assert result is wl
        assert wl.brand_name == "NewBrand"
        assert wl.updated_at == datetime(2025, 3, 15, tzinfo=timezone.utc)
        db.commit.assert_called_once()

    def test_returns_none_when_missing(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.update_white_label(uuid.UUID(PARTNER_ID), brand_name="X")

        assert result is None
        db.commit.assert_not_called()


# -------------------------------------------------------------------
# Partner Users
# -------------------------------------------------------------------


class TestAddPartnerUser:
    def test_creates_partner_user_with_defaults(self):
        svc, db = _svc()
        pu_obj = MagicMock(spec=PartnerUser)

        with patch("app.services.partner_service.PartnerUser", return_value=pu_obj) as MockPU:
            result = svc.add_partner_user(
                uuid.UUID(PARTNER_ID), uuid.UUID(USER_ID)
            )

        assert result is pu_obj
        MockPU.assert_called_once_with(
            partner_id=uuid.UUID(PARTNER_ID),
            user_id=uuid.UUID(USER_ID),
            partner_role="viewer",
            permissions=None,
            is_primary_contact=False,
        )
        db.add.assert_called_once_with(pu_obj)
        db.commit.assert_called_once()

    def test_creates_partner_user_with_custom_role(self):
        svc, db = _svc()
        pu_obj = MagicMock(spec=PartnerUser)

        with patch("app.services.partner_service.PartnerUser", return_value=pu_obj) as MockPU:
            result = svc.add_partner_user(
                uuid.UUID(PARTNER_ID),
                uuid.UUID(USER_ID),
                partner_role="admin",
                permissions={"manage_users": True},
                is_primary_contact=True,
            )

        MockPU.assert_called_once_with(
            partner_id=uuid.UUID(PARTNER_ID),
            user_id=uuid.UUID(USER_ID),
            partner_role="admin",
            permissions={"manage_users": True},
            is_primary_contact=True,
        )


class TestListPartnerUsers:
    def test_returns_items_and_total(self):
        svc, db = _svc()
        users = [_mock_partner_user(), _mock_partner_user()]
        db.query.return_value = _chain(rows=users, count=2)

        items, total = svc.list_partner_users(uuid.UUID(PARTNER_ID))

        assert items == users
        assert total == 2
        db.query.assert_called_once_with(PartnerUser)

    def test_pagination(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain

        svc.list_partner_users(uuid.UUID(PARTNER_ID), page=2, per_page=5)

        chain.offset.assert_called_once_with(5)  # (2-1)*5
        chain.limit.assert_called_once_with(5)


class TestUpdatePartnerUser:
    def test_updates_and_returns_partner_user(self):
        svc, db = _svc()
        pu = _mock_partner_user()
        db.query.return_value = _chain(first=pu)

        with patch("app.services.partner_service._utc_now") as mock_now:
            mock_now.return_value = datetime(2025, 7, 1, tzinfo=timezone.utc)
            result = svc.update_partner_user(
                uuid.UUID(PARTNER_USER_ID), partner_role="admin"
            )

        assert result is pu
        assert pu.partner_role == "admin"
        assert pu.updated_at == datetime(2025, 7, 1, tzinfo=timezone.utc)
        db.commit.assert_called_once()

    def test_returns_none_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.update_partner_user(uuid.UUID(PARTNER_USER_ID), partner_role="admin")

        assert result is None
        db.commit.assert_not_called()


class TestRemovePartnerUser:
    def test_soft_deletes_and_returns_true(self):
        svc, db = _svc()
        pu = _mock_partner_user()
        db.query.return_value = _chain(first=pu)

        result = svc.remove_partner_user(uuid.UUID(PARTNER_USER_ID))

        assert result is True
        pu.soft_delete.assert_called_once()
        db.commit.assert_called_once()

    def test_returns_false_when_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)

        result = svc.remove_partner_user(uuid.UUID(PARTNER_USER_ID))

        assert result is False
        db.commit.assert_not_called()
