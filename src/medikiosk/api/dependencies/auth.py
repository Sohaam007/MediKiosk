"""
RBAC authentication dependency for MediKiosk FastAPI routes.

Supports roles: Kiosk_Device, Triage_Nurse, Attending_Physician.
JWT secret is loaded from Settings (environment variable). NEVER hardcoded.

JWT library: PyJWT not in pyproject.toml; uses a stdlib HMAC HS256 fallback
(base64url + hmac-sha256) for compatibility without adding new dependencies.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Annotated

import structlog
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# auth.py is the wiring boundary for JWT secret retrieval — config only.
from medikiosk.adapters.config import get_settings

log = structlog.get_logger(__name__)

ALLOWED_ROLES: frozenset[str] = frozenset({"Kiosk_Device", "Triage_Nurse", "Attending_Physician"})
CLINICIAN_ROLES: frozenset[str] = frozenset({"Triage_Nurse", "Attending_Physician"})

security = HTTPBearer(auto_error=False)

# ── JWT library detection ──────────────────────────────────────────────────────
# PyJWT is not listed in pyproject.toml; use stdlib HMAC HS256 fallback.

try:
    import jwt as _pyjwt  # type: ignore[import-not-found]

    _HAVE_PYJWT = True
    log.debug("auth_jwt_backend", backend="PyJWT")
except ModuleNotFoundError:
    _HAVE_PYJWT = False
    log.debug("auth_jwt_backend", backend="stdlib-hmac-hs256-fallback")


# ── Stdlib HS256 fallback ──────────────────────────────────────────────────────


def _b64url_decode(segment: str) -> bytes:
    """Decode a base64url segment, padding as required."""
    padding = 4 - len(segment) % 4
    if padding != 4:
        segment += "=" * padding
    return base64.urlsafe_b64decode(segment)


def _b64url_encode(data: bytes) -> str:
    """Encode bytes to base64url without padding."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _hs256_decode(token: str, secret: str) -> dict[str, object]:
    """Manually decode and verify a HS256 JWT using stdlib hmac + hashlib.

    Args:
        token: Raw JWT string.
        secret: Signing secret (from Settings.api_key).

    Returns:
        Decoded claims dict.

    Raises:
        HTTPException 401: If signature invalid, token malformed, or expired.
    """
    if not secret or not secret.strip():
        log.error("jwt_secret_empty")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication secret is not configured",
        )

    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    header_b64, payload_b64, sig_b64 = parts

    # Verify signature
    signing_input = f"{header_b64}.{payload_b64}".encode()
    expected_sig = hmac.new(
        secret.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    try:
        provided_sig = _b64url_decode(sig_b64)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None

    if not hmac.compare_digest(expected_sig, provided_sig):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None

    # Decode header to confirm algorithm
    try:
        header: dict[str, object] = json.loads(_b64url_decode(header_b64))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None
    if header.get("alg") != "HS256":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None

    # Decode claims
    try:
        claims: dict[str, object] = json.loads(_b64url_decode(payload_b64))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None

    # Mandatory expiry (exp claim) check
    if "exp" not in claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing mandatory exp claim",
        )

    exp = claims["exp"]
    try:
        if int(str(exp)) < int(time.time()):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None

    return claims


# ── Core verification ──────────────────────────────────────────────────────────


def verify_jwt(
    token: str,
    required_roles: frozenset[str] | None = None,
) -> dict[str, object]:
    """Decode and verify a JWT, optionally enforcing role membership.

    JWT secret is read from Settings.api_key — never hardcoded.
    The raw token value is NEVER logged.

    Args:
        token: Raw JWT bearer token string.
        required_roles: If supplied, the token's 'role' claim must be one of
                        these values. Pass None to skip role enforcement.

    Returns:
        Decoded claims dict (includes 'role', 'sub', 'exp', …).

    Raises:
        HTTPException 401: Token missing, malformed, or expired.
        HTTPException 403: Role claim absent or not in required_roles.
    """
    settings = get_settings()
    secret: str = settings.effective_jwt_secret

    if not secret or not secret.strip():
        log.error("jwt_secret_empty")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication secret is not configured",
        )

    if _HAVE_PYJWT:
        try:
            claims: dict[str, object] = _pyjwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                options={"require": ["exp"]},
            )
        except _pyjwt.ExpiredSignatureError:
            log.warning("jwt_expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            ) from None
        except _pyjwt.PyJWTError:
            log.warning("jwt_invalid")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            ) from None
    else:
        claims = _hs256_decode(token, secret)

    if required_roles is not None:
        role = claims.get("role")
        if role not in required_roles:
            log.warning("jwt_insufficient_role", role=role)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role",
            )

    return claims


# ── FastAPI dependency functions ───────────────────────────────────────────────


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)] = None,
    token: Annotated[
        str | None, Query(description="JWT token for SSE/WebSocket clients")
    ] = None,
) -> dict[str, object]:
    """FastAPI dependency: authenticate the request and return JWT claims.

    Supports Authorization Bearer header, with query parameter fallback
    for browser EventSource (SSE) connections.

    Args:
        credentials: Injected by HTTPBearer. None if Authorization header absent.
        token: Injected by Query. None if token parameter absent.

    Returns:
        Decoded JWT claims dict.

    Raises:
        HTTPException 401: If credentials are missing or token is invalid.
    """
    raw_token = credentials.credentials if credentials is not None else token
    if raw_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization required",
        )
    return verify_jwt(raw_token)


async def require_clinician(
    current_user: Annotated[dict[str, object], Depends(get_current_user)],
) -> dict[str, object]:
    """FastAPI dependency: require Triage_Nurse or Attending_Physician role.

    Args:
        current_user: Claims from get_current_user.

    Returns:
        The same claims dict if role check passes.

    Raises:
        HTTPException 403: If the caller is not a clinician.
    """
    role = current_user.get("role")
    if role not in CLINICIAN_ROLES:
        log.warning("rbac_denied", required="clinician", role=role)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Clinician role required",
        )
    return current_user


async def require_kiosk_or_clinician(
    current_user: Annotated[dict[str, object], Depends(get_current_user)],
) -> dict[str, object]:
    """FastAPI dependency: require any known MediKiosk role.

    Accepts Kiosk_Device, Triage_Nurse, or Attending_Physician.

    Args:
        current_user: Claims from get_current_user.

    Returns:
        The same claims dict if role check passes.

    Raises:
        HTTPException 403: If the caller has an unrecognised role.
    """
    role = current_user.get("role")
    if role not in ALLOWED_ROLES:
        log.warning("rbac_denied", required="kiosk_or_clinician", role=role)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return current_user
