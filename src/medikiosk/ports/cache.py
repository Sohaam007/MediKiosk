"""Cache port interface.

Abstract contract for key-value cache backends.
Implementations: adapters/cache/memory.py (dev), adapters/cache/redis.py (prod).
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class CachePort(Protocol):
    """Abstract interface for key-value cache backends.

    Used for session-level caching (LLM response caching, rate limiting counters).
    Values are always strings \u2014 serialise/deserialise at the call site.

    Security: cache keys must never contain raw PHI. Use session_id as prefix.
    """

    async def get(self, key: str) -> str | None:
        """Get a value by key.

        Args:
            key: Cache key.

        Returns:
            Cached string value, or None if key does not exist or is expired.
        """
        ...

    async def set(self, key: str, value: str, *, ttl_seconds: int = 3600) -> None:
        """Set a key-value pair with optional TTL.

        Args:
            key: Cache key.
            value: String value to cache.
            ttl_seconds: Time-to-live in seconds. Default: 1 hour.
        """
        ...

    async def delete(self, key: str) -> None:
        """Delete a key from the cache.

        Args:
            key: Cache key to delete.
        """
        ...

    async def exists(self, key: str) -> bool:
        """Check if a key exists and is not expired.

        Args:
            key: Cache key to check.

        Returns:
            True if the key exists and is not expired.
        """
        ...
