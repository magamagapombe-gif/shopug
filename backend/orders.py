from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from database import get_db
from auth_utils import require_customer, require_admin, get_current_user

router = APIRouter(tags=["orders"])


# ── Cart ──────────────────────────────────────────────────────────────────────

class CartItemIn(BaseModel):
    product_id: int
    quantity:   int = 1


@router.get("/cart")
def get_cart(payload=Depends(require_customer)):
    conn = get_db()
    items = conn.execute("""
        SELECT c.id, c.quantity,
               p.id as product_id, p.title, p.price,
               p.image_url, p.brand, p.currency
        FROM carts c
        JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?
    """, (payload["sub"],)).fetchall()
    conn.close()
    items_list = [dict(i) for i in items]
    total = sum((i["price"] or 0) * i["quantity"] for i in items_list)
    return {"items": items_list, "total": total}


@router.post("/cart")
def add_to_cart(body: CartItemIn, payload=Depends(require_customer)):
    conn = get_db()
    existing = conn.execute(
        "SELECT id, quantity FROM carts WHERE user_id=? AND product_id=?",
        (payload["sub"], body.product_id)
    ).fetchone()
    if existing:
        conn.execute("UPDATE carts SET quantity=? WHERE id=?",
                     (existing["quantity"] + body.quantity, existing["id"]))
    else:
        conn.execute("INSERT INTO carts (user_id, product_id, quantity) VALUES (?,?,?)",
                     (payload["sub"], body.product_id, body.quantity))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.patch("/cart/{product_id}")
def update_cart(product_id: int, quantity: int, payload=Depends(require_customer)):
    conn = get_db()
    if quantity <= 0:
        conn.execute("DELETE FROM carts WHERE user_id=? AND product_id=?",
                     (payload["sub"], product_id))
    else:
        conn.execute("UPDATE carts SET quantity=? WHERE user_id=? AND product_id=?",
                     (quantity, payload["sub"], product_id))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.delete("/cart/{product_id}")
def remove_from_cart(product_id: int, payload=Depends(require_customer)):
    conn = get_db()
    conn.execute("DELETE FROM carts WHERE user_id=? AND product_id=?",
                 (payload["sub"], product_id))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.delete("/cart")
def clear_cart(payload=Depends(require_customer)):
    conn = get_db()
    conn.execute("DELETE FROM carts WHERE user_id=?", (payload["sub"],))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Orders ────────────────────────────────────────────────────────────────────

class OrderIn(BaseModel):
    address:        str
    phone:          str
    payment_method: str = "mobile_money"
    payment_ref:    str = ""


@router.post("/orders")
def place_order(body: OrderIn, payload=Depends(require_customer)):
    conn = get_db()
    cart = conn.execute("""
        SELECT c.quantity, p.id as product_id, p.price, p.title
        FROM carts c JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?
    """, (payload["sub"],)).fetchall()

    if not cart:
        raise HTTPException(400, "Cart is empty")

    total = sum((i["price"] or 0) * i["quantity"] for i in cart)
    now   = datetime.utcnow().isoformat()

    # Create order
    cur = conn.execute("""
        INSERT INTO orders (user_id, total, address, phone, payment_method, payment_ref, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?)
    """, (payload["sub"], total, body.address, body.phone,
          body.payment_method, body.payment_ref, now, now))
    order_id = cur.lastrowid

    # Create order items + open bids for each
    for item in cart:
        cur2 = conn.execute("""
            INSERT INTO order_items (order_id, product_id, quantity, price, title)
            VALUES (?,?,?,?,?)
        """, (order_id, item["product_id"], item["quantity"],
              item["price"] or 0, item["title"]))
        item_id = cur2.lastrowid

        # Find eligible suppliers for this product and notify them
        suppliers = conn.execute("""
            SELECT si.supplier_id, si.supply_price, s.tier, s.rating,
                   s.fulfilled_orders, s.avg_delivery_hrs
            FROM supplier_inventory si
            JOIN suppliers s ON si.supplier_id = s.id
            WHERE si.product_id = ? AND si.stock_status = 'available'
            AND s.status = 'active'
        """, (item["product_id"],)).fetchall()

        for sup in suppliers:
            # Compute score: lower supply_price is better, higher rating/tier better
            tier_bonus = {"gold": 15, "silver": 8, "bronze": 0}.get(sup["tier"], 0)
            score = (
                (1 / (sup["supply_price"] + 1)) * 1000
                + (sup["rating"] or 0) * 10
                + tier_bonus
                + min(sup["fulfilled_orders"] or 0, 50)
                - min(sup["avg_delivery_hrs"] or 0, 48)
            )
            conn.execute("""
                INSERT OR IGNORE INTO bids
                  (order_id, order_item_id, supplier_id, supply_price, score)
                VALUES (?,?,?,?,?)
            """, (order_id, item_id, sup["supplier_id"],
                  sup["supply_price"], round(score, 2)))

            # Notify supplier
            conn.execute("""
                INSERT INTO notifications (target, type, title, body, data)
                VALUES (?,?,?,?,?)
            """, (f"supplier:{sup['supplier_id']}", "new_bid",
                  "New Order — You Can Bid",
                  f"A new order for '{item['title']}' is available.",
                  f'{{"order_id":{order_id},"item_id":{item_id}}}'))

    # Clear cart
    conn.execute("DELETE FROM carts WHERE user_id=?", (payload["sub"],))

    # Notify admin
    conn.execute("""
        INSERT INTO notifications (target, type, title, body, data)
        VALUES ('admin','new_order','New Order Received',?,?)
    """, (f"Order #{order_id} — {len(cart)} item(s) — UGX {total:,.0f}",
          f'{{"order_id":{order_id}}}'))

    conn.commit()
    conn.close()
    return {"order_id": order_id, "total": total, "status": "paid"}


@router.get("/orders")
def list_orders(payload=Depends(require_customer)):
    conn = get_db()
    orders = conn.execute(
        "SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC",
        (payload["sub"],)
    ).fetchall()
    result = []
    for o in orders:
        items = conn.execute("""
            SELECT oi.*, p.image_url FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        """, (o["id"],)).fetchall()
        result.append({**dict(o), "items": [dict(i) for i in items]})
    conn.close()
    return result


@router.get("/orders/{order_id}")
def get_order(order_id: int, payload=Depends(get_current_user)):
    conn = get_db()
    o = conn.execute("SELECT * FROM orders WHERE id=?", (order_id,)).fetchone()
    if not o:
        raise HTTPException(404, "Order not found")
    # Customers can only see their own
    if payload["role"] == "customer" and o["user_id"] != payload["sub"]:
        raise HTTPException(403, "Forbidden")
    items = conn.execute("""
        SELECT oi.*, p.image_url FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
    """, (order_id,)).fetchall()
    fulfillments = conn.execute("""
        SELECT of.*, s.name as supplier_name FROM order_fulfillments of
        JOIN suppliers s ON of.supplier_id = s.id
        WHERE of.order_id = ?
    """, (order_id,)).fetchall() if payload["role"] == "admin" else []
    conn.close()
    return {
        **dict(o),
        "items": [dict(i) for i in items],
        "fulfillments": [dict(f) for f in fulfillments],
    }


# ── Complaints ────────────────────────────────────────────────────────────────

class ComplaintIn(BaseModel):
    order_id:    int
    description: str
    evidence_url: Optional[str] = None


@router.post("/complaints")
def file_complaint(body: ComplaintIn, payload=Depends(require_customer)):
    conn = get_db()
    # Verify order belongs to user
    o = conn.execute(
        "SELECT id FROM orders WHERE id=? AND user_id=?",
        (body.order_id, payload["sub"])
    ).fetchone()
    if not o:
        raise HTTPException(404, "Order not found")

    # Trace which supplier fulfilled it
    fulfillment = conn.execute("""
        SELECT supplier_id FROM order_fulfillments
        WHERE order_id=? LIMIT 1
    """, (body.order_id,)).fetchone()
    supplier_id = fulfillment["supplier_id"] if fulfillment else None

    conn.execute("""
        INSERT INTO complaints (order_id, user_id, supplier_id, description, evidence_url)
        VALUES (?,?,?,?,?)
    """, (body.order_id, payload["sub"], supplier_id,
          body.description, body.evidence_url))

    # Notify admin
    conn.execute("""
        INSERT INTO notifications (target, type, title, body)
        VALUES ('admin','complaint','Customer Complaint',?)
    """, (f"Order #{body.order_id}: {body.description[:80]}",))
    conn.commit()
    conn.close()
    return {"ok": True, "message": "Complaint filed. We will investigate."}


# ── Admin: orders management ──────────────────────────────────────────────────

VALID_STATUSES = {
    "paid", "supplier_assigned", "supplier_confirmed",
    "in_transit", "inspecting", "out_for_delivery",
    "delivered", "completed", "cancelled"
}


@router.get("/admin/orders")
def admin_list_orders(status: Optional[str] = None, _=Depends(require_admin)):
    conn = get_db()
    q = """
        SELECT o.*, u.name as customer_name, u.email as customer_email,
               u.phone as customer_phone
        FROM orders o JOIN users u ON o.user_id = u.id
    """
    params = []
    if status:
        q += " WHERE o.status=?"
        params.append(status)
    q += " ORDER BY o.created_at DESC"
    rows = conn.execute(q, params).fetchall()
    result = []
    for o in rows:
        items = conn.execute(
            "SELECT * FROM order_items WHERE order_id=?", (o["id"],)
        ).fetchall()
        bids = conn.execute("""
            SELECT b.*, s.name as supplier_name, s.business_name,
                   s.tier, s.rating, s.phone as supplier_phone
            FROM bids b JOIN suppliers s ON b.supplier_id = s.id
            WHERE b.order_id = ?
            ORDER BY b.score DESC
        """, (o["id"],)).fetchall()
        result.append({
            **dict(o),
            "items": [dict(i) for i in items],
            "bids":  [dict(b) for b in bids],
        })
    conn.close()
    return result


@router.patch("/admin/orders/{order_id}/status")
def update_order_status(order_id: int, status: str, _=Depends(require_admin)):
    if status not in VALID_STATUSES:
        raise HTTPException(400, f"Invalid status")
    conn = get_db()
    conn.execute(
        "UPDATE orders SET status=?, updated_at=? WHERE id=?",
        (status, datetime.utcnow().isoformat(), order_id)
    )
    # Notify customer
    o = conn.execute("SELECT user_id FROM orders WHERE id=?", (order_id,)).fetchone()
    if o:
        conn.execute("""
            INSERT INTO notifications (target, type, title, body)
            VALUES (?,?,?,?)
        """, (f"user:{o['user_id']}", "order_update",
              f"Order #{order_id} Update",
              f"Your order status is now: {status.replace('_',' ').title()}"))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.get("/admin/complaints")
def admin_complaints(_=Depends(require_admin)):
    conn = get_db()
    rows = conn.execute("""
        SELECT c.*, u.name as customer_name, u.email as customer_email,
               s.name as supplier_name, s.business_name
        FROM complaints c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN suppliers s ON c.supplier_id = s.id
        ORDER BY c.created_at DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.patch("/admin/complaints/{complaint_id}")
def resolve_complaint(
    complaint_id: int,
    status: str,
    resolution: str = "",
    _=Depends(require_admin)
):
    conn = get_db()
    c = conn.execute("SELECT * FROM complaints WHERE id=?", (complaint_id,)).fetchone()
    if not c:
        raise HTTPException(404, "Not found")
    conn.execute("""
        UPDATE complaints SET status=?, resolution=?, resolved_at=? WHERE id=?
    """, (status, resolution, datetime.utcnow().isoformat(), complaint_id))
    # If resolved against supplier — add strike
    if status == "resolved" and c["supplier_id"]:
        conn.execute("""
            UPDATE suppliers SET rating = MAX(0, rating - 0.5) WHERE id=?
        """, (c["supplier_id"],))
        conn.execute("""
            INSERT INTO notifications (target, type, title, body)
            VALUES (?,?,?,?)
        """, (f"supplier:{c['supplier_id']}", "complaint_resolved",
              "Complaint Resolved Against You",
              f"A customer complaint was resolved against your account. {resolution}"))
    conn.commit()
    conn.close()
    return {"ok": True}
