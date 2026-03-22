"use client";
import { Suspense } from "react";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchProducts, fetchCategories } from "@/lib/api";
import ProductCard from "@/components/ProductCard";
import { SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";

const SORTS = [
  { value: "id", label: "Newest" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "rating", label: "Top Rated" },
];

function ShopContent() {
  const sp     = useSearchParams();
  const router = useRouter();
  const [products, setProducts]   = useState<any[]>([]);
  const [total, setTotal]         = useState(0);
  const [pages, setPages]         = useState(1);
  const [cats, setCats]           = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showFilters, setFilters] = useState(false);

  const page       = parseInt(sp.get("page") || "1");
  const search     = sp.get("search") || "";
  const category   = sp.get("category") || "";
  const subcategory = sp.get("subcategory") || "";
  const sort       = sp.get("sort") || "id";
  const minPrice   = sp.get("min_price") || "";
  const maxPrice   = sp.get("max_price") || "";

  const set = (key: string, val: string) => {
    const p = new URLSearchParams(sp.toString());
    val ? p.set(key, val) : p.delete(key);
    p.delete("page");
    router.push(`/shop?${p}`);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, sort, limit: 20 };
      if (search)      params.search      = search;
      if (category)    params.category    = category;
      if (subcategory) params.subcategory = subcategory;
      if (minPrice)    params.min_price   = parseFloat(minPrice);
      if (maxPrice)    params.max_price   = parseFloat(maxPrice);
      const data = await fetchProducts(params);
      setProducts(data.products);
      setTotal(data.total);
      setPages(data.pages);
    } catch { setProducts([]); }
    setLoading(false);
  }, [page, search, category, subcategory, sort, minPrice, maxPrice]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchCategories().then(setCats).catch(() => {}); }, []);

  const goPage = (p: number) => {
    const params = new URLSearchParams(sp.toString());
    params.set("page", String(p));
    router.push(`/shop?${params}`);
  };

  const activeCat = cats.find(c => c.slug === category);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl capitalize">
            {search ? `Results for "${search}"` : subcategory ? subcategory.replace(/-/g, " ") : category ? category.replace(/-/g, " ") : "All Products"}
          </h1>
          {!loading && <p className="text-sm text-gray-500">{total.toLocaleString()} products</p>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setFilters(!showFilters)}
            className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm hover:border-brand transition">
            <SlidersHorizontal size={15} /> Filters
          </button>
          <select value={sort} onChange={e => set("sort", e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand focus:outline-none">
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-6">
        {showFilters && (
          <aside className="w-56 shrink-0 space-y-6">
            <div>
              <h3 className="font-semibold text-sm mb-2">Category</h3>
              <div className="space-y-1">
                <button onClick={() => { set("category", ""); set("subcategory", ""); }}
                  className={`block text-sm w-full text-left px-2 py-1 rounded hover:bg-gray-100 ${!category ? "text-brand font-semibold" : "text-gray-700"}`}>
                  All Categories
                </button>
                {cats.map(cat => (
                  <div key={cat.id}>
                    <button onClick={() => { set("category", cat.slug); set("subcategory", ""); }}
                      className={`block text-sm w-full text-left px-2 py-1 rounded hover:bg-gray-100 ${category === cat.slug ? "text-brand font-semibold" : "text-gray-700"}`}>
                      {cat.name}
                    </button>
                    {category === cat.slug && cat.subcategories?.length > 0 && (
                      <div className="ml-3 mt-1 space-y-1">
                        {cat.subcategories.map((sub: any) => (
                          <button key={sub.id} onClick={() => set("subcategory", sub.slug)}
                            className={`block text-xs w-full text-left px-2 py-1 rounded hover:bg-gray-100 ${subcategory === sub.slug ? "text-brand font-semibold" : "text-gray-500"}`}>
                            {sub.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">Price (UGX)</h3>
              <div className="flex gap-2">
                <input type="number" placeholder="Min" defaultValue={minPrice}
                  onBlur={e => set("min_price", e.target.value)}
                  className="border rounded px-2 py-1 text-sm w-full focus:border-brand focus:outline-none" />
                <input type="number" placeholder="Max" defaultValue={maxPrice}
                  onBlur={e => set("max_price", e.target.value)}
                  className="border rounded px-2 py-1 text-sm w-full focus:border-brand focus:outline-none" />
              </div>
            </div>
          </aside>
        )}

        <div className="flex-1">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="bg-gray-100 rounded-xl h-64 animate-pulse" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <div className="text-5xl mb-3">🔍</div>
              <p className="font-semibold">No products found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {products.map(p => <ProductCard key={p.id} product={p} />)}
              </div>
              {pages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-10">
                  <button onClick={() => goPage(page - 1)} disabled={page <= 1}
                    className="p-2 rounded-lg border hover:border-brand disabled:opacity-30 transition">
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => goPage(p)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition ${page === p ? "bg-brand text-white" : "border hover:border-brand"}`}>
                      {p}
                    </button>
                  ))}
                  <button onClick={() => goPage(page + 1)} disabled={page >= pages}
                    className="p-2 rounded-lg border hover:border-brand disabled:opacity-30 transition">
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-8"><div className="h-40 bg-gray-100 rounded-2xl animate-pulse" /></div>}>
      <ShopContent />
    </Suspense>
  );
}