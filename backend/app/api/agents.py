"""
backend/app/api/agents.py

FastAPI router for the BizPilot agent system.
All endpoints are auth-protected via get_current_active_user.

Endpoints:
  POST /agents/chat           — Send a message; returns plan or response
  POST /agents/chat/confirm   — Confirm a plan and execute the task
  POST /agents/hitl/{id}/approve — Approve a pending HITL action
  POST /agents/hitl/{id}/reject  — Reject a pending HITL action
"""

import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_sync_db
from app.api.deps import get_current_business_id, check_feature, get_optional_current_user
from app.models.user import User
from app.models.user_settings import AIDataSharingLevel
from app.services.ai_service import AIService
from app.agents.tasks.chat_agent import ChatAgent
from app.agents.lib.hitl_manager import get_pending_action, reject_hitl
from app.agents.lib.cache_manager import clear_hitl_pending
from app.agents.orchestrator import Orchestrator

logger = logging.getLogger("bizpilot.agents")

router = APIRouter(prefix="/agents", tags=["AI Agents"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class AgentChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    conversation_id: Optional[str] = None


class AgentConfirmRequest(BaseModel):
    message: str
    session_id: str
    conversation_id: Optional[str] = None


class AgentResponse(BaseModel):
    type: str          # "plan" | "response" | "hitl_request" | "stopped" | "error"
    message: str
    session_id: str
    pending: bool = False
    conversation_id: Optional[str] = None


class HITLActionRequest(BaseModel):
    pass   # No body needed — the session_id is in the path


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_sharing_level(db: Session, user: User) -> AIDataSharingLevel:
    """Get the user's AI data-sharing preference."""
    svc = AIService(db)
    settings_row = svc.get_or_create_user_settings(user.id)
    return settings_row.ai_data_sharing_level


def _make_session_id(provided: Optional[str]) -> str:
    """Use provided session_id or generate a new one."""
    return provided if provided else str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

PUBLIC_AGENT_PROMPT = """You are BizPilot AI, a helpful assistant on the BizPilot website.

BizPilot is a complete POS and ERP platform for restaurants, retail stores,
and multi-location businesses. It includes POS, inventory management, supplier
ordering, invoicing, payroll, CRM, kitchen display systems, and AI automation.

You can answer questions about:
- What BizPilot does and how it works
- Pricing and plans
- Features available for restaurants and retail
- How to get started
- How BizPilot compares to other systems

You cannot access any business data — the user is not logged in.
If they want to see their data or take actions, politely ask them to log in.
Keep responses friendly, concise, and helpful.
Never make up specific pricing — direct users to the pricing page at bizpilotpro.app/pricing
"""

@router.post("/chat", response_model=AgentResponse)
async def agent_chat(
    request: AgentChatRequest,
    current_user: Optional[User] = Depends(get_optional_current_user),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
) -> AgentResponse:
    """
    Send a message to the agent system.
    """
    session_id = _make_session_id(request.session_id)
    
    if current_user is None:
        from app.core.ai_models import execute_fast_task
        messages = [
            {"role": "system", "content": PUBLIC_AGENT_PROMPT},
            {"role": "user", "content": request.message}
        ]
        response = await execute_fast_task(messages=messages)
        
        return AgentResponse(
            type="response",
            message=response.content.strip(),
            session_id=session_id,
            pending=False,
            conversation_id=request.conversation_id,
        )

    sharing_level = _get_sharing_level(db, current_user)

    agent = ChatAgent(db)
    result = await agent.run(
        user=current_user,
        message=request.message,
        history=[],
        sharing_level=sharing_level,
        session_id=session_id,
        business_id=business_id,
        plan_confirmed=True, # We no longer generate plans
    )

    return AgentResponse(
        type=result.get("type", "response"),
        message=result.get("plan") or result.get("message", ""),
        session_id=session_id,
        pending=result.get("pending", False),
        conversation_id=request.conversation_id,
    )


@router.post("/chat/confirm", response_model=AgentResponse)
async def agent_chat_confirm(
    request: AgentConfirmRequest,
    current_user: User = Depends(check_feature("has_ai")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
) -> AgentResponse:
    """
    Confirm a plan and execute the agent task.
    Called after the user reviews the plan returned by /agents/chat.
    """
    sharing_level = _get_sharing_level(db, current_user)

    agent = ChatAgent(db)
    result = await agent.run(
        user=current_user,
        message=request.message,
        history=[],
        sharing_level=sharing_level,
        session_id=request.session_id,
        business_id=business_id,
        plan_confirmed=True,
    )

    return AgentResponse(
        type=result.get("type", "response"),
        message=result.get("message", ""),
        session_id=request.session_id,
        pending=result.get("pending", False),
        conversation_id=request.conversation_id,
    )


@router.post("/hitl/{session_id}/approve", response_model=AgentResponse)
async def hitl_approve(
    session_id: str,
    current_user: User = Depends(check_feature("has_ai")),
    business_id: str = Depends(get_current_business_id),
    db: Session = Depends(get_sync_db),
) -> AgentResponse:
    """
    Approve a pending HITL action.
    Executes the tool that was paused and returns the result.
    """
    pending = await get_pending_action(session_id)
    if not pending:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending approval found. It may have expired (15-minute timeout).",
        )

    orchestrator = Orchestrator(db)
    result = await orchestrator.execute_tool_and_continue(
        session_id=session_id,
        user=current_user,
        tool_name=pending["tool_name"],
        tool_args=pending["tool_args"],
        messages_so_far=pending.get("messages_so_far", []),
        agent_name=pending["agent_name"],
        business_id=business_id,
    )

    # Clean up the HITL state from Redis now that it's resolved
    await clear_hitl_pending(session_id)

    return AgentResponse(
        type=result.get("type", "tool_result"),
        message=str(result.get("result") or result.get("message", "")),
        session_id=session_id,
        pending=False,
    )


@router.post("/hitl/{session_id}/reject", response_model=AgentResponse)
async def hitl_reject(
    session_id: str,
    current_user: User = Depends(check_feature("has_ai")),
    db: Session = Depends(get_sync_db),
) -> AgentResponse:
    """
    Reject a pending HITL action and cancel it.
    """
    result = await reject_hitl(session_id)
    return AgentResponse(
        type=result.get("type", "hitl_rejected"),
        message=result.get("message", "Action cancelled."),
        session_id=session_id,
        pending=False,
    )
