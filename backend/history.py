from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import jwt
from .db import history_collection
from .auth import SECRET_KEY

router = APIRouter()


def get_user_email(authorization: str = Header(None)) -> str:
    """Extract user email from the JWT Bearer token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload["email"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


class SaveRequest(BaseModel):
    topic: str
    mode: str  # single, multi, compare
    result: Dict[str, Any]  # The full result object from the frontend


@router.post("/save")
def save_result(req: SaveRequest, authorization: str = Header(None)):
    if history_collection is None:
        raise HTTPException(status_code=500, detail="Database not available")

    email = get_user_email(authorization)

    doc = {
        "email": email,
        "topic": req.topic,
        "mode": req.mode,
        "result": req.result,
        "saved_at": datetime.utcnow(),
    }
    history_collection.insert_one(doc)
    return {"status": "saved", "topic": req.topic}


@router.get("/list")
def list_history(authorization: str = Header(None)):
    if history_collection is None:
        raise HTTPException(status_code=500, detail="Database not available")

    email = get_user_email(authorization)

    # Return most recent 20 items, newest first
    cursor = history_collection.find(
        {"email": email},
        {"_id": 0, "email": 0}   # exclude internal fields
    ).sort("saved_at", -1).limit(20)

    items = []
    for doc in cursor:
        # Convert datetime to string for JSON serialization
        doc["saved_at"] = doc["saved_at"].isoformat() if doc.get("saved_at") else ""
        items.append(doc)

    return {"items": items}


@router.delete("/clear")
def clear_history(authorization: str = Header(None)):
    if history_collection is None:
        raise HTTPException(status_code=500, detail="Database not available")

    email = get_user_email(authorization)
    result = history_collection.delete_many({"email": email})
    return {"status": "cleared", "deleted": result.deleted_count}
