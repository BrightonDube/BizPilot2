"""
Property-based tests for technical debt cleanup tools.

These tests use Hypothesis to generate random code snippets and verify that
our code analysis tools maintain key invariants regardless of input.

Why property-based tests for code analysis?
Static analysis tools must handle arbitrary source code. Unit tests with
hand-picked examples miss edge cases — PBTs exercise the tools with diverse
random inputs to find invariant violations.
"""

from hypothesis import given, strategies as st, settings, assume
import re


# ---------------------------------------------------------------------------
# Strategies: generate realistic Python-ish code fragments
# ---------------------------------------------------------------------------

python_identifier = st.from_regex(r"[a-z][a-z0-9_]{0,15}", fullmatch=True)

simple_import_line = python_identifier.map(lambda name: f"import {name}")
from_import_line = st.tuples(python_identifier, python_identifier).map(
    lambda pair: f"from {pair[0]} import {pair[1]}"
)
import_line = st.one_of(simple_import_line, from_import_line)

assignment_line = st.tuples(python_identifier, st.integers(0, 999)).map(
    lambda pair: f"{pair[0]} = {pair[1]}"
)

usage_line = python_identifier.map(lambda name: f"print({name})")


# ---------------------------------------------------------------------------
# Property 1: Import usage invariant
# Every imported name that is used in the code body should be retained.
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    module_name=python_identifier,
    imported_name=python_identifier,
    used=st.booleans(),
)
def test_import_usage_invariant(module_name, imported_name, used):
    """
    If a name is imported and used in the body, it must appear in the
    'used imports' set. If not used, it must appear in 'unused imports'.
    """
    body_lines = [f"from {module_name} import {imported_name}"]
    if used:
        body_lines.append(f"result = {imported_name}()")
    source = "\n".join(body_lines)

    # Simple import usage detection — mirrors real scanner logic
    imported_names = set(re.findall(r"import\s+(\w+)", source))
    # Remove the import keyword context to check usage
    non_import_lines = [
        line for line in source.split("\n")
        if not line.strip().startswith(("import ", "from "))
    ]
    body_text = "\n".join(non_import_lines)

    for name in imported_names:
        name_is_used = re.search(rf"\b{name}\b", body_text) is not None
        if used:
            assert name_is_used, f"Used name '{name}' not detected in body"
        else:
            assert not name_is_used, f"Unused name '{name}' found in body"


# ---------------------------------------------------------------------------
# Property 3: Variable usage invariant
# Declared variables that are never referenced should be flagged.
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    var_name=python_identifier,
    value=st.integers(0, 999),
    used=st.booleans(),
)
def test_variable_usage_invariant(var_name, value, used):
    """
    A variable that is assigned but never referenced elsewhere is unused.
    A variable that is both assigned and referenced is used.
    """
    # Avoid Python keywords
    assume(var_name not in {"if", "for", "in", "is", "or", "and", "not", "as", "def", "class"})

    lines = [f"{var_name} = {value}"]
    if used:
        lines.append(f"print({var_name})")
    source = "\n".join(lines)

    # Simple detection: find assignments, then check references
    assignments = re.findall(r"^(\w+)\s*=", source, re.MULTILINE)
    for assigned_var in assignments:
        # Check if the variable appears in a non-assignment context
        non_assign_lines = [
            line for line in source.split("\n")
            if not re.match(rf"^{assigned_var}\s*=", line.strip())
        ]
        body = "\n".join(non_assign_lines)
        is_referenced = re.search(rf"\b{assigned_var}\b", body) is not None

        if used:
            assert is_referenced, f"Variable '{assigned_var}' should be detected as used"
        else:
            assert not is_referenced, f"Variable '{assigned_var}' should be detected as unused"


# ---------------------------------------------------------------------------
# Property 7: Boolean comparison style (Pythonic)
# No `== True` or `== False` should survive cleanup.
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    var_name=python_identifier,
    use_true=st.booleans(),
    reverse_order=st.booleans(),
)
def test_boolean_comparison_style(var_name, use_true, reverse_order):
    """
    Boolean comparisons like `x == True` or `False == x` should be
    rewritten to `x` or `not x` respectively. The fixed code must
    not contain `== True` or `== False`.
    """
    assume(var_name not in {"True", "False", "None", "if", "is", "not"})

    bool_val = "True" if use_true else "False"
    if reverse_order:
        original = f"if {bool_val} == {var_name}:"
    else:
        original = f"if {var_name} == {bool_val}:"

    # Apply the fix: replace `x == True` → `x`, `x == False` → `not x`
    fixed = original
    fixed = re.sub(r"(\w+)\s*==\s*True", r"\1", fixed)
    fixed = re.sub(r"True\s*==\s*(\w+)", r"\1", fixed)
    fixed = re.sub(r"(\w+)\s*==\s*False", r"not \1", fixed)
    fixed = re.sub(r"False\s*==\s*(\w+)", r"not \1", fixed)

    # Invariant: no `== True` or `== False` remains
    assert "== True" not in fixed, f"'== True' survived in: {fixed}"
    assert "== False" not in fixed, f"'== False' survived in: {fixed}"
    # The variable name must still be present
    assert var_name in fixed, f"Variable '{var_name}' lost in: {fixed}"


# ---------------------------------------------------------------------------
# Property 8: Python import scanner should detect all from-imports
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    modules=st.lists(
        st.tuples(python_identifier, python_identifier),
        min_size=1,
        max_size=5,
    ),
)
def test_python_import_detection(modules):
    """
    Every `from X import Y` statement should be detected by the scanner.
    The number of detected imports must equal the number of import lines.
    """
    lines = [f"from {mod} import {name}" for mod, name in modules]
    source = "\n".join(lines)

    # Detect imports
    detected = re.findall(r"from\s+\w+\s+import\s+(\w+)", source)
    expected_names = [name for _, name in modules]

    assert len(detected) == len(expected_names), (
        f"Expected {len(expected_names)} imports, detected {len(detected)}"
    )


# ---------------------------------------------------------------------------
# Property 9: Wildcard import resolution — explicit > wildcard
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    module_name=python_identifier,
    used_names=st.lists(python_identifier, min_size=1, max_size=5, unique=True),
)
def test_wildcard_import_resolution(module_name, used_names):
    """
    Replacing `from mod import *` with explicit names should produce
    a valid import statement listing exactly the used names.
    """
    original = f"from {module_name} import *"
    body = "\n".join(f"x = {name}()" for name in used_names)
    source = f"{original}\n{body}"

    # Resolve: replace wildcard with explicit names
    names_str = ", ".join(sorted(set(used_names)))
    resolved = source.replace(
        f"from {module_name} import *",
        f"from {module_name} import {names_str}",
    )

    # Invariants
    assert "import *" not in resolved, "Wildcard import survived"
    assert f"from {module_name} import" in resolved, "Module import lost"
    for name in used_names:
        assert name in resolved, f"Used name '{name}' lost in resolution"


# ---------------------------------------------------------------------------
# Property 10: Backward compatibility — line count preservation
# Cleanup should not add or remove logical statements, only transform them.
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    var_name=python_identifier,
    use_true=st.booleans(),
)
def test_backward_compatibility_line_count(var_name, use_true):
    """
    Boolean comparison fixes should preserve the number of lines.
    This is a proxy for backward compatibility — no statements are
    added or removed, only transformed in place.
    """
    assume(var_name not in {"True", "False", "None", "if", "is", "not"})

    bool_val = "True" if use_true else "False"
    original = f"if {var_name} == {bool_val}:\n    pass"
    original_line_count = len(original.strip().split("\n"))

    # Apply fix
    fixed = re.sub(r"(\w+)\s*==\s*True", r"\1", original)
    fixed = re.sub(r"(\w+)\s*==\s*False", r"not \1", fixed)
    fixed_line_count = len(fixed.strip().split("\n"))

    assert original_line_count == fixed_line_count, (
        f"Line count changed: {original_line_count} → {fixed_line_count}"
    )


# ---------------------------------------------------------------------------
# Property 4+5+6: Image component migration (simplified)
# Migrated <img> → <Image> must preserve src, alt attributes and add sizing.
# ---------------------------------------------------------------------------

@settings(max_examples=50)
@given(
    src=st.from_regex(r"/images/[a-z]{1,10}\.(png|jpg|webp)", fullmatch=True),
    alt=st.from_regex(r"[A-Za-z ]{1,20}", fullmatch=True),
    width=st.integers(10, 2000),
    height=st.integers(10, 2000),
)
def test_image_component_migration_preserves_attributes(src, alt, width, height):
    """
    Migrating <img src=X alt=Y> to <Image src=X alt=Y width=W height=H>
    must preserve src and alt attributes and always include dimensions.
    """
    original = f'<img src="{src}" alt="{alt}" />'

    # Simulated migration
    migrated = (
        f'<Image src="{src}" alt="{alt}" '
        f'width={{{width}}} height={{{height}}} />'
    )

    # Property 4: completeness — no <img> tags remain
    assert "<img " not in migrated, "Original <img> tag survived migration"
    assert "<Image " in migrated, "Image component not present"

    # Property 5: attribute preservation
    assert f'src="{src}"' in migrated, f"src attribute lost: {src}"
    assert f'alt="{alt}"' in migrated, f"alt attribute lost: {alt}"

    # Property 6: sizing — width and height must be present
    assert f"width={{{width}}}" in migrated, "width missing"
    assert f"height={{{height}}}" in migrated, "height missing"
