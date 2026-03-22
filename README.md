# ShopUG — Dropshipping Marketplace

## Business Model
Suppliers register (hidden from customers) → mark products they can supply → customer orders → 
admin sees bids → lowest price/best score wins → supplier delivers to your hub → 
you inspect → you deliver to customer → customer confirms → supplier gets paid.
You keep the margin (20% markup built into all prices).

## Project Structure
```
ecommerce/
├── scraper/
│   └── scraper.py          # Playwright scraper with 20% markup + deduplication
├── backend/
│   ├── main.py             # FastAPI entry point
│   ├── database.py         # Schema + DB init
│   ├── auth.py             # Customer + supplier auth (JWT)
│   ├── auth_utils.py       # JWT helpers, role guards
│   ├── products.py         # Catalog, categories, supplier product approval
│   ├── orders.py           # Cart, checkout, order lifecycle, complaints
│   ├── suppliers.py        # Supplier portal, bids, inventory, payouts
│   ├── admin.py            # Admin stats, notifications
│   └── requirements.txt
└── frontend-next/
    └── src/app/
        ├── page.tsx                    # Homepage
        ├── shop/                       # Product listing + filters
        ├── product/[id]/               # Product detail
        ├── cart/                       # Cart
        ├── checkout/                   # Checkout (mobile money / card)
        ├── orders/                     # Order history + complaint filing
        ├── auth/login|register/        # Customer auth
        ├── admin/                      # Admin panel (orders, suppliers, bids, payouts, complaints)
        └── supplier/
            ├── login|register/         # Supplier auth
            ├── dashboard/              # Supplier hub (bids, fulfillments, notifications)
            ├── inventory/              # Mark products + set supply prices
            ├── categories/             # Select supply categories
            ├── products/               # Submit new products for approval
            └── payouts/                # Payout history
```

## Setup

### Step 1 — Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
# API: http://localhost:8000  Docs: http://localhost:8000/docs
```

### Step 2 — Scraper
```bash
cd scraper
pip install playwright
playwright install chromium
python scraper.py                    # Run once
python scraper.py --schedule 6      # Run every 6 hours
```

### Step 3 — Frontend
```bash
cd frontend-next
npm install
npm run dev
# http://localhost:3000
```

### Step 4 — Make yourself admin
```bash
sqlite3 backend/shop.db "UPDATE users SET is_admin=1 WHERE email='your@email.com';"
```

## Key Features

### For Customers
- Browse by category with flyout subcategory menus
- Search, filter by price, sort by rating/price
- Add to cart, checkout with Mobile Money / Card / Cash on Delivery
- Order tracking with status updates
- File complaints on delivered orders

### For Suppliers (hidden portal at /supplier)
- Register → pending admin approval
- Select which categories they supply
- Search catalog and mark products with their supply price
- Receive bid notifications when orders come in
- Confirm fulfillment, deliver to your hub
- Track payouts

### For Admin (/admin)
- Stats: revenue, margin, products, customers, suppliers, complaints
- Orders: expand any order, view supplier bids ranked by score, manually select or auto-select
- Suppliers: activate/suspend, assign Bronze/Silver/Gold tier
- Payouts: mark pending payouts as paid
- Complaints: investigate, resolve (penalises supplier rating), dismiss
- Products: approve/reject supplier-submitted products, set selling price

## Bid Scoring Formula
`score = (1000 / supply_price) + (rating × 10) + tier_bonus + min(fulfilled_orders, 50) - avg_delivery_hours`
- Gold tier: +15 bonus, Silver: +8, Bronze: 0
- Auto-selects highest score, admin can override manually

## Pricing
All scraped Jumia prices have 20% markup applied automatically.
Original price stored in `original_price` column for your reference.
