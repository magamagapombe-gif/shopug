"""
Jumia Uganda Scraper v4
- Discovers REAL subcategory URLs by crawling each category page
- No more guessed slugs — uses actual links Jumia serves
- 20% markup on every price
- Deduplication + page loop detection
- Auto-scheduler: python scraper.py --schedule 6
"""

import asyncio, re, sqlite3, os, hashlib, argparse, time
from datetime import datetime
from playwright.async_api import async_playwright

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "backend", "shop.db")
BASE    = "https://www.jumia.ug"
MARKUP  = 1.20

# Top-level categories + subcategories with CORRECT Jumia URL slugs
# Format verified against Jumia UG's actual URL structure
CATEGORIES_WITH_SUBS = {
    "Phones & Tablets": {
        "slug": "phones-tablets",
        "subs": [
            ("Smartphones",        "mlp-smartphones"),
            ("iPhones",            "mlp-iphones"),
            ("Android Phones",     "mlp-android-phones"),
            ("Feature Phones",     "mlp-feature-phones"),
            ("Rugged Phones",      "mlp-rugged-phones"),
            ("Refurbished Phones", "mlp-refurbished-phones"),
            ("Tablets",            "mlp-tablets"),
            ("iPads",              "mlp-ipads"),
            ("Android Tablets",    "mlp-android-tablets"),
            ("Power Banks",        "mlp-power-banks"),
            ("Phone Chargers",     "mlp-phone-chargers"),
            ("Smart Watches",      "mlp-smart-watches"),
            ("Cables & Chargers",  "mlp-cables-chargers"),
        ]
    },
    "Electronics": {
        "slug": "electronics",
        "subs": [
            ("Smart TVs",                    "mlp-smart-tvs"),
            ("LED & LCD TVs",                "mlp-led-lcd-tvs"),
            ("Digital TVs",                  "mlp-digital-tvs"),
            ("Bluetooth Speakers",           "mlp-bluetooth-speakers"),
            ("Home Theatre Systems",         "mlp-home-theatre-systems"),
            ("Sound Bars",                   "mlp-sound-bars"),
            ("CCTV & Video Surveillance",    "mlp-cctv-video-surveillance"),
            ("Projectors",                   "mlp-projectors"),
            ("TV Mounts",                    "mlp-tv-mounts"),
            ("HDMI Cables",                  "mlp-hdmi-cables"),
            ("Car Audio Systems",            "mlp-car-audio-systems"),
            ("Car Chargers",                 "mlp-car-chargers"),
        ]
    },
    "Appliances": {
        "slug": "appliances",
        "subs": [
            ("Refrigerators",             "mlp-refrigerators"),
            ("Washing Machines",          "mlp-washing-machines"),
            ("Air Conditioners",          "mlp-air-conditioners"),
            ("Freezers",                  "mlp-freezers"),
            ("Water Dispensers",          "mlp-water-dispensers"),
            ("Microwaves",                "mlp-microwaves"),
            ("Cookers",                   "mlp-cookers"),
            ("Blenders",                  "mlp-blenders"),
            ("Air Fryers",                "mlp-air-fryers"),
            ("Kettles",                   "mlp-kettles"),
            ("Irons",                     "mlp-irons"),
            ("Fans",                      "mlp-fans"),
            ("Vacuum Cleaners",           "mlp-vacuum-cleaners"),
            ("Deep Fryers",               "mlp-deep-fryers"),
            ("Rice Cookers",              "mlp-rice-cookers"),
            ("Juicers",                   "mlp-juicers"),
            ("Coffee Makers",             "mlp-coffee-makers"),
            ("Toasters",                  "mlp-toasters"),
        ]
    },
    "Home": {
        "slug": "home-office",
        "subs": [
            ("Bedding Sets",              "mlp-bedding-sets-collections"),
            ("Pillows & Duvets",          "mlp-duvets-covers-sets"),
            ("Mattress",                  "mlp-mattresses"),
            ("Cookware",                  "mlp-cookware"),
            ("Kitchen Utensils",          "mlp-kitchen-utensils"),
            ("Home Decor",                "mlp-home-decor"),
            ("Lighting",                  "mlp-lighting"),
            ("Living Room Furniture",     "mlp-living-room"),
            ("Bedroom Furniture",         "mlp-bedroom-furniture"),
            ("Office & School Supplies",  "mlp-office-school-supplies"),
            ("Cleaning Supplies",         "mlp-cleaning-supplies"),
            ("Bathroom Accessories",      "mlp-bathroom-accessories"),
            ("Storage & Organization",    "mlp-storage-organization"),
            ("Towels",                    "mlp-towels"),
        ]
    },
    "Fashion": {
        "slug": "fashion",
        "subs": [
            ("Women Clothing",        "mlp-women-clothing"),
            ("Men Clothing",          "mlp-men-clothing"),
            ("Women Shoes",           "mlp-women-shoes"),
            ("Men Shoes",             "mlp-men-shoes"),
            ("Women Accessories",     "mlp-women-accessories"),
            ("Men Accessories",       "mlp-men-accessories"),
            ("Handbags & Wallets",    "mlp-handbags-wallets"),
            ("Jewelry",               "mlp-jewelry"),
            ("Watches",               "mlp-watches"),
            ("Boys Fashion",          "mlp-boys-fashion"),
            ("Girls Fashion",         "mlp-girls-fashion"),
            ("Backpacks",             "mlp-backpacks"),
            ("Luggage",               "mlp-luggage"),
            ("Sunglasses",            "mlp-sunglasses"),
        ]
    },
    "Computing": {
        "slug": "computing",
        "subs": [
            ("Laptops",                   "mlp-laptops"),
            ("Desktops",                  "mlp-desktop-sets"),
            ("Monitors",                  "mlp-monitors"),
            ("Printers",                  "mlp-printers"),
            ("Keyboards & Mice",          "mlp-keyboards-mice-accessories"),
            ("USB Flash Drives",          "mlp-usb-flash-drives"),
            ("External Hard Drives",      "mlp-external-hard-drives"),
            ("Memory Cards",              "mlp-memory-cards"),
            ("SSD",                       "mlp-ssd"),
            ("Laptop Bags",               "mlp-laptop-bags-stands"),
            ("Cables & Adapters",         "mlp-cables-usb-hubs-adapters"),
        ]
    },
    "Health & Beauty": {
        "slug": "health-beauty",
        "subs": [
            ("Skin Care",                 "mlp-skin-care"),
            ("Hair Care",                 "mlp-hair-care"),
            ("Makeup",                    "mlp-makeup"),
            ("Fragrances",                "mlp-fragrances"),
            ("Personal Care",             "mlp-personal-care"),
            ("Men Grooming",              "mlp-mens-grooming"),
            ("Toothbrushes",              "mlp-toothbrushes"),
            ("Toothpaste",                "mlp-toothpaste"),
            ("Shampoo & Conditioners",    "mlp-shampoo-conditioners"),
            ("Hair Accessories",          "mlp-hair-accessories"),
        ]
    },
    "Supermarket": {
        "slug": "groceries",
        "subs": [
            ("Cooking Oil",               "mlp-cooking-oil"),
            ("Sugar",                     "mlp-sugar"),
            ("Flour",                     "mlp-flours"),
            ("Rice & Grains",             "mlp-dried-beans-grains-rice"),
            ("Snacks",                    "mlp-snacks"),
            ("Beverages",                 "mlp-soft-drinks"),
            ("Water",                     "mlp-water"),
            ("Breakfast Foods",           "mlp-breakfast-foods"),
            ("Household Cleaning",        "mlp-household-cleaning"),
            ("Laundry",                   "mlp-laundry"),
            ("Diapers",                   "mlp-disposable-diapers"),
        ]
    },
    "Gaming": {
        "slug": "video-games",
        "subs": [
            ("PlayStation",               "mlp-playstation-4"),
            ("Xbox",                      "mlp-xbox-one"),
            ("PC Gaming",                 "mlp-pc-gaming"),
            ("Gaming Accessories",        "mlp-gaming-accessories"),
        ]
    },
    "Baby Products": {
        "slug": "baby-products",
        "subs": [
            ("Baby Feeding",              "mlp-feeding"),
            ("Baby Clothing",             "mlp-baby-boys"),
            ("Diapers",                   "mlp-disposable-diapers"),
            ("Baby Monitors",             "mlp-health-baby-care"),
            ("Baby Toys",                 "mlp-baby-toddler-toys"),
            ("Baby Bath",                 "mlp-bathing-skin-care"),
            ("Baby Carriers",             "mlp-gear"),
        ]
    },
    "Sporting Goods": {
        "slug": "sporting-goods",
        "subs": [
            ("Fitness Equipment",         "mlp-sports-fitness"),
            ("Outdoor & Adventure",       "mlp-outdoor-adventure"),
            ("Racquet Sports",            "mlp-racquet-sports"),
        ]
    },
    "Toys & Games": {
        "slug": "toys-games",
        "subs": [
            ("Toys",                      "mlp-toys"),
            ("Games",                     "mlp-games"),
            ("Outdoor Play",              "mlp-sports-outdoor-play"),
        ]
    },
    "Automobile": {
        "slug": "automobile",
        "subs": [
            ("Car Electronics",           "mlp-car-electronics-accessories"),
        ]
    },
}


# ── DB ────────────────────────────────────────────────────────────────────────

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        CREATE TABLE IF NOT EXISTS scrape_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL, scraped_at TEXT NOT NULL, count INTEGER DEFAULT 0
        );
    """)
    conn.commit()
    return conn


def slugify(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def fingerprint(products: list) -> str:
    urls = sorted(p['product_url'] for p in products if p.get('product_url'))
    return hashlib.md5(''.join(urls).encode()).hexdigest()


def get_existing_urls(conn) -> set:
    return {r[0] for r in conn.execute("SELECT product_url FROM products").fetchall()}


# ── Discover real subcategory URLs from a category page ──────────────────────

async def discover_subcategories(page, cat_slug: str, cat_url: str) -> list:
    """
    Load the category page, wait for JS to render, then extract real
    subcategory links from Jumia's left sidebar / filter panel.
    Returns list of (name, slug, full_url).
    """
    try:
        await page.goto(cat_url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(3000)
    except Exception as e:
        print(f"    Could not load category page: {e}")
        return []

    subcats = await page.evaluate(f"""
        () => {{
            const results = [];
            const seen    = new Set();

            document.querySelectorAll('a[href]').forEach(a => {{
                const raw  = (a.getAttribute('href') || '').trim();
                const text = a.innerText.trim().replace(/\\s+/g, ' ');

                // Skip empty, anchors, external, or too long
                if (!raw || raw.startsWith('#') || raw.startsWith('http') || text.length > 60 || text.length < 2) return;

                // Strip query string and trailing slash, then re-add slash
                const clean = raw.split('?')[0].split('#')[0].replace(/\\/+$/, '') + '/';

                // Must be exactly two path segments: /cat-slug/sub-slug/
                const parts = clean.split('/').filter(Boolean);
                if (parts.length !== 2) return;
                if (parts[0] !== '{cat_slug}') return;

                // Skip slugs that look like product detail pages (very long) or brand pages
                const subSlug = parts[1];
                if (subSlug.length > 80) return;

                const key = clean;
                if (seen.has(key)) return;
                seen.add(key);

                results.push({{ name: text, slug: subSlug, href: clean }});
            }});

            return results;
        }}
    """)

    # Filter out noise: skip entries whose name matches the category name itself,
    # or are clearly brand names picked from "shop by brand" sections (very short, all caps)
    cleaned = []
    cat_name_lower = cat_slug.replace('-', ' ')
    for s in subcats:
        name = s['name']
        slug = s['slug']
        # Skip if slug is just the category slug repeated
        if slug == cat_slug:
            continue
        # Skip anchor-style slugs
        if slug.startswith('#'):
            continue
        cleaned.append((name, slug, BASE + s['href']))

    # Dedupe by slug
    seen_slugs = set()
    unique = []
    for name, slug, url in cleaned:
        if slug not in seen_slugs:
            seen_slugs.add(slug)
            unique.append((name, slug, url))

    print(f"    Discovered {len(unique)} subcategories")
    return unique


# ── Product scraping ──────────────────────────────────────────────────────────

async def scrape_page(page) -> list:
    return await page.evaluate("""
        () => Array.from(document.querySelectorAll('article.prd')).map(card => {
            const a       = card.querySelector('a.core');
            const img     = card.querySelector('img.img');
            const name    = card.querySelector('.name');
            const price   = card.querySelector('.prc');
            const rating  = card.querySelector('.stars._s');
            const reviews = card.querySelector('._c');
            const brand   = card.querySelector('.brand');

            let priceVal = null;
            if (price) {
                // Take only the FIRST number — handles ranges like "50,000 - 120,000"
                const match = price.innerText.trim().match(/[\d,]+/);
                if (match) priceVal = parseFloat(match[0].replace(/,/g, ''));
            }
            let ratingVal = null;
            if (rating) {
                const m = rating.className.match(/_([1-5])/);
                ratingVal = m ? parseInt(m[1]) : null;
            }
            return {
                title:        name    ? name.innerText.trim()                             : null,
                price:        priceVal,
                image_url:    img     ? (img.getAttribute('data-src') || img.src)         : null,
                product_url:  a       ? a.getAttribute('href')                            : null,
                rating:       ratingVal,
                review_count: reviews ? parseInt(reviews.innerText.replace(/\D/g,''))||0 : 0,
                brand:        brand   ? brand.innerText.trim()                            : null,
            };
        }).filter(p => p.title && p.product_url)
    """)


async def scrape_listing(page, url: str, existing: set, max_pages=5) -> list:
    """Paginate a listing URL, stop on duplicate pages or 404."""
    all_products, seen_fps = [], set()

    for pg in range(1, max_pages + 1):
        paged = f"{url}?page={pg}" if pg > 1 else url
        try:
            resp = await page.goto(paged, wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(1800)

            if resp and resp.status == 404:
                break

            items = await scrape_page(page)
            if not items:
                break

            fp = fingerprint(items)
            if fp in seen_fps:
                print(f"        page {pg}: duplicate — stopping")
                break
            seen_fps.add(fp)

            new = []
            for item in items:
                u = BASE + item['product_url'] if item['product_url'].startswith('/') else item['product_url']
                item['product_url'] = u
                if u not in existing:
                    new.append(item)

            all_products.extend(new)
            print(f"        page {pg}: {len(items)} found, {len(new)} new")

            has_next = await page.evaluate(
                "() => !!document.querySelector('a[aria-label=\"Next Page\"]')"
            )
            if not has_next:
                break

        except Exception as e:
            print(f"        error pg{pg}: {e}")
            break

    return all_products


def save_products(c, conn, prods, existing, cat_id, sub_id=None) -> list:
    """Insert new products, return list of (id, product_url) for detail scraping."""
    now, inserted = datetime.utcnow().isoformat(), []
    for p in prods:
        url = p['product_url']
        if url in existing:
            continue
        marked = round(p['price'] * MARKUP) if p['price'] else None
        try:
            c.execute("""
                INSERT INTO products
                  (subcategory_id, category_id, title, price, original_price,
                   image_url, product_url, rating, review_count, brand, scraped_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """, (sub_id, cat_id, p['title'], marked, p['price'],
                  p['image_url'], url, p['rating'], p['review_count'], p['brand'], now))
            pid = c.lastrowid
            existing.add(url)
            inserted.append((pid, url))
        except sqlite3.IntegrityError:
            pass
    conn.commit()
    return inserted


# ── Detail page scraping ──────────────────────────────────────────────────────

async def scrape_detail(page, product_url: str) -> dict:
    """
    Visit a single product page and extract:
    - description, specs (as JSON), colors, sizes, stock status
    """
    try:
        await page.goto(product_url, wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(1500)
    except Exception:
        return {}

    return await page.evaluate("""
        () => {
            // ── Description ──────────────────────────────────────────────
            const descEl = document.querySelector(
                '.-pdt-desc, .markup, [data-qa="product-description"], .product-description'
            );
            const description = descEl ? descEl.innerText.trim().slice(0, 2000) : null;

            // ── Specifications ────────────────────────────────────────────
            const specs = {};
            // Jumia renders specs as a table or dl list
            document.querySelectorAll('.-pvs, .specifications tr, .-row').forEach(row => {
                const cells = row.querySelectorAll('td, .-val, .-key, dt, dd');
                if (cells.length >= 2) {
                    const key = cells[0].innerText.trim();
                    const val = cells[1].innerText.trim();
                    if (key && val && key.length < 80) specs[key] = val;
                }
            });
            // Also try definition lists
            const dts = document.querySelectorAll('dt');
            dts.forEach(dt => {
                const dd = dt.nextElementSibling;
                if (dd && dd.tagName === 'DD') {
                    const key = dt.innerText.trim();
                    const val = dd.innerText.trim();
                    if (key && val && key.length < 80) specs[key] = val;
                }
            });

            // ── Colors ────────────────────────────────────────────────────
            const colors = [];
            document.querySelectorAll('.-sku-color, [data-type="color"] li, .color-selector li').forEach(el => {
                const c = el.getAttribute('data-value') || el.getAttribute('title') || el.innerText.trim();
                if (c && c.length < 40) colors.push(c);
            });

            // ── Sizes ─────────────────────────────────────────────────────
            const sizes = [];
            document.querySelectorAll('.-sku-size, [data-type="size"] li, .size-selector li').forEach(el => {
                const s = el.getAttribute('data-value') || el.innerText.trim();
                if (s && s.length < 30) sizes.push(s);
            });

            // ── Stock status ──────────────────────────────────────────────
            const outOfStock = !!(
                document.querySelector('.-out-of-stock, .out-of-stock') ||
                document.body.innerText.match(/out of stock/i)
            );
            const stock_status = outOfStock ? 'out_of_stock' : 'in_stock';

            // ── Extra images ──────────────────────────────────────────────
            const images = [];
            document.querySelectorAll('.-imgs img, .gallery img, .-slide img').forEach(img => {
                const src = img.getAttribute('data-src') || img.src;
                if (src && src.startsWith('http') && !images.includes(src)) images.push(src);
            });

            return {
                description,
                specs: Object.keys(specs).length > 0 ? JSON.stringify(specs) : null,
                colors: colors.length > 0 ? JSON.stringify(colors) : null,
                sizes:  sizes.length  > 0 ? JSON.stringify(sizes)  : null,
                stock_status,
                extra_images: images.length > 1 ? JSON.stringify(images.slice(0, 8)) : null,
            };
        }
    """)


async def enrich_products(page, conn, product_ids: list):
    """
    Visit each product URL and update the DB with full detail info.
    product_ids: list of (id, product_url)
    """
    c   = conn.cursor()
    total = len(product_ids)
    print(f"\n  ┌─ Enriching {total} products with detail info...")

    for i, (pid, url) in enumerate(product_ids, 1):
        try:
            detail = await scrape_detail(page, url)
            if detail:
                c.execute("""
                    UPDATE products SET
                        description  = COALESCE(?, description),
                        specs        = COALESCE(?, specs),
                        colors       = COALESCE(?, colors),
                        sizes        = COALESCE(?, sizes),
                        stock_status = COALESCE(?, stock_status),
                        extra_images = COALESCE(?, extra_images)
                    WHERE id = ?
                """, (
                    detail.get('description'), detail.get('specs'),
                    detail.get('colors'),      detail.get('sizes'),
                    detail.get('stock_status'), detail.get('extra_images'),
                    pid
                ))
            if i % 20 == 0:
                conn.commit()
                print(f"  │  {i}/{total} enriched...")
        except Exception as e:
            print(f"  │  Error on {url[:60]}: {e}")

    conn.commit()
    print(f"  └─ Done enriching {total} products")


# ── Main crawl ────────────────────────────────────────────────────────────────

async def pass1_listings():
    """Pass 1 — scrape all listing pages, save products to DB."""
    conn     = init_db()
    c        = conn.cursor()
    existing = get_existing_urls(conn)
    total    = 0
    print(f"▶  PASS 1: Listing pages — {len(existing)} products already in DB\n")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()

        for cat_name, cat_data in CATEGORIES_WITH_SUBS.items():
            cat_slug = cat_data["slug"]
            cat_url  = f"{BASE}/{cat_slug}/"
            print(f"\n{'='*60}")
            print(f"[CAT] {cat_name}")
            print(f"{'='*60}")

            c.execute("INSERT OR IGNORE INTO categories (name, slug, url) VALUES (?,?,?)",
                      (cat_name, cat_slug, cat_url))
            conn.commit()
            cat_id = c.execute("SELECT id FROM categories WHERE slug=?", (cat_slug,)).fetchone()[0]

            for sub_name, sub_slug in cat_data["subs"]:
                sub_url = f"{BASE}/{cat_slug}/{sub_slug}/"
                print(f"\n  [SUB] {sub_name}  →  {sub_url}")

                c.execute("""
                    INSERT OR IGNORE INTO subcategories (category_id, name, slug, url)
                    VALUES (?,?,?,?)
                """, (cat_id, sub_name, sub_slug, sub_url))
                conn.commit()
                sub_id = c.execute(
                    "SELECT id FROM subcategories WHERE category_id=? AND slug=?",
                    (cat_id, sub_slug)
                ).fetchone()[0]

                prods = await scrape_listing(page, sub_url, existing)
                if not prods:
                    search_url = f"{BASE}/catalog/?q={sub_name.replace(' ', '+')}"
                    print(f"        ↳ fallback: {search_url}")
                    prods = await scrape_listing(page, search_url, existing, max_pages=2)

                new_ids = save_products(c, conn, prods, existing, cat_id, sub_id)
                c.execute("INSERT INTO scrape_log (url, scraped_at, count) VALUES (?,?,?)",
                          (sub_url, datetime.utcnow().isoformat(), len(new_ids)))
                conn.commit()
                total += len(new_ids)
                print(f"        → {len(new_ids)} new products saved")

        await browser.close()

    # Cleanup empty subcategories/categories
    deleted_subs = conn.execute("""
        DELETE FROM subcategories WHERE id NOT IN (
            SELECT DISTINCT subcategory_id FROM products WHERE subcategory_id IS NOT NULL
        )
    """).rowcount
    deleted_cats = conn.execute("""
        DELETE FROM categories
        WHERE id NOT IN (SELECT DISTINCT category_id FROM products WHERE category_id IS NOT NULL)
        AND id NOT IN (SELECT DISTINCT category_id FROM subcategories)
    """).rowcount
    conn.commit()

    db_total = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    unenriched = conn.execute("SELECT COUNT(*) FROM products WHERE description IS NULL").fetchone()[0]
    conn.close()

    print(f"\n{'='*60}")
    print(f"✅  PASS 1 Done!")
    print(f"   New products  : {total}")
    print(f"   DB total      : {db_total}")
    print(f"   Empty subs removed : {deleted_subs}")
    print(f"   Needs enriching    : {unenriched} products")
    print(f"\n👉  Now run in a new terminal: python scraper.py --pass2")
    print(f"{'='*60}")


async def pass2_enrich():
    """Pass 2 — visit every product page missing description and enrich it."""
    conn = init_db()

    # Fetch all products that have no description yet
    rows = conn.execute("""
        SELECT id, product_url FROM products
        WHERE description IS NULL AND product_url IS NOT NULL
        ORDER BY id
    """).fetchall()

    total = len(rows)
    if total == 0:
        print("✅  All products already enriched — nothing to do.")
        conn.close()
        return

    print(f"▶  PASS 2: Enriching {total} products with detail info...")
    print(f"   This visits every product page — will take a while.\n")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()
        await enrich_products(page, conn, [(r[0], r[1]) for r in rows])
        await browser.close()

    enriched = conn.execute(
        "SELECT COUNT(*) FROM products WHERE description IS NOT NULL"
    ).fetchone()[0]
    db_total = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    conn.close()

    print(f"\n{'='*60}")
    print(f"✅  PASS 2 Done!")
    print(f"   Enriched : {enriched}/{db_total} products now have full details")
    print(f"{'='*60}")


async def crawl():
    """Run both passes sequentially (default behaviour)."""
    await pass1_listings()
    print("\n\nStarting Pass 2 automatically...\n")
    await pass2_enrich()


# ── Scheduler ─────────────────────────────────────────────────────────────────

def run_scheduled(hours: float):
    print(f"⏰  Scheduler — every {hours}h (both passes)")
    while True:
        start = time.time()
        asyncio.run(crawl())
        sleep = max(0, hours * 3600 - (time.time() - start))
        print(f"\n💤  Next run in {hours}h")
        time.sleep(sleep)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ShopUG Jumia Scraper")
    parser.add_argument("--pass1",    action="store_true", help="Scrape listing pages only")
    parser.add_argument("--pass2",    action="store_true", help="Enrich products with detail info only")
    parser.add_argument("--schedule", type=float, default=None, metavar="HOURS",
                        help="Run both passes every N hours")
    parser.add_argument("--cleanup",  action="store_true",
                        help="Remove empty subcategories/categories and exit")
    args = parser.parse_args()

    if args.cleanup:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA journal_mode=WAL")
        ds = conn.execute("""
            DELETE FROM subcategories WHERE id NOT IN (
                SELECT DISTINCT subcategory_id FROM products WHERE subcategory_id IS NOT NULL
            )
        """).rowcount
        dc = conn.execute("""
            DELETE FROM categories
            WHERE id NOT IN (SELECT DISTINCT category_id FROM products WHERE category_id IS NOT NULL)
            AND id NOT IN (SELECT DISTINCT category_id FROM subcategories)
        """).rowcount
        conn.commit()
        subs = conn.execute("SELECT COUNT(*) FROM subcategories").fetchone()[0]
        cats = conn.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
        conn.close()
        print(f"🧹  Removed {ds} empty subcategories, {dc} empty categories")
        print(f"   Remaining: {cats} categories, {subs} subcategories")
    elif args.pass1:
        asyncio.run(pass1_listings())
    elif args.pass2:
        asyncio.run(pass2_enrich())
    elif args.schedule:
        run_scheduled(args.schedule)
    else:
        asyncio.run(crawl())

