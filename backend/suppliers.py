from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from database import get_db
from auth_utils import require_supplier, require_admin

router = APIRouter(tags=["suppliers"])


# ── Supplier dashboard ────────────────────────────────────────────────────────

@router.get("/supplier/dashboard")
def supplier_dashboard(payload=Depends(require_supplier)):
    conn  = get_db()
    sid   = payload["sub"]
    sup   = conn.execute("SELECT * FROM suppliers WHERE id=?", (sid,)).fetchone()

    stats = {
        "total_bids":       conn.execute("SELECT COUNT(*) FROM bids WHERE supplier_id=?", (sid,)).fetchone()[0],
        "won_bids":         conn.execute("SELECT COUNT(*) FROM bids WHERE supplier_id=? AND status='accepted'", (sid,)).fetchone()[0],
        "pending_bids":     conn.execute("SELECT COUNT(*) FROM bids WHERE supplier_id=? AND status='pending'", (sid,)).fetchone()[0],
        "total_fulfilled":  conn.execute("SELECT COUNT(*) FROM order_fulfillments WHERE supplier_id=? AND status='completed'", (sid,)).fetchone()[0],
        "pending_payout":   conn.execute("SELECT COALESCE(SUM(amount),0) FROM payouts WHERE supplier_id=? AND status='pending'", (sid,)).fetchone()[0],
        "total_earned":     conn.execute("SELECT COALESCE(SUM(amount),0) FROM payouts WHERE supplier_id=? AND status='paid'", (sid,)).fetchone()[0],
        "inventory_count":  conn.execute("SELECT COUNT(*) FROM supplier_inventory WHERE supplier_id=?", (sid,)).fetchone()[0],
    }

    recent_bids = conn.execute("""
        SELECT b.*, oi.title, oi.quantity, o.created_at as order_date
        FROM bids b
        JOIN order_items oi ON b.order_item_id = oi.id
        JOIN orders o ON b.order_id = o.id
        WHERE b.supplier_id = ?
        ORDER BY b.submitted_at DESC LIMIT 10
    """, (sid,)).fetchall()

    conn.close()
    return {
        "supplier": dict(sup),
        "stats":    stats,
        "recent_bids": [dict(b) for b in recent_bids],
    }


# ── Category preferences ──────────────────────────────────────────────────────

@router.get("/supplier/categories")
def get_supplier_categories(payload=Depends(require_supplier)):
    conn = get_db()
    all_cats = conn.execute("SELECT * FROM categories ORDER BY name").fetchall()
    my_cat_ids = {r["category_id"] for r in conn.execute(
        "SELECT category_id FROM supplier_categories WHERE supplier_id=?",
        (payload["sub"],)
    ).fetchall()}
    conn.close()
    return [
        {**dict(c), "selected": c["id"] in my_cat_ids}
        for c in all_cats
    ]


class CategoryPrefs(BaseModel):
    category_ids: List[int]


@router.post("/supplier/categories")
def set_supplier_categories(body: CategoryPrefs, payload=Depends(require_supplier)):
    conn = get_db()
    conn.execute("DELETE FROM supplier_categories WHERE supplier_id=?", (payload["sub"],))
    for cid in body.category_ids:
        conn.execute(
            "INSERT OR IGNORE INTO supplier_categories (supplier_id, category_id) VALUES (?,?)",
            (payload["sub"], cid)
        )
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Inventory (which products supplier can supply + price) ────────────────────

@router.get("/supplier/inventory")
def get_inventory(payload=Depends(require_supplier)):
    conn = get_db()
    rows = conn.execute("""
        SELECT si.*, p.title, p.price as selling_price,
               p.image_url, c.name as category_name
        FROM supplier_inventory si
        JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE si.supplier_id = ?
        ORDER BY p.title
    """, (payload["sub"],)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


class InventoryItem(BaseModel):
    product_id:   int
    supply_price: float
    stock_status: str = "available"


@router.post("/supplier/inventory")
def add_to_inventory(body: InventoryItem, payload=Depends(require_supplier)):
    conn = get_db()
    conn.execute("""
        INSERT INTO supplier_inventory (supplier_id, product_id, supply_price, stock_status, updated_at)
        VALUES (?,?,?,?,?)
        ON CONFLICT(supplier_id, product_id) DO UPDATE
        SET supply_price=excluded.supply_price,
            stock_status=excluded.stock_status,
            updated_at=excluded.updated_at
    """, (payload["sub"], body.product_id, body.supply_price,
          body.stock_status, datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.delete("/supplier/inventory/{product_id}")
def remove_from_inventory(product_id: int, payload=Depends(require_supplier)):
    conn = get_db()
    conn.execute(
        "DELETE FROM supplier_inventory WHERE supplier_id=? AND product_id=?",
        (payload["sub"], product_id)
    )
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Supplier-submitted new products ──────────────────────────────────────────

class NewProductIn(BaseModel):
    title:          str
    description:    Optional[str] = None
    image_url:      Optional[str] = None
    supplier_price: float
    category_id:    Optional[int] = None
    subcategory_id: Optional[int] = None


@router.post("/supplier/products/submit")
def submit_product(body: NewProductIn, payload=Depends(require_supplier)):
    conn = get_db()
    conn.execute("""
        INSERT INTO supplier_products
          (supplier_id, title, description, image_url, supplier_price,
           category_id, subcategory_id)
        VALUES (?,?,?,?,?,?,?)
    """, (payload["sub"], body.title, body.description, body.image_url,
          body.supplier_price, body.category_id, body.subcategory_id))
    conn.execute("""
        INSERT INTO notifications (target, type, title, body)
        VALUES ('admin','new_product_submission','New Product Submitted',?)
    """, (f"Supplier submitted: '{body.title}' — awaiting review",))
    conn.commit()
    conn.close()
    return {"ok": True, "message": "Product submitted for review"}


@router.get("/supplier/products/submissions")
def my_submissions(payload=Depends(require_supplier)):
    conn = get_db()
    rows = conn.execute("""
        SELECT * FROM supplier_products WHERE supplier_id=?
        ORDER BY submitted_at DESC
    """, (payload["sub"],)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Bids ──────────────────────────────────────────────────────────────────────

@router.get("/supplier/bids")
def get_bids(status: Optional[str] = None, payload=Depends(require_supplier)):
    conn = get_db()
    q = """
        SELECT b.*, oi.title, oi.quantity, oi.price as selling_price,
               o.address, o.created_at as order_date, o.status as order_status
        FROM bids b
        JOIN order_items oi ON b.order_item_id = oi.id
        JOIN orders o ON b.order_id = o.id
        WHERE b.supplier_id = ?
    """
    params = [payload["sub"]]
    if status:
        q += " AND b.status=?"
        params.append(status)
    q += " ORDER BY b.submitted_at DESC"
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Fulfillment updates ───────────────────────────────────────────────────────

@router.get("/supplier/fulfillments")
def get_fulfillments(payload=Depends(require_supplier)):
    conn = get_db()
    rows = conn.execute("""
        SELECT of.*, oi.title, oi.quantity, o.address, o.phone,
               o.created_at as order_date
        FROM order_fulfillments of
        JOIN order_items oi ON of.order_item_id = oi.id
        JOIN orders o ON of.order_id = o.id
        WHERE of.supplier_id = ?
        ORDER BY of.order_id DESC
    """, (payload["sub"],)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.patch("/supplier/fulfillments/{fulfillment_id}/confirm")
def supplier_confirm(fulfillment_id: int, payload=Depends(require_supplier)):
    """Supplier confirms they have the product and will deliver to hub."""
    conn = get_db()
    f = conn.execute(
        "SELECT * FROM order_fulfillments WHERE id=? AND supplier_id=?",
        (fulfillment_id, payload["sub"])
    ).fetchone()
    if not f:
        raise HTTPException(404, "Fulfillment not found")
    conn.execute("""
        UPDATE order_fulfillments SET status='supplier_confirmed', confirmed_at=?
        WHERE id=?
    """, (datetime.utcnow().isoformat(), fulfillment_id))
    conn.execute("""
        INSERT INTO notifications (target, type, title, body)
        VALUES ('admin','supplier_confirmed','Supplier Confirmed',?)
    """, (f"Fulfillment #{fulfillment_id} confirmed by supplier.",))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Payouts ───────────────────────────────────────────────────────────────────

@router.get("/supplier/payouts")
def get_payouts(payload=Depends(require_supplier)):
    conn = get_db()
    rows = conn.execute("""
        SELECT p.*, oi.title FROM payouts p
        JOIN order_fulfillments of ON p.fulfillment_id = of.id
        JOIN order_items oi ON of.order_item_id = oi.id
        WHERE p.supplier_id = ?
        ORDER BY p.paid_at DESC
    """, (payload["sub"],)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Notifications ─────────────────────────────────────────────────────────────

@router.get("/supplier/notifications")
def get_notifications(payload=Depends(require_supplier)):
    conn = get_db()
    rows = conn.execute("""
        SELECT * FROM notifications
        WHERE target=?
        ORDER BY created_at DESC LIMIT 50
    """, (f"supplier:{payload['sub']}",)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.post("/supplier/notifications/read")
def mark_read(payload=Depends(require_supplier)):
    conn = get_db()
    conn.execute(
        "UPDATE notifications SET is_read=1 WHERE target=?",
        (f"supplier:{payload['sub']}",)
    )
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Admin: manage suppliers ───────────────────────────────────────────────────

@router.get("/admin/suppliers")
def admin_list_suppliers(status: Optional[str] = None, _=Depends(require_admin)):
    conn = get_db()
    q = "SELECT * FROM suppliers"
    params = []
    if status:
        q += " WHERE status=?"
        params.append(status)
    q += " ORDER BY joined_at DESC"
    rows = conn.execute(q, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.patch("/admin/suppliers/{supplier_id}/status")
def update_supplier_status(supplier_id: int, status: str, _=Depends(require_admin)):
    valid = {"pending", "active", "suspended"}
    if status not in valid:
        raise HTTPException(400, "Invalid status")
    conn = get_db()
    conn.execute("UPDATE suppliers SET status=? WHERE id=?", (status, supplier_id))
    conn.execute("""
        INSERT INTO notifications (target, type, title, body)
        VALUES (?,?,?,?)
    """, (f"supplier:{supplier_id}", "account_update",
          "Account Status Updated",
          f"Your account status has been updated to: {status}"))
    conn.commit()
    conn.close()
    return {"ok": True}


@router.patch("/admin/suppliers/{supplier_id}/tier")
def update_supplier_tier(supplier_id: int, tier: str, _=Depends(require_admin)):
    valid = {"bronze", "silver", "gold"}
    if tier not in valid:
        raise HTTPException(400, "Invalid tier")
    conn = get_db()
    conn.execute("UPDATE suppliers SET tier=? WHERE id=?", (tier, supplier_id))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Admin: bid management ─────────────────────────────────────────────────────

@router.get("/admin/bids/{order_item_id}")
def get_item_bids(order_item_id: int, _=Depends(require_admin)):
    conn = get_db()
    bids = conn.execute("""
        SELECT b.*,
               s.name as supplier_name, s.business_name,
               s.tier, s.rating, s.fulfilled_orders,
               s.avg_delivery_hrs, s.phone as supplier_phone
        FROM bids b
        JOIN suppliers s ON b.supplier_id = s.id
        WHERE b.order_item_id = ?
        ORDER BY b.score DESC
    """, (order_item_id,)).fetchall()
    conn.close()
    return [dict(b) for b in bids]


@router.post("/admin/bids/{bid_id}/select")
def select_bid(bid_id: int, _=Depends(require_admin)):
    """Admin manually selects a bid (override auto-selection)."""
    conn  = get_db()
    bid   = conn.execute("SELECT * FROM bids WHERE id=?", (bid_id,)).fetchone()
    if not bid:
        raise HTTPException(404, "Bid not found")

    now = datetime.utcnow().isoformat()

    # Get item details for margin calc
    item = conn.execute(
        "SELECT * FROM order_items WHERE id=?", (bid["order_item_id"],)
    ).fetchone()
    margin = (item["price"] or 0) - bid["supply_price"]

    # Reject all other bids for this item
    conn.execute("""
        UPDATE bids SET status='rejected', responded_at=?
        WHERE order_item_id=? AND id != ?
    """, (now, bid["order_item_id"], bid_id))

    # Accept this bid
    conn.execute(
        "UPDATE bids SET status='accepted', responded_at=? WHERE id=?",
        (now, bid_id)
    )

    # Create fulfillment record
    conn.execute("""
        INSERT INTO order_fulfillments
          (order_id, order_item_id, supplier_id, bid_id,
           supply_price, selling_price, margin)
        VALUES (?,?,?,?,?,?,?)
    """, (bid["order_id"], bid["order_item_id"], bid["supplier_id"],
          bid_id, bid["supply_price"], item["price"] or 0, margin))

    # Update order status
    conn.execute(
        "UPDATE orders SET status='supplier_assigned', updated_at=? WHERE id=?",
        (now, bid["order_id"])
    )

    # Notify winning supplier
    conn.execute("""
        INSERT INTO notifications (target, type, title, body, data)
        VALUES (?,?,?,?,?)
    """, (f"supplier:{bid['supplier_id']}", "bid_won",
          "You Won a Bid!",
          f"You have been selected to fulfill: '{item['title']}'",
          f'{{"order_id":{bid["order_id"]}}}'))

    conn.commit()
    conn.close()
    return {"ok": True}


@router.post("/admin/bids/auto-select/{order_id}")
def auto_select_bids(order_id: int, _=Depends(require_admin)):
    """Auto-select the highest-scored bid for each item in an order."""
    conn  = get_db()
    items = conn.execute(
        "SELECT * FROM order_items WHERE order_id=?", (order_id,)
    ).fetchall()
    selected = 0
    for item in items:
        # Check if already fulfilled
        existing = conn.execute(
            "SELECT id FROM order_fulfillments WHERE order_item_id=?",
            (item["id"],)
        ).fetchone()
        if existing:
            continue
        # Get top bid by score
        top_bid = conn.execute("""
            SELECT * FROM bids
            WHERE order_item_id=? AND status='pending'
            ORDER BY score DESC LIMIT 1
        """, (item["id"],)).fetchone()
        if not top_bid:
            continue

        now    = datetime.utcnow().isoformat()
        margin = (item["price"] or 0) - top_bid["supply_price"]

        conn.execute("""
            UPDATE bids SET status='rejected', responded_at=?
            WHERE order_item_id=? AND id != ?
        """, (now, item["id"], top_bid["id"]))
        conn.execute(
            "UPDATE bids SET status='auto_selected', responded_at=? WHERE id=?",
            (now, top_bid["id"])
        )
        conn.execute("""
            INSERT INTO order_fulfillments
              (order_id, order_item_id, supplier_id, bid_id,
               supply_price, selling_price, margin)
            VALUES (?,?,?,?,?,?,?)
        """, (order_id, item["id"], top_bid["supplier_id"], top_bid["id"],
              top_bid["supply_price"], item["price"] or 0, margin))
        conn.execute("""
            INSERT INTO notifications (target, type, title, body)
            VALUES (?,?,?,?)
        """, (f"supplier:{top_bid['supplier_id']}", "bid_won",
              "You Won a Bid!",
              f"Auto-selected to fulfill: '{item['title']}'"))
        selected += 1

    if selected > 0:
        conn.execute(
            "UPDATE orders SET status='supplier_assigned', updated_at=? WHERE id=?",
            (datetime.utcnow().isoformat(), order_id)
        )
    conn.commit()
    conn.close()
    return {"ok": True, "selected": selected}


# ── Admin: fulfillment workflow ───────────────────────────────────────────────

FULFILLMENT_STATUSES = [
    "pending", "supplier_confirmed", "delivered_to_hub",
    "inspected", "dispatched", "completed", "failed"
]


@router.patch("/admin/fulfillments/{fulfillment_id}/status")
def update_fulfillment(
    fulfillment_id: int,
    status: str,
    admin_note: str = "",
    _=Depends(require_admin)
):
    if status not in FULFILLMENT_STATUSES:
        raise HTTPException(400, "Invalid status")
    conn = get_db()
    f    = conn.execute(
        "SELECT * FROM order_fulfillments WHERE id=?", (fulfillment_id,)
    ).fetchone()
    if not f:
        raise HTTPException(404, "Not found")

    now = datetime.utcnow().isoformat()
    ts_col = {
        "delivered_to_hub": "delivered_to_hub_at",
        "inspected":        "inspected_at",
        "dispatched":       "dispatched_at",
        "completed":        "completed_at",
    }.get(status)

    extra = f", {ts_col}='{now}'" if ts_col else ""
    conn.execute(f"""
        UPDATE order_fulfillments
        SET status=?, admin_note=? {extra}
        WHERE id=?
    """, (status, admin_note, fulfillment_id))

    # When completed: create payout record + update supplier stats
    if status == "completed":
        conn.execute("""
            INSERT INTO payouts (supplier_id, fulfillment_id, amount)
            VALUES (?,?,?)
        """, (f["supplier_id"], fulfillment_id, f["supply_price"]))
        conn.execute("""
            UPDATE suppliers
            SET fulfilled_orders = fulfilled_orders + 1,
                total_orders     = total_orders + 1
            WHERE id=?
        """, (f["supplier_id"],))
        conn.execute("""
            UPDATE orders SET status='completed', updated_at=? WHERE id=?
        """, (now, f["order_id"]))
        # Notify customer
        o = conn.execute("SELECT user_id FROM orders WHERE id=?", (f["order_id"],)).fetchone()
        if o:
            conn.execute("""
                INSERT INTO notifications (target, type, title, body)
                VALUES (?,?,?,?)
            """, (f"user:{o['user_id']}", "order_delivered",
                  "Order Delivered!", "Your order has been delivered. Enjoy!"))

    conn.commit()
    conn.close()
    return {"ok": True}


# ── Admin: payouts ────────────────────────────────────────────────────────────

@router.get("/admin/payouts")
def admin_payouts(status: Optional[str] = "pending", _=Depends(require_admin)):
    conn = get_db()
    rows = conn.execute("""
        SELECT p.*, s.name as supplier_name, s.business_name,
               s.phone as supplier_phone, oi.title as product_title
        FROM payouts p
        JOIN suppliers s ON p.supplier_id = s.id
        JOIN order_fulfillments of ON p.fulfillment_id = of.id
        JOIN order_items oi ON of.order_item_id = oi.id
        WHERE p.status = ?
        ORDER BY p.paid_at DESC
    """, (status,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.patch("/admin/payouts/{payout_id}/pay")
def mark_payout_paid(payout_id: int, payment_ref: str = "", _=Depends(require_admin)):
    conn = get_db()
    p = conn.execute("SELECT * FROM payouts WHERE id=?", (payout_id,)).fetchone()
    if not p:
        raise HTTPException(404, "Not found")
    now = datetime.utcnow().isoformat()
    conn.execute(
        "UPDATE payouts SET status='paid', paid_at=?, payment_ref=? WHERE id=?",
        (now, payment_ref, payout_id)
    )
    conn.execute("""
        INSERT INTO notifications (target, type, title, body)
        VALUES (?,?,?,?)
    """, (f"supplier:{p['supplier_id']}", "payout_sent",
          "Payment Sent",
          f"UGX {p['amount']:,.0f} has been sent to you."))
    conn.commit()
    conn.close()
    return {"ok": True}
