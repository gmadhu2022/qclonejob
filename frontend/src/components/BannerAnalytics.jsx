import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { TrendChart, PieChart, HBarChart, Donut } from "./charts";

/**
 * Banner performance dashboard, shared by recruiters (their own banners)
 * and admin (platform-wide).
 */
export default function BannerAnalytics({ endpoint, title = "Banner performance", subtitle }) {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(14);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null); setErr(null);
    api.get(`${endpoint}?days=${days}`)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [endpoint, days]);

  if (err) return <div className="card text-sm text-red-600">{err}</div>;
  if (!data) return <p className="text-slate-400">Loading…</p>;

  const t = data.totals;
  const top = [...data.banners].filter((b) => b.impressions > 0)
    .sort((a, b) => b.ctr - a.ctr).slice(0, 5);
  const typeAgg = {};
  data.banners.forEach((b) => {
    const k = b.media_type || "image";
    typeAgg[k] = (typeAgg[k] || 0) + b.impressions;
  });
  const TYPE_COLOR = { image: "bg-navy", video: "bg-brandgreen", gif: "bg-amber-400", audio: "bg-violet-500" };
  const byType = Object.entries(typeAgg).map(([label, value]) => ({
    label, value, color: TYPE_COLOR[label] || "bg-slate-400" }));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex gap-1.5 rounded-lg bg-slate-100 p-1">
          {[7, 14, 30].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                days === d ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Banners" value={t.banners} />
        <Kpi label="Active" value={t.active} tone="green" />
        <Kpi label="Views" value={t.impressions.toLocaleString()} />
        <Kpi label="Clicks" value={t.clicks.toLocaleString()} tone="green" />
        <Kpi label="Click rate" value={`${t.ctr}%`} tone={t.ctr >= 2 ? "green" : "navy"} />
      </div>

      <div className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-slate-800">Trend — last {days} days</h3>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-navy" /> Views</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded bg-brandgreen" /> Clicks</span>
          </div>
        </div>
        <TrendChart series={data.series} />
      </div>

      <div className="card overflow-hidden !p-0">
        <div className="border-b border-slate-100 px-5 py-3">
          <h3 className="font-bold text-slate-800">Per banner</h3>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Banner</th><th>Type</th><th>Audience</th><th>Status</th>
              <th className="text-right">Views</th><th className="text-right">Clicks</th>
              <th className="text-right">CTR</th><th className="text-right">Last {days}d</th>
            </tr>
          </thead>
          <tbody>
            {data.banners.map((b) => (
              <tr key={b.id}>
                <td>
                  <span className="font-medium text-slate-800">{b.title}</span>
                  {b.company_name && <span className="block text-xs text-slate-400">{b.company_name}</span>}
                </td>
                <td className="capitalize text-slate-500">{b.media_type}</td>
                <td className="capitalize text-slate-500">{b.audience}</td>
                <td>
                  <span className={`badge ${b.status === "active" ? "bg-brandgreen-50 text-brandgreen-600" : "bg-slate-100 text-slate-500"}`}>
                    {b.status}
                  </span>
                </td>
                <td className="text-right font-semibold text-slate-700">{b.impressions.toLocaleString()}</td>
                <td className="text-right font-semibold text-slate-700">{b.clicks.toLocaleString()}</td>
                <td className="text-right">
                  <span className={`font-bold ${b.ctr >= 2 ? "text-brandgreen-600" : "text-slate-500"}`}>{b.ctr}%</span>
                </td>
                <td className="text-right text-xs text-slate-500">
                  {b.recent_impressions} / {b.recent_clicks}
                </td>
              </tr>
            ))}
            {data.banners.length === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">No banners yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* performance leaderboard */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 font-bold text-slate-800">Best performing</h3>
          {top.length ? (
            <div className="space-y-2.5">
              {top.map((b, i) => (
                <div key={b.id} className="group flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-50 text-[11px] font-bold text-navy">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-800">{b.title}</p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brandgreen transition-all duration-500"
                           style={{ width: `${Math.min(100, (b.ctr / Math.max(1, top[0].ctr)) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="w-14 shrink-0 text-right text-[12px] font-bold text-brandgreen-600">{b.ctr}%</span>
                </div>
              ))}
            </div>
          ) : <p className="py-8 text-center text-sm text-slate-400">No data yet.</p>}
          <p className="mt-3 text-xs text-slate-400">Ranked by click-through rate.</p>
        </div>

        <div className="card">
          <h3 className="mb-3 font-bold text-slate-800">Views by media type</h3>
          <PieChart data={byType} donut />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card">
          <h3 className="mb-1 font-bold text-slate-800">Engagement</h3>
          <p className="mb-3 text-xs text-slate-400">How many views turn into clicks</p>
          <div className="flex items-center justify-center py-2">
            <Donut value={Math.round(t.ctr)} label="click rate" size={140} />
          </div>
        </div>
        <div className="card lg:col-span-2">
          <h3 className="mb-3 font-bold text-slate-800">Views vs clicks per banner</h3>
          <HBarChart data={data.banners.slice(0, 6).map((b) => ({
            label: b.title, value: b.impressions, color: "bg-navy" }))} />
        </div>
      </div>

    </div>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <div className="card-hover text-center">
      <div className={`text-2xl font-extrabold ${tone === "green" ? "text-brandgreen-600" : "text-navy"}`}>{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}
