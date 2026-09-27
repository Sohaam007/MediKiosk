"""Local filesystem storage adapter implementing StoragePort.

Content-addressable: files are stored by SHA-256 hash as filename.
For development and single-node deployments. Replace with GCS/S3 in production.
All blocking I/O is offloaded to a thread-pool executor.
"""

from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path

from medikiosk.adapters.logging import get_logger
from medikiosk.domain.errors import StorageError

log = get_logger(__name__)


class LocalStorageAdapter:
    """Filesystem-backed StoragePort.

    Args:
        base_path: Root directory for all stored files. Created if absent.
    """

    def __init__(self, base_path: str = "./storage") -> None:
        self._base = Path(base_path)
        self._base.mkdir(parents=True, exist_ok=True)
        log.info("local_storage_init", base=str(self._base.resolve()))

    def _resolve(self, key: str) -> Path:
        """Resolve a storage key to a filesystem path, sanitising the key.

        Args:
            key: Storage key (e.g. 'audio/abc.wav').

        Returns:
            Absolute Path.
        """
        safe = "".join(c for c in key if c.isalnum() or c in "-_./")
        return self._base / safe

    async def save(self, key: str, data: bytes, content_type: str) -> str:
        """Store bytes under key.

        Args:
            key: Storage key.
            data: Raw bytes.
            content_type: MIME type (informational).

        Returns:
            The storage key.

        Raises:
            StorageError: On filesystem failure.
        """
        path = self._resolve(key)
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._write, path, data)
            log.info("storage_saved", key=key, size=len(data))
            return key
        except OSError as exc:
            raise StorageError(f"Write failed: {exc.strerror}") from exc

    @staticmethod
    def _write(path: Path, data: bytes) -> None:
        """Blocking write; run in executor."""
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    async def get(self, key: str) -> bytes | None:
        """Retrieve bytes by key, returning None if absent.

        Args:
            key: Storage key.

        Returns:
            Bytes or None.

        Raises:
            StorageError: On filesystem failure.
        """
        path = self._resolve(key)
        try:
            if not path.exists():
                return None
            loop = asyncio.get_event_loop()
            data: bytes = await loop.run_in_executor(None, path.read_bytes)
            return data
        except OSError as exc:
            raise StorageError(f"Read failed: {exc.strerror}") from exc

    async def delete(self, key: str) -> None:
        """Delete a file by key (used during DPDP purge).

        Args:
            key: Storage key.

        Raises:
            StorageError: On filesystem failure.
        """
        path = self._resolve(key)
        try:
            if path.exists():
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, path.unlink)
            log.info("storage_deleted", key=key)
        except OSError as exc:
            raise StorageError(f"Delete failed: {exc.strerror}") from exc

    async def exists(self, key: str) -> bool:
        """Return True if the key exists in storage.

        Args:
            key: Storage key.

        Returns:
            True if the file exists.
        """
        return self._resolve(key).exists()


def make_content_key(data: bytes, prefix: str, ext: str) -> str:
    """Build a content-addressable storage key using SHA-256.

    Args:
        data: File bytes.
        prefix: Key prefix (e.g. 'audio', 'scans').
        ext: Extension without dot (e.g. 'wav', 'jpg').

    Returns:
        Key like 'audio/{64-char-sha256}.wav'.
    """
    sha = hashlib.sha256(data).hexdigest()
    return f"{prefix}/{sha}.{ext}"
