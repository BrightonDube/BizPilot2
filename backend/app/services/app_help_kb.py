from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class HelpArticle:
    key: str
    title: str
    triggers: tuple[str, ...]
    steps: tuple[str, ...]


DEFAULT_ARTICLES: tuple[HelpArticle, ...] = (
    HelpArticle(
        key="create_invoice",
        title="Create an invoice",
        triggers=("create invoice", "new invoice", "invoice", "billing"),
        steps=(
            "Go to Invoices",
            "Click New Invoice",
            "Select a customer",
            "Add line items",
            "Set due date and notes (optional)",
            "Save invoice",
        ),
    ),
    HelpArticle(
        key="record_payment",
        title="Record a payment",
        triggers=("record payment", "add payment", "payment", "mark as paid"),
        steps=(
            "Go to Payments or open an invoice",
            "Click Record Payment",
            "Enter amount and payment method",
            "Save payment",
        ),
    ),
    HelpArticle(
        key="add_product",
        title="Add a product",
        triggers=("add product", "new product", "create product", "product"),
        steps=(
            "Go to Products",
            "Click New Product",
            "Enter name, price, and optional SKU",
            "Enable Track inventory if needed",
            "Save product",
        ),
    ),
    HelpArticle(
        key="add_customer",
        title="Add a customer",
        triggers=("add customer", "new customer", "create customer", "customer"),
        steps=(
            "Go to Customers",
            "Click New Customer",
            "Enter contact details",
            "Save customer",
        ),
    ),
    HelpArticle(
        key="add_user",
        title="Add a user",
        triggers=("add user", "new user", "invite user", "create user", "user management"),
        steps=(
            "Go to Settings",
            "Open the AI or main Settings page",
            "Select the Users/User Management section",
            "Click Add User",
            "Enter name, email, role",
            "Save user",
        ),
    ),
    HelpArticle(
        key="assign_role",
        title="Assign or change a user role",
        triggers=("assign role", "change role", "update role", "set role", "roles", "permissions"),
        steps=(
            "Go to Settings",
            "Open the Users/User Management section",
            "Click the user (or the three dots) you want to edit",
            "Choose Edit User",
            "Select the desired role",
            "Save changes",
        ),
    ),
    HelpArticle(
        key="create_order",
        title="Create a sales order",
        triggers=("create order", "new order", "sales order", "order"),
        steps=(
            "Go to Orders",
            "Click New Order",
            "Select a customer (or create one)",
            "Add products and quantities",
            "Review totals and taxes",
            "Save the order",
        ),
    ),
    HelpArticle(
        key="create_purchase_order",
        title="Create a purchase order",
        triggers=("purchase order", "create purchase", "new purchase", "supplier order"),
        steps=(
            "Go to Purchases",
            "Click New Purchase Order",
            "Select a supplier (or add one)",
            "Add products and quantities",
            "Save the purchase order",
            "Mark as Received when goods arrive",
        ),
    ),
    HelpArticle(
        key="add_supplier",
        title="Add a supplier",
        triggers=("add supplier", "new supplier", "create supplier", "supplier"),
        steps=(
            "Go to Suppliers",
            "Click New Supplier",
            "Enter supplier details (name, contact, email/phone)",
            "Save supplier",
        ),
    ),
    HelpArticle(
        key="inventory_adjustment",
        title="Adjust inventory",
        triggers=("adjust inventory", "inventory adjustment", "stock adjustment", "update stock"),
        steps=(
            "Go to Inventory",
            "Open the product or inventory item",
            "Choose Adjust Stock",
            "Enter the adjustment quantity and reason",
            "Save changes",
        ),
    ),
    HelpArticle(
        key="view_reports",
        title="View reports",
        triggers=("reports", "analytics", "revenue report", "sales report", "profit"),
        steps=(
            "Go to Reports",
            "Pick a report type (Sales, Customers, Inventory, etc.)",
            "Select the date range",
            "Review charts and totals",
            "Export if needed",
        ),
    ),
    HelpArticle(
        key="ai_privacy_settings",
        title="Change AI privacy settings",
        triggers=("ai privacy", "data sharing", "ai settings", "privacy settings"),
        steps=(
            "Go to Settings",
            "Open AI Settings / Privacy",
            "Choose how much data you want to share with AI",
            "Save changes",
        ),
    ),
)


class AppHelpKnowledgeBase:
    def __init__(self, repo_root: Path | None = None) -> None:
        self._repo_root = repo_root or self._guess_repo_root()

    def _guess_repo_root(self) -> Path:
        # backend/app/services/app_help_kb.py -> repo root
        return Path(__file__).resolve().parents[3]

    def scan_dashboard_routes(self) -> dict[str, str]:
        """Scan Next.js app/(dashboard) pages to produce route -> label mapping.

        We intentionally do NOT read file contents (avoid leaking secrets).
        """
        dashboard_root = self._repo_root / "frontend" / "src" / "app" / "(dashboard)"
        if not dashboard_root.exists():
            return {}

        routes: dict[str, str] = {}
        for page in dashboard_root.rglob("page.tsx"):
            rel = page.relative_to(dashboard_root)
            parts = [p for p in rel.parts[:-1] if p not in ("page.tsx",)]

            # Next.js uses [id] folders for dynamic routes
            url_parts = []
            label_parts = []
            for part in parts:
                if part.startswith("[") and part.endswith("]"):
                    token = part[1:-1]
                    url_parts.append(f"{{{token}}}")
                    label_parts.append(token)
                else:
                    url_parts.append(part)
                    label_parts.append(part.replace("-", " "))

            url = "/" + "/".join(url_parts) if url_parts else "/"
            label = " ".join(label_parts).strip() or "Home"
            routes[url] = label.title()

        # Prefer common aliases (these exist in the app layout)
        if "/dashboard" in routes:
            routes["/dashboard"] = "Dashboard"

        return dict(sorted(routes.items(), key=lambda x: x[0]))

    def to_context(self) -> dict[str, Any]:
        routes = self.scan_dashboard_routes()
        return {
            "routes": routes,
            "howTo": {
                a.key: {
                    "title": a.title,
                    "steps": list(a.steps),
                }
                for a in DEFAULT_ARTICLES
            },
        }

    def retrieve(self, question: str, max_articles: int = 2) -> dict[str, Any]:
        q = question.lower()
        matched: list[HelpArticle] = []
        for article in DEFAULT_ARTICLES:
            if any(t in q for t in article.triggers):
                matched.append(article)

        matched = matched[:max_articles]
        return {
            "howTo": {
                a.key: {
                    "title": a.title,
                    "steps": list(a.steps),
                }
                for a in matched
            }
        }
