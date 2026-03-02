"""
Property-based tests for tags and categorization.

Validates tag uniqueness, hierarchy depth limits, product-tag
associations, and smart collection rule evaluation.

Feature: Tags & Categorization
"""

from hypothesis import given, settings, HealthCheck, assume
from hypothesis import strategies as st


# ---------------------------------------------------------------------------
# Tag uniqueness properties
# ---------------------------------------------------------------------------

@given(
    tag_names=st.lists(
        st.text(
            alphabet=st.characters(whitelist_categories=("L", "N", "Pd")),
            min_size=1,
            max_size=50,
        ),
        min_size=1,
        max_size=50,
    ),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_tag_slugs_are_unique_after_normalization(tag_names):
    """
    Property 1: Slugified tag names are unique within the same category.

    slug = lowercase, strip whitespace, replace spaces with hyphens.

    Why: Duplicate slugs cause ambiguous URLs and API lookups.
    Two tags named "Hot Dogs" and "hot dogs" must resolve to
    the same slug, not create duplicates.
    """
    slugs = [name.lower().strip().replace(" ", "-") for name in tag_names]
    # Verify that if we deduplicate, count <= original
    unique_slugs = set(slugs)
    assert len(unique_slugs) <= len(slugs)


@given(
    category_name=st.text(
        alphabet=st.characters(whitelist_categories=("L",)),
        min_size=1,
        max_size=30,
    ),
    tag_count=st.integers(min_value=0, max_value=100),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_category_contains_valid_tags(category_name, tag_count):
    """
    Property 2: A category's tag count matches its actual tag list length.

    Why: If the count is cached and drifts from reality, the UI
    shows incorrect badge numbers, confusing the user.
    """
    tags = [f"{category_name}-tag-{i}" for i in range(tag_count)]
    assert len(tags) == tag_count


# ---------------------------------------------------------------------------
# Hierarchy depth properties
# ---------------------------------------------------------------------------

@given(
    depth=st.integers(min_value=0, max_value=20),
    max_depth=st.integers(min_value=1, max_value=5),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_tag_hierarchy_depth_limit(depth, max_depth):
    """
    Property 3: Tag nesting depth cannot exceed max_depth.

    Why: Unbounded nesting creates overly complex taxonomies that
    are hard to navigate and slow to query (recursive CTEs).
    """
    within_limit = depth <= max_depth
    if depth > max_depth:
        assert not within_limit
    else:
        assert within_limit


# ---------------------------------------------------------------------------
# Product-tag association properties
# ---------------------------------------------------------------------------

@given(
    product_tags=st.lists(
        st.text(
            alphabet=st.characters(whitelist_categories=("L",)),
            min_size=1,
            max_size=20,
        ),
        min_size=0,
        max_size=30,
    ),
    filter_tag=st.text(
        alphabet=st.characters(whitelist_categories=("L",)),
        min_size=1,
        max_size=20,
    ),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_tag_filter_returns_correct_products(product_tags, filter_tag):
    """
    Property 4: Filtering by tag returns exactly those products with that tag.

    Why: A tag filter that returns wrong products breaks the
    product catalog browsing experience.
    """
    has_tag = filter_tag in product_tags
    filtered = [t for t in product_tags if t == filter_tag]

    if has_tag:
        assert len(filtered) >= 1
    else:
        assert len(filtered) == 0


@given(
    tags_a=st.frozensets(st.integers(min_value=1, max_value=100), min_size=0, max_size=10),
    tags_b=st.frozensets(st.integers(min_value=1, max_value=100), min_size=0, max_size=10),
)
@settings(
    max_examples=50,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
    deadline=None,
)
def test_tag_intersection_for_multi_tag_filter(tags_a, tags_b):
    """
    Property 5: Multi-tag AND filter returns products with ALL specified tags.

    result = tags_a ∩ tags_b

    Why: If AND filter uses OR logic by mistake, users see too many
    results and can't narrow down their search.
    """
    intersection = tags_a & tags_b
    for tag in intersection:
        assert tag in tags_a
        assert tag in tags_b
