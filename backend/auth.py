from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import bcrypt
import jwt
from datetime import datetime, timedelta
from .db import users_collection

router = APIRouter()
SECRET_KEY = "agentic_research_secret_key_demo"  # In production, move to .env

class UserAuth(BaseModel):
    email: str
    password: str

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

@router.post("/signup")
def signup(user: UserAuth):
    if users_collection is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
        
    existing = users_collection.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = get_password_hash(user.password)
    users_collection.insert_one({
        "email": user.email, 
        "password": hashed,
        "created_at": datetime.utcnow()
    })
    
    # Auto-login after signup
    return login(user)

@router.post("/login")
def login(user: UserAuth):
    if users_collection is None:
        raise HTTPException(status_code=500, detail="Database connection not available")
        
    db_user = users_collection.find_one({"email": user.email})
    
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = jwt.encode(
        {
            "sub": str(db_user["_id"]), 
            "email": db_user["email"], 
            "exp": datetime.utcnow() + timedelta(days=7)
        },
        SECRET_KEY,
        algorithm="HS256"
    )
    
    return {"token": token, "email": db_user["email"]}
