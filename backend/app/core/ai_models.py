"""Dynamic LLM Model Routing with Automatic Fallback.

This module implements zero-hardcoded-model routing for BizPilot AI agents.
All model selection is capability-based with automatic fallback on failure.

Architecture:
1. Model Capability Registry - Single source of truth for model lists
2. Task Classification - Maps agent intent to capability type
3. Groq Execution Wrapper - Provider isolation layer
4. Automatic Fallback - Retry logic with fallback chain
5. Environment Overrides - Production safety controls
6. Observability - Logging for debugging and cost monitoring
"""

import os
import logging
from enum import Enum
from typing import Any, Optional
from dataclasses import dataclass
import httpx

from app.core.config import settings


logger = logging.getLogger(__name__)


# ============================================================================
# 1. MODEL CAPABILITY REGISTRY (Single Source of Truth)
# ============================================================================
# This is the ONLY place where Groq model names should exist.
# Models are listed in priority order (first = preferred, last = fallback).

MODEL_REGISTRY = {
    "fast": [
        "llama-3.1-8b-instant",  # Fast, cheap, good for tool calls and routing
    ],
    "reasoning": [
        "llama-3.3-70b-versatile",  # Best for complex analysis and planning
        "llama-3.1-70b-versatile",  # Backup reasoning model
        "llama-3.1-8b-instant",  # Fallback to fast model
    ],
    "summarization": [
        "llama-3.1-8b-instant",  # Good enough for condensing content
        "mixtral-8x7b-32768",  # Backup option
    ],
    "fallback": [
        "llama-3.1-8b-instant",  # Universal fallback
    ],
}


# ============================================================================
# 2. TASK CLASSIFICATION LAYER
# ============================================================================

class TaskType(str, Enum):
    """Task capability types for model routing."""
    FAST = "fast"  # Tool calls, routing, short responses
    REASONING = "reasoning"  # Multi-step planning, analysis, decisions
    SUMMARIZATION = "summarization"  # Condensing, rewriting, reporting
    FALLBACK = "fallback"  # Universal fallback


# ============================================================================
# 3. ENVIRONMENT VARIABLE OVERRIDES
# ============================================================================

def get_models_for_task(task_type: TaskType) -> list[str]:
    """
    Get model list for a task type with environment variable overrides.
    
    Environment variables (production safety):
    - FORCE_MODEL: Use single model for all tasks (bypass routing)
    - DEFAULT_FAST_MODEL: Override fast task models
    - DEFAULT_REASONING_MODEL: Override reasoning task models
    
    Returns:
        List of model names in priority order
    """
    # Check for force override (use single model for everything)
    force_model = os.getenv("FORCE_MODEL")
    if force_model:
        logger.info(f"FORCE_MODEL override active: {force_model}")
        return [force_model]
    
    # Check for task-specific overrides
    if task_type == TaskType.FAST:
        override = os.getenv("DEFAULT_FAST_MODEL")
        if override:
            logger.info(f"DEFAULT_FAST_MODEL override: {override}")
            return [override] + MODEL_REGISTRY["fast"]
    
    elif task_type == TaskType.REASONING:
        override = os.getenv("DEFAULT_REASONING_MODEL")
        if override:
            logger.info(f"DEFAULT_REASONING_MODEL override: {override}")
            return [override] + MODEL_REGISTRY["reasoning"]
    
    # Return registry defaults
    return MODEL_REGISTRY.get(task_type.value, MODEL_REGISTRY["fallback"])


# ============================================================================
# 4. GROQ EXECUTION WRAPPER (Provider Isolation)
# ============================================================================

@dataclass
class LLMResponse:
    """Standardized LLM response."""
    content: str
    model_used: str
    finish_reason: str
    usage: dict[str, int]


class ModelExecutionError(Exception):
    """Raised when a specific model fails."""
    def __init__(self, model: str, error: str, status_code: Optional[int] = None):
        self.model = model
        self.error = error
        self.status_code = status_code
        super().__init__(f"Model {model} failed: {error}")


async def run_groq(model: str, messages: list[dict[str, Any]], **kwargs) -> LLMResponse:
    """
    Execute a Groq model request with error handling.
    
    This is the ONLY function that should interact with Groq SDK.
    All agents and services must call this function, never Groq directly.
    
    Args:
        model: Groq model name
        messages: Chat messages in OpenAI format
        **kwargs: Additional parameters (temperature, max_tokens, etc.)
    
    Returns:
        LLMResponse with content and metadata
    
    Raises:
        ModelExecutionError: If the model request fails
    """
    if not settings.GROQ_API_KEY:
        raise ModelExecutionError(model, "GROQ_API_KEY not configured")
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    
    # Build request payload
    payload = {
        "model": model,
        "messages": messages,
        "temperature": kwargs.get("temperature", 0.7),
        "max_tokens": kwargs.get("max_tokens", 2048),
        "top_p": kwargs.get("top_p", 1.0),
        "stream": False,
    }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            
            # Handle HTTP errors
            if response.status_code != 200:
                error_detail = response.text
                raise ModelExecutionError(
                    model=model,
                    error=f"HTTP {response.status_code}: {error_detail}",
                    status_code=response.status_code,
                )
            
            data = response.json()
            
            # Extract response content
            choice = data.get("choices", [{}])[0]
            content = choice.get("message", {}).get("content")
            
            if not content:
                raise ModelExecutionError(model, "No content in response")
            
            return LLMResponse(
                content=str(content),
                model_used=model,
                finish_reason=choice.get("finish_reason", "unknown"),
                usage=data.get("usage", {}),
            )
    
    except httpx.TimeoutException as e:
        raise ModelExecutionError(model, f"Request timeout: {str(e)}")
    except httpx.RequestError as e:
        raise ModelExecutionError(model, f"Request error: {str(e)}")
    except Exception as e:
        raise ModelExecutionError(model, f"Unexpected error: {str(e)}")


# ============================================================================
# 5. AUTOMATIC MODEL FALLBACK (Critical)
# ============================================================================

async def execute_task(
    task_type: TaskType,
    messages: list[dict[str, Any]],
    **kwargs
) -> LLMResponse:
    """
    Execute an LLM task with automatic model fallback.
    
    This function:
    1. Gets model list for task type (with env overrides)
    2. Tries each model in priority order
    3. Falls back to universal fallback on all failures
    4. Logs all failures for observability
    
    Args:
        task_type: Type of task (fast, reasoning, summarization)
        messages: Chat messages
        **kwargs: Additional parameters for model
    
    Returns:
        LLMResponse from successful model
    
    Raises:
        RuntimeError: If all models fail (including fallback)
    """
    # Get models for this task type
    models = get_models_for_task(task_type)
    
    # Track failures for logging
    failures = []
    
    # Try each model in priority order
    for model in models:
        try:
            logger.info(f"Attempting task_type={task_type.value} with model={model}")
            response = await run_groq(model, messages, **kwargs)
            
            # Log success
            logger.info(
                f"✓ Success: task_type={task_type.value}, model={model}, "
                f"tokens={response.usage.get('total_tokens', 0)}"
            )
            
            return response
        
        except ModelExecutionError as e:
            # Log failure and continue to next model
            logger.warning(
                f"✗ Model failure: task_type={task_type.value}, model={model}, "
                f"error={e.error}, status_code={e.status_code}"
            )
            failures.append({
                "model": model,
                "error": e.error,
                "status_code": e.status_code,
            })
            continue
    
    # All primary models failed, try universal fallback
    if task_type != TaskType.FALLBACK:
        logger.warning(
            f"All models failed for task_type={task_type.value}, "
            f"attempting universal fallback"
        )
        
        fallback_models = MODEL_REGISTRY["fallback"]
        for model in fallback_models:
            # Skip if already tried
            if model in models:
                continue
            
            try:
                logger.info(f"Fallback attempt with model={model}")
                response = await run_groq(model, messages, **kwargs)
                
                logger.info(
                    f"✓ Fallback success: model={model}, "
                    f"tokens={response.usage.get('total_tokens', 0)}"
                )
                
                return response
            
            except ModelExecutionError as e:
                logger.warning(f"✗ Fallback failure: model={model}, error={e.error}")
                failures.append({
                    "model": model,
                    "error": e.error,
                    "status_code": e.status_code,
                })
                continue
    
    # All models failed (including fallback)
    logger.error(
        f"CRITICAL: All Groq models failed for task_type={task_type.value}. "
        f"Failures: {failures}"
    )
    
    raise RuntimeError(
        f"All Groq models failed for task_type={task_type.value}. "
        f"Attempted {len(failures)} models. Check logs for details."
    )


# ============================================================================
# 6. AGENT INTEGRATION HELPERS
# ============================================================================

async def execute_fast_task(messages: list[dict[str, Any]], **kwargs) -> LLMResponse:
    """Execute a fast task (tool calls, routing, short responses)."""
    return await execute_task(TaskType.FAST, messages, **kwargs)


async def execute_reasoning_task(messages: list[dict[str, Any]], **kwargs) -> LLMResponse:
    """Execute a reasoning task (planning, analysis, decisions)."""
    return await execute_task(TaskType.REASONING, messages, **kwargs)


async def execute_summarization_task(messages: list[dict[str, Any]], **kwargs) -> LLMResponse:
    """Execute a summarization task (condensing, rewriting, reporting)."""
    return await execute_task(TaskType.SUMMARIZATION, messages, **kwargs)
