"use client";
import { useEffect, useState } from "react";
import { submitProduct, fetchMySubmissions, fetchCategories } from "@/lib/api";
import { useAuthStore } from "@/store";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Link from "next/link";
import { ArrowLeft, PlusCircle } from "lucide-react";

const fmt = (p: number) => new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(p);
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function SupplierProductsPage() {
  const { user }  = useAuthStore();
  const router    = useRouter();
  const [cats, setCats]         = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", image_url: "", supplier_price: "", category_id: "" });
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (!user || user.role !== "supplier") { router.push("/supplier/login"); return; }
    fetchCategories().then(setCats);
    fetchMySubmissions().then(setSubmissions);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.supplier_price) { toast.error("Fill required fields"); return; }
    setSubmitting(true);
    try {
      await submitProduct({
        title: form.title, description: form.description,
        image_url: form.image_url || null,
        supplier_price: parseFloat(form.supplier_price),
        category_id: form.category_id ? parseInt(form.category_id) : null,
      });
      toast.success("Product submitted for review!");
      setShowForm(false);
      setForm({ title: "", description: "", image_url: "", supplier_price: "", category_id: "" });
      fetchMySubmissions().then(setSubmissions);
    } catch { toast.error("Submission failed"); }
    setSubmitting(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/supplier/dashboard" className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-6">
        <ArrowLeft size={16} /> Back
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl">Submit Products</h1>
          <p className="text-gray-500 text-sm">Add products not listed on our site. Admin will review and set the selling price.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 text-sm flex items-center gap-2">
          <PlusCircle size={16} /> New Product
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 space-y-4">
          <h3 className="font-semibold text-blue-700">New Product Submission</h3>
          {[
            { label: "Product Title *", key: "title", type: "text", ph: "e.g. Samsung Galaxy A54 128GB" },
            { label: "Image URL", key: "image_url", type: "url", ph: "https://..." },
            { label: "Your Supply Price (UGX) *", key: "supplier_price", type: "number", ph: "e.g. 800000" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-sm font-medium text-gray-700 block mb-1">{f.label}</label>
              <input type={f.type} value={(form as any)[f.key]} onChange={set(f.key)} placeholder={f.ph}
                className="w-full border rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
          ))}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Category</label>
            <select value={form.category_id} onChange={set("category_id")}
              className="w-full border rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
              <option value="">Select category</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
            <textarea value={form.description} onChange={set("description")} rows={3}
              placeholder="Product details, specifications..."
              className="w-full border rounded-xl px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 border rounded-xl py-2 text-sm hover:border-gray-400">Cancel</button>
            <button type="submit" disabled={submitting}
              className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-xl hover:bg-blue-700 disabled:opacity-60 text-sm">
              {submitting ? "Submitting..." : "Submit for Review"}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {submissions.length === 0 && <div className="text-center py-12 text-gray-400">No submissions yet</div>}
        {submissions.map(s => (
          <div key={s.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex gap-4">
            {s.image_url && <img src={s.image_url} alt={s.title} className="w-16 h-16 object-contain bg-gray-50 rounded-lg shrink-0" />}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <p className="font-medium text-sm">{s.title}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[s.status] || "bg-gray-100 text-gray-600"}`}>{s.status}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Your price: {fmt(s.supplier_price)}</p>
              {s.admin_note && <p className="text-xs text-gray-500 mt-1 italic">Note: {s.admin_note}</p>}
              <p className="text-xs text-gray-300 mt-1">{new Date(s.submitted_at).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
