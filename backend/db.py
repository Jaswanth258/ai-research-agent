import os
import json
import uuid
import sqlite3
from datetime import datetime
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

# Load .env BEFORE reading MONGO_URI
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


# ═══════════════════════════════════════════════════════════════════════════
# Local SQLite Collection Adapter (Seamless Fallback for Local Dev)
# ═══════════════════════════════════════════════════════════════════════════

class SQLiteCursor:
    """Cursor emulator for MongoDB find() queries."""

    def __init__(self, docs: List[Dict[str, Any]], projection: Optional[Dict[str, int]] = None):
        self.docs = docs
        self.projection = projection or {}

    def sort(self, field: str, direction: int = 1):
        reverse = (direction == -1)
        self.docs.sort(key=lambda d: str(d.get(field, "")), reverse=reverse)
        return self

    def limit(self, count: int):
        self.docs = self.docs[:count]
        return self

    def __iter__(self):
        for doc in self.docs:
            d = dict(doc)
            # Apply basic MongoDB-style projection exclusion
            for k, v in self.projection.items():
                if v == 0 and k in d:
                    del d[k]
            yield d

    def __len__(self):
        return len(self.docs)


class SQLiteCollection:
    """Emulates a MongoDB collection on top of a local SQLite table."""

    def __init__(self, db_path: str, table_name: str):
        self.db_path = db_path
        self.table_name = table_name
        self._init_table()

    def _get_conn(self):
        return sqlite3.connect(self.db_path)

    def _init_table(self):
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        with self._get_conn() as conn:
            conn.execute(f"""
                CREATE TABLE IF NOT EXISTS {self.table_name} (
                    id TEXT PRIMARY KEY,
                    email TEXT,
                    doc TEXT,
                    created_at TIMESTAMP
                )
            """)
            conn.execute(f"CREATE INDEX IF NOT EXISTS idx_{self.table_name}_email ON {self.table_name}(email)")
            conn.commit()

    def insert_one(self, doc: Dict[str, Any]) -> Any:
        doc_copy = dict(doc)
        if "_id" not in doc_copy:
            doc_copy["_id"] = str(uuid.uuid4())
        
        # Serialize datetimes to ISO format strings
        serialized = {}
        for k, v in doc_copy.items():
            if isinstance(v, datetime):
                serialized[k] = v.isoformat()
            else:
                serialized[k] = v

        doc_json = json.dumps(serialized)
        email = doc_copy.get("email", "")

        with self._get_conn() as conn:
            conn.execute(
                f"INSERT INTO {self.table_name} (id, email, doc, created_at) VALUES (?, ?, ?, ?)",
                (str(doc_copy["_id"]), email, doc_json, datetime.utcnow())
            )
            conn.commit()
        return doc_copy

    def _match(self, doc: Dict[str, Any], filter_dict: Dict[str, Any]) -> bool:
        for k, v in filter_dict.items():
            if k == "$or" and isinstance(v, list):
                if not any(self._match(doc, clause) for clause in v):
                    return False
                continue
            if isinstance(v, dict):
                # Operator support like $gt, $gte, etc.
                if "$gte" in v:
                    val = doc.get(k)
                    target = v["$gte"].isoformat() if isinstance(v["$gte"], datetime) else str(v["$gte"])
                    if not val or str(val) < target:
                        return False
                if "$gt" in v:
                    val = doc.get(k)
                    target = v["$gt"].isoformat() if isinstance(v["$gt"], datetime) else str(v["$gt"])
                    if not val or str(val) <= target:
                        return False
            else:
                if doc.get(k) != v:
                    return False
        return True

    def find_one(self, filter_dict: Dict[str, Any], projection: Optional[Dict[str, int]] = None) -> Optional[Dict[str, Any]]:
        cursor = self.find(filter_dict, projection)
        for doc in cursor:
            return doc
        return None

    def find(self, filter_dict: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, int]] = None) -> SQLiteCursor:
        filter_dict = filter_dict or {}
        email = filter_dict.get("email")

        with self._get_conn() as conn:
            if email and isinstance(email, str):
                cur = conn.execute(f"SELECT doc FROM {self.table_name} WHERE email = ?", (email,))
            else:
                cur = conn.execute(f"SELECT doc FROM {self.table_name}")
            rows = cur.fetchall()

        matched_docs = []
        for (doc_str,) in rows:
            try:
                doc = json.loads(doc_str)
                if self._match(doc, filter_dict):
                    matched_docs.append(doc)
            except Exception:
                pass

        return SQLiteCursor(matched_docs, projection)

    def update_one(self, filter_dict: Dict[str, Any], update_dict: Dict[str, Any]) -> bool:
        existing = self.find_one(filter_dict)
        if not existing:
            return False

        updated_doc = dict(existing)
        if "$set" in update_dict:
            for k, v in update_dict["$set"].items():
                if isinstance(v, datetime):
                    updated_doc[k] = v.isoformat()
                else:
                    updated_doc[k] = v

        doc_json = json.dumps(updated_doc)
        doc_id = str(updated_doc["_id"])

        with self._get_conn() as conn:
            conn.execute(f"UPDATE {self.table_name} SET doc = ? WHERE id = ?", (doc_json, doc_id))
            conn.commit()
        return True

    def delete_many(self, filter_dict: Dict[str, Any]) -> int:
        docs = list(self.find(filter_dict))
        if not docs:
            return 0
        ids = [str(d["_id"]) for d in docs]
        with self._get_conn() as conn:
            conn.execute(
                f"DELETE FROM {self.table_name} WHERE id IN ({','.join(['?']*len(ids))})",
                ids
            )
            conn.commit()
        return len(ids)

    def delete_one(self, filter_dict: Dict[str, Any]) -> int:
        doc = self.find_one(filter_dict)
        if not doc:
            return 0
        with self._get_conn() as conn:
            conn.execute(f"DELETE FROM {self.table_name} WHERE id = ?", (str(doc["_id"]),))
            conn.commit()
        return 1


# ═══════════════════════════════════════════════════════════════════════════
# Initialization: MongoDB (Primary) with SQLite Fallback
# ═══════════════════════════════════════════════════════════════════════════

users_collection = None
history_collection = None
otp_collection = None
DB_TYPE = "mongodb"

print(f"Initializing database connection to {MONGO_URI[:40]}...")

import sys
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

try:
    from pymongo import MongoClient
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    client.admin.command('ping')
    db = client.agentic_research
    users_collection = db["users"]
    history_collection = db["research_history"]
    otp_collection = db["password_otps"]
    print("[DB] MongoDB successfully connected!")
    DB_TYPE = "mongodb"
except Exception as e:
    print(f"[DB] MongoDB not available ({e}). Initializing seamless local SQLite fallback...")
    sqlite_db_path = os.path.join(DATA_DIR, "agentic_research.db")
    users_collection = SQLiteCollection(sqlite_db_path, "users")
    history_collection = SQLiteCollection(sqlite_db_path, "research_history")
    otp_collection = SQLiteCollection(sqlite_db_path, "password_otps")
    print(f"[DB] Local SQLite storage active at: {sqlite_db_path}")
    DB_TYPE = "sqlite"

