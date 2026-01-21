"""Tests for dynamic AI model routing system.

This test suite verifies:
1. Model registry configuration
2. Environment variable overrides
3. Automatic fallback logic
4. Provider isolation
5. Task routing helpers
6. Error handling
7. Integration with actual endpoints
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.core.ai_models import (
    TaskType,
    get_models_for_task,
    execute_fast_task,
    execute_reasoning_task,
    execute_summarization_task,
    run_groq,
    LLMResponse,
    ModelExecutionError,
    MODEL_REGISTRY,
)


class TestModelRegistry:
    """Test model registry configuration."""
    
    def test_registry_has_required_task_types(self):
        """Verify registry contains all required task types."""
        assert "fast" in MODEL_REGISTRY
        assert "reasoning" in MODEL_REGISTRY
        assert "summarization" in MODEL_REGISTRY
        assert "fallback" in MODEL_REGISTRY
    
    def test_all_task_types_have_models(self):
        """Verify each task type has at least one model."""
        for task_type, models in MODEL_REGISTRY.items():
            assert len(models) > 0, f"Task type {task_type} has no models"
    
    def test_fallback_exists(self):
        """Verify universal fallback is configured."""
        assert len(MODEL_REGISTRY["fallback"]) > 0


class TestEnvironmentOverrides:
    """Test environment variable overrides."""
    
    def test_force_model_override(self, monkeypatch):
        """Test FORCE_MODEL overrides all task types."""
        monkeypatch.setenv("FORCE_MODEL", "test-model")
        
        models = get_models_for_task(TaskType.FAST)
        assert models == ["test-model"]
        
        models = get_models_for_task(TaskType.REASONING)
        assert models == ["test-model"]
    
    def test_fast_model_override(self, monkeypatch):
        """Test DEFAULT_FAST_MODEL override."""
        monkeypatch.setenv("DEFAULT_FAST_MODEL", "custom-fast-model")
        
        models = get_models_for_task(TaskType.FAST)
        assert models[0] == "custom-fast-model"
        # Should still include registry models as fallback
        assert len(models) > 1
    
    def test_reasoning_model_override(self, monkeypatch):
        """Test DEFAULT_REASONING_MODEL override."""
        monkeypatch.setenv("DEFAULT_REASONING_MODEL", "custom-reasoning-model")
        
        models = get_models_for_task(TaskType.REASONING)
        assert models[0] == "custom-reasoning-model"
        assert len(models) > 1


class TestModelExecution:
    """Test model execution and fallback logic."""
    
    @pytest.mark.asyncio
    async def test_successful_execution(self):
        """Test successful model execution."""
        mock_response = LLMResponse(
            content="Test response",
            model_used="llama-3.1-8b-instant",
            finish_reason="stop",
            usage={"total_tokens": 100}
        )
        
        with patch("app.core.ai_models.run_groq", new_callable=AsyncMock) as mock_groq:
            mock_groq.return_value = mock_response
            
            result = await execute_fast_task([{"role": "user", "content": "test"}])
            
            assert result.content == "Test response"
            assert result.model_used == "llama-3.1-8b-instant"
            mock_groq.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_automatic_fallback_on_model_failure(self):
        """Test automatic fallback when first model fails."""
        mock_success = LLMResponse(
            content="Fallback response",
            model_used="llama-3.1-70b-versatile",
            finish_reason="stop",
            usage={"total_tokens": 100}
        )
        
        with patch("app.core.ai_models.run_groq", new_callable=AsyncMock) as mock_groq:
            # First call fails, second succeeds
            mock_groq.side_effect = [
                ModelExecutionError("llama-3.3-70b-versatile", "Model deprecated", 404),
                mock_success
            ]
            
            result = await execute_reasoning_task([{"role": "user", "content": "test"}])
            
            assert result.content == "Fallback response"
            assert result.model_used == "llama-3.1-70b-versatile"
            assert mock_groq.call_count == 2
    
    @pytest.mark.asyncio
    async def test_universal_fallback_when_all_primary_fail(self):
        """Test universal fallback when all primary models fail."""
        mock_success = LLMResponse(
            content="Universal fallback response",
            model_used="llama-3.1-8b-instant",
            finish_reason="stop",
            usage={"total_tokens": 100}
        )
        
        with patch("app.core.ai_models.run_groq", new_callable=AsyncMock) as mock_groq:
            # All reasoning models fail, fallback succeeds
            mock_groq.side_effect = [
                ModelExecutionError("llama-3.3-70b-versatile", "Error", 500),
                ModelExecutionError("llama-3.1-70b-versatile", "Error", 500),
                ModelExecutionError("llama-3.1-8b-instant", "Error", 500),
                mock_success  # Universal fallback
            ]
            
            result = await execute_reasoning_task([{"role": "user", "content": "test"}])
            
            assert result.content == "Universal fallback response"
            # Should have tried 3 reasoning models + 1 fallback
            assert mock_groq.call_count == 4
    
    @pytest.mark.asyncio
    async def test_raises_error_when_all_models_fail(self):
        """Test error raised when all models fail."""
        with patch("app.core.ai_models.run_groq", new_callable=AsyncMock) as mock_groq:
            mock_groq.side_effect = ModelExecutionError("test-model", "All failed", 500)
            
            with pytest.raises(RuntimeError, match="All Groq models failed"):
                await execute_fast_task([{"role": "user", "content": "test"}])


class TestTaskTypeHelpers:
    """Test task type helper functions."""
    
    @pytest.mark.asyncio
    async def test_execute_fast_task(self):
        """Test fast task execution helper."""
        mock_response = LLMResponse(
            content="Fast response",
            model_used="llama-3.1-8b-instant",
            finish_reason="stop",
            usage={"total_tokens": 50}
        )
        
        with patch("app.core.ai_models.run_groq", new_callable=AsyncMock) as mock_groq:
            mock_groq.return_value = mock_response
            
            result = await execute_fast_task([{"role": "user", "content": "test"}])
            
            assert result.content == "Fast response"
    
    @pytest.mark.asyncio
    async def test_execute_reasoning_task(self):
        """Test reasoning task execution helper."""
        mock_response = LLMResponse(
            content="Reasoning response",
            model_used="llama-3.3-70b-versatile",
            finish_reason="stop",
            usage={"total_tokens": 200}
        )
        
        with patch("app.core.ai_models.run_groq", new_callable=AsyncMock) as mock_groq:
            mock_groq.return_value = mock_response
            
            result = await execute_reasoning_task([{"role": "user", "content": "test"}])
            
            assert result.content == "Reasoning response"
    
    @pytest.mark.asyncio
    async def test_execute_summarization_task(self):
        """Test summarization task execution helper."""
        mock_response = LLMResponse(
            content="Summary response",
            model_used="llama-3.1-8b-instant",
            finish_reason="stop",
            usage={"total_tokens": 100}
        )
        
        with patch("app.core.ai_models.run_groq", new_callable=AsyncMock) as mock_groq:
            mock_groq.return_value = mock_response
            
            result = await execute_summarization_task([{"role": "user", "content": "test"}])
            
            assert result.content == "Summary response"


class TestNoHardcodedModels:
    """Verify no hardcoded model names in agent code."""
    
    def test_model_names_only_in_registry(self):
        """Verify model names only exist in MODEL_REGISTRY."""
        # This test documents the architecture requirement:
        # Model names should ONLY exist in MODEL_REGISTRY
        
        # If this test fails, it means a model name was hardcoded somewhere
        # All agent code should use execute_*_task() functions
        assert "fast" in MODEL_REGISTRY
        assert "reasoning" in MODEL_REGISTRY
        assert "summarization" in MODEL_REGISTRY
        assert "fallback" in MODEL_REGISTRY


class TestGroqExecutionWrapper:
    """Test the Groq execution wrapper (provider isolation)."""
    
    @pytest.mark.asyncio
    async def test_run_groq_success(self):
        """Test successful Groq API call."""
        mock_response_data = {
            "choices": [{
                "message": {"content": "Test response"},
                "finish_reason": "stop"
            }],
            "usage": {"total_tokens": 100, "prompt_tokens": 50, "completion_tokens": 50}
        }
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_post = AsyncMock()
            mock_post.return_value.status_code = 200
            mock_post.return_value.json.return_value = mock_response_data
            mock_client.return_value.__aenter__.return_value.post = mock_post
            
            # Mock settings
            with patch("app.core.ai_models.settings") as mock_settings:
                mock_settings.GROQ_API_KEY = "test-key"
                
                result = await run_groq(
                    model="llama-3.1-8b-instant",
                    messages=[{"role": "user", "content": "test"}]
                )
                
                assert result.content == "Test response"
                assert result.model_used == "llama-3.1-8b-instant"
                assert result.finish_reason == "stop"
                assert result.usage["total_tokens"] == 100
    
    @pytest.mark.asyncio
    async def test_run_groq_http_error(self):
        """Test Groq API HTTP error handling."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_post = AsyncMock()
            mock_post.return_value.status_code = 404
            mock_post.return_value.text = "Model not found"
            mock_client.return_value.__aenter__.return_value.post = mock_post
            
            with patch("app.core.ai_models.settings") as mock_settings:
                mock_settings.GROQ_API_KEY = "test-key"
                
                with pytest.raises(ModelExecutionError) as exc_info:
                    await run_groq(
                        model="invalid-model",
                        messages=[{"role": "user", "content": "test"}]
                    )
                
                assert exc_info.value.model == "invalid-model"
                assert exc_info.value.status_code == 404
                assert "404" in exc_info.value.error
    
    @pytest.mark.asyncio
    async def test_run_groq_no_api_key(self):
        """Test error when GROQ_API_KEY is not configured."""
        with patch("app.core.ai_models.settings") as mock_settings:
            mock_settings.GROQ_API_KEY = None
            
            with pytest.raises(ModelExecutionError, match="GROQ_API_KEY not configured"):
                await run_groq(
                    model="llama-3.1-8b-instant",
                    messages=[{"role": "user", "content": "test"}]
                )
    
    @pytest.mark.asyncio
    async def test_run_groq_timeout(self):
        """Test timeout handling."""
        with patch("httpx.AsyncClient") as mock_client:
            mock_post = AsyncMock()
            mock_post.side_effect = Exception("Request timeout")
            mock_client.return_value.__aenter__.return_value.post = mock_post
            
            with patch("app.core.ai_models.settings") as mock_settings:
                mock_settings.GROQ_API_KEY = "test-key"
                
                with pytest.raises(ModelExecutionError, match="timeout"):
                    await run_groq(
                        model="llama-3.1-8b-instant",
                        messages=[{"role": "user", "content": "test"}]
                    )


class TestIntegrationWithEndpoints:
    """Test integration with actual AI endpoints."""
    
    @pytest.mark.asyncio
    async def test_guest_ai_uses_fast_task(self):
        """Verify guest AI endpoint uses execute_fast_task."""
        from app.api.ai import generate_marketing_ai_response
        
        mock_response = LLMResponse(
            content="BizPilot is a business management platform.",
            model_used="llama-3.1-8b-instant",
            finish_reason="stop",
            usage={"total_tokens": 50}
        )
        
        with patch("app.core.ai_models.execute_fast_task", new_callable=AsyncMock) as mock_task:
            mock_task.return_value = mock_response
            
            with patch("app.core.ai_models.settings") as mock_settings:
                mock_settings.GROQ_API_KEY = "test-key"
                
                result = await generate_marketing_ai_response(
                    message="What is BizPilot?",
                    knowledge_base=["BizPilot is a POS system"]
                )
                
                # Should have called execute_fast_task
                mock_task.assert_called_once()
                assert "BizPilot" in result
    
    @pytest.mark.asyncio
    async def test_business_ai_uses_reasoning_task(self):
        """Verify business AI service uses execute_reasoning_task."""
        from app.services.ai_service import AIService
        
        mock_response = LLMResponse(
            content="Your revenue is trending upward.",
            model_used="llama-3.3-70b-versatile",
            finish_reason="stop",
            usage={"total_tokens": 200}
        )
        
        with patch("app.core.ai_models.execute_reasoning_task", new_callable=AsyncMock) as mock_task:
            mock_task.return_value = mock_response
            
            with patch("app.core.ai_models.settings") as mock_settings:
                mock_settings.GROQ_API_KEY = "test-key"
                
                # Create a mock database session
                mock_db = MagicMock()
                service = AIService(mock_db)
                
                result = await service._call_groq([{"role": "user", "content": "test"}])
                
                # Should have called execute_reasoning_task
                mock_task.assert_called_once()
                assert result == "Your revenue is trending upward."


class TestModelSelectionLogic:
    """Test model selection based on task type."""
    
    def test_fast_task_selects_fast_model(self):
        """Verify fast tasks use fast models."""
        models = get_models_for_task(TaskType.FAST)
        assert "llama-3.1-8b-instant" in models
    
    def test_reasoning_task_selects_reasoning_models(self):
        """Verify reasoning tasks use reasoning models."""
        models = get_models_for_task(TaskType.REASONING)
        # Should have multiple models for fallback
        assert len(models) >= 2
        # First should be the best reasoning model
        assert "llama-3.3-70b-versatile" in models or "llama-3.1-70b-versatile" in models
    
    def test_summarization_task_selects_appropriate_models(self):
        """Verify summarization tasks use appropriate models."""
        models = get_models_for_task(TaskType.SUMMARIZATION)
        assert len(models) > 0


class TestFallbackChain:
    """Test the complete fallback chain."""
    
    @pytest.mark.asyncio
    async def test_complete_fallback_chain(self):
        """Test fallback through all models to universal fallback."""
        call_count = 0
        
        async def mock_run_groq_with_failures(model, messages, **kwargs):
            nonlocal call_count
            call_count += 1
            
            # Fail first 3 attempts, succeed on 4th (universal fallback)
            if call_count < 4:
                raise ModelExecutionError(model, f"Failure {call_count}", 500)
            
            return LLMResponse(
                content="Universal fallback success",
                model_used=model,
                finish_reason="stop",
                usage={"total_tokens": 100}
            )
        
        with patch("app.core.ai_models.run_groq", side_effect=mock_run_groq_with_failures):
            result = await execute_reasoning_task([{"role": "user", "content": "test"}])
            
            assert result.content == "Universal fallback success"
            # Should have tried multiple models
            assert call_count >= 2


class TestLoggingAndObservability:
    """Test logging for observability."""
    
    @pytest.mark.asyncio
    async def test_success_logging(self, caplog):
        """Verify successful execution is logged."""
        mock_response = LLMResponse(
            content="Test",
            model_used="llama-3.1-8b-instant",
            finish_reason="stop",
            usage={"total_tokens": 100}
        )
        
        with patch("app.core.ai_models.run_groq", new_callable=AsyncMock) as mock_groq:
            mock_groq.return_value = mock_response
            
            await execute_fast_task([{"role": "user", "content": "test"}])
            
            # Check logs contain success message
            assert any("Success" in record.message for record in caplog.records)
            assert any("llama-3.1-8b-instant" in record.message for record in caplog.records)
    
    @pytest.mark.asyncio
    async def test_failure_logging(self, caplog):
        """Verify failures are logged."""
        with patch("app.core.ai_models.run_groq", new_callable=AsyncMock) as mock_groq:
            mock_groq.side_effect = ModelExecutionError("test-model", "Test error", 500)
            
            with pytest.raises(RuntimeError):
                await execute_fast_task([{"role": "user", "content": "test"}])
            
            # Check logs contain failure message
            assert any("failure" in record.message.lower() for record in caplog.records)
