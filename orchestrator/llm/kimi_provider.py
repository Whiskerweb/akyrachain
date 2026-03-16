"""Moonshot Kimi LLM provider."""

import asyncio
import httpx

from llm.base import LLMProvider, LLMResponse

PRICING = {
    "kimi-k2": {"input": 0.60, "output": 2.00},
    "kimi-k2-0711-preview": {"input": 0.60, "output": 2.00},
    "kimi-k2-thinking": {"input": 0.60, "output": 2.00},
    "kimi-k2-thinking-turbo": {"input": 0.60, "output": 2.00},
    "moonshot-v1-auto": {"input": 0.24, "output": 0.24},
    "moonshot-v1-8k": {"input": 0.12, "output": 0.12},
    "moonshot-v1-32k": {"input": 0.24, "output": 0.24},
    "moonshot-v1-128k": {"input": 0.60, "output": 0.60},
}

DEFAULT_PRICING = {"input": 0.60, "output": 2.00}


class KimiProvider(LLMProvider):
    BASE_URL = "https://api.moonshot.ai/v1/chat/completions"

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
            payload = {
                "model": model,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
            }
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }

            # Retry with exponential backoff on 429
            for attempt in range(3):
                resp = await client.post(self.BASE_URL, headers=headers, json=payload)
                if resp.status_code == 429:
                    retry_after = int(resp.headers.get("Retry-After", 2 ** (attempt + 1)))
                    await asyncio.sleep(retry_after)
                    continue
                resp.raise_for_status()
                break
            else:
                resp.raise_for_status()  # raise on final 429

            data = resp.json()

        choice = data["choices"][0]["message"]
        usage = data.get("usage", {})
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)

        return LLMResponse(
            content=choice["content"],
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=self.estimate_cost(model, input_tokens, output_tokens),
        )

    def estimate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        pricing = PRICING.get(model, DEFAULT_PRICING)
        return (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000
