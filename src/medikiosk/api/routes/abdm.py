"""ABDM Scan & Share Integration routes.

Provides endpoints for the National Health Authority (NHA) ABDM Gateway:
- GET /api/abdm/generate-qr: Generates dynamic counter QR code and token for patient scan.
- POST /api/abdm/webhook: Receives demographic profile payload from ABHA app / NHA Gateway.
- GET /api/abdm/events/{session_id}: Server-Sent Events (SSE) stream for profile receipt.

SECURITY: Never log patient names, ABHA numbers, or phone numbers (PHI protection).
Only session IDs, tokens, and operational metadata may appear in structured logs.
"""

from __future__ import annotations

import asyncio
import json
import secrets
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from medikiosk.api.dependencies.container import get_session_service_dep
from medikiosk.domain.errors import SessionExpiredError, SessionNotFoundError
from medikiosk.services.session_service import SessionService

log = structlog.get_logger(__name__)

router = APIRouter(tags=["abdm"])

# In-memory pub-sub registry for real-time SSE dispatch
_SUBSCRIBERS: dict[str, list[asyncio.Queue[dict[str, Any]]]] = {}
_TOKEN_REGISTRY: dict[str, dict[str, Any]] = {}
MAX_TOKEN_REGISTRY_SIZE = 5000


def _prune_token_registry() -> None:
    """Evict expired counter tokens from the in-memory registry."""
    now = datetime.now(UTC)
    expired_keys = [
        k for k, v in _TOKEN_REGISTRY.items() if v.get("expires_at") and v["expires_at"] < now
    ]
    for k in expired_keys:
        _TOKEN_REGISTRY.pop(k, None)

    # Evict oldest entries if total registry size exceeds capacity
    if len(_TOKEN_REGISTRY) > MAX_TOKEN_REGISTRY_SIZE:
        excess = len(_TOKEN_REGISTRY) - MAX_TOKEN_REGISTRY_SIZE
        for k in list(_TOKEN_REGISTRY.keys())[:excess]:
            _TOKEN_REGISTRY.pop(k, None)


def _subscribe(key: str, q: asyncio.Queue[dict[str, Any]]) -> None:
    clean_key = key.strip() if key else ""
    if not clean_key:
        return
    if clean_key not in _SUBSCRIBERS:
        _SUBSCRIBERS[clean_key] = []
    _SUBSCRIBERS[clean_key].append(q)


def _unsubscribe(key: str, q: asyncio.Queue[dict[str, Any]]) -> None:
    clean_key = key.strip() if key else ""
    if not clean_key or clean_key not in _SUBSCRIBERS:
        return
    try:
        _SUBSCRIBERS[clean_key].remove(q)
        if not _SUBSCRIBERS[clean_key]:
            _SUBSCRIBERS.pop(clean_key, None)
    except ValueError:
        pass


def _broadcast(keys: list[str], data: dict[str, Any]) -> None:
    seen_queues: set[int] = set()
    for key in keys:
        clean_key = key.strip() if key else ""
        if not clean_key or clean_key not in _SUBSCRIBERS:
            continue
        for q in list(_SUBSCRIBERS.get(clean_key, [])):
            if id(q) not in seen_queues:
                seen_queues.add(id(q))
                try:
                    q.put_nowait(data)
                except asyncio.QueueFull:
                    log.warning("abdm_sse_queue_full_dropped_event", key=clean_key)
                except Exception as exc:
                    log.warning(
                        "abdm_sse_broadcast_put_failed",
                        key=clean_key,
                        exc_type=type(exc).__name__,
                    )


# ── Schemas ───────────────────────────────────────────────────────────────────


class ABDMGenerateQRResponse(BaseModel):
    """Payload returned for display as an ABDM Scan & Share QR code."""

    token: str = Field(
        ...,
        description="Unique counter token assigned to this scan transaction",
    )
    hip_id: str = Field(
        default="IN0810000001",
        description="Health Information Provider ID (Hospital NHA ID)",
    )
    hip_name: str = Field(
        default="St. Ananya Hospital",
        description="Registered hospital facility name",
    )
    counter_id: str = Field(
        default="KIOSK-01",
        description="Physical kiosk counter / terminal code",
    )
    intent: str = Field(
        default="ABHA_SCAN_AND_SHARE",
        description="ABDM Scan and Share intent",
    )
    qr_code_data: str = Field(
        ...,
        description="Serialized JSON payload string for QR code generation",
    )
    expires_at: str = Field(
        ...,
        description="ISO UTC timestamp when QR code expires",
    )
    session_id: UUID | None = Field(
        default=None,
        description="Active session UUID if linked",
    )


class ABDMWebhookPayload(BaseModel):
    """Demographic profile payload sent by the ABDM Gateway / ABHA app upon scan."""

    token: str = Field(
        ...,
        min_length=1,
        description="Counter / transaction token from scanned QR code",
    )
    session_id: UUID | None = Field(
        default=None,
        description="Optional active session UUID",
    )
    name: str = Field(
        ...,
        min_length=1,
        description="Patient full name from ABHA profile",
    )
    age: int = Field(
        default=30,
        ge=0,
        le=125,
        description="Patient age in years",
    )
    gender: str = Field(
        default="Male",
        description="Patient gender (Male, Female, Other)",
    )
    abha_id: str = Field(
        ...,
        min_length=1,
        description="14-digit ABHA number or ABHA address",
    )
    phone_number: str | None = Field(
        default=None,
        description="Registered mobile number",
    )
    encrypted_payload: str | None = Field(
        default=None,
        description="Optional encrypted demographic block",
    )

    @field_validator("token", "name", "abha_id")
    @classmethod
    def validate_non_blank(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field cannot be blank or whitespace only")
        return s


class ABDMWebhookResponse(BaseModel):
    """Response returned to ABDM Gateway acknowledging profile ingestion."""

    status: str = Field(
        default="ACK",
        description="Acknowledgement status",
    )
    message: str = Field(
        default="Demographic profile received and broadcast",
        description="Status message",
    )
    token: str = Field(
        ...,
        description="Transaction token",
    )
    session_id: UUID | None = Field(
        default=None,
        description="Linked session ID",
    )


# ── Routes ───────────────────────────────────────────────────────────────────


@router.get("/api/abdm/generate-qr", response_model=ABDMGenerateQRResponse)
async def generate_abdm_qr(
    session_id: Annotated[
        UUID | None,
        Query(description="Active intake session identifier"),
    ] = None,
    kiosk_id: Annotated[
        str,
        Query(description="Physical kiosk identifier"),
    ] = "KIOSK-01",
) -> ABDMGenerateQRResponse:
    """Generate dynamic ABDM Scan & Share QR code payload and counter token.

    Returns the formatted NHA ABDM JSON structure containing HIP ID, counter ID,
    and a time-limited transaction token.
    """
    token = f"ABDM-{secrets.token_hex(4).upper()}"
    expires_at = datetime.now(UTC) + timedelta(minutes=15)
    expires_at_str = expires_at.isoformat()

    qr_payload = {
        "hip_id": "IN0810000001",
        "hip_name": "St. Ananya Hospital",
        "counter_id": kiosk_id,
        "token": token,
        "intent": "ABHA_SCAN_AND_SHARE",
        "expires_at": expires_at_str,
    }
    qr_code_data = json.dumps(qr_payload)

    _prune_token_registry()

    _TOKEN_REGISTRY[token] = {
        "session_id": session_id,
        "kiosk_id": kiosk_id,
        "expires_at": expires_at,
    }

    log.info(
        "abdm_qr_generated",
        token=token,
        counter_id=kiosk_id,
        has_session=session_id is not None,
    )

    return ABDMGenerateQRResponse(
        token=token,
        hip_id="IN0810000001",
        hip_name="St. Ananya Hospital",
        counter_id=kiosk_id,
        intent="ABHA_SCAN_AND_SHARE",
        qr_code_data=qr_code_data,
        expires_at=expires_at_str,
        session_id=session_id,
    )


async def _sse_streamer(
    session_key: str,
    token_key: str | None,
    max_events: int | None = None,
) -> AsyncGenerator[str, None]:
    """Yield Server-Sent Events for ABDM profile sharing."""
    clean_session = session_key.strip()
    clean_token = token_key.strip() if token_key else None

    # Bounded queue (maxsize=100) prevents memory leakage if subscriber is slow or stalled
    queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=100)
    _subscribe(clean_session, queue)
    if clean_token:
        _subscribe(clean_token, queue)

    emitted = 0
    try:
        # Initial connection acknowledgement
        conn_payload = json.dumps({"status": "connected", "channel": clean_session})
        yield f"event: ping\ndata: {conn_payload}\n\n"
        emitted += 1
        if max_events is not None and emitted >= max_events:
            return

        while True:
            try:
                # Wait up to 15 seconds for incoming profile event
                event_data = await asyncio.wait_for(queue.get(), timeout=15.0)
                event_json = json.dumps(event_data)
                # Yield both named event and raw data for maximum frontend client compatibility
                yield f"event: abha_profile_shared\ndata: {event_json}\n\n"
                yield f"data: {event_json}\n\n"
                emitted += 1
                if max_events is not None and emitted >= max_events:
                    return
            except TimeoutError:
                # Keep-alive comment to prevent socket timeout
                yield ": keepalive\n\n"
    except (asyncio.CancelledError, GeneratorExit):
        log.debug("abdm_sse_client_disconnected", session_key=clean_session)
        raise
    finally:
        _unsubscribe(clean_session, queue)
        if clean_token:
            _unsubscribe(clean_token, queue)
        # Drain remaining events to clear queue object references
        while not queue.empty():
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:
                break


@router.get("/api/abdm/events/{session_id}")
async def abdm_events_by_session(
    session_id: str,
    token: Annotated[
        str | None,
        Query(description="Optional counter token to also subscribe to"),
    ] = None,
    max_events: Annotated[
        int | None,
        Query(description="Optional limit on events before stream close"),
    ] = None,
) -> StreamingResponse:
    """Stream Server-Sent Events (SSE) for ABDM profile sharing linked to a session."""
    clean_session = session_id.strip()
    if not clean_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session ID cannot be blank",
        )
    log.info("abdm_sse_connected", session_id=clean_session, token=token)
    return StreamingResponse(
        _sse_streamer(clean_session, token, max_events=max_events),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/api/abdm/events")
async def abdm_events_query(
    session_id: Annotated[
        str,
        Query(description="Active session ID to stream"),
    ],
    token: Annotated[
        str | None,
        Query(description="Optional counter token"),
    ] = None,
    max_events: Annotated[
        int | None,
        Query(description="Optional limit on events before stream close"),
    ] = None,
) -> StreamingResponse:
    """Stream Server-Sent Events (SSE) using query parameters."""
    return await abdm_events_by_session(session_id, token, max_events=max_events)


@router.post(
    "/api/abdm/webhook",
    response_model=ABDMWebhookResponse,
    status_code=status.HTTP_200_OK,
)
async def abdm_webhook(
    payload: ABDMWebhookPayload,
    session_svc: Annotated[SessionService, Depends(get_session_service_dep)],
) -> ABDMWebhookResponse:
    """Ingest demographic profile payload from ABDM Gateway / ABHA app.

    When triggered, updates the active session state (recording DPDP consent)
    and broadcasts an SSE event to the kiosk client.
    """
    _prune_token_registry()

    # Resolve target session ID
    target_session_id = payload.session_id
    if target_session_id is None:
        reg_entry = _TOKEN_REGISTRY.get(payload.token)
        if reg_entry and reg_entry.get("session_id"):
            target_session_id = reg_entry["session_id"]

    # If linked to an active session, record DPDP consent
    if target_session_id is not None:
        try:
            await session_svc.record_consent(
                target_session_id,
                source="ABDM_SCAN_AND_SHARE",
            )
        except (SessionNotFoundError, SessionExpiredError) as exc:
            log.warning(
                "abdm_session_not_found_or_expired",
                session_id=str(target_session_id),
                reason=type(exc).__name__,
            )
        except Exception as exc:
            log.warning(
                "abdm_session_consent_update_skipped",
                session_id=str(target_session_id),
                exc_type=type(exc).__name__,
            )

    # Broadcast demographic event to listening kiosk clients
    event_payload: dict[str, Any] = {
        "event": "abha_profile_shared",
        "status": "success",
        "token": payload.token,
        "session_id": str(target_session_id) if target_session_id else None,
        "patient_name": payload.name,
        "name": payload.name,
        "age": payload.age,
        "gender": payload.gender,
        "abha_id": payload.abha_id,
        "phone_number": payload.phone_number,
    }

    channels_to_notify = [payload.token]
    if target_session_id:
        channels_to_notify.append(str(target_session_id))

    try:
        _broadcast(channels_to_notify, event_payload)
    except Exception as exc:
        log.warning(
            "abdm_broadcast_failed",
            token=payload.token,
            exc_type=type(exc).__name__,
        )

    # Log telemetry WITHOUT PHI
    log.info(
        "abdm_webhook_received",
        token=payload.token,
        has_session=target_session_id is not None,
        channels_count=len(channels_to_notify),
    )

    return ABDMWebhookResponse(
        status="ACK",
        message="Demographic profile received and broadcast",
        token=payload.token,
        session_id=target_session_id,
    )
