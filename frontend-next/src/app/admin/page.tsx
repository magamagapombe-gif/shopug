"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  fetchAdminStats, fetchAdminOrders, fetchAdminSuppliers,
  fetchAdminPayouts, fetchAdminComplaints, fetchPendingProducts,
  updateOrderStatus, updateSupplierStatus, updateSupplierTier,
  selectBid, autoSelectBids, getItemBids, markPayoutPaid,
  approveProduct, rejectProduct, updateFulfillment,
} from "@/lib/api";
import { Package, Users, ShoppingCart, DollarSign, AlertCircle, Store, Bell, CheckCircle, X, ChevronDown } from "lucide-react";

const fmt = (p: number) => new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(p);

const TABS = ["Overview", "Orders", "Suppliers", "Bids", "Payouts", "Complaints", "Products"] as const;
type Tab = typeof TABS[number];

export default function AdminPage() {
  const { user }  = useAuthStore();
  const router    = useRouter();
  const [tab, setTab]         = useState<Tab>("Overview");
  const [stats, setStats]     = useState<any>(null);
  const [orders, setOrders]   = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [pendingProds, setPending]  = useState<any[]>([]);
  const [bids, setBids]       = useState<{ [itemId: number]: any[] }>({});
  const [loading, setLoading] = useState(true);
  const [expandOrder, setExpandOrder] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    if (!user.is_admin) { router.push("/"); toast.error("Admin only"); return; }
    loadAll();
  }, [user]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, o, sup, pay, comp, pp] = await Promise.all([
        fetchAdminStats(), fetchAdminOrders(), fetchAdminSuppliers(),
        fetchAdminPayouts("pending"), fetchAdminComplaints(), fetchPendingProducts(),
      ]);
      setStats(s); setOrders(o); setSuppliers(sup);
      setPayouts(pay); setComplaints(comp); setPending(pp);
    } catch { toast.error("Load failed"); }
    setLoading(false);
  };

  const loadBids = async (itemId: number) => {
    if (bids[itemId]) return;
    const b = await getItemBids(itemId);
    setBids(prev => ({ ...prev, [itemId]: b }));
  };

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-12"><div className="h-40 bg-gray-100 rounded-2xl animate-pulse" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl">Admin Panel</h1>
        <div className="flex items-center gap-2">
          {stats && (
            <>
              {stats.pending_products > 0 && (
                <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-3 py-1 rounded-full">{stats.pending_products} product submissions</span>
              )}
              {stats.complaints_open > 0 && (
                <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">{stats.complaints_open} complaints</span>
              )}
            </>
          )}
          <button onClick={loadAll} className="text-xs text-gray-400 hover:text-brand border rounded-lg px-3 py-1.5">Refresh</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? "bg-brand text-white" : "bg-white border hover:border-brand"}`}>
            {t}
            {t === "Complaints" && stats?.complaints_open > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 inline-flex items-center justify-center">{stats.complaints_open}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "Overview" && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Products",       value: stats.products.toLocaleString(),        icon: Package,      color: "text-blue-500" },
              { label: "Customers",      value: stats.customers.toLocaleString(),        icon: Users,        color: "text-purple-500" },
              { label: "Active Suppliers",value: stats.suppliers_active.toLocaleString(),icon: Store,       color: "text-indigo-500" },
              { label: "Total Orders",   value: stats.orders_total.toLocaleString(),     icon: ShoppingCart, color: "text-orange-500" },
              { label: "Revenue",        value: fmt(stats.revenue),                      icon: DollarSign,   color: "text-green-500" },
              { label: "Margin Earned",  value: fmt(stats.margin),                       icon: DollarSign,   color: "text-emerald-500" },
              { label: "Pending Payouts",value: fmt(stats.pending_payouts),              icon: DollarSign,   color: "text-yellow-500" },
              { label: "Open Complaints",value: stats.complaints_open.toString(),        icon: AlertCircle,  color: "text-red-500" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <Icon size={22} className={`${color} mb-3`} />
                <p className="font-bold text-xl">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
          {stats.orders_pending > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
              <Bell size={20} className="text-yellow-600" />
              <p className="text-sm font-medium text-yellow-700">{stats.orders_pending} new paid orders waiting for supplier assignment.</p>
              <button onClick={() => setTab("Orders")} className="ml-auto text-xs bg-yellow-200 text-yellow-800 px-3 py-1 rounded-lg font-semibold">View Orders</button>
            </div>
          )}
        </div>
      )}

      {/* ── Orders ── */}
      {tab === "Orders" && (
        <div className="space-y-4">
          {orders.map(order => (
            <div key={order.id} className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-4 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandOrder(expandOrder === order.id ? null : order.id)}>
                <div>
                  <span className="font-bold">Order #{order.id}</span>
                  <span className="text-xs text-gray-400 ml-2">{new Date(order.created_at).toLocaleDateString()}</span>
                  <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${order.status === "paid" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{order.status}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-brand">{fmt(order.total)}</span>
                  <span className="text-xs text-gray-500">{order.customer_name}</span>
                  <ChevronDown size={16} className={`transition-transform ${expandOrder === order.id ? "rotate-180" : ""}`} />
                </div>
              </div>

              {expandOrder === order.id && (
                <div className="border-t px-4 pb-4 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4 pt-3 text-sm">
                    <div>
                      <p className="text-gray-500">Customer: <span className="font-medium text-gray-900">{order.customer_name}</span></p>
                      <p className="text-gray-500">Email: {order.customer_email}</p>
                      <p className="text-gray-500">Phone: {order.customer_phone}</p>
                      <p className="text-gray-500">Address: {order.address}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-2">Update Status:</p>
                      <div className="flex gap-2 flex-wrap">
                        {["supplier_assigned","in_transit","inspecting","out_for_delivery","completed","cancelled"].map(s => (
                          <button key={s} onClick={async () => { await updateOrderStatus(order.id, s); await loadAll(); toast.success("Updated"); }}
                            className="text-xs border rounded-lg px-2 py-1 hover:border-brand hover:text-brand transition capitalize">
                            {s.replace(/_/g, " ")}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Items + Bids */}
                  {order.items?.map((item: any) => (
                    <div key={item.id} className="border rounded-xl p-3 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm">{item.title} <span className="text-gray-400">×{item.quantity}</span></p>
                        <div className="flex gap-2">
                          <button onClick={async () => { await loadBids(item.id); }}
                            className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-100">
                            View Bids
                          </button>
                          <button onClick={async () => { await autoSelectBids(order.id); await loadAll(); toast.success("Auto-selected!"); }}
                            className="text-xs bg-brand text-white px-2 py-1 rounded-lg hover:bg-brand-dark">
                            Auto-Select
                          </button>
                        </div>
                      </div>

                      {bids[item.id] && (
                        <div className="space-y-2 mt-2">
                          <p className="text-xs font-semibold text-gray-500">Supplier Bids (sorted by score):</p>
                          {bids[item.id].length === 0
                            ? <p className="text-xs text-gray-400">No bids yet</p>
                            : bids[item.id].map((bid: any) => (
                              <div key={bid.id} className={`flex items-center justify-between p-2 rounded-lg text-xs border ${bid.status === "accepted" || bid.status === "auto_selected" ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"}`}>
                                <div>
                                  <span className="font-semibold">{bid.supplier_name}</span>
                                  <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${bid.tier === "gold" ? "bg-yellow-100 text-yellow-700" : bid.tier === "silver" ? "bg-gray-100 text-gray-600" : "bg-orange-50 text-orange-600"}`}>{bid.tier}</span>
                                  <span className="ml-2 text-gray-400">⭐ {bid.rating || "—"}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-bold text-green-700">{fmt(bid.supply_price)}</span>
                                  <span className="text-gray-400">score: {bid.score}</span>
                                  {bid.status === "pending" && (
                                    <button onClick={async () => { await selectBid(bid.id); await loadAll(); toast.success("Bid selected!"); }}
                                      className="bg-brand text-white px-2 py-1 rounded text-xs hover:bg-brand-dark">Select</button>
                                  )}
                                  {(bid.status === "accepted" || bid.status === "auto_selected") && (
                                    <span className="text-green-600 font-semibold flex items-center gap-1"><CheckCircle size={12} /> Selected</span>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {orders.length === 0 && <div className="text-center py-12 text-gray-400">No orders yet</div>}
        </div>
      )}

      {/* ── Suppliers ── */}
      {tab === "Suppliers" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{["Business", "Contact", "Tier", "Orders", "Rating", "Status", "Actions"].map(h => (
                <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium">{s.business_name}</p><p className="text-xs text-gray-400">{s.name}</p></td>
                  <td className="px-4 py-3"><p>{s.email}</p><p className="text-xs text-gray-400">{s.phone}</p></td>
                  <td className="px-4 py-3">
                    <select value={s.tier} onChange={async e => { await updateSupplierTier(s.id, e.target.value); await loadAll(); }}
                      className={`text-xs border rounded px-2 py-1 font-semibold ${s.tier === "gold" ? "border-yellow-300 text-yellow-700" : s.tier === "silver" ? "border-gray-300 text-gray-600" : "border-orange-200 text-orange-600"}`}>
                      {["bronze","silver","gold"].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">{s.fulfilled_orders}/{s.total_orders}</td>
                  <td className="px-4 py-3">⭐ {s.rating || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.status === "active" ? "bg-green-100 text-green-700" : s.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {s.status !== "active" && <button onClick={async () => { await updateSupplierStatus(s.id, "active"); await loadAll(); toast.success("Activated"); }} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100">Activate</button>}
                      {s.status !== "suspended" && <button onClick={async () => { await updateSupplierStatus(s.id, "suspended"); await loadAll(); toast.success("Suspended"); }} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100">Suspend</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {suppliers.length === 0 && <div className="text-center py-12 text-gray-400">No suppliers yet</div>}
        </div>
      )}

      {/* ── Payouts ── */}
      {tab === "Payouts" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{["Supplier", "Product", "Amount", "Status", "Action"].map(h => (
                <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 text-xs">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y">
              {payouts.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-medium">{p.business_name}</p><p className="text-xs text-gray-400">{p.supplier_phone}</p></td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">{p.product_title}</td>
                  <td className="px-4 py-3 font-bold text-green-700">{fmt(p.amount)}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${p.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{p.status}</span></td>
                  <td className="px-4 py-3">
                    {p.status === "pending" && (
                      <button onClick={async () => { const ref = prompt("Payment reference?") || ""; await markPayoutPaid(p.id, ref); await loadAll(); toast.success("Marked paid!"); }}
                        className="text-xs bg-brand text-white px-3 py-1 rounded-lg hover:bg-brand-dark">Mark Paid</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payouts.length === 0 && <div className="text-center py-12 text-gray-400">No pending payouts</div>}
        </div>
      )}

      {/* ── Complaints ── */}
      {tab === "Complaints" && (
        <div className="space-y-4">
          {complaints.map(c => (
            <div key={c.id} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${c.status === "open" ? "bg-red-100 text-red-700" : c.status === "resolved" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{c.status}</span>
                  <span className="text-xs text-gray-400 ml-2">Order #{c.order_id}</span>
                </div>
                <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-gray-700 mb-2">{c.description}</p>
              <div className="text-xs text-gray-400 mb-3">
                <span>Customer: {c.customer_name}</span>
                {c.supplier_name && <span className="ml-3">Traced supplier: {c.supplier_name} ({c.business_name})</span>}
              </div>
              {c.status === "open" && (
                <div className="flex gap-2">
                  <button onClick={async () => { const r = prompt("Resolution note?") || ""; await (await import("@/lib/api")).default.patch(`/admin/complaints/${c.id}`, null, { params: { status: "resolved", resolution: r } }); await loadAll(); toast.success("Resolved"); }}
                    className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-lg hover:bg-green-100">Resolve</button>
                  <button onClick={async () => { await (await import("@/lib/api")).default.patch(`/admin/complaints/${c.id}`, null, { params: { status: "dismissed" } }); await loadAll(); }}
                    className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-200">Dismiss</button>
                </div>
              )}
            </div>
          ))}
          {complaints.length === 0 && <div className="text-center py-12 text-gray-400">No complaints</div>}
        </div>
      )}

      {/* ── Pending Products ── */}
      {tab === "Products" && (
        <div className="space-y-4">
          {pendingProds.map(p => (
            <div key={p.id} className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex gap-4">
              {p.image_url && <img src={p.image_url} alt={p.title} className="w-20 h-20 object-contain bg-gray-50 rounded-lg shrink-0" />}
              <div className="flex-1">
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-xs text-gray-400 mt-1">Supplier: {p.supplier_name} — {p.business_name}</p>
                <p className="text-xs text-gray-400">Supplier price: {fmt(p.supplier_price)} | Category: {p.category_name || "—"}</p>
                {p.description && <p className="text-sm text-gray-600 mt-2">{p.description}</p>}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button onClick={async () => {
                  const priceStr = prompt(`Set selling price (supplier asks ${fmt(p.supplier_price)}):`);
                  if (!priceStr) return;
                  await approveProduct(p.id, { final_price: parseFloat(priceStr) });
                  await loadAll(); toast.success("Approved!");
                }} className="bg-green-500 text-white text-xs px-4 py-2 rounded-lg hover:bg-green-600">Approve</button>
                <button onClick={async () => {
                  const note = prompt("Rejection reason?") || "";
                  await rejectProduct(p.id, note); await loadAll(); toast.success("Rejected");
                }} className="bg-gray-100 text-gray-700 text-xs px-4 py-2 rounded-lg hover:bg-gray-200">Reject</button>
              </div>
            </div>
          ))}
          {pendingProds.length === 0 && <div className="text-center py-12 text-gray-400">No pending product submissions</div>}
        </div>
      )}
    </div>
  );
}
