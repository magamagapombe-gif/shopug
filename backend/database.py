"""
Central database module — single connection pool, all schema definitions.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "shop.db")


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
    -- ── Catalog ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS categories (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        url  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subcategories (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL REFERENCES categories(id),
        name        TEXT NOT NULL,
        slug        TEXT NOT NULL,
        url         TEXT NOT NULL,
        UNIQUE(category_id, slug)
    );

    CREATE TABLE IF NOT EXISTS products (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        subcategory_id INTEGER REFERENCES subcategories(id),
        category_id    INTEGER REFERENCES categories(id),
        title          TEXT NOT NULL,
        price          REAL,
        original_price REAL,
        currency       TEXT DEFAULT 'UGX',
        image_url      TEXT,
        product_url    TEXT UNIQUE,
        rating         REAL,
        review_count   INTEGER DEFAULT 0,
        brand          TEXT,
        is_active      INTEGER DEFAULT 1,
        scraped_at     TEXT,
        created_at     TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Supplier-submitted products pending admin approval
    CREATE TABLE IF NOT EXISTS supplier_products (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
        title           TEXT NOT NULL,
        description     TEXT,
        image_url       TEXT,
        supplier_price  REAL NOT NULL,
        suggested_price REAL,
        category_id     INTEGER REFERENCES categories(id),
        subcategory_id  INTEGER REFERENCES subcategories(id),
        status          TEXT DEFAULT 'pending',  -- pending | approved | rejected
        admin_note      TEXT,
        submitted_at    TEXT DEFAULT CURRENT_TIMESTAMP,
        reviewed_at     TEXT
    );

    -- ── Users (customers) ────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        email         TEXT NOT NULL UNIQUE,
        name          TEXT NOT NULL,
        phone         TEXT,
        password_hash TEXT NOT NULL,
        is_admin      INTEGER DEFAULT 0,
        created_at    TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- ── Suppliers ────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS suppliers (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        email            TEXT NOT NULL UNIQUE,
        name             TEXT NOT NULL,
        business_name    TEXT NOT NULL,
        phone            TEXT NOT NULL,
        address          TEXT,
        password_hash    TEXT NOT NULL,
        status           TEXT DEFAULT 'pending',  -- pending | active | suspended
        tier             TEXT DEFAULT 'bronze',   -- bronze | silver | gold
        rating           REAL DEFAULT 0,
        total_orders     INTEGER DEFAULT 0,
        fulfilled_orders INTEGER DEFAULT 0,
        avg_delivery_hrs REAL DEFAULT 0,
        joined_at        TEXT DEFAULT CURRENT_TIMESTAMP,
        last_active      TEXT
    );

    -- Which categories a supplier can supply
    CREATE TABLE IF NOT EXISTS supplier_categories (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
        category_id INTEGER NOT NULL REFERENCES categories(id),
        UNIQUE(supplier_id, category_id)
    );

    -- Which specific products a supplier stocks
    CREATE TABLE IF NOT EXISTS supplier_inventory (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id    INTEGER NOT NULL REFERENCES suppliers(id),
        product_id     INTEGER NOT NULL REFERENCES products(id),
        supply_price   REAL NOT NULL,
        stock_status   TEXT DEFAULT 'available',  -- available | out_of_stock
        updated_at     TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(supplier_id, product_id)
    );

    -- ── Cart ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS carts (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity   INTEGER NOT NULL DEFAULT 1,
        UNIQUE(user_id, product_id)
    );

    -- ── Orders ───────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS orders (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id         INTEGER NOT NULL REFERENCES users(id),
        total           REAL NOT NULL,
        status          TEXT DEFAULT 'paid',
        -- paid → supplier_assigned → supplier_confirmed → in_transit →
        -- inspecting → out_for_delivery → delivered → completed
        address         TEXT NOT NULL,
        phone           TEXT,
        payment_method  TEXT DEFAULT 'mobile_money',
        payment_ref     TEXT,
        created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS order_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id   INTEGER NOT NULL REFERENCES orders(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity   INTEGER NOT NULL,
        price      REAL NOT NULL,   -- price customer paid
        title      TEXT NOT NULL
    );

    -- ── Bids ─────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS bids (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id        INTEGER NOT NULL REFERENCES orders(id),
        order_item_id   INTEGER NOT NULL REFERENCES order_items(id),
        supplier_id     INTEGER NOT NULL REFERENCES suppliers(id),
        supply_price    REAL NOT NULL,   -- supplier's offered price
        status          TEXT DEFAULT 'pending',
        -- pending | accepted | rejected | withdrawn | auto_selected
        score           REAL DEFAULT 0,  -- composite score for ranking
        submitted_at    TEXT DEFAULT CURRENT_TIMESTAMP,
        responded_at    TEXT,
        UNIQUE(order_item_id, supplier_id)
    );

    -- Which supplier won each order item
    CREATE TABLE IF NOT EXISTS order_fulfillments (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id      INTEGER NOT NULL REFERENCES orders(id),
        order_item_id INTEGER NOT NULL REFERENCES order_items(id),
        supplier_id   INTEGER NOT NULL REFERENCES suppliers(id),
        bid_id        INTEGER NOT NULL REFERENCES bids(id),
        supply_price  REAL NOT NULL,
        selling_price REAL NOT NULL,
        margin        REAL NOT NULL,    -- selling_price - supply_price
        status        TEXT DEFAULT 'pending',
        -- pending | supplier_confirmed | delivered_to_hub |
        -- inspected | dispatched | completed | failed
        confirmed_at  TEXT,
        delivered_to_hub_at TEXT,
        inspected_at  TEXT,
        dispatched_at TEXT,
        completed_at  TEXT,
        admin_note    TEXT
    );

    -- ── Payouts ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS payouts (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        supplier_id   INTEGER NOT NULL REFERENCES suppliers(id),
        fulfillment_id INTEGER NOT NULL REFERENCES order_fulfillments(id),
        amount        REAL NOT NULL,
        status        TEXT DEFAULT 'pending',  -- pending | paid
        paid_at       TEXT,
        payment_ref   TEXT
    );

    -- ── Complaints ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS complaints (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id      INTEGER NOT NULL REFERENCES orders(id),
        user_id       INTEGER NOT NULL REFERENCES users(id),
        supplier_id   INTEGER REFERENCES suppliers(id),  -- traced internally
        description   TEXT NOT NULL,
        evidence_url  TEXT,
        status        TEXT DEFAULT 'open',  -- open | investigating | resolved | dismissed
        resolution    TEXT,
        created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
        resolved_at   TEXT
    );

    -- ── Notifications ────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS notifications (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        target     TEXT NOT NULL,     -- 'admin' | 'supplier:{id}' | 'user:{id}'
        type       TEXT NOT NULL,     -- 'new_order' | 'bid_won' | 'bid_lost' | etc.
        title      TEXT NOT NULL,
        body       TEXT,
        data       TEXT,              -- JSON blob for extra context
        is_read    INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- ── Scrape log ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS scrape_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        url        TEXT NOT NULL,
        scraped_at TEXT NOT NULL,
        count      INTEGER DEFAULT 0
    );
    """)
    conn.commit()
    conn.close()
