from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import bcrypt
import jwt
import os
import random
import string
from datetime import datetime, timedelta
from .db import users_collection, otp_collection
from .email_service import send_otp_email

router = APIRouter()
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "agentic_research_secret_key_demo")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


# ── Public Config Endpoint ─────────────────────────────────────────────────

@router.get("/google-client-id")
def get_google_client_id():
    """Return the Google OAuth client ID for frontend initialization."""
    return {"client_id": GOOGLE_CLIENT_ID}


# ── Pydantic Models ────────────────────────────────────────────────────────

class UserSignup(BaseModel):
    email: str
    password: str
    full_name: str
    institution: str = ""
    role: str = ""
    research_interests: str = ""

class UserAuth(BaseModel):
    email: str
    password: str

class GoogleAuth(BaseModel):
    credential: str  # Google ID token

class ForgotPasswordRequest(BaseModel):
    email: str

class VerifyOTPRequest(BaseModel):
    email: str
    otp: str

class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str


# ── Helpers ────────────────────────────────────────────────────────────────

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def _create_token(user_doc: dict) -> dict:
    """Create a JWT and return {token, email, full_name}."""
    token = jwt.encode(
        {
            "sub": str(user_doc["_id"]),
            "email": user_doc["email"],
            "exp": datetime.utcnow() + timedelta(days=7),
        },
        SECRET_KEY,
        algorithm="HS256",
    )
    return {
        "token": token,
        "email": user_doc["email"],
        "full_name": user_doc.get("full_name", ""),
    }

def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


# ── Signup ─────────────────────────────────────────────────────────────────

@router.post("/signup")
def signup(user: UserSignup):
    if users_collection is None:
        raise HTTPException(status_code=500, detail="Database connection not available")

    existing = users_collection.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = get_password_hash(user.password)
    users_collection.insert_one({
        "email": user.email,
        "password": hashed,
        "full_name": user.full_name,
        "institution": user.institution,
        "role": user.role,
        "research_interests": user.research_interests,
        "auth_provider": "local",
        "created_at": datetime.utcnow(),
    })

    # Auto-login after signup
    db_user = users_collection.find_one({"email": user.email})
    return _create_token(db_user)


# ── Login ──────────────────────────────────────────────────────────────────

@router.post("/login")
def login(user: UserAuth):
    if users_collection is None:
        raise HTTPException(status_code=500, detail="Database connection not available")

    db_user = users_collection.find_one({"email": user.email})

    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Google-only accounts have no password
    if not db_user.get("password"):
        raise HTTPException(
            status_code=401,
            detail="This account was created with Google. Please use Google Sign-In.",
        )

    if not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return _create_token(db_user)


# ── Google OAuth ───────────────────────────────────────────────────────────

@router.post("/google")
def google_login(body: GoogleAuth):
    """Verify Google ID token and login or create user."""
    if users_collection is None:
        raise HTTPException(status_code=500, detail="Database connection not available")

    if not GOOGLE_CLIENT_ID or GOOGLE_CLIENT_ID.startswith("your-"):
        raise HTTPException(
            status_code=503,
            detail="Google Sign-In is not configured on this server.",
        )

    try:
        from google.oauth2 import id_token as gid
        from google.auth.transport import requests as google_requests

        idinfo = gid.verify_oauth2_token(
            body.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {exc}")

    email = idinfo.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Google token missing email claim")

    # Find or create user
    db_user = users_collection.find_one({"email": email})
    if not db_user:
        users_collection.insert_one({
            "email": email,
            "password": None,
            "full_name": idinfo.get("name", ""),
            "institution": "",
            "role": "",
            "research_interests": "",
            "auth_provider": "google",
            "google_picture": idinfo.get("picture", ""),
            "created_at": datetime.utcnow(),
        })
        db_user = users_collection.find_one({"email": email})

    return _create_token(db_user)


# ── Forgot Password → Send OTP ────────────────────────────────────────────

@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest):
    if users_collection is None:
        raise HTTPException(status_code=500, detail="Database connection not available")

    db_user = users_collection.find_one({"email": body.email})
    if not db_user:
        # Don't reveal whether the account exists — always return success
        return {"message": "If the email is registered, an OTP has been sent."}

    if db_user.get("auth_provider") == "google" and not db_user.get("password"):
        raise HTTPException(
            status_code=400,
            detail="This account uses Google Sign-In. Password reset is not applicable.",
        )

    otp = _generate_otp()

    # Store OTP with 10-minute expiry
    if otp_collection is not None:
        otp_collection.delete_many({"email": body.email})  # Remove old OTPs
        otp_collection.insert_one({
            "email": body.email,
            "otp": otp,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(minutes=10),
            "verified": False,
        })

    # Send email
    sent = send_otp_email(body.email, otp)
    if not sent:
        raise HTTPException(
            status_code=500,
            detail="Failed to send OTP email. Please check SMTP configuration.",
        )

    return {"message": "If the email is registered, an OTP has been sent."}


# ── Verify OTP ─────────────────────────────────────────────────────────────

@router.post("/verify-otp")
def verify_otp(body: VerifyOTPRequest):
    if otp_collection is None:
        raise HTTPException(status_code=500, detail="Database connection not available")

    record = otp_collection.find_one({
        "email": body.email,
        "otp": body.otp,
        "verified": False,
    })

    if not record:
        raise HTTPException(status_code=400, detail="Invalid OTP code")

    if record["expires_at"] < datetime.utcnow():
        otp_collection.delete_one({"_id": record["_id"]})
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    # Mark as verified
    otp_collection.update_one(
        {"_id": record["_id"]},
        {"$set": {"verified": True}},
    )

    return {"message": "OTP verified successfully", "verified": True}


# ── Reset Password ─────────────────────────────────────────────────────────

@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest):
    if users_collection is None or otp_collection is None:
        raise HTTPException(status_code=500, detail="Database connection not available")

    # Verify that a valid, verified OTP exists
    verified_otp = otp_collection.find_one({
        "email": body.email,
        "verified": True,
    })
    if not verified_otp:
        raise HTTPException(
            status_code=403,
            detail="No verified OTP found. Please verify your OTP first.",
        )

    # Update password
    hashed = get_password_hash(body.new_password)
    users_collection.update_one(
        {"email": body.email},
        {"$set": {"password": hashed}},
    )

    # Clean up OTPs
    otp_collection.delete_many({"email": body.email})

    return {"message": "Password reset successfully. You can now log in."}
