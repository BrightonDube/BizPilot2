"""Unit tests for delivery_zone_service module."""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key")

from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from app.models.delivery import DeliveryZone
from app.services.delivery_zone_service import (
    _point_in_polygon,
    check_address_in_zone,
    match_zone_by_coords,
    match_zone_by_postcode,
)

BIZ = str(uuid4())

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SQUARE = [[0, 0], [0, 10], [10, 10], [10, 0]]
TRIANGLE = [[0, 0], [5, 10], [10, 0]]


def _chain(rows=None):
    """Reusable mock for SQLAlchemy chained query calls."""
    c = MagicMock()
    c.filter.return_value = c
    c.all.return_value = rows if rows is not None else []
    return c


def _mock_zone(**kw):
    """Build a MagicMock that behaves like a DeliveryZone row."""
    z = MagicMock(spec=DeliveryZone)
    z.id = kw.get("id", uuid4())
    z.business_id = kw.get("business_id", BIZ)
    z.name = kw.get("name", "Zone")
    z.zone_type = kw.get("zone_type", "flat")
    z.is_active = kw.get("is_active", True)
    z.deleted_at = kw.get("deleted_at", None)
    z.center_lat = kw.get("center_lat", None)
    z.center_lng = kw.get("center_lng", None)
    z.radius_km = kw.get("radius_km", None)
    z.boundary = kw.get("boundary", None)
    z.postcodes = kw.get("postcodes", None)
    z.delivery_fee = kw.get("delivery_fee", Decimal("25.00"))
    return z


# ===================================================================
# _point_in_polygon
# ===================================================================
class TestPointInPolygon:
    """Tests for the ray-casting point-in-polygon helper."""

    # -- Square polygon ---------------------------------------------------

    def test_inside_square(self):
        assert _point_in_polygon(5, 5, SQUARE) is True

    def test_outside_square_right(self):
        assert _point_in_polygon(5, 15, SQUARE) is False

    def test_outside_square_above(self):
        assert _point_in_polygon(15, 5, SQUARE) is False

    def test_outside_square_negative(self):
        assert _point_in_polygon(-1, -1, SQUARE) is False

    def test_corner_of_square(self):
        # Vertex behaviour is implementation-defined; just ensure no crash
        result = _point_in_polygon(0, 0, SQUARE)
        assert isinstance(result, bool)

    def test_on_edge_of_square(self):
        # Edge behaviour is implementation-defined; no crash expected
        result = _point_in_polygon(0, 5, SQUARE)
        assert isinstance(result, bool)

    # -- Triangle polygon -------------------------------------------------

    def test_inside_triangle(self):
        # Triangle [(0,0),(5,10),(10,0)]: centroid area around (4,4)
        assert _point_in_polygon(4, 4, TRIANGLE) is True

    def test_outside_triangle(self):
        assert _point_in_polygon(8, 9, TRIANGLE) is False

    # -- Decimal / float coordinates --------------------------------------

    def test_decimal_coords_inside(self):
        poly = [
            [Decimal("0"), Decimal("0")],
            [Decimal("0"), Decimal("10")],
            [Decimal("10"), Decimal("10")],
            [Decimal("10"), Decimal("0")],
        ]
        assert _point_in_polygon(5.0, 5.0, poly) is True

    def test_decimal_coords_outside(self):
        poly = [
            [Decimal("0"), Decimal("0")],
            [Decimal("0"), Decimal("10")],
            [Decimal("10"), Decimal("10")],
            [Decimal("10"), Decimal("0")],
        ]
        assert _point_in_polygon(15.0, 5.0, poly) is False

    # -- Minimal polygon (triangle) ---------------------------------------

    def test_minimal_three_vertices(self):
        tri = [[0, 0], [0, 6], [6, 0]]
        assert _point_in_polygon(1, 1, tri) is True
        assert _point_in_polygon(5, 5, tri) is False

    # -- Complex concave polygon ------------------------------------------

    def test_concave_polygon_inside_concavity(self):
        # L-shaped polygon: point in the concave "notch" should be outside
        l_shape = [[0, 0], [0, 10], [5, 10], [5, 5], [10, 5], [10, 0]]
        assert _point_in_polygon(2, 2, l_shape) is True  # inside lower part
        assert _point_in_polygon(7, 8, l_shape) is False  # in the notch


# ===================================================================
# match_zone_by_coords
# ===================================================================
@patch("app.services.delivery_zone_service._haversine_km")
class TestMatchZoneByCoords:
    """Tests for coordinate-based zone matching."""

    def test_returns_none_when_no_zones(self, mock_hav):
        db = MagicMock()
        db.query.return_value = _chain(rows=[])
        assert match_zone_by_coords(db, BIZ, -26.0, 28.0) is None

    # -- Radius matching --------------------------------------------------

    def test_radius_match_within_range(self, mock_hav):
        mock_hav.return_value = 3.0
        zone = _mock_zone(
            zone_type="radius",
            center_lat=Decimal("-26.0"),
            center_lng=Decimal("28.0"),
            radius_km=Decimal("5.0"),
        )
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_coords(db, BIZ, -26.01, 28.01) is zone

    def test_radius_no_match_outside_range(self, mock_hav):
        mock_hav.return_value = 10.0
        zone = _mock_zone(
            zone_type="radius",
            center_lat=Decimal("-26.0"),
            center_lng=Decimal("28.0"),
            radius_km=Decimal("5.0"),
        )
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_coords(db, BIZ, -26.5, 28.5) is None

    def test_radius_closest_wins(self, mock_hav):
        """When multiple radius zones match, the closest is returned."""
        mock_hav.side_effect = [8.0, 2.0]  # zone_far first, zone_near second
        zone_far = _mock_zone(
            name="far",
            zone_type="radius",
            center_lat=Decimal("-26.0"),
            center_lng=Decimal("28.0"),
            radius_km=Decimal("10.0"),
        )
        zone_near = _mock_zone(
            name="near",
            zone_type="radius",
            center_lat=Decimal("-26.0"),
            center_lng=Decimal("28.0"),
            radius_km=Decimal("5.0"),
        )
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone_far, zone_near])
        result = match_zone_by_coords(db, BIZ, -26.01, 28.01)
        assert result.name == "near"

    def test_radius_exact_boundary(self, mock_hav):
        """Distance == radius_km should still match (<=)."""
        mock_hav.return_value = 5.0
        zone = _mock_zone(
            zone_type="radius",
            center_lat=Decimal("-26.0"),
            center_lng=Decimal("28.0"),
            radius_km=Decimal("5.0"),
        )
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_coords(db, BIZ, -26.0, 28.0) is zone

    def test_radius_skipped_when_center_zero(self, mock_hav):
        """Radius zone with 0 center_lat/lng is skipped."""
        zone = _mock_zone(
            zone_type="radius",
            center_lat=Decimal("0"),
            center_lng=Decimal("0"),
            radius_km=Decimal("5.0"),
        )
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        result = match_zone_by_coords(db, BIZ, -26.0, 28.0)
        assert result is None
        mock_hav.assert_not_called()

    def test_radius_skipped_when_radius_zero(self, mock_hav):
        """Radius zone with radius_km=0 is skipped."""
        zone = _mock_zone(
            zone_type="radius",
            center_lat=Decimal("-26.0"),
            center_lng=Decimal("28.0"),
            radius_km=Decimal("0"),
        )
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        result = match_zone_by_coords(db, BIZ, -26.0, 28.0)
        assert result is None
        mock_hav.assert_not_called()

    def test_radius_skipped_when_none_values(self, mock_hav):
        """Radius zone with None center/radius is skipped."""
        zone = _mock_zone(
            zone_type="radius",
            center_lat=None,
            center_lng=None,
            radius_km=None,
        )
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_coords(db, BIZ, -26.0, 28.0) is None
        mock_hav.assert_not_called()

    # -- Polygon matching -------------------------------------------------

    def test_polygon_match(self, mock_hav):
        zone = _mock_zone(zone_type="polygon", boundary=SQUARE)
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_coords(db, BIZ, 5.0, 5.0) is zone

    def test_polygon_no_match(self, mock_hav):
        zone = _mock_zone(zone_type="polygon", boundary=SQUARE)
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_coords(db, BIZ, 15.0, 15.0) is None

    def test_polygon_boundary_too_few_points_skipped(self, mock_hav):
        """Polygon with < 3 vertices is skipped."""
        zone = _mock_zone(zone_type="polygon", boundary=[[0, 0], [1, 1]])
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_coords(db, BIZ, 0.5, 0.5) is None

    def test_polygon_boundary_none_skipped(self, mock_hav):
        zone = _mock_zone(zone_type="polygon", boundary=None)
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_coords(db, BIZ, 5.0, 5.0) is None

    def test_polygon_boundary_not_list_skipped(self, mock_hav):
        zone = _mock_zone(zone_type="polygon", boundary="invalid")
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_coords(db, BIZ, 5.0, 5.0) is None

    # -- Flat fallback ----------------------------------------------------

    def test_flat_fallback(self, mock_hav):
        zone = _mock_zone(zone_type="flat")
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_coords(db, BIZ, 5.0, 5.0) is zone

    def test_flat_first_only(self, mock_hav):
        """Only the first flat zone is used as fallback."""
        zone1 = _mock_zone(name="flat1", zone_type="flat")
        zone2 = _mock_zone(name="flat2", zone_type="flat")
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone1, zone2])
        assert match_zone_by_coords(db, BIZ, 5.0, 5.0) is zone1

    # -- Priority: radius > polygon > flat --------------------------------

    def test_radius_beats_polygon(self, mock_hav):
        mock_hav.return_value = 1.0
        r_zone = _mock_zone(
            name="radius",
            zone_type="radius",
            center_lat=Decimal("5.0"),
            center_lng=Decimal("5.0"),
            radius_km=Decimal("10.0"),
        )
        p_zone = _mock_zone(name="polygon", zone_type="polygon", boundary=SQUARE)
        db = MagicMock()
        db.query.return_value = _chain(rows=[r_zone, p_zone])
        result = match_zone_by_coords(db, BIZ, 5.0, 5.0)
        assert result.name == "radius"

    def test_radius_beats_flat(self, mock_hav):
        mock_hav.return_value = 1.0
        r_zone = _mock_zone(
            name="radius",
            zone_type="radius",
            center_lat=Decimal("5.0"),
            center_lng=Decimal("5.0"),
            radius_km=Decimal("10.0"),
        )
        f_zone = _mock_zone(name="flat", zone_type="flat")
        db = MagicMock()
        db.query.return_value = _chain(rows=[r_zone, f_zone])
        result = match_zone_by_coords(db, BIZ, 5.0, 5.0)
        assert result.name == "radius"

    def test_polygon_beats_flat(self, mock_hav):
        p_zone = _mock_zone(name="polygon", zone_type="polygon", boundary=SQUARE)
        f_zone = _mock_zone(name="flat", zone_type="flat")
        db = MagicMock()
        db.query.return_value = _chain(rows=[p_zone, f_zone])
        result = match_zone_by_coords(db, BIZ, 5.0, 5.0)
        assert result.name == "polygon"

    def test_falls_through_to_flat_when_radius_and_polygon_miss(self, mock_hav):
        mock_hav.return_value = 100.0  # outside radius
        r_zone = _mock_zone(
            name="radius",
            zone_type="radius",
            center_lat=Decimal("5.0"),
            center_lng=Decimal("5.0"),
            radius_km=Decimal("2.0"),
        )
        p_zone = _mock_zone(name="polygon", zone_type="polygon", boundary=SQUARE)
        f_zone = _mock_zone(name="flat", zone_type="flat")
        db = MagicMock()
        db.query.return_value = _chain(rows=[r_zone, p_zone, f_zone])
        # Point at (15, 15): outside radius and outside polygon
        result = match_zone_by_coords(db, BIZ, 15.0, 15.0)
        assert result.name == "flat"

    # -- zone_type normalization ------------------------------------------

    def test_zone_type_none_treated_as_flat(self, mock_hav):
        zone = _mock_zone(zone_type=None)
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_coords(db, BIZ, 5.0, 5.0) is zone

    def test_zone_type_uppercase_radius(self, mock_hav):
        """Zone type is lowered before comparison."""
        mock_hav.return_value = 1.0
        zone = _mock_zone(
            zone_type="RADIUS",
            center_lat=Decimal("-26.0"),
            center_lng=Decimal("28.0"),
            radius_km=Decimal("10.0"),
        )
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_coords(db, BIZ, -26.0, 28.0) is zone

    # -- Postcode zones are ignored in coord matching ---------------------

    def test_postcode_zone_ignored(self, mock_hav):
        zone = _mock_zone(zone_type="postcode", postcodes=["2000"])
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_coords(db, BIZ, 5.0, 5.0) is None


# ===================================================================
# match_zone_by_postcode
# ===================================================================
class TestMatchZoneByPostcode:
    """Tests for postcode-based zone matching."""

    def test_matching_postcode(self):
        zone = _mock_zone(zone_type="postcode", postcodes=["2000", "2001", "2002"])
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_postcode(db, BIZ, "2001") is zone

    def test_no_match(self):
        zone = _mock_zone(zone_type="postcode", postcodes=["2000", "2001"])
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_postcode(db, BIZ, "9999") is None

    def test_whitespace_trimmed(self):
        zone = _mock_zone(zone_type="postcode", postcodes=["2000"])
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_postcode(db, BIZ, "  2000  ") is zone

    def test_no_zones_returns_none(self):
        db = MagicMock()
        db.query.return_value = _chain(rows=[])
        assert match_zone_by_postcode(db, BIZ, "2000") is None

    def test_postcodes_none_skipped(self):
        zone = _mock_zone(zone_type="postcode", postcodes=None)
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_postcode(db, BIZ, "2000") is None

    def test_postcodes_not_list_skipped(self):
        zone = _mock_zone(zone_type="postcode", postcodes="2000")
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_postcode(db, BIZ, "2000") is None

    def test_first_matching_zone_returned(self):
        zone1 = _mock_zone(name="z1", zone_type="postcode", postcodes=["1000"])
        zone2 = _mock_zone(name="z2", zone_type="postcode", postcodes=["2000"])
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone1, zone2])
        result = match_zone_by_postcode(db, BIZ, "2000")
        assert result.name == "z2"

    def test_empty_postcode_list(self):
        zone = _mock_zone(zone_type="postcode", postcodes=[])
        db = MagicMock()
        db.query.return_value = _chain(rows=[zone])
        assert match_zone_by_postcode(db, BIZ, "2000") is None


# ===================================================================
# check_address_in_zone
# ===================================================================
class TestCheckAddressInZone:
    """Tests for the unified entry point."""

    @patch("app.services.delivery_zone_service.match_zone_by_postcode")
    @patch("app.services.delivery_zone_service.match_zone_by_coords")
    def test_coords_only(self, mock_coords, mock_pc):
        expected = _mock_zone(name="coord_zone")
        mock_coords.return_value = expected
        db = MagicMock()
        result = check_address_in_zone(db, BIZ, lat=-26.0, lng=28.0)
        assert result is expected
        mock_coords.assert_called_once_with(db, BIZ, -26.0, 28.0)
        mock_pc.assert_not_called()

    @patch("app.services.delivery_zone_service.match_zone_by_postcode")
    @patch("app.services.delivery_zone_service.match_zone_by_coords")
    def test_postcode_only(self, mock_coords, mock_pc):
        expected = _mock_zone(name="pc_zone")
        mock_pc.return_value = expected
        db = MagicMock()
        result = check_address_in_zone(db, BIZ, postcode="2000")
        assert result is expected
        mock_coords.assert_not_called()
        mock_pc.assert_called_once_with(db, BIZ, "2000")

    @patch("app.services.delivery_zone_service.match_zone_by_postcode")
    @patch("app.services.delivery_zone_service.match_zone_by_coords")
    def test_both_coords_preferred(self, mock_coords, mock_pc):
        coord_zone = _mock_zone(name="coord")
        mock_coords.return_value = coord_zone
        db = MagicMock()
        result = check_address_in_zone(db, BIZ, lat=-26.0, lng=28.0, postcode="2000")
        assert result is coord_zone
        mock_pc.assert_not_called()

    @patch("app.services.delivery_zone_service.match_zone_by_postcode")
    @patch("app.services.delivery_zone_service.match_zone_by_coords")
    def test_falls_through_to_postcode(self, mock_coords, mock_pc):
        """When coords match nothing, postcode is tried."""
        mock_coords.return_value = None
        pc_zone = _mock_zone(name="pc")
        mock_pc.return_value = pc_zone
        db = MagicMock()
        result = check_address_in_zone(db, BIZ, lat=-26.0, lng=28.0, postcode="2000")
        assert result is pc_zone
        mock_coords.assert_called_once()
        mock_pc.assert_called_once()

    @patch("app.services.delivery_zone_service.match_zone_by_postcode")
    @patch("app.services.delivery_zone_service.match_zone_by_coords")
    def test_neither_returns_none(self, mock_coords, mock_pc):
        db = MagicMock()
        result = check_address_in_zone(db, BIZ)
        assert result is None
        mock_coords.assert_not_called()
        mock_pc.assert_not_called()

    @patch("app.services.delivery_zone_service.match_zone_by_postcode")
    @patch("app.services.delivery_zone_service.match_zone_by_coords")
    def test_both_miss_returns_none(self, mock_coords, mock_pc):
        mock_coords.return_value = None
        mock_pc.return_value = None
        db = MagicMock()
        result = check_address_in_zone(db, BIZ, lat=-26.0, lng=28.0, postcode="2000")
        assert result is None

    @patch("app.services.delivery_zone_service.match_zone_by_postcode")
    @patch("app.services.delivery_zone_service.match_zone_by_coords")
    def test_lat_only_without_lng_skips_coords(self, mock_coords, mock_pc):
        """If only lat provided (lng is None), coords path is skipped."""
        mock_pc.return_value = None
        db = MagicMock()
        result = check_address_in_zone(db, BIZ, lat=-26.0, postcode="2000")
        assert result is None
        mock_coords.assert_not_called()

    @patch("app.services.delivery_zone_service.match_zone_by_postcode")
    @patch("app.services.delivery_zone_service.match_zone_by_coords")
    def test_empty_postcode_skips_postcode(self, mock_coords, mock_pc):
        """Empty string postcode is falsy, so postcode path is skipped."""
        db = MagicMock()
        result = check_address_in_zone(db, BIZ, postcode="")
        assert result is None
        mock_pc.assert_not_called()
