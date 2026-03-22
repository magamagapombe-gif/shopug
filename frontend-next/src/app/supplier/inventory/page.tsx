"use client";
import { useEffect, useState } from "react";
import { fetchSupplierInventory, addInventoryItem, removeInventoryItem, fetchProducts } from "@/lib/api";
import { useAuthStore } from "@/store";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus, Trash2, Search, ArrowLeft } from "lucide-react";
import Link from "next/link";

const fmt = (p: number) => new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(p);

export default function SupplierInventoryPage() {
  const { user }  = useAuthStore();
  const router    = useRouter();
  const [inventory, setInventory] = useState<any[]>([]);
  const [search, setSearch]       = useState("");
  const [results, setResults]     = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [supplyPrices, setSupplyPrices] = useState<Record<number, string>>({});
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!user || user.role !== "supplier") { router.push("/supplier/login"); return; }
    fetchSupplierInventory().then(setInventory).finally(() => setLoading(false));
  }, [user]);

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    const data = await fetchProducts({ search, limit: 10 });
    setResults(data.products);
    setSearching(false);
  };

  const handleAdd = async (product: any) => {
    const price = supplyPrices[product.id];
    if (!price || parseFloat(price) <= 0) { toast.error("Enter your supply price first"); return; }
    await addInventoryItem({ product_id: product.id, supply_price: parseFloat(price) });
    toast.success("Added to inventory!");
    const inv = await fetchSupplierInventory();
    setInventory(inv);
    setSupplyPrices(prev => { const n = { ...prev }; delete n[product.id]; return n; });
  };

  const handleRemove = async (productId: number) => {
    await removeInventoryItem(productId);
    setInventory(inv => inv.filter(i => i.product_id !== productId));
    toast.success("Removed");
  };

  const inventoryIds = new Set(inventory.map(i => i.product_id));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/supplier/dashboard" className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-6">
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl">My Inventory</h1>
        <button onClick={() => setShowSearch(!showSearch)}
          className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition flex items-center gap-2 text-sm">
          <Plus size={16} /> Add Products
        </button>
      </div>

      {/* Search to add products */}
      {showSearch && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-blue-700 mb-3">Search catalog and add products you can supply:</p>
          <div className="flex gap-2 mb-4">
            <input value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder="Search product name..."
              className="flex-1 border rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            <button onClick={doSearch} disabled={searching}
              className="bg-blue-600 text-white px-4 rounded-xl hover:bg-blue-700 transition text-sm">
              <Search size={16} />
            </button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {results.map(p => (
              <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg bg-white border ${inventoryIds.has(p.id) ? "border-green-300 bg-green-50" : "border-gray-100"}`}>
                {p.image_url && <img src={p.image_url} alt={p.title} className="w-12 h-12 object-contain bg-gray-50 rounded-lg shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{p.title}</p>
                  <p className="text-xs text-gray-400">Selling: {fmt(p.price)}</p>
                </div>
                {inventoryIds.has(p.id)
                  ? <span className="text-xs text-green-600 font-semibold">✓ In Inventory</span>
                  : (
                    <div className="flex items-center gap-2 shrink-0">
                      <input type="number" placeholder="Your price"
                        value={supplyPrices[p.id] || ""}
                        onChange={e => setSupplyPrices(prev => ({ ...prev, [p.id]: e.target.value }))}
                        className="w-28 border rounded-lg px-2 py-1 text-xs focus:border-blue-500 focus:outline-none" />
                      <button onClick={() => handleAdd(p)}
                        className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-700 font-semibold">Add</button>
                    </div>
                  )}
              </div>
            ))}
            {results.length === 0 && search && !searching && (
              <p className="text-sm text-gray-400 text-center py-4">No products found. Try a different search.</p>
            )}
          </div>
        </div>
      )}

      {/* Current inventory */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : inventory.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package size={48} className="mx-auto mb-3 text-gray-200" />
          <p className="font-semibold">No products in inventory</p>
          <p className="text-sm">Search and add products you can supply above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inventory.map(item => (
            <div key={item.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
              {item.image_url && <img src={item.image_url} alt={item.title} className="w-14 h-14 object-contain bg-gray-50 rounded-lg shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm line-clamp-1">{item.title}</p>
                <p className="text-xs text-gray-400">{item.category_name}</p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-xs">Selling price: <strong>{fmt(item.selling_price)}</strong></span>
                  <span className="text-xs text-green-700">Your price: <strong>{fmt(item.supply_price)}</strong></span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${item.stock_status === "available" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {item.stock_status}
                </span>
                <button onClick={() => handleRemove(item.product_id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Package({ size, className }: { size: number; className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/></svg>;
}
