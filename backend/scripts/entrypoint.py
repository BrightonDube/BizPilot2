import os


def main() -> int:
    """
    Entrypoint script for the API service.
    
    Note: Database migrations are handled by the pre-deploy job 'release-migrate',
    so this script only starts the web server.
    """
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
