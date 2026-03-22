"use client";
import Link from "next/link";
import { ShoppingCart, Star } from "lucide-react";
import { addToCart, fetchCart } from "@/lib/api";
import { useCartStore, useAuthStore } from "@/store";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

const fmt = (p: number) => new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(p);

export default function ProductCard({ product }: { product: any }) {
  const { user }    = useAuthStore();
  const { setCart } = useCartStore();
  const router      = useRouter();

  const handleAdd = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user || user.role === "supplier") { router.push("/auth/login"); return; }
    try {
      await addToCart(product.id, 1);
      const cart = await fetchCart();
      setCart(cart.items, cart.total);
      toast.success("Added to cart!");
    } catch { toast.error("Failed to add"); }
  };

  return (
    <Link href={`/product/${product.id}`}>
      <div className="product-card bg-white rounded-xl overflow-hidden border border-gray-100 cursor-pointer h-full flex flex-col">
        <div className="relative h-48 bg-gray-50 flex items-center justify-center overflow-hidden">
          {product.image_url
            ? <img src={product.image_url} alt={product.title} className="object-contain h-full w-full p-3"
                onError={e => { (e.target as any).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24'%3E%3Cpath fill='%23ddd' d='M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z'/%3E%3C/svg%3E"; }} />
            : <div className="text-gray-200 text-5xl">📦</div>}
        </div>
        <div className="p-3 flex flex-col flex-1">
          {product.brand && <p className="text-xs text-brand font-semibold uppercase tracking-wide mb-1">{product.brand}</p>}
          <h3 className="text-sm font-medium text-gray-800 line-clamp-2 flex-1 leading-snug">{product.title}</h3>
          {product.rating && (
            <div className="flex items-center gap-1 mt-2">
              <div className="flex stars">{[1,2,3,4,5].map(s => <Star key={s} size={11} fill={s <= product.rating ? "currentColor" : "none"} />)}</div>
              <span className="text-xs text-gray-400">({product.review_count})</span>
            </div>
          )}
          <div className="flex items-center justify-between mt-3">
            <span className="font-bold text-gray-900 text-sm">{product.price ? fmt(product.price) : "N/A"}</span>
            <button onClick={handleAdd} className="bg-brand text-white p-2 rounded-lg hover:bg-brand-dark transition active:scale-95">
              <ShoppingCart size={15} />
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
