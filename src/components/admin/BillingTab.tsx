"use client";

import { useEffect, useState } from "react";
import { Loader2, Ticket, Check, AlertCircle, CreditCard, Users, Coins, Sparkles, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BillingTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Coupon Creation Form state
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [creatingCoupon, setCreatingCoupon] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/billing");
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || "Failed to load admin billing data.");
      }
    } catch (err) {
      console.error(err);
      setError("Network connection error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBillingData();
  }, []);

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !discountValue) return;

    try {
      setCreatingCoupon(true);
      setCouponMessage(null);
      setCouponError(null);

      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.toUpperCase().trim(),
          discountType,
          discountValue: Number(discountValue),
          maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
          expiresAt: expiresAt || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setCouponMessage(`Coupon '${code.toUpperCase()}' successfully created.`);
        setCode("");
        setDiscountValue("");
        setMaxRedemptions("");
        setExpiresAt("");
        // Reload data
        void loadBillingData();
      } else {
        setCouponError(json.error || "Failed to create coupon.");
      }
    } catch (err) {
      setCouponError("Network error creating coupon.");
    } finally {
      setCreatingCoupon(false);
    }
  };

  const handleDisableCoupon = async (couponCode: string) => {
    const confirmDisable = window.confirm(`Deactivate coupon '${couponCode}'? This action cannot be undone.`);
    if (!confirmDisable) return;

    try {
      const res = await fetch(`/api/admin/coupons?code=${couponCode}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        alert(`Coupon '${couponCode}' deactivated.`);
        void loadBillingData();
      } else {
        alert(json.error || "Failed to deactivate coupon.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error.");
    }
  };

  if (loading && !data) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-2">
        <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
        <span className="text-xs text-slate-500">Loading Billing Stats...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 rounded-xl border border-red-500/20 bg-red-500/5 text-center text-xs text-red-400">
        <AlertCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
        {error}
        <Button onClick={loadBillingData} className="mt-3 block mx-auto bg-red-500 text-white text-[10px] px-4 py-1.5 h-8">
          Retry Connection
        </Button>
      </div>
    );
  }

  const { stats, coupons, recentHistory } = data || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Billing Administration</h2>
        <p className="text-xs text-slate-500 mt-1">Review MRR growth metrics, plan tiers distributions, and coupon code campaign registries.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Estimated MRR", value: `$${stats?.mrr || 0}`, desc: "Active plans multiplier", icon: Coins, color: "text-emerald-400" },
          { label: "ARR Projection", value: `$${stats?.arr || 0}`, desc: "Annualized current run rate", icon: Sparkles, color: "text-cyan-400" },
          { label: "Average ARPU", value: `$${stats?.arpu || 0}`, desc: "Monthly revenue per user", icon: Users, color: "text-purple-400" },
          { label: "SaaS Sales Vol", value: `$${stats?.transactions?.totalAmount || 0}`, desc: `Successful payments: ${stats?.transactions?.successful || 0}`, icon: CreditCard, color: "text-yellow-400" }
        ].map((kpi, idx) => (
          <div key={idx} className="p-4 rounded-xl border border-white/5 bg-[#14161a] space-y-1.5">
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-[10px] font-bold uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </div>
            <div className="text-2xl font-black text-white">{kpi.value}</div>
            <span className="text-[9px] text-slate-500 block leading-tight">{kpi.desc}</span>
          </div>
        ))}
      </div>

      {/* Plan distributions progress layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 p-5 rounded-xl border border-white/5 bg-[#14161a] space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            👥 Plan Distributions
          </h3>
          <div className="space-y-3.5">
            {[
              { label: "Free Plan", count: stats?.distribution?.free || 0 },
              { label: "Student Plan", count: stats?.distribution?.student || 0 },
              { label: "Pro Plan", count: stats?.distribution?.pro || 0 },
              { label: "Team Plan", count: stats?.distribution?.team || 0 },
              { label: "Enterprise Plan", count: stats?.distribution?.enterprise || 0 }
            ].map((p, idx) => {
              const total = Object.values(stats?.distribution || {}).reduce((a: any, b: any) => a + b, 0) as number;
              const pct = total > 0 ? Math.round((p.count / total) * 100) : 0;
              return (
                <div key={idx} className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-slate-400">
                    <span>{p.label}</span>
                    <strong>{p.count} users ({pct}%)</strong>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coupons Creation Form */}
        <div className="md:col-span-2 p-5 rounded-xl border border-white/5 bg-[#14161a] space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            🎟 Campaign Coupons Registry
          </h3>

          <form onSubmit={handleCreateCoupon} className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
            <div className="space-y-1.5">
              <label className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Coupon Code</label>
              <Input
                placeholder="e.g. EDUSUMMER50"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="bg-[#0d0f12] border-white/5 h-9 uppercase font-bold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Discount Type</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                className="w-full bg-[#0d0f12] border border-white/5 text-white h-9 rounded-lg px-3 focus:outline-none"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Discount Value</label>
              <Input
                type="number"
                placeholder="Value (e.g. 50)"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="bg-[#0d0f12] border-white/5 h-9"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Max Redemptions (Optional)</label>
              <Input
                type="number"
                placeholder="Limit count (e.g. 100)"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                className="bg-[#0d0f12] border-white/5 h-9"
              />
            </div>

            <div className="col-span-1 md:col-span-2 flex justify-between items-center pt-2">
              <Button
                type="submit"
                disabled={creatingCoupon}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs h-9 px-5 flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" /> Create Voucher Campaign
              </Button>

              {couponMessage && <span className="text-emerald-400 text-[10px] font-semibold">✓ {couponMessage}</span>}
              {couponError && <span className="text-red-400 text-[10px] font-semibold">✕ {couponError}</span>}
            </div>
          </form>
        </div>
      </div>

      {/* Lists of Coupons registry and subscription history */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Coupons List */}
        <div className="p-5 rounded-xl border border-white/5 bg-[#14161a] space-y-3">
          <h3 className="text-sm font-bold text-white">Active Promo Vouchers</h3>
          {coupons?.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No coupons registered yet.</p>
          ) : (
            <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2 text-[10px]">
              {coupons?.map((c: any) => (
                <div key={c.id} className="p-2.5 rounded border border-white/5 bg-[#0d0f12] flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="font-mono font-bold text-cyan-400 block">{c.code}</span>
                    <span className="text-slate-500 text-[9px] block">
                      Value: {c.discount_value}{c.discount_type === "percentage" ? "%" : " USD"} | Redeemed: {c.redemption_count} / {c.max_redemptions || "∞"}
                    </span>
                  </div>
                  {c.is_active ? (
                    <Button
                      onClick={() => handleDisableCoupon(c.code)}
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:bg-red-500/15"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <span className="text-slate-500 line-through">Disabled</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Subscription Modifications */}
        <div className="p-5 rounded-xl border border-white/5 bg-[#14161a] space-y-3">
          <h3 className="text-sm font-bold text-white">Recent Subscription Logs</h3>
          {recentHistory?.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No subscription logs found.</p>
          ) : (
            <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2 text-[10px]">
              {recentHistory?.map((h: any) => (
                <div key={h.id} className="p-2.5 rounded border border-white/5 bg-[#0d0f12] space-y-1">
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-200 capitalize">{h.profiles?.email || "Unknown User"}</span>
                    <span className="text-slate-500 text-[9px]">{new Date(h.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400 text-[9px]">
                    <span>Old: <strong className="text-white capitalize">{h.old_plan || "free"}</strong> | New: <strong className="text-white capitalize">{h.new_plan || "free"}</strong></span>
                    <span className="italic text-slate-500">{h.reason || "Manual Assignment"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
