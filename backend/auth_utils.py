import hashlib
import jwt
import os
from datetime import datetime, timedelta
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY = os.getenv("JWT_SECRET", "shopug-secret-change-in-production")
ALGORITHM  = "HS256"
EXPIRE_HRS = 24 * 7

bearer = HTTPBearer(auto_error=False)


def hash_password(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def create_token(sub_id: int, role: str) -> str:
    """role: 'customer' | 'supplier' | 'admin'"""
    exp = datetime.utcnow() + timedelta(hours=EXPIRE_HRS)
    return jwt.encode(
        {"sub": sub_id, "role": role, "exp": exp},
        SECRET_KEY, algorithm=ALGORITHM
    )


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    if not creds:
        raise HTTPException(401, "Not authenticated")
    try:
        return decode_token(creds.credentials)
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except Exception:
        raise HTTPException(401, "Invalid token")


def require_customer(payload=Depends(get_current_user)):
    if payload["role"] not in ("customer", "admin"):
        raise HTTPException(403, "Customers only")
    return payload


def require_supplier(payload=Depends(get_current_user)):
    if payload["role"] != "supplier":
        raise HTTPException(403, "Suppliers only")
    return payload


def require_admin(payload=Depends(get_current_user)):
    if payload["role"] != "admin":
        raise HTTPException(403, "Admin only")
    return payload
