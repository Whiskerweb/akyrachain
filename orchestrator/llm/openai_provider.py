"""OpenAI LLM provider (GPT-4o, GPT-4o-mini)."""

import httpx

from llm.base import LLMProvider, LLMResponse

# Cost per 1M tokens (USD)
PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4.1": {"input": 2.00, "output": 8.00},
    "gpt-4.1-mini": {"input": 0.40, "output": 1.60},
    "gpt-4.1-nano": {"input": 0.10, "output": 0.40},
}


class OpenAIProvider(LLMProvider):
    BASE_URL = "https://api.openai.com/v1/chat/completions"

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
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            data = resp.json()

        choice = data["choices"][0]
        usage = data.get("usage", {})
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)

        return LLMResponse(
            content=choice["message"]["content"],
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=self.estimate_cost(model, input_tokens, output_tokens),
        )

    def estimate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        pricing = PRICING.get(model, PRICING["gpt-4o-mini"])
        return (input_tokens * pricing["input"] + output_tokens * pricing["output"]) / 1_000_000
