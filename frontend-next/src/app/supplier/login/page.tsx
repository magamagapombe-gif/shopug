"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginSupplier } from "@/lib/api";
import { useAuthStore } from "@/store";
import toast from "react-hot-toast";
import Link from "next/link";
import { Store } from "lucide-react";

export default function SupplierLoginPage() {
  const [email, setEmail] = useState("");
  const [pass, setPass]   = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      const d = await loginSupplier({ email, password: pass });
      setAuth(d.token || d.access_token, { name: d.name, email, is_admin: false, role: "supplier" });
      toast.success(`Welcome, ${d.name}!`);
      router.push("/supplier/dashboard");
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Login failed"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Store size={28} className="text-blue-600" />
          </div>
          <h1 className="font-display font-black text-2xl">Supplier Portal</h1>
          <p className="text-gray-500 mt-1 text-sm">Sign in to your supplier account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="supplier@example.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Password</label>
            <input type="password" required value={pass} onChange={e => setPass(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition disabled:opacity-60">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Not registered? <Link href="/supplier/register" className="text-blue-600 font-semibold hover:underline">Become a Supplier</Link>
        </p>
        <p className="text-center text-sm text-gray-400 mt-2">
          Customer? <Link href="/auth/login" className="text-brand font-semibold hover:underline">Customer Login</Link>
        </p>
      </div>
    </div>
  );
}