"""Unit tests for SignageService."""
import os
os.environ.setdefault("SECRET_KEY", "test-secret-key")

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.services.signage_service import SignageService, _generate_pairing_code


BIZ = uuid4()
GRP = uuid4()
DSP = uuid4()
CNT = uuid4()
PL = uuid4()


def _svc():
    db = MagicMock()
    return SignageService(db), db


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


# ── Helpers ──────────────────────────────────────────────────────────


class TestHelpers:
    def test_pairing_code_length(self):
        code = _generate_pairing_code()
        assert len(code) == 6

    def test_pairing_code_custom_length(self):
        code = _generate_pairing_code(length=10)
        assert len(code) == 10

    def test_pairing_code_alphanumeric(self):
        code = _generate_pairing_code()
        assert code.isalnum()
        assert code == code.upper()


# ── Display Groups ───────────────────────────────────────────────────


class TestDisplayGroups:
    def test_create(self):
        svc, db = _svc()
        svc.create_display_group(BIZ, "Lobby Screens")
        db.add.assert_called_once()
        db.commit.assert_called()

    def test_get(self):
        svc, db = _svc()
        grp = MagicMock()
        db.query.return_value = _chain(first=grp)
        assert svc.get_display_group(BIZ, GRP) == grp

    def test_get_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.get_display_group(BIZ, GRP) is None

    def test_list(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[MagicMock()], count=1)
        items, total = svc.list_display_groups(BIZ)
        assert total == 1

    def test_update(self):
        svc, db = _svc()
        grp = MagicMock()
        db.query.return_value = _chain(first=grp)
        result = svc.update_display_group(BIZ, GRP, name="Updated")
        assert result == grp
        db.commit.assert_called()

    def test_update_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.update_display_group(BIZ, GRP, name="X") is None

    def test_delete(self):
        svc, db = _svc()
        grp = MagicMock()
        db.query.return_value = _chain(first=grp)
        assert svc.delete_display_group(BIZ, GRP) is True
        grp.soft_delete.assert_called_once()

    def test_delete_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.delete_display_group(BIZ, GRP) is False


# ── Displays ─────────────────────────────────────────────────────────


class TestDisplays:
    def test_create(self):
        svc, db = _svc()
        svc.create_display(BIZ, "Screen 1")
        db.add.assert_called_once()

    def test_get(self):
        svc, db = _svc()
        dsp = MagicMock()
        db.query.return_value = _chain(first=dsp)
        assert svc.get_display(BIZ, DSP) == dsp

    def test_list(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[MagicMock(), MagicMock()], count=2)
        items, total = svc.list_displays(BIZ)
        assert total == 2

    def test_list_with_group_filter(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.list_displays(BIZ, group_id=GRP)
        assert chain.filter.call_count >= 1

    def test_update(self):
        svc, db = _svc()
        dsp = MagicMock()
        db.query.return_value = _chain(first=dsp)
        result = svc.update_display(BIZ, DSP, name="New Name")
        assert result == dsp

    def test_heartbeat(self):
        svc, db = _svc()
        dsp = MagicMock()
        db.query.return_value = _chain(first=dsp)
        result = svc.record_heartbeat(BIZ, DSP)
        assert result.status == "online"

    def test_heartbeat_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.record_heartbeat(BIZ, DSP) is None


# ── Content ──────────────────────────────────────────────────────────


class TestContent:
    def test_create(self):
        svc, db = _svc()
        svc.create_content(BIZ, "Promo Slide", "image")
        db.add.assert_called_once()

    def test_get(self):
        svc, db = _svc()
        cnt = MagicMock()
        db.query.return_value = _chain(first=cnt)
        assert svc.get_content(BIZ, CNT) == cnt

    def test_list(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[MagicMock()], count=1)
        items, total = svc.list_content(BIZ)
        assert total == 1

    def test_list_with_filters(self):
        svc, db = _svc()
        chain = _chain(rows=[], count=0)
        db.query.return_value = chain
        svc.list_content(BIZ, content_type="video", status="published")
        assert chain.filter.call_count >= 1

    def test_publish(self):
        svc, db = _svc()
        cnt = MagicMock()
        db.query.return_value = _chain(first=cnt)
        result = svc.publish_content(BIZ, CNT)
        assert result.status == "published"

    def test_publish_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.publish_content(BIZ, CNT) is None

    def test_update(self):
        svc, db = _svc()
        cnt = MagicMock()
        db.query.return_value = _chain(first=cnt)
        result = svc.update_content(BIZ, CNT, name="Updated")
        assert result == cnt


# ── Playlists ────────────────────────────────────────────────────────


class TestPlaylists:
    def test_create(self):
        svc, db = _svc()
        svc.create_playlist(BIZ, "Daily Rotation", shuffle=True)
        db.add.assert_called_once()

    def test_get(self):
        svc, db = _svc()
        pl = MagicMock()
        db.query.return_value = _chain(first=pl)
        assert svc.get_playlist(BIZ, PL) == pl

    def test_list(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[MagicMock()], count=1)
        items, total = svc.list_playlists(BIZ)
        assert total == 1

    def test_update(self):
        svc, db = _svc()
        pl = MagicMock()
        db.query.return_value = _chain(first=pl)
        result = svc.update_playlist(BIZ, PL, name="Evening")
        assert result == pl

    def test_update_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.update_playlist(BIZ, PL, name="X") is None


# ── Playlist Items ───────────────────────────────────────────────────


class TestPlaylistItems:
    def test_add(self):
        svc, db = _svc()
        svc.add_playlist_item(PL, CNT, sort_order=1)
        db.add.assert_called_once()

    def test_list(self):
        svc, db = _svc()
        db.query.return_value = _chain(rows=[MagicMock(), MagicMock()])
        items, total = svc.list_playlist_items(PL)
        assert total == 2

    def test_remove(self):
        svc, db = _svc()
        item = MagicMock()
        db.query.return_value = _chain(first=item)
        assert svc.remove_playlist_item(uuid4()) is True
        item.soft_delete.assert_called_once()

    def test_remove_not_found(self):
        svc, db = _svc()
        db.query.return_value = _chain(first=None)
        assert svc.remove_playlist_item(uuid4()) is False
