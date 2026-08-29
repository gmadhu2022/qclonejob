import { useState } from "react";

/* Lightweight charts — pure SVG/CSS, no chart library needed. */

export function BarChart({ data, height = 150 }) {
  // data: [{ label, value, color? }]
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center justify-end gap-2">
          <span className="text-xs font-bold text-slate-700">{d.value}</span>
          <div
            className={`w-full rounded-t transition-all duration-500 ${d.color || "bg-navy"}`}
            style={{ height: `${Math.max(4, (d.value / max) * (height - 46))}px` }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="text-center text-[10px] leading-tight text-slate-500">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ value, size = 120, stroke = 12, label }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={pct >= 75 ? "#4faa38" : pct >= 40 ? "#10256b" : "#f59e0b"}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-extrabold text-slate-800">{pct}%</div>
        {label && <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>}
      </div>
    </div>
  );
}

export function MatchBar({ score }) {
  const tone = score >= 75 ? "bg-brandgreen" : score >= 45 ? "bg-navy" : "bg-amber-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${tone} transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[11px] font-bold text-slate-600">{score}%</span>
    </div>
  );
}


/** Dual-line trend (impressions + clicks) as pure SVG. */
export function TrendChart({ series = [], height = 170 }) {
  if (!series.length) return <p className="py-10 text-center text-sm text-slate-400">No data yet.</p>;
  const W = 640, H = height, P = { t: 12, r: 12, b: 22, l: 34 };
  const maxI = Math.max(1, ...series.map((d) => d.impressions));
  const x = (i) => P.l + (i * (W - P.l - P.r)) / Math.max(1, series.length - 1);
  const y = (v) => P.t + (1 - v / maxI) * (H - P.t - P.b);
  const path = (key) => series.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d[key])}`).join(" ");
  const area = `${path("impressions")} L${x(series.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`;
  const label = (d) => d.day.slice(5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="impFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10256b" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#10256b" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={P.l} x2={W - P.r} y1={y(maxI * f)} y2={y(maxI * f)} stroke="#e2e8f0" strokeWidth="1" />
          <text x={P.l - 6} y={y(maxI * f) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
            {Math.round(maxI * f)}
          </text>
        </g>
      ))}
      <path d={area} fill="url(#impFill)" />
      <path d={path("impressions")} fill="none" stroke="#10256b" strokeWidth="2.5" strokeLinejoin="round" />
      <path d={path("clicks")} fill="none" stroke="#4faa38" strokeWidth="2.5" strokeLinejoin="round" />
      {series.map((d, i) => (
        <g key={d.day}>
          <circle cx={x(i)} cy={y(d.impressions)} r="2.5" fill="#10256b" />
          <circle cx={x(i)} cy={y(d.clicks)} r="2.5" fill="#4faa38" />
          <title>{`${d.day}: ${d.impressions} views, ${d.clicks} clicks`}</title>
          {(i === 0 || i === series.length - 1 || i === Math.floor(series.length / 2)) && (
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{label(d)}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** Tiny inline sparkline for table rows. */
export function Sparkline({ values = [], width = 70, height = 20, color = "#10256b" }) {
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) =>
    `${(i * width) / Math.max(1, values.length - 1)},${height - (v / max) * height}`).join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}


/** Donut/pie built from SVG arcs. data: [{label, value, color}] with tailwind bg-* colours. */
const HEX = { "bg-navy": "#10256b", "bg-brandgreen": "#4faa38", "bg-blue-500": "#3b82f6",
  "bg-blue-400": "#60a5fa", "bg-blue-600": "#2563eb", "bg-amber-400": "#fbbf24",
  "bg-violet-500": "#8b5cf6", "bg-red-400": "#f87171", "bg-slate-400": "#94a3b8",
  "bg-slate-300": "#cbd5e1", "bg-brandgreen-400": "#6ec24f" };
const hexOf = (c) => HEX[c] || "#10256b";

export function PieChart({ data = [], size = 190, donut = true }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  if (!total) return <p className="py-10 text-center text-sm text-slate-400">No data yet.</p>;
  const R = size / 2, r = donut ? R * 0.58 : 0;
  let angle = -Math.PI / 2;
  const arcs = data.filter((d) => d.value > 0).map((d, i) => {
    const slice = (d.value / total) * Math.PI * 2;
    const [x1, y1] = [R + R * 0.92 * Math.cos(angle), R + R * 0.92 * Math.sin(angle)];
    angle += slice;
    const [x2, y2] = [R + R * 0.92 * Math.cos(angle), R + R * 0.92 * Math.sin(angle)];
    const large = slice > Math.PI ? 1 : 0;
    const inner = donut
      ? ` L${R + r * Math.cos(angle)},${R + r * Math.sin(angle)}` +
        ` A${r},${r} 0 ${large} 0 ${R + r * Math.cos(angle - slice)},${R + r * Math.sin(angle - slice)} Z`
      : ` L${R},${R} Z`;
    return (
      <path key={i} d={`M${x1},${y1} A${R * 0.92},${R * 0.92} 0 ${large} 1 ${x2},${y2}${inner}`}
            fill={hexOf(d.color)} className="transition-opacity hover:opacity-80">
        <title>{`${d.label}: ${d.value} (${Math.round((d.value / total) * 100)}%)`}</title>
      </path>
    );
  });
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg width={size} height={size}>{arcs}
        {donut && <text x={R} y={R} textAnchor="middle" dominantBaseline="central"
                        className="fill-slate-800" style={{ fontSize: 22, fontWeight: 800 }}>{total}</text>}
      </svg>
      <ul className="space-y-1.5">
        {data.filter((d) => d.value > 0).map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-[12.5px] text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: hexOf(d.color) }} />
            {d.label}<span className="font-semibold text-slate-800">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars — better than vertical when labels are long. */
export function HBarChart({ data = [] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="py-10 text-center text-sm text-slate-400">No data yet.</p>;
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="group flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-right text-[12px] text-slate-500">{d.label}</span>
          <div className="h-6 flex-1 overflow-hidden rounded-lg bg-slate-100">
            <div className={`h-full rounded-lg ${d.color || "bg-navy"} transition-all duration-500 group-hover:opacity-85`}
                 style={{ width: `${Math.max(3, (d.value / max) * 100)}%` }} />
          </div>
          <span className="w-8 shrink-0 text-right text-[12px] font-bold text-slate-700">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Chart with a type switcher — bar / horizontal bar / donut / line. */
export function SwitchableChart({ title, data = [], types = ["bar", "hbar", "donut"], height = 200 }) {
  const [type, setType] = useState(types[0]);
  const LABELS = { bar: "Bars", hbar: "Rows", donut: "Donut", pie: "Pie", line: "Line" };
  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-slate-800">{title}</h3>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {types.map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                type === t ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
              {LABELS[t] || t}
            </button>
          ))}
        </div>
      </div>
      {type === "bar" && <BarChart data={data} height={height} />}
      {type === "hbar" && <HBarChart data={data} />}
      {type === "donut" && <PieChart data={data} donut />}
      {type === "pie" && <PieChart data={data} donut={false} />}
      {type === "line" && (
        <TrendChart series={data.map((d, i) => ({ day: d.label, impressions: d.value, clicks: 0 }))} height={height} />
      )}
    </div>
  );
}
