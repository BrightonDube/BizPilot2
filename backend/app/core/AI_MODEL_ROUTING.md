# Dynamic AI Model Routing System

## Overview

BizPilot uses a **zero-hardcoded-model** routing system that automatically selects and falls back between Groq models based on task requirements. This architecture ensures the application remains operational even when Groq deprecates models.

## Architecture

### 1. Model Capability Registry (`ai_models.py`)

The **single source of truth** for all model names. No other file should contain hardcoded model names.

```python
MODEL_REGISTRY = {
    "fast": ["llama-3.1-8b-instant"],
    "reasoning": ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant"],
    "summarization": ["llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    "fallback": ["llama-3.1-8b-instant"],
}
```

Models are listed in **priority order** (first = preferred, last = fallback).

### 2. Task Classification

Tasks are classified by capability, not model name:

- **fast**: Tool calls, routing, short responses (marketing AI, quick queries)
- **reasoning**: Multi-step planning, analysis, decisions (business insights)
- **summarization**: Condensing, rewriting, reporting
- **fallback**: Universal fallback when all else fails

### 3. Automatic Fallback

When a model fails (deprecation, timeout, error):
1. Try next model in the task's priority list
2. If all task models fail, try universal fallback
3. If fallback fails, raise controlled error with diagnostics

```python
# Example: Reasoning task with 3 models
# Try: llama-3.3-70b-versatile → llama-3.1-70b-versatile → llama-3.1-8b-instant
# If all fail: Try universal fallback (llama-3.1-8b-instant)
```

### 4. Environment Variable Overrides

Production safety controls (no code changes required):

```bash
# Force single model for all tasks (bypass routing)
FORCE_MODEL=llama-3.1-8b-instant

# Override specific task types
DEFAULT_FAST_MODEL=custom-fast-model
DEFAULT_REASONING_MODEL=custom-reasoning-model
```

### 5. Provider Isolation

All Groq SDK usage is isolated in `run_groq()`. Agents never call Groq directly.

```python
# ✅ CORRECT: Use task routing
from app.core.ai_models import execute_reasoning_task

response = await execute_reasoning_task(messages)

# ❌ WRONG: Never hardcode models or call Groq directly
response = await groq_client.chat.completions.create(
    model="llama-3.3-70b-versatile",  # NEVER DO THIS
    messages=messages
)
```

## Usage Guide

### For Agent Developers

**Rule: Never reference model names. Always use task routing.**

```python
from app.core.ai_models import (
    execute_fast_task,
    execute_reasoning_task,
    execute_summarization_task,
)

# Fast tasks (marketing AI, quick responses)
response = await execute_fast_task(
    messages=[{"role": "user", "content": "What is BizPilot?"}],
    max_tokens=400,
    temperature=0.7,
)

# Reasoning tasks (business insights, complex analysis)
response = await execute_reasoning_task(
    messages=[{"role": "user", "content": "Analyze my sales trends"}],
    max_tokens=2048,
    temperature=0.7,
)

# Summarization tasks (reports, condensing)
response = await execute_summarization_task(
    messages=[{"role": "user", "content": "Summarize this data..."}],
    max_tokens=1000,
    temperature=0.5,
)

# Access response
print(response.content)  # AI response text
print(response.model_used)  # Which model was used
print(response.usage)  # Token usage
```

### For Operations

**Replacing a deprecated model:**

1. Edit `MODEL_REGISTRY` in `app/core/ai_models.py`
2. Replace old model name with new model name
3. Deploy (no other code changes needed)

```python
# Before
"reasoning": ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile"],

# After (if llama-3.3-70b-versatile is deprecated)
"reasoning": ["llama-3.1-70b-versatile", "llama-3.1-8b-instant"],
```

**Emergency override (production):**

```bash
# Force all tasks to use a specific model
export FORCE_MODEL=llama-3.1-8b-instant

# Restart application
```

## Observability

All model executions are logged with:
- Task type
- Model attempted
- Success/failure status
- Fallback usage
- Token usage
- Error codes (if failed)

```
INFO: Attempting task_type=reasoning with model=llama-3.3-70b-versatile
INFO: ✓ Success: task_type=reasoning, model=llama-3.3-70b-versatile, tokens=1234

WARNING: ✗ Model failure: task_type=reasoning, model=llama-3.3-70b-versatile, error=HTTP 404: Model not found
INFO: Attempting task_type=reasoning with model=llama-3.1-70b-versatile
INFO: ✓ Success: task_type=reasoning, model=llama-3.1-70b-versatile, tokens=1234
```

## Benefits

1. **Resilience**: Model deprecation ≠ app outage
2. **Flexibility**: Change models without code changes
3. **Observability**: Clear logging for debugging and cost monitoring
4. **Simplicity**: Agents don't need to know about models
5. **Safety**: Environment overrides for production emergencies

## Migration Checklist

When migrating existing code to use this system:

- [ ] Remove all hardcoded model names from agent code
- [ ] Replace direct Groq calls with `execute_*_task()` functions
- [ ] Classify tasks as fast/reasoning/summarization
- [ ] Remove model selection logic from agents
- [ ] Update tests to mock `execute_*_task()` instead of Groq
- [ ] Verify no imports of `httpx` or Groq SDK in agent code

## Testing

```python
# Mock the routing system in tests
from unittest.mock import AsyncMock, patch
from app.core.ai_models import LLMResponse

mock_response = LLMResponse(
    content="Test response",
    model_used="llama-3.1-8b-instant",
    finish_reason="stop",
    usage={"total_tokens": 100}
)

with patch("app.core.ai_models.execute_fast_task", new_callable=AsyncMock) as mock:
    mock.return_value = mock_response
    
    # Your test code here
    result = await my_agent_function()
    assert result == "expected"
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent / Service Layer                     │
│  (No model names, only task types: fast/reasoning/summary)  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Task Routing Layer (ai_models.py)               │
│  • execute_fast_task()                                       │
│  • execute_reasoning_task()                                  │
│  • execute_summarization_task()                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           Model Registry (Single Source of Truth)            │
│  MODEL_REGISTRY = {                                          │
│    "fast": ["llama-3.1-8b-instant"],                         │
│    "reasoning": ["llama-3.3-70b", "llama-3.1-70b", ...],    │
│    "fallback": ["llama-3.1-8b-instant"]                      │
│  }                                                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         Automatic Fallback Logic (execute_task)              │
│  1. Try models in priority order                             │
│  2. On failure, try next model                               │
│  3. If all fail, try universal fallback                      │
│  4. Log all attempts                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         Provider Isolation Layer (run_groq)                  │
│  • Only place that calls Groq API                            │
│  • Handles HTTP errors                                       │
│  • Returns standardized LLMResponse                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
                   Groq API (External)
```

## FAQ

**Q: What if I need a specific model for a special case?**
A: Add a new task type to MODEL_REGISTRY with your specific model list.

**Q: Can I use multiple providers (OpenAI, Anthropic)?**
A: Not currently. This system is Groq-only. Multi-provider support would require extending `run_groq()` to `run_llm()` with provider detection.

**Q: How do I test locally without Groq API key?**
A: Mock `execute_*_task()` functions in your tests (see Testing section above).

**Q: What happens if all models fail?**
A: A `RuntimeError` is raised with diagnostic information. The application should handle this gracefully (e.g., show user-friendly error message).

**Q: How do I monitor costs?**
A: Check logs for `tokens=` in success messages. Sum token usage across all requests.

## Support

For questions or issues with the model routing system:
1. Check logs for model failure messages
2. Verify `GROQ_API_KEY` is set
3. Check MODEL_REGISTRY has valid model names
4. Review Groq's model availability: https://console.groq.com/docs/models
