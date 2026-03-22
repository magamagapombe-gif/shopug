"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchProduct, fetchRelated, addToCart, fetchCart } from "@/lib/api";
import { useAuthStore, useCartStore } from "@/store";
import { Star, ShoppingCart, ArrowLeft, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";

const fmt = (p: number) => new Intl.NumberFormat("en-UG", {
  style: "currency", currency: "UGX", maximumFractionDigits: 0
}).format(p);

export default function ProductPage() {
  const { id }      = useParams();
  const router      = useRouter();
  const { user }    = useAuthStore();
  const { setCart } = useCartStore();

  const [product, setProduct]   = useState<any>(null);
  const [related, setRelated]   = useState<any[]>([]);
  const [qty, setQty]           = useState(1);
  const [loading, setLoading]   = useState(true);
  const [adding, setAdding]     = useState(false);
  const [activeImg, setActiveImg] = useState<string | null>(null);
  const [showSpecs, setShowSpecs] = useState(true);
  const [selectedColor, setColor] = useState<string | null>(null);
  const [selectedSize, setSize]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchProduct(Number(id))
      .then(p => {
        setProduct(p);
        setActiveImg(p.image_url);
        return fetchRelated(Number(id));
      })
      .then(setRelated)
      .catch(() => router.push("/shop"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAdd = async () => {
    if (!user || user.role === "supplier") { router.push("/auth/login"); return; }
    setAdding(true);
    try {
      await addToCart(product.id, qty);
      const cart = await fetchCart();
      setCart(cart.items, cart.total);
      toast.success("Added to cart!");
    } catch { toast.error("Failed to add"); }
    setAdding(false);
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="grid md:grid-cols-2 gap-10">
        <div className="bg-gray-100 rounded-2xl h-96 animate-pulse" />
        <div className="space-y-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}
        </div>
      </div>
    </div>
  );
  if (!product) return null;

  const extraImages: string[] = product.extra_images || [];
  const allImages = [product.image_url, ...extraImages].filter(Boolean);
  const specs: Record<string, string> = product.specs || {};
  const colors: string[] = product.colors || [];
  const sizes: string[]  = product.sizes  || [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link href="/shop" className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand mb-6">
        <ArrowLeft size={16} /> Back to Shop
      </Link>

      {/* ── Main product block ─────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-10 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">

        {/* Images */}
        <div>
          {/* Main image */}
          <div className="flex items-center justify-center bg-gray-50 rounded-xl h-80 p-4 mb-3">
            {activeImg
              ? <img src={activeImg} alt={product.title}
                  className="max-h-72 object-contain w-full"
                  onError={e => { (e.target as any).src = "/placeholder.png"; }} />
              : <div className="text-gray-200 text-8xl">📦</div>}
          </div>
          {/* Thumbnail strip */}
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {allImages.map((img, i) => (
                <button key={i} onClick={() => setActiveImg(img)}
                  className={`shrink-0 w-16 h-16 rounded-lg border-2 overflow-hidden bg-gray-50 transition ${activeImg === img ? "border-brand" : "border-gray-100 hover:border-gray-300"}`}>
                  <img src={img} alt="" className="w-full h-full object-contain p-1"
                    onError={e => { (e.target as any).style.display = "none"; }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          {product.brand && (
            <span className="text-brand font-bold text-sm uppercase tracking-wide">{product.brand}</span>
          )}
          <h1 className="font-display font-bold text-2xl mt-1 leading-snug">{product.title}</h1>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
            {product.category_name && (
              <>
                <Link href={`/shop?category=${product.category_slug}`} className="hover:text-brand">
                  {product.category_name}
                </Link>
                {product.subcategory_name && (
                  <><span>›</span>
                  <Link href={`/shop?category=${product.category_slug}&subcategory=${product.subcategory_slug}`} className="hover:text-brand">
                    {product.subcategory_name}
                  </Link></>
                )}
              </>
            )}
          </div>

          {/* Rating */}
          {product.rating && (
            <div className="flex items-center gap-2 mt-3">
              <div className="flex stars">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={16} fill={s <= product.rating ? "currentColor" : "none"} />
                ))}
              </div>
              <span className="text-sm text-gray-500">({product.review_count} reviews)</span>
            </div>
          )}

          {/* Price */}
          <div className="mt-4">
            <div className="text-3xl font-black text-gray-900">
              {product.price ? fmt(product.price) : "Price N/A"}
            </div>
            {product.stock_status === "out_of_stock" && (
              <span className="text-xs font-semibold text-red-500 mt-1 block">Out of Stock</span>
            )}
          </div>

          {/* Colors */}
          {colors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Color: <span className="text-brand">{selectedColor || "Select"}</span>
              </p>
              <div className="flex gap-2 flex-wrap">
                {colors.map(color => (
                  <button key={color} onClick={() => setColor(color)}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition ${selectedColor === color ? "border-brand bg-orange-50 text-brand font-semibold" : "border-gray-200 hover:border-gray-300"}`}>
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sizes */}
          {sizes.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Size: <span className="text-brand">{selectedSize || "Select"}</span>
              </p>
              <div className="flex gap-2 flex-wrap">
                {sizes.map(size => (
                  <button key={size} onClick={() => setSize(size)}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition ${selectedSize === size ? "border-brand bg-orange-50 text-brand font-semibold" : "border-gray-200 hover:border-gray-300"}`}>
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Delivery badges */}
          <div className="mt-4 space-y-1">
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle size={14} /> Inspected before delivery
            </div>
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle size={14} /> Delivery within 24–48 hours
            </div>
          </div>

          <hr className="my-4" />

          {/* Qty + Cart */}
          <div className="flex items-center gap-3">
            <div className="flex items-center border rounded-lg overflow-hidden">
              <button onClick={() => setQty(q => Math.max(1, q - 1))}
                className="px-3 py-2 hover:bg-gray-50 text-lg font-bold">−</button>
              <span className="px-4 font-semibold">{qty}</span>
              <button onClick={() => setQty(q => q + 1)}
                className="px-3 py-2 hover:bg-gray-50 text-lg font-bold">+</button>
            </div>
            <button onClick={handleAdd} disabled={adding || product.stock_status === "out_of_stock"}
              className="flex-1 bg-brand text-white font-bold py-3 rounded-xl hover:bg-brand-dark transition flex items-center justify-center gap-2 disabled:opacity-60">
              <ShoppingCart size={18} />
              {adding ? "Adding..." : product.stock_status === "out_of_stock" ? "Out of Stock" : "Add to Cart"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Description + Specs ────────────────────────────────────────── */}
      {(product.description || Object.keys(specs).length > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-8 overflow-hidden">
          {/* Description */}
          {product.description && (
            <div className="p-6 border-b">
              <h2 className="font-display font-bold text-lg mb-3">About this product</h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {/* Specifications */}
          {Object.keys(specs).length > 0 && (
            <div className="p-6">
              <button onClick={() => setShowSpecs(!showSpecs)}
                className="flex items-center justify-between w-full">
                <h2 className="font-display font-bold text-lg">Specifications</h2>
                {showSpecs ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {showSpecs && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
                  {Object.entries(specs).map(([key, val]) => (
                    <div key={key} className="flex justify-between py-2 border-b border-gray-50 text-sm">
                      <span className="text-gray-500 font-medium shrink-0 mr-4">{key}</span>
                      <span className="text-gray-800 text-right">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Related Products ───────────────────────────────────────────── */}
      {related.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display font-bold text-2xl mb-5">Related Products</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {related.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}
