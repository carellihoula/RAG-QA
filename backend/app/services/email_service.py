"""
Email service using smtplib (no extra dependency).
Falls back to console output if SMTP is not configured (dev mode).
"""
import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings


# ── HTML templates ────────────────────────────────────────────────────────────

def _base_template(title: str, body_html: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px 40px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">RAG Q&amp;A</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.65);">AI-powered document Q&amp;A</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px 28px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.3px;">{title}</h1>
          {body_html}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;background:#fafafa;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            You received this email because an action was performed on your RAG Q&amp;A account.
            If you didn't request this, you can safely ignore this email.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _activation_html(link: str, expires_days: int) -> str:
    body = f"""
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
        Thanks for signing up! Click the button below to activate your account.
        This link expires in <strong>{expires_days} days</strong>.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr><td style="background:#2563eb;border-radius:8px;">
          <a href="{link}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
            Activate my account
          </a>
        </td></tr>
      </table>
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
        Or copy and paste this link:<br>
        <a href="{link}" style="color:#2563eb;word-break:break-all;">{link}</a>
      </p>
    """
    return _base_template("Activate your account", body)


def _reset_html(link: str, expires_hours: int) -> str:
    body = f"""
      <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
        We received a request to reset your password.
        Click the button below — this link expires in <strong>{expires_hours} hour{'s' if expires_hours > 1 else ''}</strong>.
      </p>
      <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr><td style="background:#2563eb;border-radius:8px;">
          <a href="{link}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
            Reset my password
          </a>
        </td></tr>
      </table>
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
        Or copy and paste this link:<br>
        <a href="{link}" style="color:#2563eb;word-break:break-all;">{link}</a>
      </p>
      <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;">
        If you didn't request a password reset, no action is needed — your password won't change.
      </p>
    """
    return _base_template("Reset your password", body)


# ── SMTP send ─────────────────────────────────────────────────────────────────

def _send_sync(to: str, subject: str, html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{settings.smtp_from_name} <{settings.smtp_from}>"
    msg["To"]      = to
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.sendmail(settings.smtp_from, [to], msg.as_string())


async def _send(to: str, subject: str, html: str, link: str) -> None:
    if not settings.smtp_host:
        # Dev fallback: print link to console
        print(f"\n{'─'*60}")
        print(f"[EMAIL – dev mode] To: {to}")
        print(f"[EMAIL – dev mode] Subject: {subject}")
        print(f"[EMAIL – dev mode] Link: {link}")
        print(f"{'─'*60}\n")
        return
    await asyncio.to_thread(_send_sync, to, subject, html)


# ── Public API ────────────────────────────────────────────────────────────────

async def send_activation_email(to: str, raw_token: str) -> None:
    link = f"{settings.frontend_url}/activate?token={raw_token}"
    html = _activation_html(link, expires_days=10)
    await _send(to, "Activate your RAG Q&A account", html, link)


async def send_reset_email(to: str, raw_token: str) -> None:
    link = f"{settings.frontend_url}/reset-password?token={raw_token}"
    html = _reset_html(link, expires_hours=settings.reset_token_expire_hours)
    await _send(to, "Reset your RAG Q&A password", html, link)