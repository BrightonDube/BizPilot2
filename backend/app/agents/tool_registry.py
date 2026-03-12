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

# ---------------------------------------------------------------------------
# Tool registrations — thin wrappers around BizPilot service functions
# ---------------------------------------------------------------------------
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
)
from app.agents.tools.metrics_tools import (
    get_weekly_report,
    get_monthly_report,
    get_product_performance,
    get_dashboard_kpis,
)
from app.agents.tools.customer_tools import get_customers, get_top_customers
from app.agents.tools.supplier_tools import get_suppliers
from app.agents.tools.invoice_tools import get_invoice_stats, get_invoices
from app.agents.tools.report_tools import generate_pdf_report
from app.agents.tools.staff_tools import get_staff_summary, get_time_entries

# --- Sales tools ---
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

# --- Order tools ---
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

# --- Inventory tools ---
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

# --- Metrics / reporting tools ---
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

# --- Customer tools ---
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

# --- Supplier tools ---
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

# --- Invoice tools ---
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

# --- Report tools ---
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

# --- Staff tools ---
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
