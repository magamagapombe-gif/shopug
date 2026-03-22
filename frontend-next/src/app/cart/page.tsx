"use client";
import { useEffect, useState } from "react";
import { fetchCart, removeFromCart, updateCart } from "@/lib/api";
import { useCartStore, useAuthStore } from "@/store";
import { Trash2, ShoppingBag, Plus, Minus } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const fmt = (p: number) => new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(p);

export default function CartPage() {
  const { user }                  = useAuthStore();
  const { items, total, setCart } = useCartStore();
  const [loading, setLoading]     = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    fetchCart().then(d => setCart(d.items, d.total)).finally(() => setLoading(false));
  }, [user]);

  const refresh = () => fetchCart().then(d => setCart(d.items, d.total));

  const handleRemove = async (pid: number) => {
    await removeFromCart(pid); await refresh(); toast.success("Removed");
  };
  const handleQty = async (pid: number, qty: number) => {
    await updateCart(pid, qty); await refresh();
  };

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-12"><div className="h-40 bg-gray-100 rounded-2xl animate-pulse" /></div>;

  if (items.length === 0) return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <ShoppingBag size={64} className="text-gray-200 mx-auto mb-4" />
      <h2 className="font-display font-bold text-2xl mb-2">Your cart is empty</h2>
      <p className="text-gray-500 mb-6">Browse products and add some items</p>
      <Link href="/shop" className="bg-brand text-white font-bold px-6 py-3 rounded-xl hover:bg-brand-dark transition">Shop Now</Link>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-2xl mb-6">Shopping Cart ({items.length} items)</h1>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-3">
          {items.map(item => (
            <div key={item.product_id} className="bg-white rounded-xl p-4 flex gap-4 items-center border border-gray-100 shadow-sm">
              <div className="w-20 h-20 bg-gray-50 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                {item.image_url
                  ? <img src={item.image_url} alt={item.title} className="object-contain h-full w-full p-1" />
                  : <span className="text-2xl">📦</span>}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/product/${item.product_id}`} className="font-medium text-sm line-clamp-2 hover:text-brand">{item.title}</Link>
                <p className="font-bold text-brand mt-1">{item.price ? fmt(item.price * item.quantity) : "N/A"}</p>
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={() => handleQty(item.product_id, item.quantity - 1)} className="p-1 border rounded hover:border-brand"><Minus size={12} /></button>
                  <span className="text-sm font-semibold w-6 text-center">{item.quantity}</span>
                  <button onClick={() => handleQty(item.product_id, item.quantity + 1)} className="p-1 border rounded hover:border-brand"><Plus size={12} /></button>
                </div>
              </div>
              <button onClick={() => handleRemove(item.product_id)} className="text-gray-300 hover:text-red-500 transition"><Trash2 size={18} /></button>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm h-fit">
          <h2 className="font-semibold mb-4">Order Summary</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between"><span>Subtotal</span><span>{fmt(total)}</span></div>
            <div className="flex justify-between"><span>Delivery</span><span className="text-green-600 font-medium">Free</span></div>
            <div className="flex justify-between"><span>Delivery time</span><span className="text-gray-500">24–48 hours</span></div>
            <hr />
            <div className="flex justify-between font-bold text-gray-900 text-base"><span>Total</span><span>{fmt(total)}</span></div>
          </div>
          <Link href="/checkout" className="mt-5 block bg-brand text-white font-bold text-center py-3 rounded-xl hover:bg-brand-dark transition">Proceed to Checkout</Link>
          <Link href="/shop" className="mt-2 block text-center text-sm text-gray-400 hover:text-brand">Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
}
