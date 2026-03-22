
cd ecommerce\backend
python -c "
import sqlite3
conn = sqlite3.connect('shop.db')

print('=== CATEGORIES ===')
for r in conn.execute('SELECT id, name, slug FROM categories'):
    print(r)

print('\n=== SUBCATEGORIES (first 30) ===')
for r in conn.execute('SELECT id, category_id, name, slug, url FROM subcategories LIMIT 30'):
    print(r)

print('\n=== PRODUCTS PER CATEGORY ===')
for r in conn.execute('SELECT c.name, COUNT(p.id) FROM categories c LEFT JOIN products p ON p.category_id=c.id GROUP BY c.id'):
    print(r)

print('\n=== PRODUCTS PER SUBCATEGORY (non-zero only) ===')
for r in conn.execute('SELECT s.name, COUNT(p.id) FROM subcategories s LEFT JOIN products p ON p.subcategory_id=s.id GROUP BY s.id HAVING COUNT(p.id) > 0'):
    print(r)

print('\n=== PRODUCTS WITH NO SUBCATEGORY ===')
print(conn.execute('SELECT COUNT(*) FROM products WHERE subcategory_id IS NULL').fetchone())
"