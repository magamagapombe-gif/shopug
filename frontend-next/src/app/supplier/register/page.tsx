"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerSupplier } from "@/lib/api";
import toast from "react-hot-toast";
import Link from "next/link";
import { Store, CheckCircle } from "lucide-react";

export default function SupplierRegisterPage() {
  const [form, setForm] = useState({ name: "", business_name: "", email: "", phone: "", address: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const router = useRouter();
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { toast.error("Passwords don't match"); return; }
    setLoading(true);
    try {
      await registerSupplier({ name: form.name, business_name: form.business_name, email: form.email, phone: form.phone, address: form.address, password: form.password });
      setDone(true);
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Registration failed"); }
    setLoading(false);
  };

  if (done) return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center border border-gray-100 shadow-sm">
        <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
        <h2 className="font-display font-bold text-2xl mb-2">Application Submitted!</h2>
        <p className="text-gray-500 mb-2">Your supplier account is pending admin approval.</p>
        <p className="text-gray-400 text-sm mb-6">We'll review your application and notify you via email.</p>
        <Link href="/" className="bg-brand text-white font-bold px-6 py-3 rounded-xl hover:bg-brand-dark transition inline-block">Back to Home</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 py-12">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Store size={28} className="text-blue-600" />
          </div>
          <h1 className="font-display font-black text-2xl">Become a Supplier</h1>
          <p className="text-gray-500 mt-1 text-sm">Supply products and earn through ShopUG</p>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 mb-6 text-sm text-blue-700">
          <p className="font-semibold mb-1">How it works:</p>
          <ul className="space-y-1 text-xs">
            <li>✅ Register and get approved by admin</li>
            <li>✅ Mark which products you can supply and your price</li>
            <li>✅ Receive order notifications and bid to fulfil</li>
            <li>✅ Deliver to our hub — we inspect and deliver to customer</li>
            <li>✅ Get paid after successful delivery</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: "Your Full Name", key: "name", type: "text", ph: "John Doe" },
            { label: "Business Name", key: "business_name", type: "text", ph: "Doe Electronics Ltd" },
            { label: "Email", key: "email", type: "email", ph: "business@example.com" },
            { label: "Phone", key: "phone", type: "tel", ph: "07XXXXXXXX" },
            { label: "Business Address", key: "address", type: "text", ph: "Kampala, Uganda" },
            { label: "Password", key: "password", type: "password", ph: "Min. 6 characters" },
            { label: "Confirm Password", key: "confirm", type: "password", ph: "••••••••" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-sm font-medium text-gray-700 block mb-1">{f.label}</label>
              <input type={f.type} required value={(form as any)[f.key]} onChange={set(f.key)}
                placeholder={f.ph}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-60">
            {loading ? "Submitting..." : "Submit Application"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Already registered? <Link href="/supplier/login" className="text-blue-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
