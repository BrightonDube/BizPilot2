"""
Comprehensive Alembic migration linter for CI.

Catches the exact classes of bugs that caused our DigitalOcean deployment cascade:
1. sa.Enum() inside op.create_table() → duplicate enum creation (use postgresql.ENUM)
2. ForeignKey references to non-existent tables
3. Multiple Alembic heads (branch conflicts)
4. Missing postgresql import when using postgresql.ENUM

Run: python scripts/lint_migrations.py
Exit code 0 = all checks pass, 1 = failures found.

WHY this exists: We had 6 consecutive deploy failures caused by migration bugs
that were invisible locally but crashed on the production DB. This linter runs
in CI to catch them before they reach production.
"""

import os
import re
import sys
from pathlib import Path
from typing import NamedTuple


class LintError(NamedTuple):
    file: str
    line: int
    rule: str
    message: str


# ---------------------------------------------------------------------------
# Allowlist: migrations that already ran in production and can't be changed.
# These are grandfathered in even if they violate current lint rules.
# ---------------------------------------------------------------------------
LEGACY_ALLOWLIST = {
    "001_initial_schema.py",
    "002_business_entities.py",
    "002_add_payments.py",
    "004_add_performance_indexes.py",
    "011_fix_payment_status_values.py",
    "016_add_time_entry_and_pos.py",
    "048_delivery_management.py",
    "049_crm_core.py",
    # Old-style hash-based revision files (pre-sequential naming)
    "298dd1eda420_add_job_execution_logs_table.py",
    "4c665b9d28c3_merge_all_heads.py",
    "60dd02bfc53b_add_payments_table.py",
    "6e181364b886_sync_schema_with_current_state.py",
    "c53915a0c393_add_production_tables.py",
    "d2162babb0bc_add_subscription_system.py",
    "e7c1f3a2b9d0_single_superadmin.py",
}


# ---------------------------------------------------------------------------
# Rule 1: Detect sa.Enum() inside op.create_table()
# ---------------------------------------------------------------------------
# WHY: sa.Enum() in create_table triggers SQLAlchemy's before_create event,
# which calls CREATE TYPE without IF NOT EXISTS. If the enum was already
# created via .create(checkfirst=True), the implicit second creation fails
# with "type already exists". The fix is postgresql.ENUM(create_type=False).
# ---------------------------------------------------------------------------
SA_ENUM_IN_TABLE_RE = re.compile(
    r"sa\.Enum\s*\(",
    re.MULTILINE,
)


def check_sa_enum_in_create_table(source: str, filename: str) -> list[LintError]:
    """Detect sa.Enum() used inside op.create_table() blocks."""
    if filename in LEGACY_ALLOWLIST:
        return []

    errors: list[LintError] = []
    lines = source.splitlines()

    in_create_table = False
    paren_depth = 0

    for i, line in enumerate(lines, start=1):
        stripped = line.strip()

        if "op.create_table(" in stripped:
            in_create_table = True
            paren_depth = 0

        if in_create_table:
            paren_depth += stripped.count("(") - stripped.count(")")

            if SA_ENUM_IN_TABLE_RE.search(stripped):
                errors.append(LintError(
                    file=filename,
                    line=i,
                    rule="SA_ENUM_IN_CREATE_TABLE",
                    message=(
                        "sa.Enum() inside op.create_table() will cause 'type already exists' errors. "
                        "Use postgresql.ENUM(..., create_type=False) instead."
                    ),
                ))

            if paren_depth <= 0:
                in_create_table = False

    return errors


# ---------------------------------------------------------------------------
# Rule 2: Validate ForeignKey table references
# ---------------------------------------------------------------------------
# WHY: Migration 075 referenced "expense_requests.id" but that table didn't
# exist. This only manifests at deploy time against the real database.
# ---------------------------------------------------------------------------
FK_TABLE_RE = re.compile(r"""ForeignKey\s*\(\s*["']([^"']+)\.(\w+)["']""")


def collect_known_tables(versions_dir: Path) -> set[str]:
    """Scan all migrations to collect table names from create_table calls."""
    tables: set[str] = set()
    create_table_re = re.compile(r"""op\.create_table\s*\(\s*["'](\w+)["']""")

    for path in versions_dir.glob("*.py"):
        try:
            text = path.read_text(encoding="utf-8")
        except Exception:
            continue
        for match in create_table_re.finditer(text):
            tables.add(match.group(1))

    return tables


def check_fk_references(
    source: str, filename: str, known_tables: set[str]
) -> list[LintError]:
    """Check that ForeignKey references point to tables that exist in migrations."""
    if filename in LEGACY_ALLOWLIST:
        return []

    errors: list[LintError] = []
    lines = source.splitlines()

    for i, line in enumerate(lines, start=1):
        for match in FK_TABLE_RE.finditer(line):
            table_name = match.group(1)
            if table_name not in known_tables:
                errors.append(LintError(
                    file=filename,
                    line=i,
                    rule="FK_MISSING_TABLE",
                    message=(
                        f"ForeignKey references '{table_name}' but no migration "
                        f"creates this table. Check for typos."
                    ),
                ))

    return errors


# ---------------------------------------------------------------------------
# Rule 3: Detect multiple Alembic heads (use alembic CLI for accuracy)
# ---------------------------------------------------------------------------
# WHY: Multiple heads mean Alembic can't determine the upgrade path and
# `alembic upgrade head` fails. This must be caught before deploy.
# WHY alembic CLI: Our manual parsing can't handle merge migrations with
# tuple down_revisions correctly. Alembic's own head resolution is canonical.
# ---------------------------------------------------------------------------

def check_single_head_via_cli(backend_dir: Path) -> list[LintError]:
    """Use `alembic heads` command to verify single head."""
    import subprocess

    env = os.environ.copy()
    # Provide a dummy DATABASE_URL so alembic env.py can at least parse config.
    # The heads command only reads migration files, it doesn't connect to DB.
    if "DATABASE_URL" not in env:
        env["DATABASE_URL"] = "postgresql://localhost/dummy"
    if "SECRET_KEY" not in env:
        env["SECRET_KEY"] = "lint-check-only-not-real-key-placeholder"

    try:
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "heads"],
            capture_output=True,
            text=True,
            cwd=str(backend_dir),
            env=env,
            timeout=30,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        return [LintError(
            file="alembic/",
            line=0,
            rule="HEAD_CHECK_FAILED",
            message=f"Could not run 'alembic heads': {e}",
        )]

    if result.returncode != 0:
        # If alembic itself can't parse the migrations, that's a problem
        stderr_snippet = result.stderr.strip()[-200:] if result.stderr else "no output"
        return [LintError(
            file="alembic/",
            line=0,
            rule="ALEMBIC_ERROR",
            message=f"'alembic heads' failed: {stderr_snippet}",
        )]

    # Count heads in output (each line with "(head)" is a head)
    heads = [line.strip() for line in result.stdout.strip().splitlines() if line.strip()]
    if len(heads) > 1:
        return [LintError(
            file="alembic/versions/",
            line=0,
            rule="MULTIPLE_HEADS",
            message=f"Found {len(heads)} Alembic heads: {', '.join(heads)}. Create a merge migration.",
        )]

    if len(heads) == 0:
        return [LintError(
            file="alembic/versions/",
            line=0,
            rule="NO_HEAD",
            message="No Alembic head found. Check migration chain integrity.",
        )]

    return []


# ---------------------------------------------------------------------------
# Rule 4: postgresql.ENUM used without import
# ---------------------------------------------------------------------------
def check_postgresql_import(source: str, filename: str) -> list[LintError]:
    """If postgresql.ENUM is used, verify postgresql is imported."""
    if filename in LEGACY_ALLOWLIST:
        return []

    if "postgresql.ENUM" not in source and "postgresql.enum" not in source:
        return []

    if "from sqlalchemy.dialects import postgresql" in source:
        return []
    if "from sqlalchemy.dialects.postgresql import" in source:
        return []

    return [LintError(
        file=filename,
        line=1,
        rule="MISSING_POSTGRESQL_IMPORT",
        message="Uses postgresql.ENUM but missing 'from sqlalchemy.dialects import postgresql'.",
    )]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> int:
    backend_dir = Path(__file__).resolve().parents[1]
    versions_dir = backend_dir / "alembic" / "versions"

    if not versions_dir.exists():
        print(f"ERROR: {versions_dir} not found", file=sys.stderr)
        return 1

    all_errors: list[LintError] = []

    # Collect known tables for FK validation
    known_tables = collect_known_tables(versions_dir)

    # Per-file checks
    for path in sorted(versions_dir.glob("*.py")):
        try:
            source = path.read_text(encoding="utf-8")
        except Exception as e:
            print(f"WARNING: Could not read {path.name}: {e}", file=sys.stderr)
            continue

        all_errors.extend(check_sa_enum_in_create_table(source, path.name))
        all_errors.extend(check_fk_references(source, path.name, known_tables))
        all_errors.extend(check_postgresql_import(source, path.name))

    # Global check: single Alembic head (using CLI for accuracy)
    all_errors.extend(check_single_head_via_cli(backend_dir))

    # Report
    if all_errors:
        print(f"\n{'='*60}", file=sys.stderr)
        print(f"Migration lint: {len(all_errors)} error(s) found", file=sys.stderr)
        print(f"{'='*60}\n", file=sys.stderr)

        for err in all_errors:
            loc = f"{err.file}:{err.line}" if err.line else err.file
            print(f"  [{err.rule}] {loc}", file=sys.stderr)
            print(f"    {err.message}\n", file=sys.stderr)

        return 1

    migration_count = len(list(versions_dir.glob("*.py")))
    print(f"Migration lint: all checks passed ({migration_count} files, "
          f"{len(known_tables)} tables, {len(LEGACY_ALLOWLIST)} allowlisted)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
