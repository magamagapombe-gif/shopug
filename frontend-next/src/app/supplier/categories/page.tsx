// ── Supplier Categories Page ──────────────────────────────────────────────────
// src/app/supplier/categories/page.tsx
"use client";
import { useEffect, useState } from "react";
import { fetchSupplierCategories, setSupplierCategories } from "@/lib/api";
import { useAuthStore } from "@/store";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SupplierCategoriesPage() {
  const { user }  = useAuthStore();
  const router    = useRouter();
  const [cats, setCats]     = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "supplier") { router.push("/supplier/login"); return; }
    fetchSupplierCategories().then(data => {
      setCats(data);
      setSelected(new Set(data.filter((c: any) => c.selected).map((c: any) => c.id)));
    });
  }, [user]);

  const toggle = (id: number) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const save = async () => {
    setSaving(true);
    await setSupplierCategories([...selected]);
    toast.success("Categories saved!");
    setSaving(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/supplier/dashboard" className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-6">
        <ArrowLeft size={16} /> Back
      </Link>
      <h1 className="font-display font-bold text-2xl mb-2">My Supply Categories</h1>
      <p className="text-gray-500 text-sm mb-6">Select the categories you can supply products for. You'll receive bid notifications for orders in these categories.</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {cats.map(cat => (
          <button key={cat.id} onClick={() => toggle(cat.id)}
            className={`p-4 rounded-xl border text-left transition ${selected.has(cat.id) ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-sm">{cat.name}</span>
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected.has(cat.id) ? "border-blue-500 bg-blue-500" : "border-gray-300"}`}>
                {selected.has(cat.id) && <span className="text-white text-xs font-bold">✓</span>}
              </span>
            </div>
            <p className="text-xs text-gray-400">{cat.subcategories?.length || 0} subcategories</p>
          </button>
        ))}
      </div>
      <button onClick={save} disabled={saving}
        className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-60">
        {saving ? "Saving..." : `Save ${selected.size} Categories`}
      </button>
    </div>
  );
}
