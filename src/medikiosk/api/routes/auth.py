"""Authentication routes for MediKiosk.

Provides token issuance for Kiosk Devices and Clinician Dashboard.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from medikiosk.api.dependencies.auth import ALLOWED_ROLES
from medikiosk.api.dependencies.container import get_settings_dep

log = structlog.get_logger(__name__)

router = APIRouter(tags=["auth"])


class TokenRequest(BaseModel):
    client_id: str = Field(description="Client identifier")
    role: str = Field(default="Kiosk_Device", description="Role to assume")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105
    expires_in: int


def _encode_b64url(data: bytes) -> str:
    """Encode bytes to base64url string."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _generate_jwt(sub: str, role: str, secret: str, ttl_seconds: int = 3600) -> str:
    """Generate an HS256 JWT."""
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {
        "sub": sub,
        "role": role,
        "iat": now,
        "exp": now + ttl_seconds,
    }

    header_b64 = _encode_b64url(json.dumps(header).encode("utf-8"))
    payload_b64 = _encode_b64url(json.dumps(payload).encode("utf-8"))

    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(
        secret.encode("utf-8"), msg=signing_input, digestmod=hashlib.sha256
    ).digest()

    signature_b64 = _encode_b64url(signature)
    return f"{header_b64}.{payload_b64}.{signature_b64}"


@router.post("/api/auth/token", response_model=TokenResponse)
async def generate_token(
    request: TokenRequest,
    settings: Annotated[Any, Depends(get_settings_dep)],
) -> TokenResponse:
    """Issue a signed HS256 JWT token."""
    if request.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of {list(ALLOWED_ROLES)}",
        )

    secret = settings.effective_jwt_secret
    ttl = 3600
    token = _generate_jwt(sub=request.client_id, role=request.role, secret=secret, ttl_seconds=ttl)

    log.info("token_issued", client_id=request.client_id, role=request.role)
    return TokenResponse(
        access_token=token,
        expires_in=ttl,
    )
