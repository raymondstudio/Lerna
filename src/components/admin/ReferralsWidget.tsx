"use client";

import { useState, useEffect } from "react";
import { Gift, Heart, Link, TrendingUp, Users } from "lucide-react";

export function ReferralsWidget() {
  const [data, setData] = useState<{
    referralStats: {
      totalInvited: number;
      activeCodes: number;
      conversionRate: number;
      rewardsIssued: number;
    };
    topPromoters: Array<{
      name: string;
      email: string;
      referrals: number;
      rewardStatus: string;
    }>;
  }>({
    referralStats: {
      totalInvited: 0,
      activeCodes: 0,
      conversionRate: 0.0,
      rewardsIssued: 0,
    },
    topPromoters: [],
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/analytics");
        const json = await res.json();
        if (json.success && json.data) {
          const a = json.data;
          setData({
            referralStats: {
              totalInvited: a.referralStats?.totalInvited || 0,
              activeCodes: a.referralStats?.activeCodes || 0,
              conversionRate: Number(a.referralStats?.conversionRate) || 0.0,
              rewardsIssued: a.referralStats?.rewardsIssued || 0,
            },
            topPromoters: a.topPromoters || [],
          });
        }
      } catch (err) {
        console.warn("[referrals] failed to fetch real referral data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = data.referralStats;
  const topReferrers = data.topPromoters;

  return (
    <div className="space-y-6 pt-4 border-t border-white/5">
      <div>
        <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
          <Gift className="h-4.5 w-4.5 text-cyan-400" /> Referral System Analytics
        </h3>
        <p className="text-slate-400 text-xs mt-0.5">
          Monitor invitation codes, account signups from student shares, and issued premium reward tallies.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="p-4 rounded-xl border border-white/5 bg-[#0a0a0a]/50">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Total Referred Signups</span>
          <div className="text-xl font-bold text-white mt-1">{stats.totalInvited} users</div>
        </div>

        <div className="p-4 rounded-xl border border-white/5 bg-[#0a0a0a]/50">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Active Referral Codes</span>
          <div className="text-xl font-bold text-white mt-1">{stats.activeCodes} codes</div>
        </div>

        <div className="p-4 rounded-xl border border-white/5 bg-[#0a0a0a]/50">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Conversion Rate</span>
          <div className="text-xl font-bold text-cyan-400 mt-1">{stats.conversionRate}%</div>
        </div>

        <div className="p-4 rounded-xl border border-white/5 bg-[#0a0a0a]/50">
          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Premium Rewards Issued</span>
          <div className="text-xl font-bold text-emerald-400 mt-1">{stats.rewardsIssued} rewards</div>
        </div>
      </div>

      <div className="p-5 rounded-2xl border border-white/5 bg-[#141414]/40 backdrop-blur-md">
        <div className="flex items-center gap-2 pb-3.5 border-b border-white/5 mb-4">
          <TrendingUp className="h-4 w-4 text-cyan-400" />
          <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Top Student Promoters</h4>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="text-slate-500 font-semibold border-b border-white/5">
                <th className="pb-3">Name & Email</th>
                <th className="pb-3 text-center">Referrals Generated</th>
                <th className="pb-3">Reward status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {topReferrers.map((ref) => (
                <tr key={ref.email} className="group">
                  <td className="py-3">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-white block">{ref.name}</span>
                      <span className="text-slate-500 font-mono text-[10px]">{ref.email}</span>
                    </div>
                  </td>
                  <td className="py-3 text-center font-bold text-white">{ref.referrals}</td>
                  <td className="py-3">
                    <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 text-[10px] font-semibold border border-cyan-500/20">
                      {ref.rewardStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
