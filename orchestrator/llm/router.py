"""LLM provider router — factory that returns the correct provider."""

from llm.base import LLMProvider, LLMResponse
from llm.openai_provider import OpenAIProvider
from llm.anthropic_provider import AnthropicProvider
from llm.deepinfra_provider import DeepInfraProvider
from llm.kimi_provider import KimiProvider

PROVIDERS: dict[str, LLMProvider] = {
    "openai": OpenAIProvider(),
    "anthropic": AnthropicProvider(),
    "deepinfra": DeepInfraProvider(),
    "kimi": KimiProvider(),
}

VALID_PROVIDERS = set(PROVIDERS.keys())


def get_provider(name: str) -> LLMProvider:
    """Get an LLM provider by name. Raises ValueError if unknown."""
    provider = PROVIDERS.get(name)
    if provider is None:
        raise ValueError(f"Unknown LLM provider: {name}. Valid: {', '.join(VALID_PROVIDERS)}")
    return provider


async def llm_complete(
    provider_name: str,
    api_key: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 500,
    temperature: float = 0.8,
) -> LLMResponse:
    """One-shot helper: route to the right provider and call complete()."""
    provider = get_provider(provider_name)
    return await provider.complete(
        api_key=api_key,
        model=model,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        max_tokens=max_tokens,
        temperature=temperature,
    )
