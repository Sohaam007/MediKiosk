"""In-memory cache adapter with TTL support implementing CachePort.

Thread-safe via asyncio.Lock. Lazy expiry on access.
For development and testing. Replace with Redis adapter in production.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass

from medikiosk.adapters.logging import get_logger

log = get_logger(__name__)


@dataclass
class _Entry:
    """A single cache entry."""

    value: str
    expires_at: float  # monotonic clock

    def expired(self) -> bool:
        """Return True if this entry has passed its TTL."""
        return time.monotonic() > self.expires_at


class InMemoryCacheAdapter:
    """Dict-backed CachePort with TTL and asyncio.Lock.

    All state is private; no public dict exposure.
    Entries are lazily evicted on access.
    """

    def __init__(self) -> None:
        self._store: dict[str, _Entry] = {}
        self._lock = asyncio.Lock()
        log.info("memory_cache_init")

    async def get(self, key: str) -> str | None:
        """Return cached value or None if absent/expired.

        Args:
            key: Cache key.

        Returns:
            Cached string or None.
        """
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            if entry.expired():
                del self._store[key]
                return None
            return entry.value

    async def set(self, key: str, value: str, *, ttl_seconds: int = 3600) -> None:
        """Store a key with TTL.

        Args:
            key: Cache key.
            value: String value.
            ttl_seconds: TTL in seconds.
        """
        async with self._lock:
            self._store[key] = _Entry(
                value=value,
                expires_at=time.monotonic() + ttl_seconds,
            )

    async def delete(self, key: str) -> None:
        """Remove a key from the cache.

        Args:
            key: Cache key.
        """
        async with self._lock:
            self._store.pop(key, None)

    async def exists(self, key: str) -> bool:
        """Check if a non-expired key exists.

        Args:
            key: Cache key.

        Returns:
            True if present and not expired.
        """
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return False
            if entry.expired():
                del self._store[key]
                return False
            return True

    async def clear(self) -> None:
        """Clear all entries. Use in tests."""
        async with self._lock:
            self._store.clear()

    @property
    def size(self) -> int:
        """Count of currently non-expired entries."""
        return sum(1 for e in self._store.values() if not e.expired())
