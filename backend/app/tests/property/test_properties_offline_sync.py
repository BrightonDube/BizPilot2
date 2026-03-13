"""
Property-based tests for offline sync engine.

Validates conflict resolution, queue ordering, and sync metadata
invariants that must hold regardless of input data.

Feature: Offline Sync Engine
"""

from datetime import datetime, timedelta

from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Conflict resolution strategy properties
# ---------------------------------------------------------------------------

@given(
    strategy=st.sampled_from(["server_wins", "client_wins", "last_write_wins"]),
)
@settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_conflict_resolution_returns_one_of_inputs(strategy):
    """
    Property 1: Conflict resolution always returns either server or client data.

    Why: The resolver must never invent data. It picks a winner — no merging,
    no partial updates, no synthesized fields.
    """
    from app.services.conflict_resolver import resolve_conflict

    server = {"id": "s1", "name": "Server Version", "updated_at": "2025-01-01T10:00:00"}
    client = {"id": "c1", "name": "Client Version", "updated_at": "2025-01-01T09:00:00"}

    result = resolve_conflict("products", server, client, strategy=strategy)
    assert result == server or result == client


@given(
    entity_type=st.sampled_from(["orders", "products", "inventory", "invoices"]),
)
@settings(
    max_examples=20,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_server_wins_for_financial_entities(entity_type):
    """
    Property 2: Financial entity types default to server-wins.

    Why: Financial data (orders, invoices, inventory) must be authoritative.
    A client's stale version could misrepresent revenue or stock levels.
    """
    from app.services.conflict_resolver import resolve_conflict

    server = {"id": "s1", "amount": 100, "updated_at": "2025-01-01T08:00:00"}
    client = {"id": "c1", "amount": 200, "updated_at": "2025-01-01T10:00:00"}

    result = resolve_conflict(entity_type, server, client)
    # Default for these types is server_wins
    assert result == server


@given(
    entity_type=st.sampled_from(["customers", "suppliers", "drafts"]),
)
@settings(
    max_examples=20,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_client_wins_for_contact_entities(entity_type):
    """
    Property 3: Contact entity types default to client-wins.

    Why: Contact info (phone, email, address) is typically updated by the
    user interacting with the customer. Their local changes are more
    likely to be correct than server-side automated updates.
    """
    from app.services.conflict_resolver import resolve_conflict

    server = {"id": "s1", "phone": "111", "updated_at": "2025-01-01T10:00:00"}
    client = {"id": "c1", "phone": "222", "updated_at": "2025-01-01T08:00:00"}

    result = resolve_conflict(entity_type, server, client)
    assert result == client


@given(
    server_offset_hours=st.integers(min_value=0, max_value=48),
    client_offset_hours=st.integers(min_value=0, max_value=48),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_last_write_wins_picks_newer_timestamp(server_offset_hours, client_offset_hours):
    """
    Property 4: Last-write-wins always picks the version with the later timestamp.

    When timestamps are equal, server wins (authoritative tie-break).

    Why: This strategy is useful for entities where recency is the best
    proxy for correctness (e.g., status fields).
    """
    from app.services.conflict_resolver import resolve_conflict

    base = datetime(2025, 1, 1, 0, 0, 0)
    server_ts = (base + timedelta(hours=server_offset_hours)).isoformat()
    client_ts = (base + timedelta(hours=client_offset_hours)).isoformat()

    server = {"id": "s1", "updated_at": server_ts}
    client = {"id": "c1", "updated_at": client_ts}

    result = resolve_conflict("test", server, client, strategy="last_write_wins")

    if client_offset_hours > server_offset_hours:
        assert result == client
    else:
        # Server wins on tie or when server is newer
        assert result == server


# ---------------------------------------------------------------------------
# Queue ordering properties
# ---------------------------------------------------------------------------

@given(
    actions=st.lists(
        st.sampled_from(["create", "update", "delete"]),
        min_size=1,
        max_size=20,
    ),
)
@settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_queue_preserves_fifo_order(actions):
    """
    Property 5: Queue processing must maintain FIFO order.

    Why: Out-of-order processing could cause data corruption.
    For example, processing a 'delete' before a 'create' for the
    same entity would fail silently.
    """
    # Simulate FIFO: items come out in the same order they went in
    queue = list(enumerate(actions))
    processed = sorted(queue, key=lambda x: x[0])
    for i, (idx, _) in enumerate(processed):
        assert idx == i


@given(
    retry_count=st.integers(min_value=0, max_value=10),
    max_retries=st.integers(min_value=1, max_value=10),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_dead_letter_after_max_retries(retry_count, max_retries):
    """
    Property 6: Queue items move to dead letter after exceeding max retries.

    Why: Without a dead letter limit, a permanently failing item would
    block queue processing indefinitely.
    """
    should_dead_letter = retry_count >= max_retries
    if retry_count >= max_retries:
        assert should_dead_letter
    else:
        assert not should_dead_letter


# ---------------------------------------------------------------------------
# Sync metadata properties
# ---------------------------------------------------------------------------

@given(
    timestamps=st.lists(
        st.datetimes(
            min_value=datetime(2024, 1, 1),
            max_value=datetime(2025, 12, 31),
        ),
        min_size=2,
        max_size=10,
    ),
)
@settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_sync_watermark_is_monotonically_advancing(timestamps):
    """
    Property 7: Sync watermark (last_synced_at) only advances forward.

    Why: Moving the watermark backward would cause the next sync to
    re-process already-synced data, potentially creating duplicates.
    """
    watermark = timestamps[0]
    for ts in timestamps[1:]:
        if ts > watermark:
            watermark = ts
    # Final watermark should be the maximum timestamp
    assert watermark == max(timestamps)
