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
