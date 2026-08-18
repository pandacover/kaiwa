"""Minimal LangChain-backed conversation service."""

from __future__ import annotations

import os
import re
from collections.abc import Sequence
from typing import Any

from langchain_openrouter import ChatOpenRouter

MODEL_NAME = "deepseek/deepseek-v4-flash"
SYSTEM_PROMPT = """You are Kaiwa, a friendly voice assistant.
Keep responses natural, useful, and short unless the user asks for detail.
You may sparingly use supported speech tags such as [laugh], [chuckle], [cough],
[sigh], or [gasp] when they genuinely improve delivery. Never explain the tags.
"""
EXPRESSION_TAG_RE = re.compile(
    r"\[(?:laugh|chuckle|cough|sigh|gasp|groan|sniff|clear throat)\]",
    re.IGNORECASE,
)


class AgentConfigurationError(RuntimeError):
    """Raised when the model cannot be configured."""


class AgentService:
    """Generate one response from browser-provided conversation history."""

    def __init__(self, model: Any | None = None) -> None:
        if model is None:
            api_key = os.getenv("OPENROUTER_API_KEY")
            if not api_key:
                raise AgentConfigurationError("OPENROUTER_API_KEY is not configured")
            model = ChatOpenRouter(
                model=MODEL_NAME,
                api_key=api_key,
                temperature=0.7,
                max_tokens=500,
                max_retries=1,
            )
        self.model = model

    def reply(self, messages: Sequence[dict[str, str]]) -> dict[str, str]:
        prompt = [("system", SYSTEM_PROMPT)]
        prompt.extend(
            ("human" if message["role"] == "user" else "ai", message["content"])
            for message in messages
        )

        response = self.model.invoke(prompt)
        speech_text = self._content_as_text(response.content).strip()
        if not speech_text:
            raise RuntimeError("The model returned an empty response")

        return {
            "text": self.display_text(speech_text),
            "speech_text": speech_text,
        }

    @staticmethod
    def _content_as_text(content: Any) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "".join(
                block.get("text", "")
                for block in content
                if isinstance(block, dict) and block.get("type") == "text"
            )
        return str(content)

    @staticmethod
    def display_text(speech_text: str) -> str:
        clean = EXPRESSION_TAG_RE.sub("", speech_text)
        clean = re.sub(r"\s+([,.;!?])", r"\1", clean)
        return re.sub(r"[ \t]{2,}", " ", clean).strip()
