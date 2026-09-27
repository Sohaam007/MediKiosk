"""LLM port interface.

Defines the abstract contract for all LLM provider adapters.
Implementations live in adapters/llm/ (gemini.py, openai_adapter.py).

Domain and services ONLY import from this module \u2014 never from adapters/llm/ directly.
"""

from __future__ import annotations

from typing import Protocol, TypeVar, runtime_checkable

T = TypeVar("T")


@runtime_checkable
class LLMPort(Protocol):
    """Abstract interface for LLM provider backends.

    All methods are async. Adapters must translate provider-specific errors
    into domain errors (LLMError, LLMParseError) before raising.

    LLM Security Rules (enforced here by contract):
    - Each call is stateless: no conversation history is carried between calls.
    - Callers are responsible for parameterising patient text into prompts
      (never string concatenation).
    - max_input_tokens is enforced by the adapter to prevent token-bomb DoS.
    """

    async def generate(
        self,
        prompt: str,
        system: str,
        *,
        temperature: float = 0.3,
    ) -> str:
        """Generate a text response from a prompt.

        Args:
            prompt: The user-turn prompt. Must NOT be constructed by concatenating
                    patient text directly \u2014 use parameterised templates.
            system: The system instruction (anti-injection preamble + task).
            temperature: Sampling temperature [0.0, 1.0]. Default 0.3 for
                         clinical consistency.

        Returns:
            Raw generated text string.

        Raises:
            LLMError: On provider API failure or timeout.
        """
        ...

    async def generate_structured(
        self,
        prompt: str,
        system: str,
        response_schema: type[T],
        *,
        temperature: float = 0.1,
    ) -> T:
        """Generate and parse a structured response matching a Pydantic schema.

        The adapter MUST validate the LLM response against response_schema
        before returning. If parsing fails, it retries up to 3 times, then
        raises LLMParseError.

        Args:
            prompt: The user-turn prompt.
            system: System instruction including output format spec.
            response_schema: Pydantic model class the response must conform to.
            temperature: Sampling temperature. Low default for structured output.

        Returns:
            Validated instance of response_schema.

        Raises:
            LLMError: On provider API failure.
            LLMParseError: If all retries fail to produce a valid response.
        """
        ...

    async def generate_vision(
        self,
        prompt: str,
        image_bytes: bytes,
        mime_type: str,
        *,
        system: str = "",
    ) -> str:
        """Generate a text response from a prompt and an image.

        Used by the OCR pipeline to extract text from scanned medical documents.

        Args:
            prompt: The user-turn prompt describing the extraction task.
            image_bytes: Raw image bytes (JPEG, PNG, or WebP only).
            mime_type: MIME type of the image ('image/jpeg', 'image/png', etc.).
            system: Optional system instruction.

        Returns:
            Extracted/described text from the image.

        Raises:
            LLMError: On provider API failure or unsupported image format.
            ValidationError: If image exceeds size/dimension limits.
        """
        ...
