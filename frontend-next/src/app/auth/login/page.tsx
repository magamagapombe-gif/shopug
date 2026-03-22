"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginCustomer } from "@/lib/api";
import { useAuthStore } from "@/store";
import toast from "react-hot-toast";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail]     = useState("");
  const [pass, setPass]       = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth }           = useAuthStore();
  const router                = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const d = await loginCustomer({ email, password: pass });
      setAuth(d.token, { name: d.name, email: d.email, is_admin: d.is_admin, role: d.role });
      toast.success(`Welcome back, ${d.name}!`);
      router.push(d.is_admin ? "/admin" : "/");
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Invalid credentials"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display font-black text-3xl text-brand">ShopUG</h1>
          <p className="text-gray-500 mt-2 text-sm">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: "Email", val: email, set: setEmail, type: "email", ph: "you@example.com" },
            { label: "Password", val: pass, set: setPass, type: "password", ph: "••••••••" },
          ].map(f => (
            <div key={f.label}>
              <label className="text-sm font-medium text-gray-700 block mb-1">{f.label}</label>
              <input type={f.type} required value={f.val} onChange={e => f.set(e.target.value)}
                placeholder={f.ph} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-brand focus:outline-none" />
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="w-full bg-brand text-white font-bold py-3 rounded-xl hover:bg-brand-dark transition disabled:opacity-60">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account? <Link href="/auth/register" className="text-brand font-semibold hover:underline">Register</Link>
        </p>
        <p className="text-center text-sm text-gray-400 mt-3">
          Are you a supplier? <Link href="/supplier/login" className="text-blue-600 font-semibold hover:underline">Supplier Login</Link>
        </p>
      </div>
    </div>
  );
}
