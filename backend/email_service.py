"""
SMTP e-mail helper — sends OTP codes for the forgot-password flow.

Reads configuration from environment variables:
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_NAME
"""

import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def send_otp_email(to_email: str, otp_code: str) -> bool:
    """Send a styled HTML e-mail with the 6-digit OTP.

    Returns True on success, False on failure (logs the error).
    """
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    from_name = os.getenv("SMTP_FROM_NAME", "Agentic Research Bot")

    if not user or not password:
        print("⚠ SMTP credentials not configured — cannot send OTP e-mail.")
        return False

    subject = f"Your Password Reset Code — {otp_code}"

    html_body = f"""
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f0f1a;border-radius:16px;border:1px solid #23233a;">
        <div style="text-align:center;margin-bottom:24px;">
            <span style="font-size:32px;">⚗️</span>
            <h2 style="color:#e2e2f0;margin:8px 0 0;font-size:20px;">Agentic Research Bot</h2>
        </div>
        <p style="color:#a1a1b5;font-size:15px;line-height:1.6;text-align:center;">
            You requested a password reset. Use the code below to verify your identity.
        </p>
        <div style="text-align:center;margin:28px 0;">
            <div style="display:inline-block;background:linear-gradient(135deg,#6366f1,#818cf8);padding:16px 36px;border-radius:12px;letter-spacing:10px;font-size:32px;font-weight:800;color:#fff;">
                {otp_code}
            </div>
        </div>
        <p style="color:#6b6b80;font-size:13px;text-align:center;line-height:1.5;">
            This code expires in <strong style="color:#a1a1b5;">10 minutes</strong>.<br>
            If you didn't request this, you can safely ignore this email.
        </p>
        <hr style="border:none;border-top:1px solid #23233a;margin:24px 0;">
        <p style="color:#4a4a5a;font-size:11px;text-align:center;">
            Agentic Research Bot &mdash; AI-Powered Research Intelligence
        </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{user}>"
    msg["To"] = to_email

    # Plain-text fallback
    plain = f"Your Agentic Research Bot password reset code is: {otp_code}\n\nThis code expires in 10 minutes."
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(host, port, timeout=10) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(user, to_email, msg.as_string())
        print(f"✅ OTP email sent to {to_email}")
        return True
    except Exception as exc:
        print(f"❌ Failed to send OTP email: {exc}")
        return False
