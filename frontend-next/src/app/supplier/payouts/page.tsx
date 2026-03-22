"use client";
import { useEffect, useState } from "react";
import { fetchSupplierPayouts } from "@/lib/api";
import { useAuthStore } from "@/store";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, DollarSign } from "lucide-react";

const fmt = (p: number) => new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(p);

export default function SupplierPayoutsPage() {
  const { user }  = useAuthStore();
  const router    = useRouter();
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== "supplier") { router.push("/supplier/login"); return; }
    fetchSupplierPayouts().then(setPayouts).finally(() => setLoading(false));
  }, [user]);

  const pending = payouts.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const paid    = payouts.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/supplier/dashboard" className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 mb-6">
        <ArrowLeft size={16} /> Back
      </Link>
      <h1 className="font-display font-bold text-2xl mb-6">Payouts</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <DollarSign size={20} className="text-yellow-600 mb-2" />
          <p className="font-bold text-xl text-yellow-700">{fmt(pending)}</p>
          <p className="text-xs text-yellow-600 mt-1">Pending payout</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <DollarSign size={20} className="text-green-600 mb-2" />
          <p className="font-bold text-xl text-green-700">{fmt(paid)}</p>
          <p className="text-xs text-green-600 mt-1">Total paid out</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : payouts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No payouts yet. Fulfill orders to earn.</div>
      ) : (
        <div className="space-y-3">
          {payouts.map(p => (
            <div key={p.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <p className="font-medium text-sm line-clamp-1">{p.title}</p>
                <p className="text-xs text-gray-400">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "Awaiting payment"}</p>
                {p.payment_ref && <p className="text-xs text-gray-400">Ref: {p.payment_ref}</p>}
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">{fmt(p.amount)}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.status === "paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{p.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
