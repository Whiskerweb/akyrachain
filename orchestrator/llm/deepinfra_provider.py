"""DeepInfra LLM provider (Llama, Mixtral, etc.)."""

import httpx

from llm.base import LLMProvider, LLMResponse

PRICING = {
    "meta-llama/Llama-3.3-70B-Instruct": {"input": 0.35, "output": 0.40},
    "meta-llama/Llama-3.3-70B-Instruct-Turbo": {"input": 0.35, "output": 0.40},
    "mistralai/Mixtral-8x22B-Instruct-v0.1": {"input": 0.65, "output": 0.65},
    "mistralai/Mistral-7B-Instruct-v0.3": {"input": 0.07, "output": 0.07},
    "Qwen/Qwen2.5-72B-Instruct": {"input": 0.35, "output": 0.40},
}

DEFAULT_PRICING = {"input": 0.50, "output": 0.50}


class DeepInfraProvider(LLMProvider):
    BASE_URL = "https://api.deepinfra.com/v1/openai/chat/completions"

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
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
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
