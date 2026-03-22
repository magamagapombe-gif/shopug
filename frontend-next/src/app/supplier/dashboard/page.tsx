"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  fetchSupplierDashboard, fetchSupplierBids, fetchSupplierFulfillments,
  confirmFulfillment, fetchSupplierNotifications,
} from "@/lib/api";
import { Package, DollarSign, ShoppingCart, Bell, CheckCircle, Truck, Star, ClipboardList, PlusCircle } from "lucide-react";

const fmt = (p: number) => new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(p);

const TIER_COLORS: Record<string, string> = {
  gold: "bg-yellow-100 text-yellow-700 border-yellow-300",
  silver: "bg-gray-100 text-gray-700 border-gray-300",
  bronze: "bg-orange-50 text-orange-700 border-orange-200",
};

export default function SupplierDashboard() {
  const { user }  = useAuthStore();
  const router    = useRouter();
  const [data, setData]       = useState<any>(null);
  const [bids, setBids]       = useState<any[]>([]);
  const [fulfillments, setFulfillments] = useState<any[]>([]);
  const [notifs, setNotifs]   = useState<any[]>([]);
  const [tab, setTab]         = useState<"overview" | "bids" | "fulfillments" | "notifications">("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push("/supplier/login"); return; }
    if (user.role !== "supplier") { router.push("/"); return; }
    loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [d, b, f, n] = await Promise.all([
        fetchSupplierDashboard(), fetchSupplierBids(), fetchSupplierFulfillments(), fetchSupplierNotifications(),
      ]);
      setData(d); setBids(b); setFulfillments(f); setNotifs(n);
    } catch { toast.error("Load failed"); }
    setLoading(false);
  };

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-12"><div className="h-40 bg-gray-100 rounded-2xl animate-pulse" /></div>;
  if (!data) return null;

  const { supplier, stats, recent_bids } = data;
  const unread = notifs.filter((n: any) => !n.is_read).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl">{supplier.business_name}</h1>
          <p className="text-gray-500 text-sm">{supplier.name} · {supplier.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-3 py-1 rounded-full border capitalize ${TIER_COLORS[supplier.tier] || ""}`}>
            {supplier.tier} Supplier
          </span>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${supplier.status === "active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
            {supplier.status}
          </span>
        </div>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { href: "/supplier/inventory", icon: Package, label: "My Inventory", sub: `${stats.inventory_count} products` },
          { href: "/supplier/categories", icon: ClipboardList, label: "My Categories", sub: "Set what you supply" },
          { href: "/supplier/products", icon: PlusCircle, label: "Submit Product", sub: "Add new product" },
          { href: "/supplier/payouts", icon: DollarSign, label: "Payouts", sub: fmt(stats.pending_payout) + " pending" },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="bg-white border border-gray-100 rounded-xl p-4 hover:border-blue-400 hover:shadow-md transition group">
            <item.icon size={20} className="text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="text-xs text-gray-400">{item.sub}</p>
          </Link>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["overview","bids","fulfillments","notifications"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition relative ${tab === t ? "bg-blue-600 text-white" : "bg-white border hover:border-blue-400"}`}>
            {t}
            {t === "notifications" && unread > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{unread}</span>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Pending Bids",     value: stats.pending_bids,     icon: ShoppingCart, color: "text-yellow-500" },
              { label: "Won Bids",         value: stats.won_bids,         icon: CheckCircle,  color: "text-green-500" },
              { label: "Fulfilled Orders", value: stats.total_fulfilled,  icon: Truck,        color: "text-blue-500" },
              { label: "Total Earned",     value: fmt(stats.total_earned), icon: DollarSign,  color: "text-emerald-500" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <Icon size={22} className={`${color} mb-3`} />
                <p className="font-bold text-xl">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
          {supplier.tier === "bronze" && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
              <p className="font-semibold mb-1">🏆 Reach Silver Tier</p>
              <p className="text-xs">Fulfill 20+ orders with good ratings to be upgraded to Silver. Silver suppliers get priority bid access.</p>
            </div>
          )}
          {recent_bids.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b"><h3 className="font-semibold text-sm">Recent Bids</h3></div>
              <div className="divide-y">
                {recent_bids.slice(0, 5).map((b: any) => (
                  <div key={b.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium line-clamp-1">{b.title}</p>
                      <p className="text-xs text-gray-400">×{b.quantity} · {new Date(b.order_date).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-700">{fmt(b.supply_price)}</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${b.status === "accepted" || b.status === "auto_selected" ? "bg-green-100 text-green-700" : b.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{b.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bids */}
      {tab === "bids" && (
        <div className="space-y-3">
          {bids.length === 0 && <div className="text-center py-12 text-gray-400">No bids yet. Add products to your inventory to start receiving bids.</div>}
          {bids.map(b => (
            <div key={b.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{b.title}</p>
                <p className="text-xs text-gray-400">Qty: {b.quantity} · Order #{b.order_id} · {new Date(b.order_date).toLocaleDateString()}</p>
                <p className="text-xs text-gray-400">Selling price: {fmt(b.selling_price)}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-green-700">{fmt(b.supply_price)}</p>
                <p className="text-xs text-gray-400">your offer</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${b.status === "accepted" || b.status === "auto_selected" ? "bg-green-100 text-green-700" : b.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{b.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fulfillments */}
      {tab === "fulfillments" && (
        <div className="space-y-3">
          {fulfillments.length === 0 && <div className="text-center py-12 text-gray-400">No fulfillments yet.</div>}
          {fulfillments.map(f => (
            <div key={f.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">{f.title} ×{f.quantity}</p>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${f.status === "completed" ? "bg-green-100 text-green-700" : f.status === "failed" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{f.status}</span>
              </div>
              <p className="text-xs text-gray-400">Order #{f.order_id} · Deliver to our hub</p>
              <p className="text-xs text-gray-400 mt-1">Your payout: {fmt(f.supply_price)}</p>
              {f.status === "pending" && (
                <button onClick={async () => { await confirmFulfillment(f.id); await loadAll(); toast.success("Confirmed! Bring product to our hub."); }}
                  className="mt-3 bg-blue-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold">
                  ✓ Confirm — I'll deliver to hub
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Notifications */}
      {tab === "notifications" && (
        <div className="space-y-2">
          {notifs.length === 0 && <div className="text-center py-12 text-gray-400">No notifications yet.</div>}
          {notifs.map(n => (
            <div key={n.id} className={`rounded-xl p-4 border text-sm ${!n.is_read ? "bg-blue-50 border-blue-200" : "bg-white border-gray-100"}`}>
              <div className="flex items-center justify-between">
                <p className="font-semibold">{n.title}</p>
                <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleDateString()}</p>
              </div>
              {n.body && <p className="text-gray-600 mt-1 text-xs">{n.body}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
