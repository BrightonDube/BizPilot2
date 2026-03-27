"""
backend/app/agents/tool_registry.py

Single source of truth for all agent-callable tools.
Every tool must be registered here with its HITL/HOTL classification
and risk level before any agent can use it.

To add a new tool:
  1. Write the handler function in /tools/[domain]_tools.py
  2. Add a ToolDefinition entry at the bottom of this file
  3. Nothing else needed — the agent registry references tools by name
"""

from typing import Any, Callable, Dict, List, Optional

from app.agents.constants import ActionType, RiskLevel
from app.agents.tools.sales_tools import get_daily_sales
from app.agents.tools.order_tools import (
    get_orders,
    get_order,
    create_order_draft,
    submit_order_draft,
    update_order_status,
)
from app.agents.tools.inventory_tools import (
    get_inventory_summary,
    get_low_stock_items,
    adjust_stock,
    get_inventory_value,
    get_reorder_suggestions,
)
from app.agents.tools.metrics_tools import (
    get_weekly_report,
    get_monthly_report,
    get_product_performance,
    get_dashboard_kpis,
)
from app.agents.tools.customer_tools import (
    get_customers,
    get_top_customers,
    search_customers,
    create_customer,
    update_customer,
)
from app.agents.tools.supplier_tools import get_suppliers
from app.agents.tools.invoice_tools import (
    get_invoice_stats,
    get_invoices,
    get_overdue_invoices,
    create_invoice,
    record_invoice_payment,
)
from app.agents.tools.report_tools import (
    generate_pdf_report,
    generate_and_email_report,
    get_custom_report,
)
from app.agents.tools.staff_tools import get_staff_summary, get_time_entries
from app.agents.tools.email_tools import (
    send_report_email,
    send_invoice_email,
    send_custom_email,
)
from app.agents.tools.notification_tools import send_notification, notify_all_staff
from app.agents.tools.finance_tools import (
    get_gl_accounts,
    get_gl_balance,
    create_journal_entry,
    get_petty_cash_balance,
    record_petty_cash,
    get_expense_summary,
    create_expense,
)
from app.agents.tools.crm_tools import (
    list_segments,
    create_segment,
    log_interaction,
    get_customer_metrics,
)
from app.agents.tools.pos_tools import (
    get_register_status,
    get_cashup_summary,
    get_shift_summary,
)
from app.agents.tools.layby_tools import (
    get_laybys,
    get_layby_details,
    create_layby,
    record_layby_payment,
    get_overdue_laybys,
)


class ToolDefinition:
    """Schema and metadata for a single agent-callable tool."""

    def __init__(
        self,
        name: str,
        description: str,
        parameters: Dict[str, Any],
        handler: Callable,
        action_type: str = ActionType.HOTL,
        risk_level: str = RiskLevel.LOW,
        hitl_description: str = "",
    ) -> None:
        self.name = name
        self.description = description
        self.parameters = parameters
        self.handler = handler
        self.action_type = action_type
        self.risk_level = risk_level
        # Human-readable description shown in the HITL approval prompt
        self.hitl_description = hitl_description

    def to_openai_format(self) -> Dict[str, Any]:
        """Convert to the OpenAI function-calling schema Groq expects."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


class ToolRegistry:
    """Singleton registry. All tools must be registered here before use."""

    _instance: Optional["ToolRegistry"] = None

    def __new__(cls) -> "ToolRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._tools: Dict[str, ToolDefinition] = {}
        return cls._instance

    def register(self, tool: ToolDefinition) -> None:
        """Register a tool. Raises if a tool with the same name already exists."""
        if tool.name in self._tools:
            raise ValueError(f"Tool '{tool.name}' is already registered.")
        self._tools[tool.name] = tool

    def get(self, name: str) -> Optional[ToolDefinition]:
        """Return the ToolDefinition for a given name, or None."""
        return self._tools.get(name)

    def list_for_agent(self, tool_names: List[str]) -> List[Dict[str, Any]]:
        """Return OpenAI-format tool list for the named tools only."""
        result = []
        for name in tool_names:
            tool = self._tools.get(name)
            if tool:
                result.append(tool.to_openai_format())
        return result

    def all_names(self) -> List[str]:
        """Return all registered tool names (useful for debugging)."""
        return list(self._tools.keys())


# ---------------------------------------------------------------------------
# Singleton instance — import and use this everywhere
# ---------------------------------------------------------------------------
registry = ToolRegistry()

# === Sales tools ===
registry.register(ToolDefinition(
    name="get_daily_sales",
    description="Get a sales summary for a specific date (YYYY-MM-DD). Defaults to today.",
    parameters={"type": "object", "properties": {
        "target_date": {"type": "string", "description": "Date in YYYY-MM-DD format"}
    }},
    handler=get_daily_sales,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

# === Order tools ===
registry.register(ToolDefinition(
    name="get_orders",
    description="List recent purchase orders with status and totals.",
    parameters={"type": "object", "properties": {
        "limit": {"type": "integer", "description": "Max orders to return (default 20)"}
    }},
    handler=get_orders,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="get_order",
    description="Get full details of a single purchase order by order number.",
    parameters={"type": "object", "properties": {
        "order_number": {"type": "string", "description": "The order number to look up"}
    }, "required": ["order_number"]},
    handler=get_order,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="create_order_draft",
    description="Create a draft purchase order (not submitted). Returns the draft for review.",
    parameters={"type": "object", "properties": {
        "supplier_name": {"type": "string"},
        "items": {"type": "array", "items": {"type": "object"}},
        "notes": {"type": "string"},
    }, "required": ["supplier_name", "items"]},
    handler=create_order_draft,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.MEDIUM,
))

registry.register(ToolDefinition(
    name="submit_order_draft",
    description="Submit a previously created order draft to the supplier.",
    parameters={"type": "object", "properties": {
        "order_id": {"type": "string", "description": "The draft order ID to submit"}
    }, "required": ["order_id"]},
    handler=submit_order_draft,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.HIGH,
    hitl_description="Submit purchase order to supplier — this cannot be undone.",
))

registry.register(ToolDefinition(
    name="update_order_status",
    description="Update the status of a purchase order (e.g. mark as received).",
    parameters={"type": "object", "properties": {
        "order_id": {"type": "string"},
        "status": {"type": "string", "description": "New status value"},
    }, "required": ["order_id", "status"]},
    handler=update_order_status,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.HIGH,
    hitl_description="Change order status — this updates the permanent order record.",
))

# === Inventory tools ===
registry.register(ToolDefinition(
    name="get_inventory_summary",
    description="Get a summary of current inventory levels including low-stock count.",
    parameters={"type": "object", "properties": {}},
    handler=get_inventory_summary,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="get_low_stock_items",
    description="List inventory items at or below their reorder threshold.",
    parameters={"type": "object", "properties": {
        "limit": {"type": "integer", "description": "Max items to return (default 20)"}
    }},
    handler=get_low_stock_items,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="adjust_stock",
    description="Adjust stock quantity for a product. Positive adds, negative removes.",
    parameters={"type": "object", "properties": {
        "product_id": {"type": "string", "description": "Product ID to adjust"},
        "adjustment": {"type": "integer", "description": "Quantity to adjust (positive=add, negative=remove)"},
        "reason": {"type": "string", "description": "Reason for adjustment"},
    }, "required": ["product_id", "adjustment", "reason"]},
    handler=adjust_stock,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.HIGH,
    hitl_description="Adjust stock levels — this changes the inventory permanently.",
))

registry.register(ToolDefinition(
    name="get_inventory_value",
    description="Get the total value of current inventory.",
    parameters={"type": "object", "properties": {}},
    handler=get_inventory_value,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="get_reorder_suggestions",
    description="Get reorder suggestions based on stock levels and sales velocity.",
    parameters={"type": "object", "properties": {
        "limit": {"type": "integer", "description": "Max suggestions to return (default 10)"}
    }},
    handler=get_reorder_suggestions,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

# === Metrics / reporting tools ===
registry.register(ToolDefinition(
    name="get_weekly_report",
    description="Get a sales summary for a specific week. week_start is YYYY-MM-DD (Monday).",
    parameters={"type": "object", "properties": {
        "week_start": {"type": "string"}
    }},
    handler=get_weekly_report,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="get_monthly_report",
    description="Get a sales summary for a specific month. Provide year (int) and month (1-12).",
    parameters={"type": "object", "properties": {
        "year": {"type": "integer"},
        "month": {"type": "integer"},
    }, "required": ["year", "month"]},
    handler=get_monthly_report,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="get_product_performance",
    description="Get top and bottom performing products for a date range.",
    parameters={"type": "object", "properties": {
        "start_date": {"type": "string"},
        "end_date": {"type": "string"},
        "limit": {"type": "integer"},
    }},
    handler=get_product_performance,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="get_dashboard_kpis",
    description="Get key business KPIs: total sales, orders, customers, revenue.",
    parameters={"type": "object", "properties": {}},
    handler=get_dashboard_kpis,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

# === Customer tools ===
registry.register(ToolDefinition(
    name="get_customers",
    description="List customers with basic info and purchase history.",
    parameters={"type": "object", "properties": {
        "limit": {"type": "integer", "description": "Max customers (default 20)"}
    }},
    handler=get_customers,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="get_top_customers",
    description="Get highest-value customers ranked by total spend.",
    parameters={"type": "object", "properties": {
        "limit": {"type": "integer", "description": "How many top customers (default 10)"}
    }},
    handler=get_top_customers,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="search_customers",
    description="Search customers by name, email, or phone number.",
    parameters={"type": "object", "properties": {
        "query": {"type": "string", "description": "Search query"},
        "limit": {"type": "integer", "description": "Max results (default 20)"},
    }, "required": ["query"]},
    handler=search_customers,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="create_customer",
    description="Create a new customer record.",
    parameters={"type": "object", "properties": {
        "name": {"type": "string", "description": "Customer full name"},
        "email": {"type": "string", "description": "Email address"},
        "phone": {"type": "string", "description": "Phone number"},
    }, "required": ["name"]},
    handler=create_customer,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.MEDIUM,
    hitl_description="Create a new customer record in the system.",
))

registry.register(ToolDefinition(
    name="update_customer",
    description="Update an existing customer's details.",
    parameters={"type": "object", "properties": {
        "customer_id": {"type": "string", "description": "Customer ID to update"},
        "name": {"type": "string"},
        "email": {"type": "string"},
        "phone": {"type": "string"},
    }, "required": ["customer_id"]},
    handler=update_customer,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.MEDIUM,
    hitl_description="Update customer details — this modifies the permanent record.",
))

# === Supplier tools ===
registry.register(ToolDefinition(
    name="get_suppliers",
    description="List suppliers with contact info and payment terms.",
    parameters={"type": "object", "properties": {
        "limit": {"type": "integer", "description": "Max suppliers (default 20)"}
    }},
    handler=get_suppliers,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

# === Invoice tools ===
registry.register(ToolDefinition(
    name="get_invoice_stats",
    description="Get invoice statistics: total, outstanding, overdue counts and amounts.",
    parameters={"type": "object", "properties": {}},
    handler=get_invoice_stats,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="get_invoices",
    description="List recent invoices with status and amounts.",
    parameters={"type": "object", "properties": {
        "status": {"type": "string", "description": "Filter by status (optional)"},
        "limit": {"type": "integer"},
    }},
    handler=get_invoices,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="get_overdue_invoices",
    description="List all overdue invoices with days overdue and amounts.",
    parameters={"type": "object", "properties": {
        "limit": {"type": "integer", "description": "Max invoices (default 20)"}
    }},
    handler=get_overdue_invoices,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="create_invoice",
    description="Create a new invoice for a customer.",
    parameters={"type": "object", "properties": {
        "customer_id": {"type": "string", "description": "Customer to invoice"},
        "items": {"type": "array", "items": {"type": "object"}, "description": "Line items"},
        "notes": {"type": "string"},
    }, "required": ["customer_id", "items"]},
    handler=create_invoice,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.HIGH,
    hitl_description="Create a new invoice — this creates a permanent financial record.",
))

registry.register(ToolDefinition(
    name="record_invoice_payment",
    description="Record a payment against an existing invoice.",
    parameters={"type": "object", "properties": {
        "invoice_id": {"type": "string", "description": "Invoice to pay"},
        "amount": {"type": "number", "description": "Payment amount in ZAR"},
        "payment_method": {"type": "string", "description": "cash, card, eft, etc."},
    }, "required": ["invoice_id", "amount"]},
    handler=record_invoice_payment,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.HIGH,
    hitl_description="Record an invoice payment — this updates the financial ledger.",
))

# === Report tools ===
registry.register(ToolDefinition(
    name="generate_pdf_report",
    description="Generate a downloadable PDF report. Requires user approval before execution.",
    parameters={"type": "object", "properties": {
        "report_type": {"type": "string", "description": "daily_sales | monthly_summary | inventory"},
        "period_start": {"type": "string", "description": "YYYY-MM-DD"},
        "period_end": {"type": "string", "description": "YYYY-MM-DD"},
    }, "required": ["report_type", "period_start", "period_end"]},
    handler=generate_pdf_report,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.MEDIUM,
    hitl_description="Generate and store a PDF report file.",
))

registry.register(ToolDefinition(
    name="generate_and_email_report",
    description="Generate a report and email it to the user.",
    parameters={"type": "object", "properties": {
        "report_type": {"type": "string", "description": "daily_sales | monthly_summary | inventory"},
        "period_start": {"type": "string", "description": "YYYY-MM-DD"},
        "period_end": {"type": "string", "description": "YYYY-MM-DD"},
        "recipient_email": {"type": "string", "description": "Email to send to"},
    }, "required": ["report_type", "period_start", "period_end", "recipient_email"]},
    handler=generate_and_email_report,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.HIGH,
    hitl_description="Generate a report and email it — this sends an external email.",
))

registry.register(ToolDefinition(
    name="get_custom_report",
    description="Get a custom report with flexible date range and metrics.",
    parameters={"type": "object", "properties": {
        "metrics": {"type": "array", "items": {"type": "string"}, "description": "Metrics to include"},
        "period_start": {"type": "string"},
        "period_end": {"type": "string"},
    }, "required": ["metrics", "period_start", "period_end"]},
    handler=get_custom_report,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

# === Staff tools ===
registry.register(ToolDefinition(
    name="get_staff_summary",
    description="Get a summary of staff performance and attendance for a period.",
    parameters={"type": "object", "properties": {
        "start_date": {"type": "string"},
        "end_date": {"type": "string"},
    }},
    handler=get_staff_summary,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="get_time_entries",
    description="Get clock-in/clock-out entries for staff in a date range.",
    parameters={"type": "object", "properties": {
        "start_date": {"type": "string"},
        "end_date": {"type": "string"},
        "limit": {"type": "integer"},
    }},
    handler=get_time_entries,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

# === Email tools ===
registry.register(ToolDefinition(
    name="send_report_email",
    description="Send a report via email to a specified recipient.",
    parameters={"type": "object", "properties": {
        "recipient_email": {"type": "string", "description": "Email address to send to"},
        "report_type": {"type": "string", "description": "Type of report to send"},
        "subject": {"type": "string", "description": "Email subject line"},
    }, "required": ["recipient_email", "report_type"]},
    handler=send_report_email,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.CRITICAL,
    hitl_description="Send a report email — this sends an external email.",
))

registry.register(ToolDefinition(
    name="send_invoice_email",
    description="Send an invoice to a customer via email.",
    parameters={"type": "object", "properties": {
        "invoice_id": {"type": "string", "description": "Invoice to send"},
        "recipient_email": {"type": "string", "description": "Email to send to"},
    }, "required": ["invoice_id", "recipient_email"]},
    handler=send_invoice_email,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.CRITICAL,
    hitl_description="Email an invoice to a customer — this sends an external email.",
))

registry.register(ToolDefinition(
    name="send_custom_email",
    description="Send a custom email with specified subject and body.",
    parameters={"type": "object", "properties": {
        "recipient_email": {"type": "string"},
        "subject": {"type": "string"},
        "body": {"type": "string"},
    }, "required": ["recipient_email", "subject", "body"]},
    handler=send_custom_email,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.CRITICAL,
    hitl_description="Send a custom email — this sends an external email.",
))

# === Notification tools ===
registry.register(ToolDefinition(
    name="send_notification",
    description="Send an in-app notification to a user.",
    parameters={"type": "object", "properties": {
        "message": {"type": "string", "description": "Notification message"},
        "notification_type": {"type": "string", "description": "info, warning, or alert"},
    }, "required": ["message"]},
    handler=send_notification,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="notify_all_staff",
    description="Send a notification to all staff members.",
    parameters={"type": "object", "properties": {
        "message": {"type": "string", "description": "Notification message"},
        "notification_type": {"type": "string", "description": "info, warning, or alert"},
    }, "required": ["message"]},
    handler=notify_all_staff,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.HIGH,
    hitl_description="Notify all staff — this sends notifications to every team member.",
))

# === Finance tools ===
registry.register(ToolDefinition(
    name="get_gl_accounts",
    description="List general ledger accounts with balances.",
    parameters={"type": "object", "properties": {
        "account_type": {"type": "string", "description": "Filter by type: asset, liability, equity, revenue, expense"}
    }},
    handler=get_gl_accounts,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="get_gl_balance",
    description="Get the balance of a specific GL account.",
    parameters={"type": "object", "properties": {
        "account_id": {"type": "string", "description": "GL account ID"}
    }, "required": ["account_id"]},
    handler=get_gl_balance,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="create_journal_entry",
    description="Create a journal entry in the general ledger.",
    parameters={"type": "object", "properties": {
        "description": {"type": "string"},
        "debit_account_id": {"type": "string"},
        "credit_account_id": {"type": "string"},
        "amount": {"type": "number"},
    }, "required": ["description", "debit_account_id", "credit_account_id", "amount"]},
    handler=create_journal_entry,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.HIGH,
    hitl_description="Create a journal entry — this modifies the general ledger.",
))

registry.register(ToolDefinition(
    name="get_petty_cash_balance",
    description="Get the current petty cash balance.",
    parameters={"type": "object", "properties": {}},
    handler=get_petty_cash_balance,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="record_petty_cash",
    description="Record a petty cash transaction.",
    parameters={"type": "object", "properties": {
        "amount": {"type": "number", "description": "Amount in ZAR"},
        "description": {"type": "string"},
        "transaction_type": {"type": "string", "description": "in or out"},
    }, "required": ["amount", "description", "transaction_type"]},
    handler=record_petty_cash,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.HIGH,
    hitl_description="Record petty cash — this modifies the cash balance.",
))

registry.register(ToolDefinition(
    name="get_expense_summary",
    description="Get a summary of expenses for a period.",
    parameters={"type": "object", "properties": {
        "period_start": {"type": "string", "description": "YYYY-MM-DD"},
        "period_end": {"type": "string", "description": "YYYY-MM-DD"},
    }},
    handler=get_expense_summary,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="create_expense",
    description="Record a new expense.",
    parameters={"type": "object", "properties": {
        "amount": {"type": "number"},
        "category": {"type": "string"},
        "description": {"type": "string"},
        "date": {"type": "string", "description": "YYYY-MM-DD"},
    }, "required": ["amount", "category", "description"]},
    handler=create_expense,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.HIGH,
    hitl_description="Create an expense — this records a permanent financial transaction.",
))

# === CRM tools ===
registry.register(ToolDefinition(
    name="list_segments",
    description="List customer segments with member counts.",
    parameters={"type": "object", "properties": {}},
    handler=list_segments,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="create_segment",
    description="Create a new customer segment.",
    parameters={"type": "object", "properties": {
        "name": {"type": "string", "description": "Segment name"},
        "criteria": {"type": "object", "description": "Segment criteria/filters"},
    }, "required": ["name"]},
    handler=create_segment,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.MEDIUM,
    hitl_description="Create a customer segment — this organizes customers into groups.",
))

registry.register(ToolDefinition(
    name="log_interaction",
    description="Log a customer interaction (call, visit, email, etc.).",
    parameters={"type": "object", "properties": {
        "customer_id": {"type": "string"},
        "interaction_type": {"type": "string", "description": "call, email, visit, note"},
        "notes": {"type": "string"},
    }, "required": ["customer_id", "interaction_type"]},
    handler=log_interaction,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="get_customer_metrics",
    description="Get customer metrics: lifetime value, frequency, recency.",
    parameters={"type": "object", "properties": {
        "customer_id": {"type": "string", "description": "Customer ID (optional for aggregate)"},
    }},
    handler=get_customer_metrics,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

# === POS tools ===
registry.register(ToolDefinition(
    name="get_register_status",
    description="Get the current status of POS cash registers.",
    parameters={"type": "object", "properties": {}},
    handler=get_register_status,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="get_cashup_summary",
    description="Get a cash-up summary for a register or shift.",
    parameters={"type": "object", "properties": {
        "register_id": {"type": "string", "description": "Register ID (optional)"},
        "date": {"type": "string", "description": "Date in YYYY-MM-DD format"},
    }},
    handler=get_cashup_summary,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="get_shift_summary",
    description="Get a summary of a POS shift.",
    parameters={"type": "object", "properties": {
        "shift_id": {"type": "string", "description": "Shift ID (optional for current)"},
    }},
    handler=get_shift_summary,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

# === Layby tools ===
registry.register(ToolDefinition(
    name="get_laybys",
    description="List active laybys with status and payment progress.",
    parameters={"type": "object", "properties": {
        "status": {"type": "string", "description": "Filter by status (active, completed, cancelled)"},
        "limit": {"type": "integer", "description": "Max results (default 20)"},
    }},
    handler=get_laybys,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="get_layby_details",
    description="Get full details of a specific layby.",
    parameters={"type": "object", "properties": {
        "layby_id": {"type": "string", "description": "Layby ID to look up"}
    }, "required": ["layby_id"]},
    handler=get_layby_details,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))

registry.register(ToolDefinition(
    name="create_layby",
    description="Create a new layby arrangement for a customer.",
    parameters={"type": "object", "properties": {
        "customer_id": {"type": "string"},
        "items": {"type": "array", "items": {"type": "object"}},
        "deposit_amount": {"type": "number"},
        "installment_count": {"type": "integer"},
    }, "required": ["customer_id", "items", "deposit_amount"]},
    handler=create_layby,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.HIGH,
    hitl_description="Create a layby agreement — this creates a binding payment plan.",
))

registry.register(ToolDefinition(
    name="record_layby_payment",
    description="Record a payment against an existing layby.",
    parameters={"type": "object", "properties": {
        "layby_id": {"type": "string"},
        "amount": {"type": "number"},
        "payment_method": {"type": "string", "description": "cash, card, eft"},
    }, "required": ["layby_id", "amount"]},
    handler=record_layby_payment,
    action_type=ActionType.HITL,
    risk_level=RiskLevel.HIGH,
    hitl_description="Record a layby payment — this updates the payment schedule.",
))

registry.register(ToolDefinition(
    name="get_overdue_laybys",
    description="List laybys with overdue payments.",
    parameters={"type": "object", "properties": {
        "limit": {"type": "integer", "description": "Max results (default 20)"}
    }},
    handler=get_overdue_laybys,
    action_type=ActionType.HOTL,
    risk_level=RiskLevel.LOW,
))
