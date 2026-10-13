"""Communications domain ports."""

from typing import Protocol


class NotificationPort(Protocol):
    """Port for sending out-of-band notifications (SMS/WhatsApp)."""

    async def send_queue_paging(
        self,
        *,
        phone_number: str,
        token_number: str,
        chamber_room: str,
        turns_ahead: int,
        language: str = "en",
    ) -> bool:
        """Send a queue paging notification to the patient.

        Args:
            phone_number: E.164 formatted phone number.
            token_number: The patient's assigned token.
            chamber_room: The chamber room they should proceed to.
            turns_ahead: How many patients are ahead of them.
            language: Language for the notification.

        Returns:
            True if sent successfully, False otherwise.
        """
        ...
