from fastapi import APIRouter, Depends
from database import get_db
from auth_utils import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
def stats(_=Depends(require_admin)):
    conn = get_db()
    data = {
        "products":          conn.execute("SELECT COUNT(*) FROM products WHERE is_active=1").fetchone()[0],
        "categories":        conn.execute("SELECT COUNT(*) FROM categories").fetchone()[0],
        "customers":         conn.execute("SELECT COUNT(*) FROM users WHERE is_admin=0").fetchone()[0],
        "suppliers_active":  conn.execute("SELECT COUNT(*) FROM suppliers WHERE status='active'").fetchone()[0],
        "suppliers_pending": conn.execute("SELECT COUNT(*) FROM suppliers WHERE status='pending'").fetchone()[0],
        "orders_total":      conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0],
        "orders_pending":    conn.execute("SELECT COUNT(*) FROM orders WHERE status='paid'").fetchone()[0],
        "revenue":           conn.execute("SELECT COALESCE(SUM(total),0) FROM orders WHERE status='completed'").fetchone()[0],
        "margin":            conn.execute("SELECT COALESCE(SUM(margin),0) FROM order_fulfillments WHERE status='completed'").fetchone()[0],
        "pending_payouts":   conn.execute("SELECT COALESCE(SUM(amount),0) FROM payouts WHERE status='pending'").fetchone()[0],
        "complaints_open":   conn.execute("SELECT COUNT(*) FROM complaints WHERE status='open'").fetchone()[0],
        "pending_products":  conn.execute("SELECT COUNT(*) FROM supplier_products WHERE status='pending'").fetchone()[0],
    }
    conn.close()
    return data


@router.get("/notifications")
def get_notifications(_=Depends(require_admin)):
    conn = get_db()
    rows = conn.execute("""
        SELECT * FROM notifications WHERE target='admin'
        ORDER BY created_at DESC LIMIT 100
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/notifications/read")
def mark_read(_=Depends(require_admin)):
    conn = get_db()
    conn.execute("UPDATE notifications SET is_read=1 WHERE target='admin'")
    conn.commit()
    conn.close()
    return {"ok": True}


@router.get("/users")
def list_users(_=Depends(require_admin)):
    conn = get_db()
    rows = conn.execute(
        "SELECT id, name, email, phone, is_admin, created_at FROM users ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.patch("/users/{user_id}/make-admin")
def make_admin(user_id: int, _=Depends(require_admin)):
    conn = get_db()
    conn.execute("UPDATE users SET is_admin=1 WHERE id=?", (user_id,))
    conn.commit()
    conn.close()
    return {"ok": True}
