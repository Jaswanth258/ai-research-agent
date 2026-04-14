from pymongo import MongoClient
import os
import certifi
from dotenv import load_dotenv

# Load .env BEFORE reading MONGO_URI
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")

print(f"Initializing MongoDB connection to {MONGO_URI[:50]}...")
try:
    # Use certifi CA bundle for SSL (needed in Docker/HF Spaces)
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000, tlsCAFile=certifi.where())
    db = client.agentic_research
    users_collection = db["users"]
    history_collection = db["research_history"]
    
    # Verify connection
    client.admin.command('ping')
    print("MongoDB successfully connected!")
except Exception as e:
    print(f"Warning: Could not connect to MongoDB. Auth & history disabled. Error: {e}")
    users_collection = None
    history_collection = None
