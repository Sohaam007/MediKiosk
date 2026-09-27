"""Mock adapter for WhatsApp notifications."""

import structlog

from medikiosk.ports.comms import NotificationPort

log = structlog.get_logger(__name__)


class MockWhatsAppNotificationAdapter(NotificationPort):
    """Mock implementation of NotificationPort for testing and local dev."""

    async def send_queue_paging(
        self,
        *,
        phone_number: str,
        token_number: str,
        chamber_room: str,
        turns_ahead: int,
        language: str = "en",
    ) -> bool:
        """Simulate sending a localized WhatsApp paging notification."""

        # Message is prepared for simulated gateway transmission (never logged)
        _message = (
            f"कृपया ध्यान दें। आपका टोकन {token_number} जल्द ही बुलाया जाएगा। "
            f"आपसे पहले {turns_ahead} मरीज हैं। कृपया {chamber_room} की ओर बढ़ें।"
            if language == "hi"
            else (
                f"Attention. Your token {token_number} will be called shortly. "
                f"There are {turns_ahead} patients ahead of you. Please proceed to {chamber_room}."
            )
        )
        _ = _message

        log.info(
            "notification_sent",
            notification_type="whatsapp",
            token_number=token_number,
            turns_ahead=turns_ahead,
            language=language,
            # PHI (phone_number and message) is intentionally scrubbed from the log payload
        )

        return True
