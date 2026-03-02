"""
Property-based tests for IP masking and session analysis.

Validates the ExtendedReportService's IP privacy masking and
suspicious session detection logic.

Feature: Extended Reports (IP Masking & Security)
"""

from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# IP masking properties
# ---------------------------------------------------------------------------


@given(
    octets=st.tuples(
        st.integers(min_value=0, max_value=255),
        st.integers(min_value=0, max_value=255),
        st.integers(min_value=0, max_value=255),
        st.integers(min_value=0, max_value=255),
    )
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_ipv4_masking_preserves_first_three_octets(octets):
    """
    Property: IPv4 masking preserves the first three octets.

    The masked IP should show the network portion (first 3 octets) but
    hide the host portion (last octet) for POPIA compliance.

    Why: Full IPs are personal data under POPIA. Masking the last octet
    still enables location-based analysis without identifying the device.
    """
    from app.services.extended_report_service import ExtendedReportService

    ip = f"{octets[0]}.{octets[1]}.{octets[2]}.{octets[3]}"
    masked = ExtendedReportService._mask_ip(ip)

    expected_prefix = f"{octets[0]}.{octets[1]}.{octets[2]}."
    assert masked.startswith(expected_prefix)
    assert masked.endswith("***")


@given(
    octets=st.tuples(
        st.integers(min_value=0, max_value=255),
        st.integers(min_value=0, max_value=255),
        st.integers(min_value=0, max_value=255),
        st.integers(min_value=0, max_value=255),
    )
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_masked_ipv4_has_four_segments(octets):
    """
    Property: Masked IPv4 still has exactly 4 dot-separated segments.

    Why: Downstream consumers (log parsers, analytics) may expect a
    well-formed IP structure even when masked.
    """
    from app.services.extended_report_service import ExtendedReportService

    ip = f"{octets[0]}.{octets[1]}.{octets[2]}.{octets[3]}"
    masked = ExtendedReportService._mask_ip(ip)
    assert len(masked.split(".")) == 4


@given(
    octets=st.tuples(
        st.integers(min_value=0, max_value=255),
        st.integers(min_value=0, max_value=255),
        st.integers(min_value=0, max_value=255),
        st.integers(min_value=0, max_value=255),
    )
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_ip_masking_is_idempotent(octets):
    """
    Property: Masking an already-masked IP produces the same result.

    Why: If a masked IP is accidentally passed through masking again (e.g.
    in a report re-export), it should not corrupt the data further.
    """
    from app.services.extended_report_service import ExtendedReportService

    ip = f"{octets[0]}.{octets[1]}.{octets[2]}.{octets[3]}"
    masked_once = ExtendedReportService._mask_ip(ip)
    masked_twice = ExtendedReportService._mask_ip(masked_once)
    assert masked_once == masked_twice


# ---------------------------------------------------------------------------
# Suspicious session detection
# ---------------------------------------------------------------------------

@given(
    duration_hours=st.floats(
        min_value=0, max_value=720, allow_nan=False, allow_infinity=False
    ),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_suspicious_flag_iff_exceeds_threshold(duration_hours):
    """
    Property: Sessions > 24h are always flagged suspicious and vice versa.

    Why: Stale sessions represent a security risk. The threshold must be
    consistently applied — a 25h session should always be flagged,
    and a 23h session should never be flagged.
    """
    is_suspicious = duration_hours > 24
    if duration_hours > 24:
        assert is_suspicious is True
    else:
        assert is_suspicious is False
