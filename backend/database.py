import os
import sqlite3

TURSO_URL   = os.getenv("TURSO_URL")
TURSO_TOKEN = os.getenv("TURSO_TOKEN")
USE_TURSO   = bool(TURSO_URL and TURSO_TOKEN)

if USE_TURSO:
    try:
        import libsql
        print("✅ Using Turso database")
    except ImportError:
        print("⚠️  libsql not installed — falling back to SQLite")
        USE_TURSO = False

LOCAL_DB = os.path.join(os.path.dirname(__file__), "shop.db")


def _dict_row_factory(cursor, row):
    fields = [d[0] for d in cursor.description]
    return dict(zip(fields, row))


def get_db():
    if USE_TURSO:
        conn = libsql.connect(TURSO_URL, auth_token=TURSO_TOKEN)
        conn.row_factory = _dict_row_factory
    else:
        conn = sqlite3.connect(LOCAL_DB, timeout=60, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=DELETE")
        conn.execute("PRAGMA busy_timeout=60000")
        conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _executescript(conn, script: str):
    statements = [s.strip() for s in script.split(";") if s.strip()]
    for stmt in statements:
        conn.execute(stmt)
    conn.commit()


def init_db():
    conn = get_db()
    _executescript(conn, """
        CREATE TABLE IF NOT EXISTS categories (
            id   INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            slug TEXT NOT NULL UNIQUE,
            url  TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS subcategories (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            name        TEXT NOT NULL,
            slug        TEXT NOT NULL,
            url         TEXT NOT NULL,
            UNIQUE(category_id, slug)
        );
        CREATE TABLE IF NOT EXISTS products (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            subcategory_id INTEGER,
            category_id    INTEGER,
            title          TEXT NOT NULL,
            price          REAL,
            original_price REAL,
            currency       TEXT DEFAULT 'UGX',
            image_url      TEXT,
            extra_images   TEXT,
            product_url    TEXT UNIQUE,
            rating         REAL,
            review_count   INTEGER DEFAULT 0,
            brand          TEXT,
            description    TEXT,
            specs          TEXT,
            colors         TEXT,
            sizes          TEXT,
            stock_status   TEXT DEFAULT 'in_stock',
            is_active      INTEGER DEFAULT 1,
            scraped_at     TEXT,
            created_at     TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            email         TEXT NOT NULL UNIQUE,
            name          TEXT NOT NULL,
            phone         TEXT,
            password_hash TEXT NOT NULL,
            is_admin      INTEGER DEFAULT 0,
            created_at    TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS suppliers (
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
        );
        CREATE TABLE IF NOT EXISTS supplier_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            UNIQUE(supplier_id, category_id)
        );
        CREATE TABLE IF NOT EXISTS supplier_inventory (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id  INTEGER NOT NULL,
            product_id   INTEGER NOT NULL,
            supply_price REAL NOT NULL,
            stock_status TEXT DEFAULT 'available',
            updated_at   TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(supplier_id, product_id)
        );
        CREATE TABLE IF NOT EXISTS supplier_products (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id     INTEGER NOT NULL,
            title           TEXT NOT NULL,
            description     TEXT,
            image_url       TEXT,
            supplier_price  REAL NOT NULL,
            suggested_price REAL,
            category_id     INTEGER,
            subcategory_id  INTEGER,
            status          TEXT DEFAULT 'pending',
            admin_note      TEXT,
            submitted_at    TEXT DEFAULT CURRENT_TIMESTAMP,
            reviewed_at     TEXT
        );
        CREATE TABLE IF NOT EXISTS carts (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity   INTEGER NOT NULL DEFAULT 1,
            UNIQUE(user_id, product_id)
        );
        CREATE TABLE IF NOT EXISTS orders (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL,
            total           REAL NOT NULL,
            status          TEXT DEFAULT 'paid',
            address         TEXT NOT NULL,
            phone           TEXT,
            payment_method  TEXT DEFAULT 'mobile_money',
            payment_ref     TEXT,
            created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS order_items (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id   INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity   INTEGER NOT NULL,
            price      REAL NOT NULL,
            title      TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS bids (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id      INTEGER NOT NULL,
            order_item_id INTEGER NOT NULL,
            supplier_id   INTEGER NOT NULL,
            supply_price  REAL NOT NULL,
            status        TEXT DEFAULT 'pending',
            score         REAL DEFAULT 0,
            submitted_at  TEXT DEFAULT CURRENT_TIMESTAMP,
            responded_at  TEXT,
            UNIQUE(order_item_id, supplier_id)
        );
        CREATE TABLE IF NOT EXISTS order_fulfillments (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id            INTEGER NOT NULL,
            order_item_id       INTEGER NOT NULL,
            supplier_id         INTEGER NOT NULL,
            bid_id              INTEGER NOT NULL,
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
        );
        CREATE TABLE IF NOT EXISTS payouts (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_id    INTEGER NOT NULL,
            fulfillment_id INTEGER NOT NULL,
            amount         REAL NOT NULL,
            status         TEXT DEFAULT 'pending',
            paid_at        TEXT,
            payment_ref    TEXT
        );
        CREATE TABLE IF NOT EXISTS complaints (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id     INTEGER NOT NULL,
            user_id      INTEGER NOT NULL,
            supplier_id  INTEGER,
            description  TEXT NOT NULL,
            evidence_url TEXT,
            status       TEXT DEFAULT 'open',
            resolution   TEXT,
            created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
            resolved_at  TEXT
        );
        CREATE TABLE IF NOT EXISTS notifications (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            target     TEXT NOT NULL,
            type       TEXT NOT NULL,
            title      TEXT NOT NULL,
            body       TEXT,
            data       TEXT,
            is_read    INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS scrape_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            scraped_at TEXT NOT NULL,
            count INTEGER DEFAULT 0
        )
    """)
    conn.close()