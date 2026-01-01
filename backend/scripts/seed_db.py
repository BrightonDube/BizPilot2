import argparse
import importlib
import sys
import os


def _ensure_backend_on_path() -> None:
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--preset",
        default="capetown",
        choices=["capetown", "suppliers"],
    )
    args = parser.parse_args()

    _ensure_backend_on_path()

    if args.preset == "capetown":
        module = importlib.import_module("scripts.seed_capetown")
        run = getattr(module, "main", None)
        if callable(run):
            run()
            return 0

        raise SystemExit("scripts.seed_capetown is missing a callable main()")

    if args.preset == "suppliers":
        module = importlib.import_module("scripts.seed_suppliers")
        run = getattr(module, "main", None)
        if callable(run):
            run()
            return 0

        raise SystemExit("scripts.seed_suppliers is missing a callable main()")

    raise SystemExit(f"Unsupported preset: {args.preset}")


if __name__ == "__main__":
    raise SystemExit(main())
