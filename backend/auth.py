from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_db
from auth_utils import hash_password, create_token

router = APIRouter(prefix="/auth", tags=["auth"])


class CustomerRegister(BaseModel):
    name: str
    email: str
    phone: str = ""
    password: str


class SupplierRegister(BaseModel):
    name: str
    business_name: str
    email: str
    phone: str
    address: str = ""
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


# ── Customer ──────────────────────────────────────────────────────────────────

@router.post("/register")
def customer_register(body: CustomerRegister):
    conn = get_db()
    if conn.execute("SELECT id FROM users WHERE email=?", (body.email,)).fetchone():
        conn.close()
        raise HTTPException(400, "Email already registered")
    conn.execute(
        "INSERT INTO users (name, email, phone, password_hash) VALUES (?,?,?,?)",
        (body.name, body.email, body.phone, hash_password(body.password))
    )
    conn.commit()
    user = conn.execute("SELECT * FROM users WHERE email=?", (body.email,)).fetchone()
    conn.close()
    role = "admin" if user["is_admin"] else "customer"
    return {"token": create_token(user["id"], role), "role": role,
            "name": user["name"], "email": user["email"]}


@router.post("/login")
def customer_login(body: LoginIn):
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email=?", (body.email,)).fetchone()
    conn.close()
    if not user or user["password_hash"] != hash_password(body.password):
        raise HTTPException(401, "Invalid credentials")
    role = "admin" if user["is_admin"] else "customer"
    return {"token": create_token(user["id"], role), "role": role,
            "name": user["name"], "email": user["email"], "is_admin": bool(user["is_admin"])}


@router.get("/me")
def customer_me(payload=__import__('fastapi').Depends(__import__('auth_utils').get_current_user)):
    conn = get_db()
    if payload["role"] == "supplier":
        row = conn.execute(
            "SELECT id, name, business_name, email, phone, tier, rating, "
            "total_orders, fulfilled_orders, status, joined_at FROM suppliers WHERE id=?",
            (payload["sub"],)
        ).fetchone()
    else:
        row = conn.execute(
            "SELECT id, name, email, phone, is_admin, created_at FROM users WHERE id=?",
            (payload["sub"],)
        ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Not found")
    return {**dict(row), "role": payload["role"]}


# ── Supplier ──────────────────────────────────────────────────────────────────

@router.post("/supplier/register")
def supplier_register(body: SupplierRegister):
    conn = get_db()
    if conn.execute("SELECT id FROM suppliers WHERE email=?", (body.email,)).fetchone():
        conn.close()
        raise HTTPException(400, "Email already registered")
    conn.execute(
        """INSERT INTO suppliers
           (name, business_name, email, phone, address, password_hash)
           VALUES (?,?,?,?,?,?)""",
        (body.name, body.business_name, body.email, body.phone,
         body.address, hash_password(body.password))
    )
    conn.commit()
    sup = conn.execute("SELECT * FROM suppliers WHERE email=?", (body.email,)).fetchone()
    conn.close()
    return {
        "token": create_token(sup["id"], "supplier"),
        "role": "supplier",
        "name": sup["name"],
        "status": sup["status"],
        "message": "Registration received. Awaiting admin approval."
    }


@router.post("/supplier/login")
def supplier_login(body: LoginIn):
    conn = get_db()
    sup = conn.execute("SELECT * FROM suppliers WHERE email=?", (body.email,)).fetchone()
    conn.close()
    if not sup or sup["password_hash"] != hash_password(body.password):
        raise HTTPException(401, "Invalid credentials")
    if sup["status"] == "pending":
        raise HTTPException(403, "Account pending admin approval")
    if sup["status"] == "suspended":
        raise HTTPException(403, "Account suspended. Contact admin.")
    return {
        "token": create_token(sup["id"], "supplier"),
        "role": "supplier",
        "name": sup["name"],
        "business_name": sup["business_name"],
        "tier": sup["tier"],
        "status": sup["status"]
    }
