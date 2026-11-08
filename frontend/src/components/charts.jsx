import { useEffect, useRef, useState } from "react";

/* =====================================================================
   Lightweight charts — pure SVG/CSS, no chart library needed.

   Every chart takes the same data shape, [{ label, value, color? }], so a
   SwitchableChart can show one metric as any of 16 chart types. All of them
   share: a per-category palette, gradient fills, a grow/draw-in animation
   (still under prefers-reduced-motion), and a hover tooltip driven by
   data-tip attributes, so each chart only has to tag its marks.
   ===================================================================== */

/* ---------------- colours ---------------- */
const HEX = { "bg-navy": "#4f46e5", "bg-brandgreen": "#4faa38", "bg-blue-500": "#3b82f6",
  "bg-blue-400": "#60a5fa", "bg-blue-600": "#2563eb", "bg-amber-400": "#fbbf24",
  "bg-violet-500": "#8b5cf6", "bg-red-400": "#f87171", "bg-slate-400": "#94a3b8",
  "bg-slate-300": "#cbd5e1", "bg-brandgreen-400": "#6ec24f" };
const hexOf = (c) => HEX[c] || c || "#4f46e5";

/* Ordered for contrast between neighbours rather than as a gradient. Explicit
   `color` on a datum still wins, so charts that carry meaning in colour
   (green = hired, red = rejected) are untouched. */
export const SERIES_COLORS = [
  "#4f46e5", "#4faa38", "#f59e0b", "#06b6d4", "#ec4899",
  "#8b5cf6", "#3b82f6", "#ef4444", "#84cc16", "#f97316",
  "#14b8a6", "#a855f7", "#eab308", "#0ea5e9", "#22c55e",
];
export const seriesColor = (i) => SERIES_COLORS[i % SERIES_COLORS.length];

/** Give every datum a colour, keeping any the caller set deliberately. */
export function withColors(data = []) {
  // Palette colours skip any hue a datum already claims explicitly, so an
  // un-coloured category never ends up the same green as "Placed".
  const taken = new Set((data || []).filter((d) => d.color).map((d) => hexOf(d.color).toLowerCase()));
  const free = SERIES_COLORS.filter((c) => !taken.has(c.toLowerCase()));
  let n = 0;
  return (data || []).map((d) => ({
    ...d, value: Number(d.value) || 0,
    hex: d.color ? hexOf(d.color) : free[n++ % free.length],
  }));
}

export const CHART_BG = "chart-surface rounded-xl ring-1 ring-slate-100";

const sum = (rows) => rows.reduce((a, d) => a + d.value, 0);
const pctOf = (v, t) => (t ? Math.round((v / t) * 100) : 0);
const tipOf = (d, total) => `${d.label}: ${d.value}${total ? ` · ${pctOf(d.value, total)}%` : ""}`;
const shade = (hex, a = "cc") => `${hex}${a}`;

/* ---------------- shared frame with hover tooltip ---------------- */
function ChartFrame({ children, className = "", style }) {
  const ref = useRef(null);
  const [tip, setTip] = useState(null);
  const move = (e) => {
    const el = e.target.closest?.("[data-tip]");
    if (!el || !ref.current?.contains(el)) return setTip(null);
    const r = ref.current.getBoundingClientRect();
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, text: el.getAttribute("data-tip"), color: el.getAttribute("data-color") });
  };
  return (
    <div ref={ref} onMouseMove={move} onMouseLeave={() => setTip(null)}
         className={`relative ${CHART_BG} ${className}`} style={style}>
      {children}
      {tip && (
        <div className="pointer-events-none absolute z-20 whitespace-nowrap rounded-lg bg-slate-900/95 px-2.5 py-1.5 text-[11.5px] font-semibold text-white shadow-xl"
             style={{ left: tip.x, top: tip.y, transform: "translate(-50%, calc(-100% - 12px))" }}>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: tip.color || "#fff" }} />
          {tip.text}
        </div>
      )}
    </div>
  );
}

function Legend({ rows, total, className = "" }) {
  return (
    <ul className={`flex flex-wrap justify-center gap-x-3 gap-y-1.5 ${className}`}>
      {rows.map((d) => (
        <li key={d.label} data-tip={tipOf(d, total)} data-color={d.hex}
            className="flex cursor-default items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[11.5px] text-slate-600 ring-1 ring-slate-200/70">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.hex }} />
          <span className="max-w-[120px] truncate">{d.label}</span>
          <b className="font-semibold tabular-nums text-slate-800">{d.value}</b>
          {total > 0 && <span className="tabular-nums text-slate-400">{pctOf(d.value, total)}%</span>}
        </li>
      ))}
    </ul>
  );
}

export function NoData({ label = "No data yet." }) {
  return (
    <div className={`flex h-36 flex-col items-center justify-center gap-2 ${CHART_BG}`}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.8" strokeLinecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
}

/* ---------------- geometry helpers ---------------- */
const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
function ringPath(cx, cy, R, r, a0, a1) {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, R, a0), [x1, y1] = polar(cx, cy, R, a1);
  if (r <= 0) return `M${cx},${cy} L${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} Z`;
  const [x2, y2] = polar(cx, cy, r, a1), [x3, y3] = polar(cx, cy, r, a0);
  return `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`;
}
function smooth(pts) {
  if (!pts.length) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}
let uid = 0;
const useUid = (p) => { const r = useRef(null); if (!r.current) r.current = `${p}${++uid}`; return r.current; };

/* =====================================================================
   Chart types
   ===================================================================== */

/** Column chart (vertical bars). */
export function BarChart({ data, height = 200 }) {
  const rows = withColors(data);
  const max = Math.max(1, ...rows.map((d) => d.value));
  const total = sum(rows);
  if (!rows.length) return <NoData />;
  const plot = Math.max(60, height - 60);
  return (
    <ChartFrame className="px-3 pb-2 pt-3">
      <div className="relative" style={{ height: plot + 20 }}>
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-slate-200" style={{ bottom: f * plot }} />
        ))}
        <div className="absolute inset-0 flex items-end gap-3 px-1">
          {rows.map((d, i) => (
            <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <span className="mb-1 text-[11px] font-bold tabular-nums text-slate-700">{d.value}</span>
              <div data-tip={tipOf(d, total)} data-color={d.hex}
                   className="chart-grow-y w-full max-w-[64px] cursor-pointer rounded-t-lg transition-[filter] hover:brightness-110"
                   style={{ height: Math.max(4, (d.value / max) * plot), background: `linear-gradient(180deg, ${d.hex}, ${shade(d.hex, "b3")})`,
                            boxShadow: `0 6px 14px -8px ${d.hex}`, animationDelay: `${i * 60}ms` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-3 px-1">
        {rows.map((d) => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[10.5px] text-slate-500" title={d.label}>{d.label}</span>
        ))}
      </div>
    </ChartFrame>
  );
}

/** Horizontal bars — best when labels are long. */
export function HBarChart({ data = [] }) {
  const rows = withColors(data);
  const max = Math.max(1, ...rows.map((d) => d.value));
  const total = sum(rows);
  if (!rows.length) return <NoData />;
  return (
    <ChartFrame className="space-y-2.5 p-3.5">
      {rows.map((d, i) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-right text-[12px] text-slate-500" title={d.label}>{d.label}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div data-tip={tipOf(d, total)} data-color={d.hex}
                 className="chart-grow-x h-full cursor-pointer rounded-full transition-[filter] hover:brightness-110"
                 style={{ width: `${Math.max(3, (d.value / max) * 100)}%`, background: `linear-gradient(90deg, ${shade(d.hex, "b3")}, ${d.hex})`, animationDelay: `${i * 60}ms` }} />
          </div>
          <span className="w-16 shrink-0 text-right text-[12px] font-bold tabular-nums text-slate-700">
            {d.value} <span className="font-medium text-slate-400">{pctOf(d.value, total)}%</span>
          </span>
        </div>
      ))}
    </ChartFrame>
  );
}

/** Lollipop — light-weight alternative to bars. */
function LollipopChart({ data = [] }) {
  const rows = withColors(data);
  const max = Math.max(1, ...rows.map((d) => d.value));
  const total = sum(rows);
  if (!rows.length) return <NoData />;
  return (
    <ChartFrame className="space-y-3 p-3.5">
      {rows.map((d, i) => {
        const w = Math.max(3, (d.value / max) * 100);
        return (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-right text-[12px] text-slate-500" title={d.label}>{d.label}</span>
            <div className="relative h-4 flex-1">
              <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />
              <div className="chart-grow-x absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full" style={{ width: `${w}%`, background: d.hex, animationDelay: `${i * 60}ms` }} />
              <span data-tip={tipOf(d, total)} data-color={d.hex}
                    className="chart-pop absolute top-1/2 -ml-2 -mt-2 h-4 w-4 cursor-pointer rounded-full ring-4 ring-white"
                    style={{ left: `${w}%`, background: d.hex, boxShadow: `0 0 0 6px ${d.hex}22`, animationDelay: `${300 + i * 60}ms` }} />
            </div>
            <span className="w-8 shrink-0 text-right text-[12px] font-bold tabular-nums text-slate-700">{d.value}</span>
          </div>
        );
      })}
    </ChartFrame>
  );
}

/** Line / area over the categories, with smooth curves. */
function LineLike({ data = [], height = 200, area = false }) {
  const rows = withColors(data);
  const id = useUid("ln");
  if (!rows.length) return <NoData />;
  const total = sum(rows);
  const W = 400, H = Math.max(170, height), P = { t: 22, r: 16, b: 26, l: 30 };
  const max = Math.max(1, ...rows.map((d) => d.value));
  const x = (i) => rows.length === 1 ? W / 2 : P.l + (i * (W - P.l - P.r)) / (rows.length - 1);
  const y = (v) => P.t + (1 - v / max) * (H - P.t - P.b);
  const pts = rows.map((d, i) => [x(i), y(d.value)]);
  const line = smooth(pts);
  const main = rows[0]?.hex || "#4f46e5";
  return (
    <ChartFrame className="p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        <defs>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={main} stopOpacity="0.28" />
            <stop offset="100%" stopColor={main} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
            {rows.map((d, i) => <stop key={i} offset={`${rows.length === 1 ? 50 : (i / (rows.length - 1)) * 100}%`} stopColor={d.hex} />)}
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={P.l} x2={W - P.r} y1={y(max * f)} y2={y(max * f)} stroke="#e2e8f0" strokeDasharray={f ? "4 4" : ""} />
            <text x={P.l - 6} y={y(max * f) + 3} textAnchor="end" fontSize="10.5" fill="#94a3b8">{Math.round(max * f)}</text>
          </g>
        ))}
        {area && rows.length > 1 && (
          <path className="chart-fade" d={`${line} L${x(rows.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`} fill={`url(#${id}f)`} />
        )}
        {rows.length > 1 && (
          <path className="chart-draw" d={line} fill="none" stroke={`url(#${id}s)`} strokeWidth="3.5" strokeLinecap="round" pathLength="1" />
        )}
        {rows.map((d, i) => (
          <g key={d.label}>
            <circle cx={x(i)} cy={y(d.value)} r="11" fill={d.hex} opacity="0.12" />
            <circle className="chart-pop cursor-pointer" cx={x(i)} cy={y(d.value)} r="6" fill="#fff" stroke={d.hex} strokeWidth="3"
                    data-tip={tipOf(d, total)} data-color={d.hex} style={{ animationDelay: `${400 + i * 60}ms`, transformOrigin: `${x(i)}px ${y(d.value)}px` }} />
            <text x={x(i)} y={y(d.value) - 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="#334155">{d.value}</text>
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#64748b">{String(d.label).slice(0, 12)}</text>
          </g>
        ))}
      </svg>
    </ChartFrame>
  );
}
export function AreaChart(props) { return <LineLike {...props} area />; }

/** Pie / donut / half-donut. */
export function PieChart({ data = [], size = 190, donut = true, half = false }) {
  const rows = withColors(data).filter((d) => d.value > 0);
  const total = sum(rows);
  if (!total) return <NoData />;
  const R = size / 2, inner = donut ? R * 0.62 : 0;
  const span = half ? Math.PI : Math.PI * 2;
  let a = half ? Math.PI : -Math.PI / 2;
  const top = rows.reduce((m, d) => (d.value > m.value ? d : m), rows[0]);
  const h = half ? R + 8 : size;
  return (
    <ChartFrame className="flex flex-col items-center gap-3 p-4">
      <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} className="chart-spin overflow-visible">
        {rows.map((d, i) => {
          const s = (d.value / total) * span;
          const p = ringPath(R, R, R - 2, inner, a, a + s);
          a += s;
          return (
            <path key={d.label} d={p} fill={d.hex} stroke="#fff" strokeWidth="2.5" strokeLinejoin="round"
                  data-tip={tipOf(d, total)} data-color={d.hex}
                  className="cursor-pointer transition-transform duration-200 hover:scale-[1.04]"
                  style={{ transformOrigin: `${R}px ${R}px`, animationDelay: `${i * 40}ms` }} />
          );
        })}
        {donut && (
          <>
            <text x={R} y={half ? R - 18 : R - 6} textAnchor="middle" fontSize="26" fontWeight="800" fill="#0f172a">{total}</text>
            <text x={R} y={half ? R - 2 : R + 14} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="#94a3b8">
              {String(top.label).slice(0, 14)} {pctOf(top.value, total)}%
            </text>
          </>
        )}
      </svg>
      <Legend rows={rows} total={total} />
    </ChartFrame>
  );
}

/** Concentric radial bars ("activity rings"). */
export function RadialChart({ data = [], size = 200 }) {
  const rows = withColors(data);
  const max = Math.max(1, ...rows.map((d) => d.value));
  const total = sum(rows);
  if (!rows.length) return <NoData />;
  const R = size / 2;
  const band = Math.min(16, (R - 22) / Math.max(1, rows.length) - 3);
  return (
    <ChartFrame className="flex flex-col items-center gap-3 p-4">
      <svg width={size} height={size}>
        {rows.map((d, i) => {
          const r = R - 6 - i * (band + 4) - band / 2;
          if (r <= 6) return null;
          const C = 2 * Math.PI * r;
          const frac = (d.value / max) * 0.75;
          return (
            <g key={d.label} transform={`rotate(135 ${R} ${R})`}>
              <circle cx={R} cy={R} r={r} fill="none" stroke="#f1f5f9" strokeWidth={band} strokeDasharray={`${C * 0.75} ${C}`} strokeLinecap="round" />
              <circle cx={R} cy={R} r={r} fill="none" stroke={d.hex} strokeWidth={band} strokeLinecap="round"
                      className="chart-ring cursor-pointer" data-tip={tipOf(d, total)} data-color={d.hex}
                      strokeDasharray={`${Math.max(0.5, C * frac)} ${C}`}
                      style={{ "--ring-from": C, animationDelay: `${i * 80}ms` }} />
            </g>
          );
        })}
      </svg>
      <Legend rows={rows} total={total} />
    </ChartFrame>
  );
}

/** Polar area (rose) — slice radius by value. */
function RoseChart({ data = [], size = 200 }) {
  const rows = withColors(data);
  const max = Math.max(1, ...rows.map((d) => d.value));
  const total = sum(rows);
  if (!rows.length) return <NoData />;
  const R = size / 2;
  return (
    <ChartFrame className="flex flex-col items-center gap-3 p-4">
      <svg width={size} height={size} className="chart-spin">
        {[0.33, 0.66, 1].map((f) => <circle key={f} cx={R} cy={R} r={(R - 4) * f} fill="none" stroke="#e2e8f0" strokeDasharray="3 3" />)}
        {rows.map((d, i) => {
          const a0 = (i / rows.length) * Math.PI * 2 - Math.PI / 2;
          const a1 = ((i + 1) / rows.length) * Math.PI * 2 - Math.PI / 2;
          const rad = 8 + Math.sqrt(d.value / max) * (R - 12);
          return (
            <path key={d.label} d={ringPath(R, R, rad, 0, a0 + 0.02, a1 - 0.02)} fill={d.hex} fillOpacity="0.85"
                  stroke="#fff" strokeWidth="1.5" data-tip={tipOf(d, total)} data-color={d.hex}
                  className="cursor-pointer transition-opacity hover:fill-opacity-100" />
          );
        })}
      </svg>
      <Legend rows={rows} total={total} />
    </ChartFrame>
  );
}

/** Radar / spider — needs three or more categories. */
function RadarChart({ data = [], size = 220 }) {
  const rows = withColors(data);
  const id = useUid("rd");
  const total = sum(rows);
  if (!rows.length) return <NoData />;
  if (rows.length < 3) return <NoData label="Radar needs at least 3 categories — try another chart." />;
  const R = size / 2, rr = R - 34;
  const max = Math.max(1, ...rows.map((d) => d.value));
  const ang = (i) => (i / rows.length) * Math.PI * 2 - Math.PI / 2;
  const pts = rows.map((d, i) => polar(R, R, (d.value / max) * rr, ang(i)));
  return (
    <ChartFrame className="flex justify-center p-3">
      <svg width={size} height={size} className="overflow-visible">
        <defs>
          <radialGradient id={id}><stop offset="0%" stopColor="#4f46e5" stopOpacity=".15" /><stop offset="100%" stopColor="#4f46e5" stopOpacity=".45" /></radialGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={rows.map((_, i) => polar(R, R, rr * f, ang(i)).join(",")).join(" ")} fill="none" stroke="#e2e8f0" />
        ))}
        {rows.map((_, i) => { const [x, y] = polar(R, R, rr, ang(i)); return <line key={i} x1={R} y1={R} x2={x} y2={y} stroke="#e2e8f0" />; })}
        <polygon className="chart-pop" points={pts.map((p) => p.join(",")).join(" ")} fill={`url(#${id})`} stroke="#4f46e5" strokeWidth="2.5" strokeLinejoin="round"
                 style={{ transformOrigin: `${R}px ${R}px` }} />
        {rows.map((d, i) => {
          const [x, y] = pts[i]; const [lx, ly] = polar(R, R, rr + 18, ang(i));
          return (
            <g key={d.label}>
              <circle cx={x} cy={y} r="5" fill={d.hex} stroke="#fff" strokeWidth="2" className="cursor-pointer" data-tip={tipOf(d, total)} data-color={d.hex} />
              <text x={lx} y={ly + 3} textAnchor="middle" fontSize="10" fill="#64748b">{String(d.label).slice(0, 12)}</text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

/** Single 100% stacked bar — composition at a glance. */
export function StackedBar({ data = [] }) {
  const rows = withColors(data).filter((d) => d.value > 0);
  const total = sum(rows);
  if (!total) return <NoData />;
  return (
    <ChartFrame className="p-4">
      <div className="mb-2 flex justify-between text-[11px] font-semibold text-slate-400"><span>0%</span><span>50%</span><span>100%</span></div>
      <div className="chart-grow-x flex h-11 w-full overflow-hidden rounded-xl shadow-inner ring-1 ring-slate-200/60">
        {rows.map((d) => (
          <div key={d.label} data-tip={tipOf(d, total)} data-color={d.hex}
               className="flex cursor-pointer items-center justify-center overflow-hidden text-[11px] font-bold text-white transition-[filter] hover:brightness-110"
               style={{ width: `${(d.value / total) * 100}%`, background: `linear-gradient(180deg, ${d.hex}, ${shade(d.hex, "c8")})` }}>
            {pctOf(d.value, total) >= 10 ? `${pctOf(d.value, total)}%` : ""}
          </div>
        ))}
      </div>
      <Legend rows={rows} total={total} className="mt-4" />
    </ChartFrame>
  );
}

/** Funnel — stages narrowing by value. */
function FunnelChart({ data = [] }) {
  const rows = withColors(data);
  const max = Math.max(1, ...rows.map((d) => d.value));
  const total = sum(rows);
  if (!rows.length) return <NoData />;
  return (
    <ChartFrame className="space-y-1.5 p-4">
      {rows.map((d, i) => {
        const w = Math.max(14, (d.value / max) * 100);
        return (
          <div key={d.label} className="flex justify-center">
            <div data-tip={tipOf(d, total)} data-color={d.hex}
                 className="chart-grow-x flex h-9 cursor-pointer items-center justify-between gap-2 rounded-lg px-3 text-[11.5px] font-semibold text-white shadow-sm transition-[filter] hover:brightness-110"
                 style={{ width: `${w}%`, minWidth: 120, background: `linear-gradient(90deg, ${d.hex}, ${shade(d.hex, "c0")})`,
                          clipPath: "polygon(0 0, 100% 0, 97% 100%, 3% 100%)", animationDelay: `${i * 70}ms`, transformOrigin: "center" }}>
              <span className="truncate">{d.label}</span>
              <span className="tabular-nums">{d.value}</span>
            </div>
          </div>
        );
      })}
    </ChartFrame>
  );
}

/** Treemap — area by value. */
function treemapLayout(items, x, y, w, h) {
  if (!items.length) return [];
  if (items.length === 1) return [{ ...items[0], x, y, w, h }];
  const total = sum(items);
  let acc = 0, k = 0;
  while (k < items.length - 1 && acc + items[k].value <= total / 2) { acc += items[k].value; k++; }
  if (k === 0) { acc = items[0].value; k = 1; }
  const f = total ? acc / total : 0.5;
  const a = items.slice(0, k), b = items.slice(k);
  return w >= h
    ? [...treemapLayout(a, x, y, w * f, h), ...treemapLayout(b, x + w * f, y, w * (1 - f), h)]
    : [...treemapLayout(a, x, y, w, h * f), ...treemapLayout(b, x, y + h * f, w, h * (1 - f))];
}
function TreemapChart({ data = [], height = 200 }) {
  const rows = withColors(data).filter((d) => d.value > 0).sort((p, q) => q.value - p.value);
  const total = sum(rows);
  if (!total) return <NoData />;
  const cells = treemapLayout(rows, 0, 0, 100, 100);
  return (
    <ChartFrame className="p-2">
      <div className="relative w-full" style={{ height: Math.max(170, height) }}>
        {cells.map((c, i) => (
          <div key={c.label} data-tip={tipOf(c, total)} data-color={c.hex}
               className="chart-pop absolute cursor-pointer p-0.5" style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%`, animationDelay: `${i * 50}ms` }}>
            <div className="flex h-full w-full flex-col justify-between overflow-hidden rounded-lg p-2 text-white transition-[filter] hover:brightness-110"
                 style={{ background: `linear-gradient(135deg, ${c.hex}, ${shade(c.hex, "c0")})` }}>
              <span className="truncate text-[11px] font-semibold opacity-90">{c.label}</span>
              <span className="text-[15px] font-extrabold leading-none tabular-nums">{c.value}<span className="ml-1 text-[10px] font-semibold opacity-80">{pctOf(c.value, total)}%</span></span>
            </div>
          </div>
        ))}
      </div>
    </ChartFrame>
  );
}

/** Waffle — 100 squares, one per percent. */
function WaffleChart({ data = [] }) {
  const rows = withColors(data).filter((d) => d.value > 0);
  const total = sum(rows);
  if (!total) return <NoData />;
  const raw = rows.map((d) => (d.value / total) * 100);
  const cnt = raw.map(Math.floor);
  let left = 100 - cnt.reduce((a, b) => a + b, 0);
  raw.map((v, i) => [v - Math.floor(v), i]).sort((p, q) => q[0] - p[0]).forEach(([, i]) => { if (left > 0) { cnt[i]++; left--; } });
  const cells = [];
  rows.forEach((d, i) => { for (let k = 0; k < cnt[i]; k++) cells.push(d); });
  return (
    <ChartFrame className="flex flex-col items-center gap-3 p-4">
      <div className="grid grid-cols-10 gap-1">
        {cells.map((d, i) => (
          <span key={i} data-tip={tipOf(d, total)} data-color={d.hex}
                className="chart-pop h-4 w-4 cursor-pointer rounded-[4px] transition-transform hover:scale-125"
                style={{ background: d.hex, animationDelay: `${i * 6}ms` }} />
        ))}
      </div>
      <Legend rows={rows} total={total} />
    </ChartFrame>
  );
}

/** Table with inline bars. */
function TableChart({ data = [] }) {
  const rows = withColors(data);
  const total = sum(rows);
  const max = Math.max(1, ...rows.map((d) => d.value));
  if (!rows.length) return <NoData />;
  return (
    <ChartFrame className="overflow-hidden">
      <table className="w-full text-[12.5px]">
        <tbody>
          {rows.map((d) => (
            <tr key={d.label} data-tip={tipOf(d, total)} data-color={d.hex} className="border-b border-slate-100 last:border-0 hover:bg-white">
              <td className="py-2 pl-3 pr-2"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.hex }} /><span className="truncate text-slate-700">{d.label}</span></span></td>
              <td className="w-[38%] py-2 pr-2"><div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="chart-grow-x h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: d.hex }} /></div></td>
              <td className="w-10 py-2 text-right font-bold tabular-nums text-slate-800">{d.value}</td>
              <td className="w-12 py-2 pr-3 text-right tabular-nums text-slate-400">{pctOf(d.value, total)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ChartFrame>
  );
}

/* =====================================================================
   SwitchableChart — one card, every view.
   ===================================================================== */
const I = (d) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const CHART_TYPES = {
  bar:      { label: "Column",     icon: I(<path d="M5 20V11M10 20V5M15 20v-6M20 20V8" />) },
  hbar:     { label: "Bar",        icon: I(<path d="M4 5h10M4 10h16M4 15h7M4 20h13" />) },
  lollipop: { label: "Lollipop",   icon: I(<><path d="M4 7h11M4 17h7" /><circle cx="17" cy="7" r="2.5" /><circle cx="13" cy="17" r="2.5" /></>) },
  line:     { label: "Line",       icon: I(<path d="M3 17l5-6 4 3 4-7 5 4" />) },
  area:     { label: "Area",       icon: I(<><path d="M3 17l5-6 4 3 4-7 5 4V20H3z" fill="currentColor" fillOpacity=".25" /></>) },
  donut:    { label: "Donut",      icon: I(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /><path d="M12 4v4.5" /></>) },
  pie:      { label: "Pie",        icon: I(<><circle cx="12" cy="12" r="8" /><path d="M12 4v8h8" /></>) },
  semi:     { label: "Half donut", icon: I(<path d="M4 17a8 8 0 0 1 16 0M8 17a4 4 0 0 1 8 0" />) },
  radial:   { label: "Rings",      icon: I(<><path d="M6.3 17.7A8 8 0 1 1 17.7 17.7" /><path d="M9.2 14.8A4 4 0 1 1 14.8 14.8" /></>) },
  rose:     { label: "Polar",      icon: I(<path d="M12 12V3a9 9 0 0 1 7 4zM12 12l7 2a7 7 0 0 1-6 5zM12 12l-4 6a6 6 0 0 1-3-5z" />) },
  radar:    { label: "Radar",      icon: I(<path d="M12 3l8 6-3 10H7L4 9z M12 8l4 3-1.5 4h-5L8 11z" />) },
  stacked:  { label: "Stacked",    icon: I(<><rect x="3" y="9" width="18" height="6" rx="2" /><path d="M9 9v6M15 9v6" /></>) },
  funnel:   { label: "Funnel",     icon: I(<path d="M3 5h18l-6 7v6l-6 2v-8z" />) },
  treemap:  { label: "Treemap",    icon: I(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16M12 13h9M16 13v7" /></>) },
  waffle:   { label: "Waffle",     icon: I(<path d="M5 5h3v3H5zM10.5 5h3v3h-3zM16 5h3v3h-3zM5 10.5h3v3H5zM10.5 10.5h3v3h-3zM16 10.5h3v3h-3zM5 16h3v3H5zM10.5 16h3v3h-3z" />) },
  table:    { label: "Table",      icon: I(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M10 4v16" /></>) },
};
const ALL_TYPES = Object.keys(CHART_TYPES);

function renderChart(type, data, height) {
  // Radar needs 3+ spokes; with less data fall back to a donut instead of an error.
  if (type === "radar" && (data || []).length < 3) type = "donut";
  switch (type) {
    case "hbar": return <HBarChart data={data} />;
    case "lollipop": return <LollipopChart data={data} />;
    case "line": return <LineLike data={data} height={height} />;
    case "area": return <LineLike data={data} height={height} area />;
    case "donut": return <PieChart data={data} donut />;
    case "pie": return <PieChart data={data} donut={false} />;
    case "semi": return <PieChart data={data} donut half size={220} />;
    case "radial": return <RadialChart data={data} />;
    case "rose": return <RoseChart data={data} />;
    case "radar": return <RadarChart data={data} />;
    case "stacked": return <StackedBar data={data} />;
    case "funnel": return <FunnelChart data={data} />;
    case "treemap": return <TreemapChart data={data} height={height} />;
    case "waffle": return <WaffleChart data={data} />;
    case "table": return <TableChart data={data} />;
    default: return <BarChart data={data} height={height} />;
  }
}

/**
 * `types` sets the order of the quick picks (its first entry is the default
 * view); every other chart type is still available under "More".
 * The chosen view is remembered per chart in this browser.
 */
export function SwitchableChart({ title, subtitle, data = [], types = ALL_TYPES, height = 200 }) {
  const preferred = types.filter((t) => CHART_TYPES[t]);
  const ordered = [...preferred, ...ALL_TYPES.filter((t) => !preferred.includes(t))];
  const key = `qcj.chart.v2.${title || "chart"}`;
  const [type, setTypeState] = useState(() => {
    try { const s = localStorage.getItem(key); if (s && CHART_TYPES[s]) return s; } catch { /* ignore */ }
    return ordered[0] || "bar";
  });
  const setType = (t) => { setTypeState(t); try { localStorage.setItem(key, t); } catch { /* ignore */ } };
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const quick = ordered.slice(0, 3).includes(type) ? ordered.slice(0, 3) : [...ordered.slice(0, 2), type];
  const total = sum(withColors(data));

  const rowsC = withColors(data);
  const top = rowsC.length ? rowsC.reduce((m, d) => (d.value > m.value ? d : m), rowsC[0]) : null;
  const accent = (top && top.value > 0 ? top.hex : rowsC[0]?.hex) || "#4f46e5";
  const second = rowsC.find((d) => d.hex !== accent)?.hex || "#8b5cf6";

  return (
    <div className="group/chart relative flex flex-col overflow-visible rounded-2xl border border-slate-200 bg-white
                    shadow-[0_1px_2px_rgba(15,23,42,.04)] transition-all duration-300 hover:-translate-y-0.5
                    hover:shadow-[0_22px_44px_-26px_rgba(15,23,42,.3)]"
         style={{ "--chart-accent": accent }}>
      {/* colour stripe from the chart's own palette */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl"
            style={{ background: `linear-gradient(90deg, transparent, ${accent}, ${second}, transparent)` }} />

      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
                style={{ background: `linear-gradient(135deg, ${accent}, ${second})`, boxShadow: `0 8px 18px -10px ${accent}` }}>
            {CHART_TYPES[type].icon}
          </span>
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 font-heading text-[15px] font-bold leading-tight text-slate-900">
              {title}
              {total > 0 && (
                <span className="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                      style={{ background: `${accent}14`, color: accent }}>Σ {total}</span>
              )}
            </h3>
            {subtitle && <p className="mt-0.5 text-[12px] text-slate-400">{subtitle}</p>}
          </div>
        </div>

        <div className="relative flex items-center gap-1" ref={boxRef}>
          <div className="flex rounded-xl bg-slate-100 p-0.5">
            {quick.map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} title={CHART_TYPES[t].label} aria-label={CHART_TYPES[t].label}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all focus:outline-none
                        ${type === t ? "bg-white shadow-sm" : "text-slate-400 hover:text-slate-700"}`}
                      style={type === t ? { color: accent } : undefined}>
                {CHART_TYPES[t].icon}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
                  className={`flex h-8 items-center gap-1 rounded-xl border px-2.5 text-[12px] font-semibold transition-colors focus:outline-none
                    ${open ? "border-navy bg-navy-50 text-navy" : "border-slate-200 bg-white text-slate-600 hover:border-navy-200 hover:text-navy"}`}>
            {CHART_TYPES[type].label}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform ${open ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
          </button>

          {open && (
            <div className="absolute right-0 top-full z-30 mt-2 w-[296px] rounded-2xl border border-slate-200 bg-white p-2.5 shadow-cardhover">
              <p className="px-1 pb-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Chart type</p>
              <div className="grid grid-cols-4 gap-1.5">
                {ordered.map((t) => (
                  <button key={t} type="button" onClick={() => { setType(t); setOpen(false); }}
                          className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10.5px] font-semibold transition-all focus:outline-none
                            ${t === type ? "bg-navy text-white shadow-md" : "text-slate-600 hover:bg-navy-50 hover:text-navy"}`}>
                    {CHART_TYPES[t].icon}
                    {CHART_TYPES[t].label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div key={type} className="chart-swap flex min-h-[236px] flex-1 flex-col justify-center px-5">{renderChart(type, data, height)}</div>

      {/* insight footer */}
      {top && total > 0 ? (
        <div className="mt-4 flex items-center gap-3 border-t border-slate-100 px-5 py-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `${top.hex}18`, color: top.hex }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8M15 7h6v6" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2 text-[12px]">
              <span className="truncate font-semibold text-slate-700">{top.label}</span>
              <span className="shrink-0 font-bold tabular-nums" style={{ color: top.hex }}>{pctOf(top.value, total)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="chart-grow-x h-full rounded-full" style={{ width: `${pctOf(top.value, total)}%`, background: `linear-gradient(90deg, ${top.hex}, ${shade(top.hex, "99")})` }} />
            </div>
          </div>
          <span title={`${rowsC.length} categories`} className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-500">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>
            {rowsC.length}
          </span>
        </div>
      ) : <div className="h-5" />}
    </div>
  );
}

/* =====================================================================
   Small single-purpose charts used elsewhere
   ===================================================================== */
export function Donut({ value, size = 120, stroke = 12, label }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={pct >= 75 ? "#4faa38" : pct >= 40 ? "#4f46e5" : "#f59e0b"}
                strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
                style={{ transition: "stroke-dashoffset .6s ease" }} />
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
  const pts = (key) => series.map((d, i) => [x(i), y(d[key])]);
  const area = `${smooth(pts("impressions"))} L${x(series.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="impFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={P.l} x2={W - P.r} y1={y(maxI * f)} y2={y(maxI * f)} stroke="#e2e8f0" strokeWidth="1" />
          <text x={P.l - 6} y={y(maxI * f) + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{Math.round(maxI * f)}</text>
        </g>
      ))}
      <path d={area} fill="url(#impFill)" />
      <path d={smooth(pts("impressions"))} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinejoin="round" />
      <path d={smooth(pts("clicks"))} fill="none" stroke="#4faa38" strokeWidth="2.5" strokeLinejoin="round" />
      {series.map((d, i) => (
        <g key={d.day}>
          <circle cx={x(i)} cy={y(d.impressions)} r="2.5" fill="#4f46e5" />
          <circle cx={x(i)} cy={y(d.clicks)} r="2.5" fill="#4faa38" />
          <title>{`${d.day}: ${d.impressions} views, ${d.clicks} clicks`}</title>
          {(i === 0 || i === series.length - 1 || i === Math.floor(series.length / 2)) && (
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{d.day.slice(5)}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** Tiny inline sparkline for table rows. */
export function Sparkline({ values = [], width = 70, height = 20, color = "#4f46e5" }) {
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

/** Wrapper for a dashboard's chart section — plain white background; the
    chart cards themselves carry the dark analytics styling. */
export function AnalyticsPanel({ children, className = "" }) {
  return <div className={`space-y-5 bg-white ${className}`}>{children}</div>;
}
