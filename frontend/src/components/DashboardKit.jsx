import { useEffect, useRef, useState } from "react";
import { IconSliders } from "./icons";

/* =====================================================================
   Shared dashboard / profile pieces for the recruiter and institute
   portals, so both look the same:

     useNow()            – a clock that ticks every minute
     timeOfDay(now)      – greeting + colours for morning / afternoon /
                           evening / night
     TimeOfDayIcon       – sun / sunset / moon
     useDashPrefs()      – which dashboard sections are shown (remembered
                           in this browser)
     CustomiseMenu       – the switch list that edits those prefs
     StatTile            – white number tile with a coloured top line
     ProfHead            – section heading with an icon tile
     ProfileStrength     – ring meter + "Add next" chips
     ProfileCover        – cover strip with the logo overlapping it
   ===================================================================== */

export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  return now;
}

/* 5-12 morning, 12-17 afternoon, 17-21 evening, 21-5 night. */
export function timeOfDay(now) {
  const h = new Date(now).getHours();
  const key = h >= 5 && h < 12 ? "morning" : h >= 12 && h < 17 ? "afternoon" : h >= 17 && h < 21 ? "evening" : "night";
  return {
    key,
    greet: { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Good night" }[key],
    tile: { morning: "bg-amber-50 text-amber-500", afternoon: "bg-orange-50 text-orange-500",
            evening: "bg-rose-50 text-rose-500", night: "bg-indigo-50 text-indigo-500" }[key],
    glow: { morning: "bg-amber-100/70", afternoon: "bg-orange-100/60",
            evening: "bg-rose-100/60", night: "bg-indigo-100/70" }[key],
    date: new Date(now).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }),
  };
}

export function TimeOfDayIcon({ period }) {
  const p = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
              strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (period === "night") {
    return <svg {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>;
  }
  if (period === "evening") {
    return <svg {...p}><path d="M17 18a5 5 0 0 0-10 0" /><path d="M12 9V2M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M23 22H1M16 5l-4 4-4-4" /></svg>;
  }
  return <svg {...p}><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
}

const STRIP_COLS = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5" };

/* Greeting card shell: icon, date, greeting, a line, actions, and a strip. */
export function GreetingHero({ name, line, actions, strip, badge }) {
  const now = useNow();
  const tod = timeOfDay(now);
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        <div className={`absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl ${tod.glow}`} />
      </div>
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tod.tile}`}>
            <TimeOfDayIcon period={tod.key} />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {tod.date} {badge}
            </p>
            <h2 className="mt-1 font-heading text-[26px] font-bold leading-tight text-slate-900">
              {tod.greet}{name ? <>, <span className="text-navy">{name}</span></> : ""}
            </h2>
            {line && <p className="mt-1 text-[13.5px] text-slate-500">{line}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {strip && strip.length > 0 && (
        <div className={`relative mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-100 bg-slate-100 ${STRIP_COLS[strip.length] || "sm:grid-cols-4"}`}>
          {strip.map(([l, v, dot]) => (
            <div key={l} className="bg-white px-4 py-3">
              <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-500">
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> {l}
              </p>
              <p className="mt-1 font-heading text-[20px] font-bold leading-none text-slate-900 tabular-nums">{v}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function useDashPrefs(storageKey, widgets) {
  const all = Object.fromEntries(widgets.map(([k]) => [k, true]));
  const [prefs, setPrefs] = useState(() => {
    try { return { ...all, ...JSON.parse(localStorage.getItem(storageKey) || "{}") }; }
    catch { return all; }
  });
  const save = (next) => { setPrefs(next); try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* private mode */ } };
  return [prefs, (k) => save({ ...prefs, [k]: !prefs[k] }), () => save(all)];
}

export function CustomiseMenu({ widgets, prefs, toggle, reset }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const on = (k) => prefs[k] !== false;
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((m) => !m)} aria-expanded={open} title="Choose what the dashboard shows"
              className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-2 text-[13px] font-semibold transition-colors
                ${open ? "border-navy bg-navy-50 text-navy" : "border-slate-200 bg-white text-slate-600 hover:border-navy-200 hover:text-navy"}`}>
        <IconSliders size={15} /> Customise
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-cardhover">
          <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Show on dashboard</p>
          {widgets.map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
              {label}
              <span className={`relative h-5 w-9 rounded-full transition-colors ${on(k) ? "bg-navy" : "bg-slate-200"}`}>
                <input type="checkbox" className="sr-only" checked={on(k)} onChange={() => toggle(k)} />
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on(k) ? "left-[18px]" : "left-0.5"}`} />
              </span>
            </label>
          ))}
          <button type="button" onClick={reset}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-left text-[12px] font-semibold text-navy hover:bg-navy-50">
            Show everything
          </button>
        </div>
      )}
    </div>
  );
}

export const TONES = {
  navy:   { ring: "bg-navy-50 text-navy",                 bar: "bg-navy",       from: "to-indigo-50/70",  text: "text-navy" },
  green:  { ring: "bg-brandgreen-50 text-brandgreen-600",  bar: "bg-brandgreen", from: "to-emerald-50/70", text: "text-brandgreen-600" },
  blue:   { ring: "bg-blue-50 text-blue-600",              bar: "bg-blue-500",   from: "to-sky-50/80",     text: "text-blue-600" },
  violet: { ring: "bg-violet-50 text-violet-600",          bar: "bg-violet-500", from: "to-violet-50/70",  text: "text-violet-600" },
  amber:  { ring: "bg-amber-50 text-amber-600",            bar: "bg-amber-400",  from: "to-amber-50/70",   text: "text-amber-600" },
};

export function StatTile({ label, value, tone = "navy", icon: Icon, hint }) {
  const t = TONES[tone] || TONES.navy;
  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white ${t.from} p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-22px_rgba(15,23,42,.35)]`}>
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] ${t.bar}`} />
      {Icon && (
        <span aria-hidden="true" className={`pointer-events-none absolute -bottom-4 -right-3 opacity-[0.07] transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6 ${t.text}`}>
          <Icon size={84} />
        </span>
      )}
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-semibold text-slate-500">{label}</span>
        {Icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.ring} shadow-sm`}>
            <Icon size={17} />
          </span>
        )}
      </div>
      <div className="relative mt-2 font-heading text-[28px] font-bold leading-none text-slate-900 tabular-nums">{value ?? 0}</div>
      {hint && <div className="relative mt-1.5 text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

export function ProfHead({ icon: Icon, title, action }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {Icon && <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy"><Icon size={15} /></span>}
        <h3 className="font-heading text-[15px] font-bold text-slate-900">{title}</h3>
      </div>
      {action}
    </div>
  );
}

/* checks: [[label, value], ...]; onAdd(label) is called by the chips. */
export function ProfileStrength({ checks, onAdd }) {
  const done = checks.filter(([, v]) => String(v ?? "").trim()).length;
  const pct = Math.round((done / checks.length) * 100);
  const missing = checks.filter(([, v]) => !String(v ?? "").trim()).map(([k]) => k);
  const R = 30, C = 2 * Math.PI * R;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-4">
        <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0 -rotate-90">
          <circle cx="38" cy="38" r={R} fill="none" stroke="#eef2ff" strokeWidth="8" />
          <circle cx="38" cy="38" r={R} fill="none" strokeWidth="8" strokeLinecap="round"
                  stroke={pct === 100 ? "#4faa38" : "#4f46e5"}
                  strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)}
                  style={{ transition: "stroke-dashoffset .8s ease" }} />
          <text x="38" y="38" textAnchor="middle" dominantBaseline="central" transform="rotate(90 38 38)"
                className="fill-slate-900 font-heading text-[16px] font-bold">{pct}%</text>
        </svg>
        <div>
          <p className="font-heading text-[15px] font-bold text-slate-900">Profile strength</p>
          <p className="text-[12px] leading-snug text-slate-500">
            {pct === 100 ? "Complete — everyone sees the full picture." : "A complete profile builds trust with employers."}
          </p>
        </div>
      </div>
      {missing.length > 0 && (
        <>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Add next</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missing.map((m) => (
              <button key={m} type="button" onClick={() => onAdd?.(m)}
                      className="rounded-full border border-dashed border-navy-200 px-2.5 py-1 text-[11.5px] font-semibold text-navy hover:bg-navy-50">
                + {m}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* Cover strip + logo overlapping it. Children render beside the logo,
   below the cover; `actions` sit on the right. */
export function ProfileCover({ logo, initial, children, actions }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div aria-hidden="true" className="relative h-24 overflow-hidden bg-gradient-to-r from-indigo-50 via-violet-50 to-emerald-50">
        <svg className="absolute inset-0 h-full w-full text-navy/[0.07]" aria-hidden="true">
          <defs>
            <pattern id="cover-dots" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.4" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cover-dots)" />
        </svg>
        <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-navy/10 blur-2xl" />
      </div>
      <div className="relative z-10 px-6 pb-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="-mt-12 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md">
            {logo
              ? <img src={logo} alt="" className="h-full w-full object-contain p-1.5" />
              : <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-navy to-violet-500 font-heading text-3xl font-bold text-white">
                  {(initial || "?")[0].toUpperCase()}
                </span>}
          </div>
          <div className="min-w-0 flex-1 pt-4">{children}</div>
          {actions && <div className="flex shrink-0 gap-2 pt-4">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
