from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from database import get_db
from auth_utils import require_admin, get_current_user
from fastapi import Depends
from pydantic import BaseModel

router = APIRouter(tags=["products"])


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories")
def list_categories():
    conn = get_db()
    cats = conn.execute("SELECT * FROM categories ORDER BY name").fetchall()
    result = []
    for cat in cats:
        subs = conn.execute(
            "SELECT * FROM subcategories WHERE category_id=? ORDER BY name",
            (cat["id"],)
        ).fetchall()
        result.append({**dict(cat), "subcategories": [dict(s) for s in subs]})
    conn.close()
    return result


@router.get("/categories/{slug}")
def get_category(slug: str):
    conn = get_db()
    cat = conn.execute("SELECT * FROM categories WHERE slug=?", (slug,)).fetchone()
    if not cat:
        raise HTTPException(404, "Category not found")
    subs = conn.execute(
        "SELECT * FROM subcategories WHERE category_id=?", (cat["id"],)
    ).fetchall()
    conn.close()
    return {**dict(cat), "subcategories": [dict(s) for s in subs]}


# ── Products ──────────────────────────────────────────────────────────────────

@router.get("/products")
def list_products(
    search:      Optional[str]   = None,
    category:    Optional[str]   = None,
    subcategory: Optional[str]   = None,
    min_price:   Optional[float] = None,
    max_price:   Optional[float] = None,
    sort:        Optional[str]   = "id",
    page:        int = Query(1, ge=1),
    limit:       int = Query(20, le=100),
):
    conn = get_db()
    conditions = ["p.is_active = 1", "p.price IS NOT NULL"]
    params: list = []

    if search:
        conditions.append("(p.title LIKE ? OR p.brand LIKE ?)")
        params += [f"%{search}%", f"%{search}%"]
    if category:
        conditions.append("c.slug = ?")
        params.append(category)
    if subcategory:
        conditions.append("s.slug = ?")
        params.append(subcategory)
    if min_price is not None:
        conditions.append("p.price >= ?")
        params.append(min_price)
    if max_price is not None:
        conditions.append("p.price <= ?")
        params.append(max_price)

    order_map = {
        "price_asc":  "p.price ASC",
        "price_desc": "p.price DESC",
        "rating":     "p.rating DESC NULLS LAST",
        "id":         "p.id DESC",
    }
    order = order_map.get(sort, "p.id DESC")
    where  = " AND ".join(conditions)
    offset = (page - 1) * limit

    total = conn.execute(f"""
        SELECT COUNT(*) FROM products p
        LEFT JOIN categories c    ON p.category_id    = c.id
        LEFT JOIN subcategories s ON p.subcategory_id = s.id
        WHERE {where}
    """, params).fetchone()[0]

    rows = conn.execute(f"""
        SELECT p.*,
               c.name as category_name, c.slug as category_slug,
               s.name as subcategory_name, s.slug as subcategory_slug
        FROM products p
        LEFT JOIN categories c    ON p.category_id    = c.id
        LEFT JOIN subcategories s ON p.subcategory_id = s.id
        WHERE {where}
        ORDER BY {order}
        LIMIT ? OFFSET ?
    """, params + [limit, offset]).fetchall()

    conn.close()
    return {
        "total": total,
        "page":  page,
        "limit": limit,
        "pages": max(1, (total + limit - 1) // limit),
        "products": [dict(r) for r in rows],
    }


@router.get("/products/{product_id}")
def get_product(product_id: int):
    conn = get_db()
    row = conn.execute("""
        SELECT p.*,
               c.name as category_name, c.slug as category_slug,
               s.name as subcategory_name, s.slug as subcategory_slug
        FROM products p
        LEFT JOIN categories c    ON p.category_id    = c.id
        LEFT JOIN subcategories s ON p.subcategory_id = s.id
        WHERE p.id = ? AND p.is_active = 1
    """, (product_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404, "Product not found")
    import json
    result = dict(row)
    # Parse JSON fields into proper objects
    for field in ["specs", "colors", "sizes", "extra_images"]:
        if result.get(field):
            try:
                result[field] = json.loads(result[field])
            except Exception:
                pass
    return result


@router.get("/products/{product_id}/related")
def get_related(product_id: int, limit: int = Query(8, le=20)):
    conn = get_db()
    product = conn.execute(
        "SELECT subcategory_id, category_id, brand, price FROM products WHERE id=?",
        (product_id,)
    ).fetchone()
    if not product:
        conn.close()
        raise HTTPException(404, "Product not found")

    # Mix: same subcategory OR same brand, exclude self, order by rating
    rows = conn.execute("""
        SELECT p.*,
               c.name as category_name, c.slug as category_slug,
               s.name as subcategory_name, s.slug as subcategory_slug
        FROM products p
        LEFT JOIN categories c    ON p.category_id    = c.id
        LEFT JOIN subcategories s ON p.subcategory_id = s.id
        WHERE p.id != ?
          AND p.is_active = 1
          AND p.price IS NOT NULL
          AND (
              p.subcategory_id = ?
              OR (p.brand = ? AND p.brand IS NOT NULL AND p.brand != '')
          )
        ORDER BY
            CASE WHEN p.subcategory_id = ? THEN 0 ELSE 1 END,
            p.rating DESC NULLS LAST
        LIMIT ?
    """, (
        product_id,
        product["subcategory_id"],
        product["brand"],
        product["subcategory_id"],
        limit
    )).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── Admin: manage catalog ─────────────────────────────────────────────────────

class ProductUpdate(BaseModel):
    title:     Optional[str]   = None
    price:     Optional[float] = None
    image_url: Optional[str]   = None
    brand:     Optional[str]   = None
    is_active: Optional[int]   = None


@router.patch("/admin/products/{product_id}")
def update_product(product_id: int, body: ProductUpdate, _=Depends(require_admin)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Nothing to update")
    conn = get_db()
    set_clause = ", ".join(f"{k}=?" for k in updates)
    conn.execute(
        f"UPDATE products SET {set_clause} WHERE id=?",
        list(updates.values()) + [product_id]
    )
    conn.commit()
    conn.close()
    return {"ok": True}


@router.delete("/admin/products/{product_id}")
def delete_product(product_id: int, _=Depends(require_admin)):
    conn = get_db()
    conn.execute("UPDATE products SET is_active=0 WHERE id=?", (product_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ── Admin: approve supplier-submitted products ────────────────────────────────

@router.get("/admin/supplier-products")
def list_supplier_products(status: str = "pending", _=Depends(require_admin)):
    conn = get_db()
    rows = conn.execute("""
        SELECT sp.*, s.name as supplier_name, s.business_name,
               c.name as category_name
        FROM supplier_products sp
        JOIN suppliers s ON sp.supplier_id = s.id
        LEFT JOIN categories c ON sp.category_id = c.id
        WHERE sp.status = ?
        ORDER BY sp.submitted_at DESC
    """, (status,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


class ApproveProduct(BaseModel):
    final_price: float
    admin_note:  Optional[str] = None


@router.post("/admin/supplier-products/{sp_id}/approve")
def approve_supplier_product(sp_id: int, body: ApproveProduct, _=Depends(require_admin)):
    from datetime import datetime
    conn = get_db()
    sp = conn.execute("SELECT * FROM supplier_products WHERE id=?", (sp_id,)).fetchone()
    if not sp:
        raise HTTPException(404, "Not found")

    # Add to main products catalog with admin-set price
    conn.execute("""
        INSERT INTO products
          (subcategory_id, category_id, title, price, original_price,
           image_url, is_active, created_at)
        VALUES (?,?,?,?,?,?,1,?)
    """, (sp["subcategory_id"], sp["category_id"], sp["title"],
          body.final_price, sp["supplier_price"], sp["image_url"],
          datetime.utcnow().isoformat()))
    product_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    # Auto-add to supplier inventory
    conn.execute("""
        INSERT OR IGNORE INTO supplier_inventory
          (supplier_id, product_id, supply_price)
        VALUES (?,?,?)
    """, (sp["supplier_id"], product_id, sp["supplier_price"]))

    # Mark as approved
    conn.execute("""
        UPDATE supplier_products
        SET status='approved', admin_note=?, reviewed_at=?
        WHERE id=?
    """, (body.admin_note, datetime.utcnow().isoformat(), sp_id))

    # Notify supplier
    conn.execute("""
        INSERT INTO notifications (target, type, title, body)
        VALUES (?,?,?,?)
    """, (f"supplier:{sp['supplier_id']}", "product_approved",
          "Product Approved",
          f"Your product '{sp['title']}' has been approved and listed."))
    conn.commit()
    conn.close()
    return {"ok": True, "product_id": product_id}


@router.post("/admin/supplier-products/{sp_id}/reject")
def reject_supplier_product(sp_id: int, note: str = "", _=Depends(require_admin)):
    from datetime import datetime
    conn = get_db()
    sp = conn.execute("SELECT * FROM supplier_products WHERE id=?", (sp_id,)).fetchone()
    if not sp:
        raise HTTPException(404, "Not found")
    conn.execute("""
        UPDATE supplier_products SET status='rejected', admin_note=?, reviewed_at=?
        WHERE id=?
    """, (note, datetime.utcnow().isoformat(), sp_id))
    conn.execute("""
        INSERT INTO notifications (target, type, title, body)
        VALUES (?,?,?,?)
    """, (f"supplier:{sp['supplier_id']}", "product_rejected",
          "Product Not Approved", f"Your product '{sp['title']}' was not approved. {note}"))
    conn.commit()
    conn.close()
    return {"ok": True}
