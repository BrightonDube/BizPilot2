import argparse
import importlib
import sys
import os


def _ensure_backend_on_path() -> None:
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_root not in sys.path:
        sys.path.insert(0, backend_root)


def _run_with_force_flag(run_func, force: bool):
    """
    Run a seeding function with optional --force flag.
    
    Args:
        run_func: The seeding main() function to call
        force: If True, temporarily modify sys.argv to pass --force flag
    """
    if force:
        original_argv = sys.argv[:]
        sys.argv = [sys.argv[0], "--force"]
        try:
            run_func()
        finally:
            sys.argv = original_argv
    else:
        run_func()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--preset",
        default="capetown",
        choices=["capetown", "suppliers", "purchases", "all"],
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Skip confirmation prompts in seeding scripts"
    )
    args = parser.parse_args()

    _ensure_backend_on_path()

    if args.preset == "capetown":
        module = importlib.import_module("scripts.seed_capetown")
        run = getattr(module, "main", None)
        if callable(run):
            _run_with_force_flag(run, args.force)
            return 0

        raise SystemExit("scripts.seed_capetown is missing a callable main()")

    if args.preset == "suppliers":
        module = importlib.import_module("scripts.seed_suppliers")
        run = getattr(module, "main", None)
        if callable(run):
            _run_with_force_flag(run, args.force)
            return 0

        raise SystemExit("scripts.seed_suppliers is missing a callable main()")

    if args.preset == "purchases":
        module = importlib.import_module("scripts.seed_purchases_payments")
        run = getattr(module, "main", None)
        if callable(run):
            _run_with_force_flag(run, args.force)
            return 0

        raise SystemExit("scripts.seed_purchases_payments is missing a callable main()")

    if args.preset == "all":
        # Run all seeders in order
        print("Running all seeders...")
        
        # 1. Cape Town data (products, customers, etc.)
        print("\n[1/3] Seeding Cape Town data...")
        module = importlib.import_module("scripts.seed_capetown")
        run = getattr(module, "main", None)
        if callable(run):
            _run_with_force_flag(run, args.force)
        
        # 2. Suppliers
        print("\n[2/3] Seeding suppliers...")
        module = importlib.import_module("scripts.seed_suppliers")
        run = getattr(module, "main", None)
        if callable(run):
            _run_with_force_flag(run, args.force)
        
        # 3. Purchases and payments
        print("\n[3/3] Seeding purchases and payments...")
        module = importlib.import_module("scripts.seed_purchases_payments")
        run = getattr(module, "main", None)
        if callable(run):
            _run_with_force_flag(run, args.force)
        
        print("\n✓ All seeders completed!")
        return 0

    raise SystemExit(f"Unsupported preset: {args.preset}")


if __name__ == "__main__":
    raise SystemExit(main())
