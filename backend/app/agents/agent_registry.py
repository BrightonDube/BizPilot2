"""
backend/app/agents/agent_registry.py

Registry of all BizPilot AI agents.
Each agent entry defines its role, model tier, tool list, and limits.

To add a new agent:
  1. Add an AgentDefinition entry at the bottom of this file.
  2. Write the agent task file in /tasks/[name]_agent.py.
  3. Nothing else needed — the orchestrator routes by agent name.
"""

from typing import Dict, List, Optional

from app.agents.constants import AgentTier, Limits
from app.core.ai_models import TaskType


class AgentDefinition:
    """Configuration record for a single specialised agent."""

    def __init__(
        self,
        name: str,
        role_description: str,
        model_tier: TaskType,
        capabilities: List[str],
        constraints: List[str],
        tools: List[str],
        max_steps: int = Limits.MAX_STEPS,
    ) -> None:
        self.name = name
        self.role_description = role_description
        self.model_tier = model_tier
        self.capabilities = capabilities
        self.constraints = constraints
        self.tools = tools
        self.max_steps = max_steps


class AgentRegistry:
    """Singleton registry for all agent definitions."""

    _instance: Optional["AgentRegistry"] = None

    def __new__(cls) -> "AgentRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._agents: Dict[str, AgentDefinition] = {}
        return cls._instance

    def register(self, agent: AgentDefinition) -> None:
        self._agents[agent.name] = agent

    def get(self, name: str) -> Optional[AgentDefinition]:
        return self._agents.get(name)

    def all_names(self) -> List[str]:
        return list(self._agents.keys())


registry = AgentRegistry()

# --- Chat / routing agent ---
registry.register(AgentDefinition(
    name="chat_agent",
    role_description=(
        "You are the BizPilot AI assistant. You answer general questions and "
        "route complex tasks to specialist agents."
    ),
    model_tier=AgentTier.BALANCED,
    capabilities=["answer general questions", "route requests", "summarise context"],
    constraints=[
        "Never guess business data you were not given",
        "Never route to more than one specialist per turn",
        "Always show a plan before executing multi-step tasks",
    ],
    tools=["get_daily_sales", "get_dashboard_kpis"],
))

# --- Order / procurement agent ---
registry.register(AgentDefinition(
    name="order_agent",
    role_description=(
        "You are the procurement officer. You help users create and manage "
        "purchase orders with suppliers. Never submit without explicit approval."
    ),
    model_tier=AgentTier.BALANCED,
    capabilities=["view orders", "create order drafts", "update order status"],
    constraints=[
        "Never submit an order without HITL approval",
        "Never assume supplier, quantity, or price the user did not state",
        "Always show the draft before submission",
    ],
    tools=[
        "get_orders", "get_order", "get_suppliers",
        "create_order_draft", "submit_order_draft", "update_order_status",
        "get_inventory_summary",
    ],
))

# --- Report agent ---
registry.register(AgentDefinition(
    name="report_agent",
    role_description=(
        "You are the reporting officer. You retrieve sales data, generate summaries, "
        "and produce PDF reports. Always state the period the data covers."
    ),
    model_tier=AgentTier.BALANCED,
    capabilities=["daily sales", "weekly reports", "monthly reports", "PDF generation"],
    constraints=[
        "Never generate a PDF without HITL approval",
        "Never report data from a different period than requested",
        "Never round or adjust figures — report exactly what the data returns",
    ],
    tools=[
        "get_daily_sales", "get_weekly_report", "get_monthly_report",
        "get_product_performance", "get_inventory_summary", "generate_pdf_report",
    ],
))

# --- Decision / analytics agent ---
registry.register(AgentDefinition(
    name="decision_agent",
    role_description=(
        "You are the business analyst. You analyse data and present 2-3 options "
        "with tradeoffs. You cite every data source. You never make decisions for the user."
    ),
    model_tier=AgentTier.POWERFUL,
    capabilities=["sales analysis", "inventory analysis", "customer analysis", "recommendations"],
    constraints=[
        "Never state a figure you did not receive from a tool",
        "Every claim must cite its data source",
        "State confidence level explicitly: HIGH / MEDIUM / LOW",
        "Analysis tasks are HOTL — no approval required",
    ],
    tools=[
        "get_daily_sales", "get_monthly_report", "get_product_performance",
        "get_inventory_summary", "get_low_stock_items",
        "get_customers", "get_top_customers", "get_dashboard_kpis",
    ],
    max_steps=8,
))

# --- Operations agent ---
registry.register(AgentDefinition(
    name="operations_agent",
    role_description=(
        "You are the operations manager. You help optimise daily operations: "
        "staff scheduling, section allocation, and floor planning."
    ),
    model_tier=AgentTier.BALANCED,
    capabilities=["staff summaries", "time entries", "operational planning"],
    constraints=[
        "Never generate a final PDF without HITL approval",
        "Always show a draft before any final output",
        "Never fabricate staff data or covers",
    ],
    tools=[
        "get_daily_sales", "get_staff_summary", "get_time_entries",
        "get_inventory_summary", "generate_pdf_report",
    ],
))
