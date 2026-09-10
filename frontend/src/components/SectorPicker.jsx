import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { IconSearch } from "./icons";

/* Simple glyphs per sector — no icon library needed. */
const GLYPH = {
  tools: "🔧", hardhat: "👷", home: "🏠", utensils: "🍽️", heart: "🏥", leaf: "🌾",
  store: "🏪", truck: "🚚", shield: "🛡️", factory: "🏭", code: "💻", briefcase: "💼",
  cap: "🎓", building: "🏛️", sparkle: "✨", bank: "🏦", signal: "📡", bolt: "⚡",
  car: "🚗", flask: "⚗️", cart: "🛒", camera: "🎬", scale: "⚖️", key: "🔑",
  plane: "✈️", ship: "🚢", pickaxe: "⛏️", thread: "🧵", package: "📦", run: "🏃",
  hands: "🤝", badge: "🚔", microscope: "🔬", paw: "🐾", recycle: "♻️", bell: "🔔",
};

export function useTaxonomy() {
  const [tax, setTax] = useState(null);
  useEffect(() => { api.get("/api/public/taxonomy", { auth: false }).then(setTax).catch(() => {}); }, []);
  return tax;
}

/** Grid of sectors — used for browsing jobs and for choosing a sector when posting. */
export function SectorGrid({ sectors = [], value, onChange, compact }) {
  return (
    <div className={`grid gap-2.5 ${compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"}`}>
      {sectors.map((s) => {
        const active = value === s.key;
        return (
          <button key={s.key} type="button" onClick={() => onChange(active ? null : s.key)}
            className={`rounded-xl border-2 p-3 text-left transition-all duration-150 hover:-translate-y-0.5 ${
              active ? "border-navy bg-navy-50 shadow-card" : "border-slate-200 bg-white hover:border-navy-200"}`}>
            <span className="text-xl">{GLYPH[s.icon] || "•"}</span>
            <p className={`mt-1.5 text-[12.5px] font-bold leading-tight ${active ? "text-navy" : "text-slate-700"}`}>
              {s.name}
            </p>
            {!compact && <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{s.blurb}</p>}
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {s.roles.length} roles
            </p>
          </button>
        );
      })}
    </div>
  );
}

/** Role picker scoped to a sector, with search. Falls back to all roles. */
export function RolePicker({ sectors = [], sector, value, onChange }) {
  const [q, setQ] = useState("");
  const pool = sector
    ? (sectors.find((s) => s.key === sector)?.roles || [])
    : sectors.flatMap((s) => s.roles);
  const shown = q ? pool.filter((r) => r.toLowerCase().includes(q.toLowerCase())) : pool;

  return (
    <div>
      <div className="relative mb-2">
        <input className="input pr-9" value={q} onChange={(e) => setQ(e.target.value)}
               placeholder={sector ? "Search roles in this sector…" : "Search all 300+ roles…"} />
        <IconSearch size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
        {shown.slice(0, 120).map((r) => (
          <button key={r} type="button" onClick={() => onChange(r)}
            className={`block w-full border-b border-slate-100 px-3 py-2 text-left text-[13px] last:border-0 hover:bg-navy-50 ${
              value === r ? "bg-navy-50 font-semibold text-navy" : "text-slate-700"}`}>
            {r}
          </button>
        ))}
        {shown.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-slate-400">
            No match — you can type your own job title.
          </p>
        )}
      </div>
    </div>
  );
}

/** Compact sector list for a sidebar — searchable, one row per sector. */
export function SectorList({ sectors = [], value, onChange }) {
  const [q, setQ] = useState("");
  const shown = q
    ? sectors.filter((s) =>
        s.name.toLowerCase().includes(q.toLowerCase()) ||
        s.roles.some((r) => r.toLowerCase().includes(q.toLowerCase())))
    : sectors;
  return (
    <div>
      <div className="relative mb-2">
        <input className="input pr-9 !py-2 !text-[13px]" value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="Search sector or role…" />
        <IconSearch size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
      <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
        {shown.map((s) => {
          const active = value === s.key;
          return (
            <button key={s.key} type="button" onClick={() => onChange(active ? null : s.key)}
              className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all ${
                active ? "border-navy bg-navy-50" : "border-transparent hover:border-slate-200 hover:bg-slate-50"}`}>
              <span className="text-base leading-none">{GLYPH[s.icon] || "•"}</span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[12.5px] font-semibold ${active ? "text-navy" : "text-slate-700"}`}>
                  {s.name}
                </span>
                <span className="block truncate text-[10.5px] text-slate-400">{s.roles.length} roles</span>
              </span>
            </button>
          );
        })}
        {shown.length === 0 && <p className="px-2 py-4 text-center text-xs text-slate-400">No match.</p>}
      </div>
    </div>
  );
}

export { GLYPH };
