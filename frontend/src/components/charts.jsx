import { useEffect, useRef, useState } from "react";

/* Lightweight charts — pure SVG/CSS, no chart library needed. */

export function BarChart({ data, height = 150 }) {
  // data: [{ label, value, color? }] — colour is assigned per category if unset
  const rows = withColors(data);
  const max = Math.max(1, ...rows.map((d) => d.value));
  if (!rows.length) return <NoData />;
  return (
    <div className={`flex items-end gap-3 p-3 ${CHART_BG}`} style={{ height }}>
      {rows.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center justify-end gap-2">
          <span className="text-xs font-bold text-slate-700">{d.value}</span>
          <div
            className="w-full rounded-t transition-all duration-500 hover:opacity-80"
            style={{ height: `${Math.max(4, (d.value / max) * (height - 62))}px`, background: d.hex }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="w-full truncate text-center text-[10px] leading-tight text-slate-500"
                title={d.label}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function NoData({ label = "No data yet." }) {
  return (
    <div className={`flex h-32 items-center justify-center ${CHART_BG}`}>
      <p className="text-sm text-slate-400">{label}</p>
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
const hexOf = (c) => HEX[c] || c || "#10256b";

/* ---------------------------------------------------------------------
   Series palette. Charts used to fall back to a single navy for every
   bar/slice, so a five-category breakdown read as one solid block and the
   categories were only distinguishable by their labels. Any datum without an
   explicit colour now gets a distinct hue by index, cycling if there are more
   categories than colours. Explicit `color` on a datum still wins, so charts
   that carry meaning in colour (green = hired, red = rejected) are untouched.
   Ordered for contrast between neighbours rather than as a gradient. */
export const SERIES_COLORS = [
  "#10256b", "#4faa38", "#f59e0b", "#3b82f6", "#8b5cf6",
  "#ec4899", "#06b6d4", "#ef4444", "#84cc16", "#f97316",
  "#14b8a6", "#a855f7", "#eab308", "#0ea5e9", "#22c55e",
];
export const seriesColor = (i) => SERIES_COLORS[i % SERIES_COLORS.length];

/** Give every datum a colour, keeping any the caller set deliberately. */
export function withColors(data = []) {
  return data.map((d, i) => ({ ...d, hex: d.color ? hexOf(d.color) : seriesColor(i) }));
}

/* A barely-there tint behind the plot so a chart reads as its own surface
   without competing with the card it sits in. */
export const CHART_BG =
  "rounded-xl bg-gradient-to-b from-slate-50/80 to-transparent ring-1 ring-slate-100";

export function PieChart({ data = [], size = 190, donut = true }) {
  const rows = withColors(data);
  const total = rows.reduce((a, d) => a + d.value, 0);
  if (!total) return <NoData />;
  const R = size / 2, r = donut ? R * 0.58 : 0;
  let angle = -Math.PI / 2;
  const arcs = rows.filter((d) => d.value > 0).map((d, i) => {
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
            fill={d.hex} className="transition-opacity hover:opacity-80">
        <title>{`${d.label}: ${d.value} (${Math.round((d.value / total) * 100)}%)`}</title>
      </path>
    );
  });
  return (
    <div className={`flex flex-wrap items-center justify-center gap-6 p-3 ${CHART_BG}`}>
      <svg width={size} height={size}>{arcs}
        {donut && <text x={R} y={R} textAnchor="middle" dominantBaseline="central"
                        className="fill-slate-800" style={{ fontSize: 22, fontWeight: 800 }}>{total}</text>}
      </svg>
      <ul className="space-y-1.5">
        {rows.filter((d) => d.value > 0).map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-[12.5px] text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.hex }} />
            {d.label}<span className="font-semibold text-slate-800">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars — better than vertical when labels are long. */
export function HBarChart({ data = [] }) {
  const rows = withColors(data);
  const max = Math.max(1, ...rows.map((d) => d.value));
  if (!rows.length) return <NoData />;
  return (
    <div className={`space-y-2 p-3 ${CHART_BG}`}>
      {rows.map((d) => (
        <div key={d.label} className="group flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-right text-[12px] text-slate-500">{d.label}</span>
          <div className="h-6 flex-1 overflow-hidden rounded-lg bg-slate-200/60">
            <div className="h-full rounded-lg transition-all duration-500 group-hover:opacity-85"
                 style={{ width: `${Math.max(3, (d.value / max) * 100)}%`, background: d.hex }} />
          </div>
          <span className="w-8 shrink-0 text-right text-[12px] font-bold text-slate-700">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Radial (polar) bars — reads well for a handful of categories. */
export function RadialChart({ data = [], size = 200 }) {
  const rows = withColors(data);
  const max = Math.max(1, ...rows.map((d) => d.value));
  if (!rows.length) return <NoData />;
  const R = size / 2, inner = R * 0.28;
  return (
    <div className={`flex flex-wrap items-center justify-center gap-6 p-3 ${CHART_BG}`}>
      <svg width={size} height={size}>
        {rows.map((d, i) => {
          const a0 = (i / rows.length) * Math.PI * 2 - Math.PI / 2;
          const a1 = ((i + 1) / rows.length) * Math.PI * 2 - Math.PI / 2 - 0.06;
          const rad = inner + (d.value / max) * (R * 0.92 - inner);
          const p = (ang, r) => `${R + r * Math.cos(ang)},${R + r * Math.sin(ang)}`;
          return (
            <path key={d.label}
                  d={`M${p(a0, inner)} L${p(a0, rad)} A${rad},${rad} 0 0 1 ${p(a1, rad)} L${p(a1, inner)} A${inner},${inner} 0 0 0 ${p(a0, inner)} Z`}
                  fill={d.hex} className="transition-opacity hover:opacity-80">
              <title>{`${d.label}: ${d.value}`}</title>
            </path>
          );
        })}
      </svg>
      <ul className="space-y-1.5">
        {rows.map((d) => (
          <li key={d.label} className="flex items-center gap-2 text-[12.5px] text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.hex }} />
            {d.label}<span className="font-semibold text-slate-800">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Single stacked bar — shows composition of a whole at a glance. */
export function StackedBar({ data = [] }) {
  const rows = withColors(data).filter((d) => d.value > 0);
  const total = rows.reduce((a, d) => a + d.value, 0);
  if (!total) return <NoData />;
  return (
    <div className={`p-3 ${CHART_BG}`}>
      <div className="flex h-9 w-full overflow-hidden rounded-lg">
        {rows.map((d) => (
          <div key={d.label} style={{ width: `${(d.value / total) * 100}%`, background: d.hex }}
               title={`${d.label}: ${d.value} (${Math.round((d.value / total) * 100)}%)`}
               className="transition-opacity hover:opacity-80" />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {rows.map((d) => (
          <li key={d.label} className="flex items-center gap-1.5 text-[12px] text-slate-600">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.hex }} />
            {d.label} <span className="font-semibold text-slate-800">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Area/line over the category axis, coloured by value. */
export function AreaChart({ data = [], height = 200 }) {
  const rows = withColors(data);
  if (!rows.length) return <NoData />;
  const W = 640, H = height, P = { t: 14, r: 14, b: 26, l: 34 };
  const max = Math.max(1, ...rows.map((d) => d.value));
  const x = (i) => P.l + (i * (W - P.l - P.r)) / Math.max(1, rows.length - 1);
  const y = (v) => P.t + (1 - v / max) * (H - P.t - P.b);
  const line = rows.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  return (
    <div className={`p-2 ${CHART_BG}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10256b" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#10256b" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={P.l} x2={W - P.r} y1={y(max * f)} y2={y(max * f)} stroke="#e2e8f0" />
        ))}
        <path d={`${line} L${x(rows.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`} fill="url(#areaFill)" />
        <path d={line} fill="none" stroke="#10256b" strokeWidth="2.5" strokeLinejoin="round" />
        {rows.map((d, i) => (
          <g key={d.label}>
            <circle cx={x(i)} cy={y(d.value)} r="4" fill={d.hex} stroke="#fff" strokeWidth="1.5" />
            <title>{`${d.label}: ${d.value}`}</title>
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">
              {String(d.label).slice(0, 8)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ---------------------------------------------------------------------
   SwitchableChart — one card, many views.

   The type picker is a dropdown rather than a row of segmented buttons:
   with seven types the button row wrapped onto two lines and pushed the
   chart down. A dropdown stays one line whatever the count.
   --------------------------------------------------------------------- */
const CHART_TYPES = {
  bar:     { label: "Column",       icon: "▊" },
  hbar:    { label: "Bar",          icon: "▬" },
  donut:   { label: "Donut",        icon: "◍" },
  pie:     { label: "Pie",          icon: "◕" },
  stacked: { label: "Stacked",      icon: "▤" },
  radial:  { label: "Radial",       icon: "✳" },
  area:    { label: "Area",         icon: "◺" },
};
const ALL_TYPES = Object.keys(CHART_TYPES);

export function SwitchableChart({ title, subtitle, data = [], types = ALL_TYPES, height = 200 }) {
  const list = types.filter((t) => CHART_TYPES[t]);
  const [type, setType] = useState(list[0] || "bar");
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const cur = CHART_TYPES[type] || CHART_TYPES.bar;

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>

        <div className="relative" ref={boxRef}>
          <button type="button" onClick={() => setOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5
                             text-[12px] font-semibold text-slate-600 shadow-sm transition-all
                             hover:border-navy-200 hover:text-navy">
            <span className="text-navy">{cur.icon}</span>
            {cur.label}
            <span className={`text-[9px] text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
          </button>

          {open && (
            <div className="absolute right-0 z-30 mt-1.5 w-40 overflow-hidden rounded-xl border border-slate-200
                            bg-white py-1 shadow-cardhover">
              {list.map((t) => (
                <button key={t} type="button"
                        onClick={() => { setType(t); setOpen(false); }}
                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] transition-colors
                          ${t === type ? "bg-navy-50 font-semibold text-navy" : "text-slate-600 hover:bg-slate-50"}`}>
                  <span className="w-4 text-center">{CHART_TYPES[t].icon}</span>
                  {CHART_TYPES[t].label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {type === "bar" && <BarChart data={data} height={height} />}
      {type === "hbar" && <HBarChart data={data} />}
      {type === "donut" && <PieChart data={data} donut />}
      {type === "pie" && <PieChart data={data} donut={false} />}
      {type === "stacked" && <StackedBar data={data} />}
      {type === "radial" && <RadialChart data={data} />}
      {type === "area" && <AreaChart data={data} height={height} />}
    </div>
  );
}
