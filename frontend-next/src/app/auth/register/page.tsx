"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerCustomer } from "@/lib/api";
import { useAuthStore } from "@/store";
import toast from "react-hot-toast";
import Link from "next/link";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { toast.error("Passwords don't match"); return; }
    if (form.password.length < 6) { toast.error("Password too short"); return; }
    setLoading(true);
    try {
      const d = await registerCustomer({ name: form.name, email: form.email, phone: form.phone, password: form.password });
      setAuth(d.token, { name: d.name, email: d.email, is_admin: false, role: d.role });
      toast.success("Account created!"); router.push("/");
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Registration failed"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display font-black text-3xl text-brand">ShopUG</h1>
          <p className="text-gray-500 mt-2 text-sm">Create your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: "Full Name", key: "name", type: "text", ph: "John Doe" },
            { label: "Email", key: "email", type: "email", ph: "you@example.com" },
            { label: "Phone", key: "phone", type: "tel", ph: "07XXXXXXXX" },
            { label: "Password", key: "password", type: "password", ph: "Min. 6 characters" },
            { label: "Confirm Password", key: "confirm", type: "password", ph: "••••••••" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-sm font-medium text-gray-700 block mb-1">{f.label}</label>
              <input type={f.type} required value={(form as any)[f.key]} onChange={set(f.key)}
                placeholder={f.ph} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-brand focus:outline-none" />
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="w-full bg-brand text-white font-bold py-3 rounded-xl hover:bg-brand-dark transition disabled:opacity-60">
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account? <Link href="/auth/login" className="text-brand font-semibold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
