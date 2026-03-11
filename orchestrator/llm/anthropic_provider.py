"""Anthropic LLM provider (Claude Sonnet, Opus, Haiku)."""

import httpx

from llm.base import LLMProvider, LLMResponse

PRICING = {
    "claude-sonnet-4-6": {"input": 3.00, "output": 15.00},
    "claude-opus-4-6": {"input": 15.00, "output": 75.00},
    "claude-haiku-4-5-20251001": {"input": 0.80, "output": 4.00},
}


class AnthropicProvider(LLMProvider):
    BASE_URL = "https://api.anthropic.com/v1/messages"

    async def complete(
        self,
        api_key: str,
        model: str,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 500,
        temperature: float = 0.8,
    ) -> LLMResponse:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                self.BASE_URL,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                },
            )
            resp.raise_for_status()
            data = resp.json()

        content = data["content"][0]["text"]
        usage = data.get("usage", {})
        input_tokens = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)

        return LLMResponse(
            content=content,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=self.estimate_cost(model, input_tokens, output_tokens),
        )

    def estimate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        pricing = PRICING.get(model, PRICING["claude-sonnet-4-6"])
        return (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000
