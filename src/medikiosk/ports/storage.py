"""Storage and cache port interfaces.

Defines abstract contracts for file storage and key-value cache backends.
Implementations live in adapters/storage/ and adapters/cache/.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable


@runtime_checkable
class StoragePort(Protocol):
    """Abstract interface for blob/file storage backends.

    Used for storing audio recordings and scanned document images.
    Files are addressed by a string key (content-addressable naming recommended).

    Security: stored files must NOT be accessible via public URLs without
    signed/time-limited tokens.
    """

    async def save(
        self,
        key: str,
        data: bytes,
        content_type: str,
    ) -> str:
        """Store bytes under a given key.

        Args:
            key: Storage key (e.g. 'audio/{session_id}/{uuid}.wav').
            data: Raw bytes to store.
            content_type: MIME type (e.g. 'audio/wav', 'image/jpeg').

        Returns:
            The storage key (same as input, or a normalised variant).

        Raises:
            StorageError: On write failure or size limit exceeded.
        """
        ...

    async def get(self, key: str) -> bytes | None:
        """Retrieve bytes by key.

        Args:
            key: Storage key to retrieve.

        Returns:
            Raw bytes if found, None if key does not exist.

        Raises:
            StorageError: On read failure.
        """
        ...

    async def delete(self, key: str) -> None:
        """Delete a file by key.

        Used during session purge (DPDP \u00a78(7) right to erasure).

        Args:
            key: Storage key to delete.

        Raises:
            StorageError: On delete failure.
        """
        ...

    async def exists(self, key: str) -> bool:
        """Check if a key exists in storage.

        Args:
            key: Storage key to check.

        Returns:
            True if the key exists, False otherwise.

        Raises:
            StorageError: On check failure.
        """
        ...
