import os
import subprocess
import sys
import time
from urllib.parse import urlparse

import psycopg2


LOCK_ID = 827361234  # arbitrary constant


def _is_postgres_url(url: str) -> bool:
    return url.startswith("postgresql://") or url.startswith("postgres://")


def _acquire_lock(database_url: str, timeout_seconds: int = 60) -> bool:
    parsed = urlparse(database_url)
    if not parsed.hostname:
        return False

    deadline = time.time() + timeout_seconds

    while time.time() < deadline:
        conn = None
        try:
            conn = psycopg2.connect(database_url)
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("SELECT pg_try_advisory_lock(%s)", (LOCK_ID,))
                locked = cur.fetchone()[0]
                if locked:
                    return True
        except Exception:
            pass
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass

        time.sleep(2)

    return False


def main() -> int:
    database_url = os.getenv("DATABASE_URL", "").strip()

    if database_url and _is_postgres_url(database_url):
        got_lock = _acquire_lock(database_url, timeout_seconds=90)
        if got_lock:
            rc = subprocess.call([sys.executable, "-m", "alembic", "-c", "alembic.ini", "upgrade", "head"])
            if rc != 0:
                return rc

    workers = os.getenv("WEB_CONCURRENCY", "2")
    bind = os.getenv("PORT", "8000")

    cmd = [
        "gunicorn",
        "app.main:app",
        "--worker-class",
        "uvicorn.workers.UvicornWorker",
        "--workers",
        str(workers),
        "--bind",
        f"0.0.0.0:{bind}",
    ]

    os.execvp(cmd[0], cmd)


if __name__ == "__main__":
    raise SystemExit(main())
