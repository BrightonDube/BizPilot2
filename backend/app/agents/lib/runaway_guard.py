"""
backend/app/agents/lib/runaway_guard.py

Runaway protection for AI agents.
Returns a graceful result instead of raising exceptions so the user
always gets a readable response even when limits are hit.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import List

from app.agents.constants import Limits

logger = logging.getLogger("bizpilot.agents")


@dataclass
class GuardResult:
    """Returned by the guard when a limit is triggered."""

    stopped: bool = False
    reason: str = ""
    steps_completed: int = 0
    tokens_used: int = 0
    # A human-readable summary of what completed before stopping
    partial_summary: str = ""


@dataclass
class RunawayGuard:
    """
    Monitors step counts, token usage, and wall-clock timeout.

    Call check() after every agent step. It returns a GuardResult
    so the orchestrator can decide how to respond — no exceptions thrown.
    """

    max_steps: int = Limits.MAX_STEPS
    max_tokens: int = Limits.MAX_TOKENS_PER_TASK
    timeout_seconds: int = Limits.TIMEOUT_SECONDS

    current_steps: int = field(default=0, init=False)
    total_tokens: int = field(default=0, init=False)
    completed_actions: List[str] = field(default_factory=list, init=False)

    def record_step(self, description: str, tokens_used: int) -> GuardResult:
        """
        Record a completed step and check all limits.

        Returns a stopped GuardResult if any limit is hit.
        Returns a non-stopped GuardResult if all limits are within bounds.
        """
        self.current_steps += 1
        self.total_tokens += tokens_used
        self.completed_actions.append(description)

        if self.current_steps >= self.max_steps:
            logger.warning(
                "RunawayGuard: step limit %d reached after %d steps",
                self.max_steps,
                self.current_steps,
            )
            return self._build_stop_result(
                f"Reached the maximum of {self.max_steps} steps."
            )

        if self.total_tokens >= self.max_tokens:
            logger.warning(
                "RunawayGuard: token limit %d reached at %d tokens",
                self.max_tokens,
                self.total_tokens,
            )
            return self._build_stop_result(
                f"Reached the token budget of {self.max_tokens} tokens."
            )

        # All limits are within bounds — continue normally
        return GuardResult(
            stopped=False,
            steps_completed=self.current_steps,
            tokens_used=self.total_tokens,
        )

    def _build_stop_result(self, reason: str) -> GuardResult:
        """Build a GuardResult that signals the agent must stop."""
        summary = (
            f"I stopped after {self.current_steps} step(s) because {reason}\n\n"
            f"**What I completed before stopping:**\n"
            + "\n".join(f"- {a}" for a in self.completed_actions)
            + "\n\nPlease try a more specific request or break the task into smaller steps."
        )
        return GuardResult(
            stopped=True,
            reason=reason,
            steps_completed=self.current_steps,
            tokens_used=self.total_tokens,
            partial_summary=summary,
        )
