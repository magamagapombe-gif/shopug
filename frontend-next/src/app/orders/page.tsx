"use client";
import { useEffect, useState } from "react";
import { fetchOrders, fileComplaint } from "@/lib/api";
import { useAuthStore } from "@/store";
import { useRouter } from "next/navigation";
import { Package, AlertCircle, X } from "lucide-react";
import toast from "react-hot-toast";

const fmt = (p: number) => new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(p);

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-blue-100 text-blue-700",
  supplier_assigned: "bg-purple-100 text-purple-700",
  supplier_confirmed: "bg-indigo-100 text-indigo-700",
  in_transit: "bg-yellow-100 text-yellow-700",
  inspecting: "bg-orange-100 text-orange-700",
  out_for_delivery: "bg-cyan-100 text-cyan-700",
  delivered: "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Order Paid — Finding Supplier",
  supplier_assigned: "Supplier Assigned",
  supplier_confirmed: "Supplier Confirmed",
  in_transit: "Coming to Our Hub",
  inspecting: "Being Inspected",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function OrdersPage() {
  const { user }     = useAuthStore();
  const router       = useRouter();
  const [orders, setOrders]           = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [complaintOrder, setComplaint] = useState<number | null>(null);
  const [complaintText, setComplaintText] = useState("");
  const [filing, setFiling]           = useState(false);

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    fetchOrders().then(setOrders).finally(() => setLoading(false));
  }, [user]);

  const handleComplaint = async () => {
    if (!complaintText.trim() || !complaintOrder) return;
    setFiling(true);
    try {
      await fileComplaint({ order_id: complaintOrder, description: complaintText });
      toast.success("Complaint filed. We will investigate.");
      setComplaint(null);
      setComplaintText("");
    } catch { toast.error("Failed to file complaint"); }
    setFiling(false);
  };

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  );

  if (orders.length === 0) return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <Package size={64} className="text-gray-200 mx-auto mb-4" />
      <h2 className="font-display font-bold text-2xl mb-2">No orders yet</h2>
      <a href="/shop" className="bg-brand text-white font-bold px-6 py-3 rounded-xl hover:bg-brand-dark transition inline-block">Shop Now</a>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-2xl mb-6">My Orders</h1>
      <div className="space-y-4">
        {orders.map(order => (
          <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="font-bold text-gray-900">Order #{order.id}</span>
                <span className="text-xs text-gray-400 ml-3">{new Date(order.created_at).toLocaleDateString()}</span>
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
            <div className="space-y-2 mb-3">
              {order.items?.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3">
                  {item.image_url && <img src={item.image_url} alt={item.title} className="w-10 h-10 object-contain bg-gray-50 rounded-lg" />}
                  <span className="text-sm text-gray-700 line-clamp-1 flex-1">{item.title}</span>
                  <span className="text-xs text-gray-400">×{item.quantity}</span>
                  <span className="text-sm font-medium">{fmt(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 flex items-center justify-between">
              <div className="text-xs text-gray-400">
                {order.address && <span>📍 {order.address}</span>}
              </div>
              <div className="flex items-center gap-3">
                {["delivered", "completed"].includes(order.status) && (
                  <button onClick={() => setComplaint(order.id)}
                    className="text-xs text-red-500 hover:underline flex items-center gap-1">
                    <AlertCircle size={12} /> Report Issue
                  </button>
                )}
                <span className="font-bold text-brand">{fmt(order.total)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Complaint modal */}
      {complaintOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Report an Issue — Order #{complaintOrder}</h2>
              <button onClick={() => setComplaint(null)}><X size={20} /></button>
            </div>
            <textarea value={complaintText} onChange={e => setComplaintText(e.target.value)}
              rows={4} placeholder="Describe the issue with your order..."
              className="w-full border rounded-xl px-3 py-2 text-sm focus:border-brand focus:outline-none resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setComplaint(null)} className="flex-1 border rounded-xl py-2 text-sm hover:border-brand transition">Cancel</button>
              <button onClick={handleComplaint} disabled={filing || !complaintText.trim()}
                className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-semibold hover:bg-red-600 transition disabled:opacity-60">
                {filing ? "Filing..." : "Submit Complaint"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
