"""
Clears products, subcategories, categories and scrape_log from shop.db.
Keeps users, suppliers, orders, complaints intact.
Run this before a fresh scrape.
"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "backend", "shop.db")
conn    = sqlite3.connect(DB_PATH)

# Order matters — delete dependents first
tables = [
    "scrape_log",
    "supplier_inventory",
    "bids",
    "order_fulfillments",
    "payouts",
    "order_items",
    "products",
    "subcategories",
    "categories",
]

for t in tables:
    try:
        conn.execute(f"DELETE FROM {t}")
        print(f"  ✅ Cleared {t}")
    except Exception as e:
        print(f"  ⚠️  {t}: {e}")

conn.commit()
conn.close()
print("\nDone. Run scraper.py for a fresh crawl.")
