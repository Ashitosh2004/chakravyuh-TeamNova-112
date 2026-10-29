"""Optional SMTP email delivery (password reset). If SMTP is not configured the
caller must honestly report that no email was sent — never fake delivery."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from anyio import to_thread

from app.core.config import settings

log = logging.getLogger("chakravyuh.email")


def email_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM)


def _send_sync(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    if settings.SMTP_TLS:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.starttls()
            if settings.SMTP_USERNAME:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_USERNAME:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)


async def send_email(to: str, subject: str, body: str) -> bool:
    if not email_configured():
        return False
    try:
        await to_thread.run_sync(_send_sync, to, subject, body)
        return True
    except Exception:  # noqa: BLE001 - never leak SMTP details
        log.error("Email delivery to %s failed", to)
        return False
