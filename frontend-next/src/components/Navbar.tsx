"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import {
  ShoppingCart, Search, User, Menu, X, ChevronDown,
  LogOut, LayoutDashboard, ChevronRight, Store, Package,
} from "lucide-react";
import { useAuthStore, useCartStore } from "@/store";
import { fetchCart, fetchCategories } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const { user, logout }   = useAuthStore();
  const { items, setCart } = useCartStore();
  const [cats, setCats]            = useState<any[]>([]);
  const [search, setSearch]        = useState("");
  const [mobileOpen, setMobile]    = useState(false);
  const [userMenu, setUserMenu]    = useState(false);
  const [activeCat, setActiveCat]  = useState<number | null>(null);
  const [expandMobile, setExpandM] = useState<number | null>(null);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const hideTimer  = useRef<any>(null);
  const searchRef  = useRef<HTMLInputElement>(null);
  const router     = useRouter();

  useEffect(() => {
    fetchCategories().then(setCats).catch(() => {});
    if (user && user.role !== "supplier")
      fetchCart().then(d => setCart(d.items, d.total)).catch(() => {});
  }, [user]);

  // Close menus on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".umenu")) setUserMenu(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Close mobile menu on route change / resize
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) { setMobile(false); setShowMobileSearch(false); } };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Prevent body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/shop?search=${encodeURIComponent(search.trim())}`);
      setMobile(false);
      setShowMobileSearch(false);
    }
  };

  const show = (id: number) => { if (hideTimer.current) clearTimeout(hideTimer.current); setActiveCat(id); };
  const hide = () => { hideTimer.current = setTimeout(() => setActiveCat(null), 160); };
  const keep = () => { if (hideTimer.current) clearTimeout(hideTimer.current); };

  const cartCount    = items.reduce((s, i) => s + i.quantity, 0);
  const activeCatObj = cats.find(c => c.id === activeCat);
  const isSupplier   = user?.role === "supplier";

  const closeMobile = () => { setMobile(false); setExpandM(null); };

  return (
    <>
      <nav className="bg-brand shadow-lg sticky top-0 z-50">

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">

          {/* Logo */}
          <Link href="/" className="font-display font-black text-white text-xl tracking-tight shrink-0" onClick={closeMobile}>
            Shop<span className="text-yellow-300">UG</span>
          </Link>

          {/* Desktop search */}
          {!isSupplier && (
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                className="flex-1 px-4 py-2 rounded-l-lg text-sm focus:outline-none"
              />
              <button type="submit" className="bg-brand-dark text-white px-4 rounded-r-lg hover:bg-orange-800 transition">
                <Search size={16} />
              </button>
            </form>
          )}
          {isSupplier && <span className="hidden md:block flex-1 text-white/70 text-sm font-medium">Supplier Portal</span>}

          {/* Right icons */}
          <div className="ml-auto flex items-center gap-2 shrink-0">

            {/* Mobile search toggle */}
            {!isSupplier && (
              <button
                className="md:hidden text-white p-2 hover:text-yellow-300 transition"
                onClick={() => { setShowMobileSearch(v => !v); setMobile(false); }}
                aria-label="Search"
              >
                <Search size={20} />
              </button>
            )}

            {/* Cart */}
            {!isSupplier && (
              <Link href="/cart" className="relative text-white hover:text-yellow-300 transition p-1" onClick={closeMobile}>
                <ShoppingCart size={22} />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-300 text-brand text-xs font-black w-5 h-5 rounded-full flex items-center justify-center leading-none">
                    {cartCount}
                  </span>
                )}
              </Link>
            )}

            {/* User menu */}
            {user ? (
              <div className="relative umenu">
                <button
                  onClick={() => setUserMenu(v => !v)}
                  className="flex items-center gap-1 text-white hover:text-yellow-300 transition text-sm font-medium p-1"
                >
                  <User size={20} />
                  <span className="hidden md:block max-w-[80px] truncate">{user.name.split(" ")[0]}</span>
                  <ChevronDown size={13} className={`transition-transform ${userMenu ? "rotate-180" : ""}`} />
                </button>
                {userMenu && (
                  <div className="absolute right-0 top-11 bg-white rounded-xl shadow-2xl py-2 w-52 z-[60] border border-gray-100">
                    <div className="px-4 py-2 border-b mb-1">
                      <p className="font-semibold text-sm truncate">{user.name}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
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
                          <Package size={15} /> My Orders
                        </Link>
                        {user.is_admin && (
                          <Link href="/admin" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50" onClick={() => setUserMenu(false)}>
                            <LayoutDashboard size={15} /> Admin Panel
                          </Link>
                        )}
                      </>
                    )}
                    <hr className="my-1" />
                    <button
                      onClick={() => { logout(); setUserMenu(false); router.push("/"); }}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 w-full"
                    >
                      <LogOut size={15} /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/auth/login" className="text-white hover:text-yellow-300 text-sm font-medium flex items-center gap-1 p-1" onClick={closeMobile}>
                <User size={20} />
                <span className="hidden md:block">Login</span>
              </Link>
            )}

            {/* Hamburger — mobile only */}
            <button
              className="md:hidden text-white p-2 hover:text-yellow-300 transition ml-1"
              onClick={() => { setMobile(v => !v); setShowMobileSearch(false); }}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* ── Mobile search bar (slides down) ─────────────────────────── */}
        {showMobileSearch && !isSupplier && (
          <div className="md:hidden bg-brand-dark px-4 pb-3">
            <form onSubmit={handleSearch} className="flex">
              <input
                ref={searchRef}
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                className="flex-1 px-4 py-2 rounded-l-lg text-sm focus:outline-none"
              />
              <button type="submit" className="bg-brand text-white px-4 rounded-r-lg hover:bg-orange-700 transition">
                <Search size={16} />
              </button>
            </form>
          </div>
        )}

        {/* ── Desktop category bar ─────────────────────────────────────── */}
        {!isSupplier && (
          <div className="bg-brand-dark hidden md:block relative">
            <div className="max-w-7xl mx-auto px-4 flex items-center overflow-x-auto scrollbar-none">
              <Link href="/shop"
                className="text-white text-sm py-3 px-4 hover:bg-brand rounded transition whitespace-nowrap font-semibold border-r border-white/10 shrink-0">
                All Products
              </Link>
              {cats.map(cat => (
                <div key={cat.id} className="relative shrink-0"
                  onMouseEnter={() => show(cat.id)} onMouseLeave={hide}>
                  <Link href={`/shop?category=${cat.slug}`}
                    className={`flex items-center gap-1 text-sm py-3 px-3 whitespace-nowrap transition
                      ${activeCat === cat.id ? "bg-brand text-white" : "text-white/80 hover:bg-brand hover:text-white"}`}>
                    {cat.name}
                    {cat.subcategories?.length > 0 && <ChevronDown size={12} />}
                  </Link>
                </div>
              ))}
            </div>

            {/* Flyout dropdown */}
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
                      <Link key={sub.id}
                        href={`/shop?category=${activeCatObj.slug}&subcategory=${sub.slug}`}
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
      </nav>

      {/* ── Mobile menu overlay ──────────────────────────────────────────
           Rendered OUTSIDE <nav> so it's never clipped by overflow or z-index */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={closeMobile}
          />

          {/* Drawer */}
          <div className="fixed top-14 left-0 right-0 bottom-0 z-50 md:hidden bg-white overflow-y-auto">

            {/* User info strip */}
            {user && (
              <div className="bg-orange-50 border-b px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {user.name[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="border-b">
              {!isSupplier && (
                <>
                  <Link href="/shop" className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-brand border-b border-gray-100 bg-orange-50" onClick={closeMobile}>
                    <ShoppingCart size={18} /> All Products
                  </Link>
                  <Link href="/cart" className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-gray-700 border-b border-gray-100" onClick={closeMobile}>
                    <ShoppingCart size={17} className="text-gray-400" />
                    Cart
                    {cartCount > 0 && <span className="ml-auto bg-brand text-white text-xs font-bold px-2 py-0.5 rounded-full">{cartCount}</span>}
                  </Link>
                  {user && (
                    <Link href="/orders" className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-gray-700 border-b border-gray-100" onClick={closeMobile}>
                      <Package size={17} className="text-gray-400" /> My Orders
                    </Link>
                  )}
                  {user?.is_admin && (
                    <Link href="/admin" className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-gray-700 border-b border-gray-100" onClick={closeMobile}>
                      <LayoutDashboard size={17} className="text-gray-400" /> Admin Panel
                    </Link>
                  )}
                </>
              )}
              {isSupplier && (
                <Link href="/supplier/dashboard" className="flex items-center gap-3 px-4 py-3.5 text-sm font-semibold text-brand border-b border-gray-100" onClick={closeMobile}>
                  <Store size={18} /> Supplier Dashboard
                </Link>
              )}
            </div>

            {/* Categories */}
            {!isSupplier && cats.length > 0 && (
              <div>
                <p className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50">
                  Categories
                </p>
                {cats.map(cat => (
                  <div key={cat.id} className="border-b border-gray-100">
                    <div className="flex items-center">
                      <Link
                        href={`/shop?category=${cat.slug}`}
                        className="flex-1 px-4 py-3.5 text-sm font-medium text-gray-800"
                        onClick={closeMobile}
                      >
                        {cat.name}
                      </Link>
                      {cat.subcategories?.length > 0 && (
                        <button
                          onClick={() => setExpandM(expandMobile === cat.id ? null : cat.id)}
                          className="px-4 py-3.5 text-gray-400 hover:text-brand transition"
                          aria-label="Expand subcategories"
                        >
                          <ChevronDown size={16} className={`transition-transform duration-200 ${expandMobile === cat.id ? "rotate-180" : ""}`} />
                        </button>
                      )}
                    </div>
                    {expandMobile === cat.id && cat.subcategories?.length > 0 && (
                      <div className="bg-gray-50 px-4 pb-2 pt-1">
                        {cat.subcategories.map((sub: any) => (
                          <Link
                            key={sub.id}
                            href={`/shop?category=${cat.slug}&subcategory=${sub.slug}`}
                            className="flex items-center gap-2 py-2.5 text-sm text-gray-600 hover:text-brand border-b border-gray-100 last:border-0"
                            onClick={closeMobile}
                          >
                            <ChevronRight size={12} className="text-gray-300 shrink-0" />
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Bottom auth actions */}
            <div className="p-4 border-t mt-2">
              {user ? (
                <button
                  onClick={() => { logout(); closeMobile(); router.push("/"); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition"
                >
                  <LogOut size={16} /> Logout
                </button>
              ) : (
                <div className="flex gap-3">
                  <Link href="/auth/login" onClick={closeMobile}
                    className="flex-1 py-3 rounded-xl bg-brand text-white text-sm font-bold text-center hover:bg-brand-dark transition">
                    Login
                  </Link>
                  <Link href="/auth/register" onClick={closeMobile}
                    className="flex-1 py-3 rounded-xl border border-brand text-brand text-sm font-bold text-center hover:bg-orange-50 transition">
                    Register
                  </Link>
                </div>
              )}
            </div>

          </div>
        </>
      )}
    </>
  );
}
