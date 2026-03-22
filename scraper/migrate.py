"""
Migration script — adds missing columns to existing shop.db
Run this once before running the scraper again.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "backend", "shop.db")

conn = sqlite3.connect(DB_PATH)
c    = conn.cursor()

migrations = [
    # Products table — new detail columns
    "ALTER TABLE products ADD COLUMN original_price REAL",
    "ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1",
    "ALTER TABLE products ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE products ADD COLUMN description TEXT",
    "ALTER TABLE products ADD COLUMN specs TEXT",
    "ALTER TABLE products ADD COLUMN colors TEXT",
    "ALTER TABLE products ADD COLUMN sizes TEXT",
    "ALTER TABLE products ADD COLUMN stock_status TEXT DEFAULT 'in_stock'",
    "ALTER TABLE products ADD COLUMN extra_images TEXT",

    # Supplier tables (may not exist at all if old backend)
    """CREATE TABLE IF NOT EXISTS suppliers (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        email            TEXT NOT NULL UNIQUE,
        name             TEXT NOT NULL,
        business_name    TEXT NOT NULL,
        phone            TEXT NOT NULL,
        address          TEXT,
        password_hash    TEXT NOT NULL,
        status           TEXT DEFAULT 'pending',
        tier             TEXT DEFAULT 'bronze',
        rating           REAL DEFAULT 0,
        total_orders     INTEGER DEFAULT 0,
        fulfilled_orders INTEGER DEFAULT 0,
        avg_delivery_hrs REAL DEFAULT 0,
        joined_at        TEXT DEFAULT CURRENT_TIMESTAMP,
        last_active      TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS supplier_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
        category_id INTEGER NOT NULL REFERENCES categories(id),
        UNIQUE(supplier_id, category_id)
    )""",
    """CREATE TABLE IF NOT EXISTS supplier_inventory (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id  INTEGER NOT NULL REFERENCES suppliers(id),
        product_id   INTEGER NOT NULL REFERENCES products(id),
        supply_price REAL NOT NULL,
        stock_status TEXT DEFAULT 'available',
        updated_at   TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(supplier_id, product_id)
    )""",
    """CREATE TABLE IF NOT EXISTS supplier_products (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
        title           TEXT NOT NULL,
        description     TEXT,
        image_url       TEXT,
        supplier_price  REAL NOT NULL,
        suggested_price REAL,
        category_id     INTEGER REFERENCES categories(id),
        subcategory_id  INTEGER REFERENCES subcategories(id),
        status          TEXT DEFAULT 'pending',
        admin_note      TEXT,
        submitted_at    TEXT DEFAULT CURRENT_TIMESTAMP,
        reviewed_at     TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS bids (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id      INTEGER NOT NULL REFERENCES orders(id),
        order_item_id INTEGER NOT NULL REFERENCES order_items(id),
        supplier_id   INTEGER NOT NULL REFERENCES suppliers(id),
        supply_price  REAL NOT NULL,
        status        TEXT DEFAULT 'pending',
        score         REAL DEFAULT 0,
        submitted_at  TEXT DEFAULT CURRENT_TIMESTAMP,
        responded_at  TEXT,
        UNIQUE(order_item_id, supplier_id)
    )""",
    """CREATE TABLE IF NOT EXISTS order_fulfillments (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id            INTEGER NOT NULL REFERENCES orders(id),
        order_item_id       INTEGER NOT NULL REFERENCES order_items(id),
        supplier_id         INTEGER NOT NULL REFERENCES suppliers(id),
        bid_id              INTEGER NOT NULL REFERENCES bids(id),
        supply_price        REAL NOT NULL,
        selling_price       REAL NOT NULL,
        margin              REAL NOT NULL,
        status              TEXT DEFAULT 'pending',
        confirmed_at        TEXT,
        delivered_to_hub_at TEXT,
        inspected_at        TEXT,
        dispatched_at       TEXT,
        completed_at        TEXT,
        admin_note          TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS payouts (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id    INTEGER NOT NULL REFERENCES suppliers(id),
        fulfillment_id INTEGER NOT NULL REFERENCES order_fulfillments(id),
        amount         REAL NOT NULL,
        status         TEXT DEFAULT 'pending',
        paid_at        TEXT,
        payment_ref    TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS complaints (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id     INTEGER NOT NULL REFERENCES orders(id),
        user_id      INTEGER NOT NULL REFERENCES users(id),
        supplier_id  INTEGER REFERENCES suppliers(id),
        description  TEXT NOT NULL,
        evidence_url TEXT,
        status       TEXT DEFAULT 'open',
        resolution   TEXT,
        created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
        resolved_at  TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS notifications (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        target     TEXT NOT NULL,
        type       TEXT NOT NULL,
        title      TEXT NOT NULL,
        body       TEXT,
        data       TEXT,
        is_read    INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""",
    # Orders table — add missing columns if old schema
    "ALTER TABLE orders ADD COLUMN phone TEXT",
    "ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'mobile_money'",
    "ALTER TABLE orders ADD COLUMN payment_ref TEXT",
    "ALTER TABLE orders ADD COLUMN updated_at TEXT",
    # Users table
    "ALTER TABLE users ADD COLUMN phone TEXT",
]

applied = 0
skipped = 0
for sql in migrations:
    try:
        c.execute(sql)
        conn.commit()
        # Get a short label for the log
        label = sql.strip().split('\n')[0][:70]
        print(f"  ✅ {label}")
        applied += 1
    except sqlite3.OperationalError as e:
        err = str(e)
        if "duplicate column" in err or "already exists" in err:
            skipped += 1  # already applied — skip silently
        else:
            print(f"  ⚠️  {err}  →  {sql.strip()[:60]}")

conn.close()
print(f"\nDone — {applied} migrations applied, {skipped} already existed.")
print("You can now run scraper.py again.")
