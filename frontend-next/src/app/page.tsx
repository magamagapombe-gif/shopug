import Link from "next/link";
import { fetchCategories, fetchProducts } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

async function getData() {
  try {
    const [cats, featured, topRated] = await Promise.all([
      fetchCategories(),
      fetchProducts({ limit: 8, sort: "id" }),
      fetchProducts({ limit: 8, sort: "rating" }),
    ]);
    return { categories: cats, featured: featured.products, topRated: topRated.products };
  } catch { return { categories: [], featured: [], topRated: [] }; }
}

export default async function HomePage() {
  const { categories, featured, topRated } = await getData();
  return (
    <div>
      <section className="bg-gradient-to-br from-brand to-brand-dark text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-display text-5xl md:text-7xl font-black tracking-tight mb-4">
            Shop Everything.<br /><span className="text-yellow-300">Delivered Fast.</span>
          </h1>
          <p className="text-lg text-white/80 mb-3 max-w-xl mx-auto">Electronics, fashion, home appliances and more — all inspected before delivery.</p>
          <p className="text-white/60 text-sm mb-8">📦 Delivery within 24–48 hours across Uganda</p>
          <Link href="/shop" className="inline-block bg-yellow-300 text-brand font-bold px-8 py-3 rounded-full text-lg hover:bg-yellow-400 transition">Shop Now →</Link>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-12">
          <h2 className="font-display font-bold text-2xl mb-6">Shop by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {categories.slice(0, 12).map((cat: any) => (
              <Link key={cat.id} href={`/shop?category=${cat.slug}`}
                className="bg-white border border-gray-100 rounded-xl p-4 text-center hover:border-brand hover:shadow-md transition group">
                <div className="text-3xl mb-2">🛒</div>
                <p className="text-xs font-semibold text-gray-700 group-hover:text-brand leading-tight">{cat.name}</p>
                <p className="text-xs text-gray-400 mt-1">{cat.subcategories?.length || 0} subcategories</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-bold text-2xl">New Arrivals</h2>
            <Link href="/shop" className="text-brand text-sm font-medium hover:underline">See all →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {featured.map((p: any) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {topRated.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display font-bold text-2xl">Top Rated</h2>
            <Link href="/shop?sort=rating" className="text-brand text-sm font-medium hover:underline">See all →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {topRated.map((p: any) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {featured.length === 0 && (
        <section className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="text-6xl mb-4">🚀</div>
          <h2 className="font-display font-bold text-2xl mb-2">Ready to Launch</h2>
          <p className="text-gray-500 mb-4">Run the scraper to populate your store.</p>
          <code className="bg-gray-100 px-4 py-2 rounded-lg text-sm block mb-6">cd scraper && python scraper.py</code>
          <Link href="/supplier/register" className="inline-block bg-brand text-white font-bold px-6 py-3 rounded-xl hover:bg-brand-dark transition">
            Register as Supplier →
          </Link>
        </section>
      )}
    </div>
  );
}
