"""Abstract base class for LLM providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class LLMResponse:
    content: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float  # Estimated cost


class LLMProvider(ABC):
    """Base class all LLM providers must implement."""

    @abstractmethod
    async def complete(
        self,
        api_key: str,
        model: str,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 500,
        temperature: float = 0.8,
    ) -> LLMResponse:
        ...

    @abstractmethod
    def estimate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        ...
