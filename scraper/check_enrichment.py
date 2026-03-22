"""
Run this in a separate terminal while pass2 is running to see enrichment progress.
python check_enrichment.py
"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "backend", "shop.db")

conn = sqlite3.connect(DB_PATH, timeout=10)
conn.row_factory = sqlite3.Row

total       = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
enriched    = conn.execute("SELECT COUNT(*) FROM products WHERE description IS NOT NULL").fetchone()[0]
no_desc     = conn.execute("SELECT COUNT(*) FROM products WHERE description IS NULL").fetchone()[0]
with_specs  = conn.execute("SELECT COUNT(*) FROM products WHERE specs IS NOT NULL").fetchone()[0]
with_colors = conn.execute("SELECT COUNT(*) FROM products WHERE colors IS NOT NULL").fetchone()[0]
with_sizes  = conn.execute("SELECT COUNT(*) FROM products WHERE sizes IS NOT NULL").fetchone()[0]
out_of_stock = conn.execute("SELECT COUNT(*) FROM products WHERE stock_status='out_of_stock'").fetchone()[0]
pct = round(enriched / total * 100, 1) if total else 0

print(f"\n{'='*60}")
print(f"  Enrichment Progress")
print(f"{'='*60}")
print(f"  Total products  : {total:,}")
print(f"  Enriched        : {enriched:,} ({pct}%)")
print(f"  Remaining       : {no_desc:,}")
print(f"  With specs      : {with_specs:,}")
print(f"  With colors     : {with_colors:,}")
print(f"  With sizes      : {with_sizes:,}")
print(f"  Out of stock    : {out_of_stock:,}")
print(f"{'='*60}")

# ── Per-category breakdown ────────────────────────────────────────────────────
print(f"\n  {'CATEGORY':<28} {'TOTAL':>6} {'ENRICHED':>9} {'REMAINING':>10} {'%':>5}")
print(f"  {'-'*60}")

cat_rows = conn.execute("""
    SELECT c.name, c.id,
           COUNT(p.id) as total,
           SUM(CASE WHEN p.description IS NOT NULL THEN 1 ELSE 0 END) as enriched
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name
""").fetchall()

for r in cat_rows:
    t = r['total'] or 0
    e = r['enriched'] or 0
    rem = t - e
    pct_cat = round(e / t * 100) if t else 0
    bar = '█' * (pct_cat // 10) + '░' * (10 - pct_cat // 10)
    print(f"  {r['name']:<28} {t:>6,} {e:>9,} {rem:>10,} {pct_cat:>4}%  {bar}")

# ── Per-subcategory breakdown ─────────────────────────────────────────────────
print(f"\n\n  {'SUBCATEGORY':<35} {'TOTAL':>6} {'ENRICHED':>9} {'%':>5}")
print(f"  {'-'*58}")

sub_rows = conn.execute("""
    SELECT c.name as cat_name, s.name as sub_name,
           COUNT(p.id) as total,
           SUM(CASE WHEN p.description IS NOT NULL THEN 1 ELSE 0 END) as enriched
    FROM subcategories s
    JOIN categories c ON s.category_id = c.id
    LEFT JOIN products p ON p.subcategory_id = s.id
    GROUP BY s.id
    ORDER BY c.name, s.name
""").fetchall()

current_cat = None
for r in sub_rows:
    if r['cat_name'] != current_cat:
        print(f"\n  ► {r['cat_name']}")
        current_cat = r['cat_name']
    t = r['total'] or 0
    e = r['enriched'] or 0
    pct_sub = round(e / t * 100) if t else 0
    status = "✅" if pct_sub == 100 else "🔄" if e > 0 else "⬜"
    print(f"    {status} {r['sub_name']:<33} {t:>6,} {e:>9,} {pct_sub:>4}%")

# ── Recently enriched examples ────────────────────────────────────────────────
print(f"\n\n  Recently enriched (last 5):")
recent = conn.execute("""
    SELECT p.title, p.brand, p.description, p.specs, p.colors, p.sizes,
           p.stock_status, c.name as cat_name, s.name as sub_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN subcategories s ON p.subcategory_id = s.id
    WHERE p.description IS NOT NULL
    ORDER BY p.rowid DESC LIMIT 5
""").fetchall()

for i, r in enumerate(recent, 1):
    print(f"\n  [{i}] {r['title'][:55]}")
    print(f"      Category    : {r['cat_name'] or '—'} › {r['sub_name'] or '—'}")
    print(f"      Brand       : {r['brand'] or '—'}")
    print(f"      Stock       : {r['stock_status']}")
    print(f"      Description : {(r['description'] or '')[:80]}...")
    print(f"      Specs       : {'Yes' if r['specs'] else 'No'}")
    print(f"      Colors      : {r['colors'] or '—'}")
    print(f"      Sizes       : {r['sizes'] or '—'}")

conn.close()
print()
