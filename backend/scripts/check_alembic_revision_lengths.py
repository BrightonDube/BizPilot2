import os
import re
import sys
from pathlib import Path


REVISION_RE = re.compile(r"^\s*revision\s*:\s*str\s*=\s*\"([^\"]+)\"\s*$")


def main() -> int:
    backend_dir = Path(__file__).resolve().parents[1]
    versions_dir = backend_dir / "alembic" / "versions"
    max_len = int(os.environ.get("ALEMBIC_REVISION_MAX_LEN", "32"))

    failures: list[str] = []

    for path in sorted(versions_dir.glob("*.py")):
        try:
            text = path.read_text(encoding="utf-8")
        except Exception as e:
            failures.append(f"{path.name}: failed to read ({e})")
            continue

        revision = None
        for line in text.splitlines():
            m = REVISION_RE.match(line)
            if m:
                revision = m.group(1)
                break

        if revision is None:
            continue

        if len(revision) > max_len:
            failures.append(
                f"{path.name}: revision '{revision}' length {len(revision)} exceeds {max_len}"
            )

    if failures:
        sys.stderr.write("Alembic revision length check failed:\n")
        for f in failures:
            sys.stderr.write(f"- {f}\n")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
