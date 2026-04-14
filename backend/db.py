from pymongo import MongoClient
import os

print("Initializing MongoDB connection to localhost:27017...")
try:
    # Use local MongoDB (default port)
    client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=3000)
    db = client.agentic_research
    users_collection = db["users"]
    history_collection = db["research_history"]
    
    # Verify connection
    client.admin.command('ping')
    print("MongoDB successfully connected!")
except Exception as e:
    print(f"Warning: Could not connect to MongoDB. Ensure it is running. Error: {e}")
    users_collection = None
    history_collection = None
