import { SectorImage } from "./SectorIcon";
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
      <div className="relative mb-3">
        <IconSearch size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input !rounded-full !pl-10" value={q} onChange={(e) => setQ(e.target.value)}
               placeholder={sector ? "Search roles in this sector…" : "Search all 300+ roles…"} />
      </div>
      {/* Chips rather than a list: a role is a one-tap choice. */}
      <div className="flex max-h-60 flex-wrap gap-1.5 overflow-y-auto pr-1">
        {shown.slice(0, 120).map((r) => {
          const on = value === r;
          return (
            <button key={r} type="button" onClick={() => onChange(r)}
              className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-all ${
                on ? "border-navy bg-navy text-white shadow-md" : "border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-navy-200 hover:text-navy"}`}>
              {r}
            </button>
          );
        })}
        {shown.length === 0 && (
          <p className="w-full px-3 py-4 text-center text-sm text-slate-400">
            No match — you can type your own job title.
          </p>
        )}
      </div>
    </div>
  );
}

/* One soft colour per sector tile, cycling — keeps a 57-tile grid scannable. */
const TILE_TONES = [
  ["#eef2ff", "#4f46e5"], ["#ecfdf5", "#059669"], ["#fff7ed", "#ea580c"], ["#fdf2f8", "#db2777"],
  ["#f0f9ff", "#0284c7"], ["#f5f3ff", "#7c3aed"], ["#fefce8", "#ca8a04"], ["#f0fdfa", "#0d9488"],
  ["#fef2f2", "#dc2626"], ["#f7fee7", "#65a30d"],
];

/** Sector picker for a sidebar — searchable grid of colourful tiles. */
export function SectorList({ sectors = [], value, onChange, layout = "grid" }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const matches = query
    ? sectors.filter((s) => s.name.toLowerCase().includes(query) || s.roles.some((r) => r.toLowerCase().includes(query)))
    : sectors;
  // The chosen sector is pinned first so it never scrolls out of sight.
  const shown = value ? [...matches.filter((s) => s.key === value), ...matches.filter((s) => s.key !== value)] : matches;
  const toneOf = (key) => TILE_TONES[Math.max(0, sectors.findIndex((s) => s.key === key)) % TILE_TONES.length];

  if (layout === "compact") {
    return (
      <div>
        <div className="relative mb-3">
          <IconSearch size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input !rounded-full !py-2.5 !pl-10 !text-[13px]" value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Search sector or role…" />
          {q && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-navy-50 px-2 py-0.5 text-[10.5px] font-bold text-navy">{matches.length}</span>
          )}
        </div>
        {/* About two rows visible; the rest scroll inside the box. */}
        <div className="grid max-h-[232px] grid-cols-2 gap-2 overflow-y-auto p-0.5 pr-1 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((s) => {
            const active = value === s.key;
            const [bg] = toneOf(s.key);
            return (
              <button key={s.key} type="button" onClick={() => onChange(active ? null : s.key)} aria-pressed={active}
                className={`group flex items-center gap-2.5 rounded-xl border p-2 text-left transition-all
                  ${active ? "border-navy bg-navy-50 ring-2 ring-navy/15" : "border-slate-300 bg-white hover:border-slate-500"}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: bg }}>
                  <SectorImage name={s.icon} sector={s.key} size={28} animate={active} />
                </span>
                <span className="min-w-0">
                  <span className={`line-clamp-2 block text-[12px] font-semibold leading-tight ${active ? "text-navy" : "text-slate-700"}`}>{s.name}</span>
                  <span className="block text-[10.5px] text-slate-400">{s.roles.length} roles</span>
                </span>
              </button>
            );
          })}
          {shown.length === 0 && <p className="col-span-full px-2 py-6 text-center text-xs text-slate-400">No match.</p>}
        </div>
      </div>
    );
  }

  if (layout === "strip") {
    return (
      <div>
        <div className="relative mb-4 max-w-sm">
          <IconSearch size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input !rounded-full !bg-white !py-2.5 !pl-10 !text-[13px]" value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Search sector or role…" />
        </div>
        {/* Horizontal scroller of big cards — swipe on phones, wheel/drag on desktop. */}
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3 pt-2 [scrollbar-width:thin]">
          {shown.map((s) => {
            const active = value === s.key;
            const [bg, fg] = toneOf(s.key);
            return (
              <button key={s.key} type="button" onClick={() => onChange(active ? null : s.key)} aria-pressed={active}
                className={`group relative flex w-36 shrink-0 snap-start flex-col items-center gap-2 rounded-3xl px-3 pb-4 pt-5 text-center transition-all duration-300
                  ${active ? "-translate-y-1 text-white ring-2 ring-slate-800 shadow-[0_18px_34px_-16px_rgba(79,70,229,.9)]" : "bg-white ring-[1.5px] ring-slate-500 hover:-translate-y-1 hover:ring-slate-700 hover:shadow-[0_16px_30px_-18px_rgba(15,23,42,.45)]"}`}
                style={active ? { background: `linear-gradient(150deg, #4f46e5, ${fg})` } : undefined}>
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl"
                      style={active
                        ? { background: "rgba(255,255,255,.22)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.35)" }
                        : { background: `radial-gradient(circle at 30% 25%, #fff, ${bg})`, boxShadow: `inset 0 0 0 1px ${fg}1f` }}>
                  <SectorImage name={s.icon} sector={s.key} size={42} delay={(shown.indexOf(s) % 6) * 0.35} />
                </span>
                <span className={`text-[12.5px] font-semibold leading-tight ${active ? "text-white" : "text-slate-800"}`}>{s.name}</span>
                <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                      style={active ? { background: "rgba(255,255,255,.2)", color: "#fff" } : { background: bg, color: fg }}>
                  {s.roles.length} roles
                </span>
                {active && (
                  <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-navy">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                  </span>
                )}
              </button>
            );
          })}
          {shown.length === 0 && <p className="px-2 py-6 text-xs text-slate-400">No match.</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-3">
        <IconSearch size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input !rounded-full !py-2.5 !pl-10 !text-[13px]" value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="Search sector or role…" />
        {q && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-navy-50 px-2 py-0.5 text-[10.5px] font-bold text-navy">
            {matches.length}
          </span>
        )}
      </div>
      <div className="grid max-h-[460px] grid-cols-2 gap-2 overflow-y-auto pr-1">
        {shown.map((s) => {
          const active = value === s.key;
          const [bg, fg] = toneOf(s.key);
          return (
            <button key={s.key} type="button" onClick={() => onChange(active ? null : s.key)} aria-pressed={active}
              className={`group relative flex flex-col items-start gap-2 rounded-2xl p-3 text-left transition-all duration-200 ${
                active ? "col-span-2 ring-2 ring-slate-800 shadow-[0_12px_26px_-14px_rgba(79,70,229,.7)]" : "ring-[1.5px] ring-slate-500 hover:-translate-y-0.5 hover:ring-slate-700 hover:shadow-card"}`}
              style={{ background: active ? `linear-gradient(135deg, ${bg}, #fff)` : "#fff" }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: `radial-gradient(circle at 30% 25%, #fff, ${bg})`, boxShadow: `inset 0 0 0 1px ${fg}1f` }}>
                <SectorImage name={s.icon} sector={s.key} size={30} delay={(shown.indexOf(s) % 6) * 0.35} />
              </span>
              <span className="w-full min-w-0">
                <span className={`block text-[12.5px] font-semibold leading-tight ${active ? "text-navy" : "text-slate-800"}`}>{s.name}</span>
                <span className="mt-0.5 inline-block rounded-full px-1.5 py-px text-[10px] font-bold" style={{ background: bg, color: fg }}>
                  {s.roles.length} roles
                </span>
              </span>
              {active && (
                <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-navy text-white">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                </span>
              )}
            </button>
          );
        })}
        {shown.length === 0 && <p className="col-span-2 px-2 py-6 text-center text-xs text-slate-400">No match.</p>}
      </div>
    </div>
  );
}

export { GLYPH };
