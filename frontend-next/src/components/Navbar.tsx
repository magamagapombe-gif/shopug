"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { ShoppingCart, Search, User, Menu, X, ChevronDown, LogOut, LayoutDashboard, ChevronRight, Store } from "lucide-react";
import { useAuthStore, useCartStore } from "@/store";
import { fetchCart, fetchCategories } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const { user, logout }   = useAuthStore();
  const { items, setCart } = useCartStore();
  const [cats, setCats]    = useState<any[]>([]);
  const [search, setSearch]        = useState("");
  const [mobileOpen, setMobile]    = useState(false);
  const [userMenu, setUserMenu]    = useState(false);
  const [activeCat, setActiveCat]  = useState<number | null>(null);
  const [expandMobile, setExpandM] = useState<number | null>(null);
  const hideTimer = useRef<any>(null);
  const router    = useRouter();

  useEffect(() => {
    fetchCategories().then(setCats).catch(() => {});
    if (user && user.role !== "supplier") fetchCart().then(d => setCart(d.items, d.total)).catch(() => {});
  }, [user]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".umenu")) setUserMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) router.push(`/shop?search=${encodeURIComponent(search.trim())}`);
  };

  const show = (id: number) => { if (hideTimer.current) clearTimeout(hideTimer.current); setActiveCat(id); };
  const hide = () => { hideTimer.current = setTimeout(() => setActiveCat(null), 160); };
  const keep = () => { if (hideTimer.current) clearTimeout(hideTimer.current); };

  const cartCount  = items.reduce((s, i) => s + i.quantity, 0);
  const activeCatObj = cats.find(c => c.id === activeCat);
  const isSupplier = user?.role === "supplier";

  return (
    <nav className="bg-brand shadow-lg sticky top-0 z-50">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
        <Link href="/" className="font-display font-black text-white text-2xl tracking-tight shrink-0">
          Shop<span className="text-yellow-300">UG</span>
        </Link>

        {!isSupplier && (
          <form onSubmit={handleSearch} className="flex-1 flex">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              className="flex-1 px-4 py-2 rounded-l-lg text-sm focus:outline-none" />
            <button type="submit" className="bg-brand-dark text-white px-4 rounded-r-lg hover:bg-orange-800 transition">
              <Search size={18} />
            </button>
          </form>
        )}
        {isSupplier && <span className="flex-1 text-white/70 text-sm font-medium">Supplier Portal</span>}

        <div className="flex items-center gap-3 shrink-0">
          {!isSupplier && (
            <Link href="/cart" className="relative text-white hover:text-yellow-300 transition">
              <ShoppingCart size={24} />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-yellow-300 text-brand text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">{cartCount}</span>
              )}
            </Link>
          )}

          {user ? (
            <div className="relative umenu">
              <button onClick={() => setUserMenu(!userMenu)}
                className="flex items-center gap-1 text-white hover:text-yellow-300 transition text-sm font-medium">
                <User size={20} />
                <span className="hidden md:block">{user.name.split(" ")[0]}</span>
                <ChevronDown size={14} />
              </button>
              {userMenu && (
                <div className="absolute right-0 top-10 bg-white rounded-xl shadow-2xl py-2 w-52 z-50 border border-gray-100">
                  <div className="px-4 py-2 border-b mb-1">
                    <p className="font-semibold text-sm">{user.name}</p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${isSupplier ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-brand"}`}>
                      {isSupplier ? "Supplier" : user.is_admin ? "Admin" : "Customer"}
                    </span>
                  </div>
                  {isSupplier ? (
                    <Link href="/supplier/dashboard" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50" onClick={() => setUserMenu(false)}>
                      <Store size={15} /> Supplier Dashboard
                    </Link>
                  ) : (
                    <>
                      <Link href="/orders" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50" onClick={() => setUserMenu(false)}>
                        <ShoppingCart size={15} /> My Orders
                      </Link>
                      {user.is_admin && (
                        <Link href="/admin" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50" onClick={() => setUserMenu(false)}>
                          <LayoutDashboard size={15} /> Admin Panel
                        </Link>
                      )}
                    </>
                  )}
                  <hr className="my-1" />
                  <button onClick={() => { logout(); setUserMenu(false); router.push("/"); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 w-full">
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href="/auth/login" className="text-white hover:text-yellow-300 text-sm font-medium flex items-center gap-1">
              <User size={20} /><span className="hidden md:block">Login</span>
            </Link>
          )}

          <button className="text-white md:hidden" onClick={() => setMobile(!mobileOpen)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Category bar - only for customers */}
      {!isSupplier && (
        <div className="bg-brand-dark hidden md:block relative">
          <div className="max-w-7xl mx-auto px-4 flex items-center overflow-x-auto">
            <Link href="/shop" className="text-white text-sm py-3 px-4 hover:bg-brand rounded transition whitespace-nowrap font-semibold border-r border-white/10 shrink-0">
              All Products
            </Link>
            {cats.map(cat => (
              <div key={cat.id} className="relative shrink-0"
                onMouseEnter={() => show(cat.id)} onMouseLeave={hide}>
                <Link href={`/shop?category=${cat.slug}`}
                  className={`flex items-center gap-1 text-sm py-3 px-3 whitespace-nowrap transition ${activeCat === cat.id ? "bg-brand text-white" : "text-white/80 hover:bg-brand hover:text-white"}`}>
                  {cat.name}
                  {cat.subcategories?.length > 0 && <ChevronDown size={12} />}
                </Link>
              </div>
            ))}
          </div>

          {/* Flyout */}
          {activeCatObj && activeCatObj.subcategories?.length > 0 && (
            <div onMouseEnter={keep} onMouseLeave={hide}
              className="absolute left-0 right-0 top-full bg-white shadow-2xl border-t-2 border-brand z-50">
              <div className="max-w-7xl mx-auto px-8 py-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-lg text-brand">{activeCatObj.name}</h3>
                  <Link href={`/shop?category=${activeCatObj.slug}`}
                    className="text-xs text-brand hover:underline flex items-center gap-1"
                    onClick={() => setActiveCat(null)}>
                    View all <ChevronRight size={12} />
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-1">
                  {activeCatObj.subcategories.map((sub: any) => (
                    <Link key={sub.id} href={`/shop?category=${activeCatObj.slug}&subcategory=${sub.slug}`}
                      className="text-sm text-gray-600 hover:text-brand py-1.5 transition flex items-center gap-1 group"
                      onClick={() => setActiveCat(null)}>
                      <ChevronRight size={11} className="text-gray-300 group-hover:text-brand transition shrink-0" />
                      <span className="truncate">{sub.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && !isSupplier && (
        <div className="md:hidden bg-white border-t shadow-xl max-h-[80vh] overflow-y-auto">
          <Link href="/shop" className="block px-4 py-3 font-semibold text-brand border-b bg-orange-50" onClick={() => setMobile(false)}>
            🛒 All Products
          </Link>
          {cats.map(cat => (
            <div key={cat.id} className="border-b">
              <div className="flex items-center justify-between">
                <Link href={`/shop?category=${cat.slug}`} className="flex-1 px-4 py-3 text-sm font-semibold text-gray-800" onClick={() => setMobile(false)}>
                  {cat.name}
                </Link>
                {cat.subcategories?.length > 0 && (
                  <button onClick={() => setExpandM(expandMobile === cat.id ? null : cat.id)} className="px-4 py-3 text-gray-400">
                    <ChevronDown size={16} className={`transition-transform ${expandMobile === cat.id ? "rotate-180" : ""}`} />
                  </button>
                )}
              </div>
              {expandMobile === cat.id && (
                <div className="bg-gray-50 px-4 pb-2">
                  {cat.subcategories.map((sub: any) => (
                    <Link key={sub.id} href={`/shop?category=${cat.slug}&subcategory=${sub.slug}`}
                      className="flex items-center gap-2 py-2 text-sm text-gray-600 hover:text-brand border-b border-gray-100 last:border-0"
                      onClick={() => setMobile(false)}>
                      <ChevronRight size={12} className="text-gray-300" />{sub.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}
