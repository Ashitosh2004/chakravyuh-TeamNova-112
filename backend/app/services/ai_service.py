"""Genuine AI provider adapter.

Provider-agnostic chat completion over async HTTP (httpx):
  - "openai"            → OpenAI Chat Completions API (default base URL)
  - "openai_compatible" → any OpenAI-compatible endpoint (AI_BASE_URL required)
  - "anthropic"         → Anthropic Messages API

Credentials live only on the server (env vars). Failures map to structured
errors: 429 for provider rate limits, 503 for unavailability, 503 with code
"ai_not_configured" when no provider credentials exist. Responses are never
fabricated: if the provider is unreachable the caller gets an honest error.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings
from app.core.exceptions import RateLimitError, ServiceUnavailableError, ValidationAppError

log = logging.getLogger("chakravyuh.ai")

DEFAULT_BASES = {
    "openai": "https://api.openai.com/v1",
    "anthropic": "https://api.anthropic.com",
}

SYSTEM_PROMPT_TEMPLATE = """You are the CHAKRAVYUH AI learning assistant for ENTC (Electronics & Telecommunication) students.
The student's level is "{level}". Adapt depth and vocabulary accordingly:
- beginner: plain language, everyday analogies, define every term.
- intermediate: standard technical vocabulary, some math.
- advanced: rigorous treatment, formulas, design trade-offs.

Style rules:
- Answer in Markdown. Keep answers focused (under ~350 words) unless the student asks for depth.
- Use fenced code blocks with a language tag for any code (Arduino/C-style examples are welcome).
- You help with: ENTC concepts, interpreting simulation/lab results, explaining quiz mistakes, and reasoning through coding challenges (guide, never just dump full solutions).
- If asked something unrelated to learning electronics/telecommunication/embedded topics, briefly answer if harmless, then steer back to the coursework.
- Never invent course content that was not provided in the context below.
{context_block}"""


def _context_block(context: dict[str, Any] | None, titles: dict[str, str]) -> str:
    if not context:
        return ""
    lines = ["", "The student is currently working with:"]
    if context.get("courseId"):
        lines.append(f"- Course: {titles.get('course', context['courseId'])} (id {context['courseId']})")
    if context.get("lessonId"):
        lines.append(f"- Lesson: {titles.get('lesson', context['lessonId'])} (id {context['lessonId']})")
    if context.get("simulationId"):
        lines.append(f"- Virtual lab simulation: {context['simulationId']}")
    if context.get("challengeId"):
        lines.append(f"- Coding challenge: {titles.get('challenge', context['challengeId'])}")
    if context.get("quizQuestionId"):
        lines.append(f"- Quiz question id: {context['quizQuestionId']}")
    if context.get("code"):
        lines.append("- The student's code so far:\n```\n" + context["code"][:3000] + "\n```")
    return "\n".join(lines)


async def complete_chat(
    *,
    level: str,
    message: str,
    history: list[dict[str, str]],
    context: dict[str, Any] | None,
    titles: dict[str, str],
) -> str:
    """Call the configured provider and return the assistant's message text."""
    if not settings.ai_configured:
        raise ServiceUnavailableError(
            "The AI assistant is not configured on this server. Ask the administrator to set "
            "AI_PROVIDER, AI_API_KEY and AI_MODEL in the backend environment.",
            code="ai_not_configured",
        )
    provider = settings.AI_PROVIDER
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        level=level, context_block=_context_block(context, titles)
    )

    if provider == "anthropic":
        return await _complete_anthropic(system_prompt, message, history)
    return await _complete_openai(system_prompt, message, history)


def _base_url() -> str:
    if settings.AI_BASE_URL:
        return settings.AI_BASE_URL.rstrip("/")
    base = DEFAULT_BASES.get(settings.AI_PROVIDER)
    if not base:
        raise ServiceUnavailableError(
            f"AI_BASE_URL must be configured for provider '{settings.AI_PROVIDER}'.", code="ai_not_configured"
        )
    return base


def _map_provider_status(status: int, detail: str) -> None:
    if status == 401 or status == 403:
        raise ServiceUnavailableError(
            "The AI provider rejected the server's credentials. Check AI_API_KEY on the server.",
            code="ai_provider_auth",
        )
    if status == 429:
        raise RateLimitError("The AI assistant is busy right now. Please try again in a moment.")
    if status >= 400:
        log.warning("AI provider returned HTTP %s", status)
        raise ServiceUnavailableError("The AI assistant could not complete the request. Please try again later.", code="ai_provider_error")


async def _complete_openai(system_prompt: str, message: str, history: list[dict[str, str]]) -> str:
    messages = [{"role": "system", "content": system_prompt}, *history, {"role": "user", "content": message}]
    payload = {
        "model": settings.AI_MODEL,
        "messages": messages,
        "max_tokens": settings.AI_MAX_OUTPUT_TOKENS,
        "temperature": 0.4,
    }
    try:
        async with httpx.AsyncClient(timeout=settings.AI_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                f"{_base_url()}/chat/completions",
                headers={"Authorization": f"Bearer {settings.AI_API_KEY}"},
                json=payload,
            )
    except httpx.TimeoutException as exc:
        raise ServiceUnavailableError("The AI assistant took too long to respond. Please try again.", code="ai_timeout") from exc
    except httpx.HTTPError as exc:
        log.warning("AI provider network error: %s", type(exc).__name__)
        raise ServiceUnavailableError("The AI assistant is unreachable right now. Please try again later.", code="ai_unreachable") from exc
    _map_provider_status(resp.status_code, resp.text[:300])
    try:
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
    except Exception as exc:  # noqa: BLE001
        raise ServiceUnavailableError("The AI provider returned an unexpected response.", code="ai_invalid_response") from exc
    if not isinstance(content, str) or not content.strip():
        raise ServiceUnavailableError("The AI provider returned an empty response.", code="ai_invalid_response")
    return content


async def _complete_anthropic(system_prompt: str, message: str, history: list[dict[str, str]]) -> str:
    payload = {
        "model": settings.AI_MODEL,
        "system": system_prompt,
        "max_tokens": settings.AI_MAX_OUTPUT_TOKENS,
        "messages": [*history, {"role": "user", "content": message}],
    }
    try:
        async with httpx.AsyncClient(timeout=settings.AI_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                f"{_base_url()}/v1/messages",
                headers={"x-api-key": settings.AI_API_KEY, "anthropic-version": "2023-06-01"},
                json=payload,
            )
    except httpx.TimeoutException as exc:
        raise ServiceUnavailableError("The AI assistant took too long to respond. Please try again.", code="ai_timeout") from exc
    except httpx.HTTPError as exc:
        log.warning("AI provider network error: %s", type(exc).__name__)
        raise ServiceUnavailableError("The AI assistant is unreachable right now. Please try again later.", code="ai_unreachable") from exc
    _map_provider_status(resp.status_code, resp.text[:300])
    try:
        data = resp.json()
        blocks = [b for b in data.get("content", []) if b.get("type") == "text"]
        content = "\n".join(b.get("text", "") for b in blocks).strip()
    except Exception as exc:  # noqa: BLE001
        raise ServiceUnavailableError("The AI provider returned an unexpected response.", code="ai_invalid_response") from exc
    if not content:
        raise ServiceUnavailableError("The AI provider returned an empty response.", code="ai_invalid_response")
    return content


def validate_provider_config() -> list[str]:
    problems: list[str] = []
    if settings.AI_PROVIDER and settings.AI_PROVIDER not in ("openai", "openai_compatible", "anthropic"):
        problems.append(f"AI_PROVIDER '{settings.AI_PROVIDER}' is not supported.")
    if settings.AI_PROVIDER in ("openai_compatible",) and not settings.AI_BASE_URL:
        problems.append("AI_PROVIDER=openai_compatible requires AI_BASE_URL.")
    if settings.AI_PROVIDER and settings.AI_API_KEY and not settings.AI_MODEL:
        problems.append("AI_MODEL is required when AI_API_KEY is set.")
    return problems
