"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { placeOrder, fetchCart } from "@/lib/api";
import { useAuthStore, useCartStore } from "@/store";
import toast from "react-hot-toast";
import { CheckCircle, Smartphone, CreditCard } from "lucide-react";

const fmt = (p: number) => new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(p);

export default function CheckoutPage() {
  const { user }                        = useAuthStore();
  const { items, total, setCart, clearLocal } = useCartStore();
  const router                          = useRouter();
  const [address, setAddress]           = useState("");
  const [phone, setPhone]               = useState("");
  const [payMethod, setPayMethod]       = useState("mobile_money");
  const [payRef, setPayRef]             = useState("");
  const [placing, setPlacing]           = useState(false);
  const [orderId, setOrderId]           = useState<number | null>(null);

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    if (items.length === 0) fetchCart().then(d => setCart(d.items, d.total)).catch(() => router.push("/cart"));
    if (user) setPhone((user as any).phone || "");
  }, [user]);

  const handleOrder = async () => {
    if (!address.trim()) { toast.error("Enter delivery address"); return; }
    if (!phone.trim())   { toast.error("Enter phone number"); return; }
    setPlacing(true);
    try {
      const order = await placeOrder({ address, phone, payment_method: payMethod, payment_ref: payRef });
      clearLocal();
      setOrderId(order.order_id);
      toast.success("Order placed!");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Failed to place order");
    }
    setPlacing(false);
  };

  if (orderId) return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
      <h1 className="font-display font-bold text-3xl mb-2">Order Confirmed!</h1>
      <p className="text-gray-500 mb-1">Order #{orderId} has been placed.</p>
      <p className="text-gray-400 text-sm mb-8">We'll find the best supplier and deliver within 24–48 hours.</p>
      <div className="flex gap-3 justify-center">
        <a href="/orders" className="bg-brand text-white font-bold px-6 py-3 rounded-xl hover:bg-brand-dark transition">View Orders</a>
        <a href="/shop" className="border border-gray-200 px-6 py-3 rounded-xl hover:border-brand transition">Continue Shopping</a>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-2xl mb-6">Checkout</h1>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Delivery */}
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <h2 className="font-semibold mb-4">Delivery Details</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Full Name</label>
                <input value={user?.name || ""} readOnly className="w-full border rounded-xl px-3 py-2 text-sm bg-gray-50" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Phone Number *</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07XXXXXXXX"
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:border-brand focus:outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Delivery Address *</label>
                <textarea value={address} onChange={e => setAddress(e.target.value)} rows={3}
                  placeholder="Street, area, city..."
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:border-brand focus:outline-none resize-none" />
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <h2 className="font-semibold mb-4">Payment Method</h2>
            <div className="space-y-3">
              {[
                { value: "mobile_money", label: "Mobile Money", sub: "MTN / Airtel Money", icon: Smartphone },
                { value: "card", label: "Card Payment", sub: "Visa / Mastercard", icon: CreditCard },
                { value: "cash_on_delivery", label: "Cash on Delivery", sub: "Pay when you receive", icon: null },
              ].map(opt => (
                <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${payMethod === opt.value ? "border-brand bg-orange-50" : "border-gray-200 hover:border-gray-300"}`}>
                  <input type="radio" name="pay" value={opt.value} checked={payMethod === opt.value}
                    onChange={() => setPayMethod(opt.value)} className="accent-brand" />
                  {opt.icon && <opt.icon size={20} className="text-gray-500" />}
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-gray-400">{opt.sub}</p>
                  </div>
                </label>
              ))}
              {payMethod !== "cash_on_delivery" && (
                <input value={payRef} onChange={e => setPayRef(e.target.value)}
                  placeholder={payMethod === "mobile_money" ? "Transaction reference / phone" : "Card last 4 digits"}
                  className="w-full border rounded-xl px-3 py-2 text-sm focus:border-brand focus:outline-none mt-2" />
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm h-fit">
          <h2 className="font-semibold mb-4">Order Summary</h2>
          <div className="space-y-2 max-h-52 overflow-y-auto mb-4">
            {items.map(item => (
              <div key={item.product_id} className="flex justify-between text-sm">
                <span className="text-gray-600 line-clamp-1 flex-1">{item.title} ×{item.quantity}</span>
                <span className="font-medium ml-2">{item.price ? fmt(item.price * item.quantity) : "-"}</span>
              </div>
            ))}
          </div>
          <hr />
          <div className="flex justify-between font-bold text-lg mt-3">
            <span>Total</span><span className="text-brand">{fmt(total)}</span>
          </div>
          <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700">
            ✅ Every product is inspected before delivery. Delivery within 24–48 hours.
          </div>
          <button onClick={handleOrder} disabled={placing || items.length === 0}
            className="mt-5 w-full bg-brand text-white font-bold py-3 rounded-xl hover:bg-brand-dark transition disabled:opacity-60">
            {placing ? "Placing Order..." : `Place Order — ${fmt(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
