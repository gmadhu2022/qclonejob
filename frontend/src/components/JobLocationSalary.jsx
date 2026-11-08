import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { COUNTRIES, findCountry } from "../lib/countries";
import { CITIES } from "../lib/options";
import { CURRENCIES, currencyOf, salarySteps, formatMoney } from "../lib/currencies";
import Flag from "./Flag";
import { IconMapPin, IconSearch, IconChevronDown } from "./icons";

/* Close a popover on outside click / Escape. */
function useOutside(open, setOpen) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open, setOpen]);
  return ref;
}

/* Searchable picker used for country and currency. */
function PickList({ open, setOpen, button, items, render, onPick, placeholder, width = "w-72" }) {
  const ref = useOutside(open, setOpen);
  const [q, setQ] = useState("");
  const shown = q ? items.filter((it) => it.search.includes(q.toLowerCase())) : items;
  return (
    <div className="relative" ref={ref}>
      {button}
      {open && (
        <div className={`absolute left-0 top-full z-50 mt-1 ${width} overflow-hidden rounded-xl border border-slate-200 bg-white shadow-cardhover`}>
          <div className="border-b border-slate-100 p-2">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
                   onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (shown[0]) { onPick(shown[0]); setOpen(false); setQ(""); } } }}
                   className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm outline-none" />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1">
            {shown.slice(0, 300).map((it) => (
              <li key={it.key}>
                <button type="button" onClick={() => { onPick(it); setOpen(false); setQ(""); }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-navy-50">
                  {render(it)}
                </button>
              </li>
            ))}
            {!shown.length && <li className="px-3 py-4 text-center text-sm text-slate-400">No match.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   Location: country + any city / town / village in it.
   Indian cities from the local list appear instantly; everything else is
   looked up worldwide through /api/public/places (OpenStreetMap data).
   ===================================================================== */
export function JobLocationField({ country = "IN", location, onCountry, onLocation, invalid }) {
  const [cOpen, setCOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState([]);
  const [busy, setBusy] = useState(false);
  const boxRef = useOutside(open, setOpen);
  const c = findCountry(country) || findCountry("IN");

  const countryItems = useMemo(() => COUNTRIES.map((x) => ({
    key: x.iso, iso: x.iso, flag: x.flag, name: x.name, search: `${x.name} ${x.iso}`.toLowerCase(),
  })), []);

  // Debounced worldwide search.
  useEffect(() => {
    const term = q.trim();
    if (!open || term.length < 2) { setRemote([]); return; }
    let alive = true;
    setBusy(true);
    const t = setTimeout(() => {
      api.get(`/api/public/places?q=${encodeURIComponent(term)}&country=${country}`, { auth: false })
        .then((r) => alive && setRemote(r.places || []))
        .catch(() => alive && setRemote([]))
        .finally(() => alive && setBusy(false));
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q, country, open]);

  const local = country === "IN" && q.trim()
    ? CITIES.filter((x) => x.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : [];
  const seen = new Set(local.map((x) => x.toLowerCase()));
  const results = [
    ...local.map((x) => ({ label: x, type: "city" })),
    ...remote.filter((p) => !seen.has(p.name.toLowerCase())),
  ];
  const pick = (label) => { onLocation(label); setQ(""); setOpen(false); };

  return (
    <div className="grid gap-2 sm:grid-cols-[170px_minmax(0,1fr)]">
      {/* country */}
      <PickList open={cOpen} setOpen={setCOpen} items={countryItems} placeholder="Search country…"
                onPick={(it) => { onCountry(it.iso); onLocation(""); }}
                render={(it) => (<><Flag iso={it.iso} emoji={it.flag} size={20} /><span className="truncate">{it.name}</span></>)}
                button={(
                  <button type="button" onClick={() => setCOpen((o) => !o)}
                          className="flex h-full w-full items-center gap-2 rounded-2xl border-[1.5px] border-indigo-100 bg-[#f6f7ff] px-3 py-2.5 text-left text-[13.5px] font-semibold text-slate-700 hover:border-indigo-200">
                    <Flag iso={c.iso} emoji={c.flag} size={20} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <IconChevronDown size={14} className="text-slate-400" />
                  </button>
                )} />

      {/* place */}
      <div className="relative" ref={boxRef}>
        <div className={`flex items-center gap-2 rounded-2xl border-[1.5px] px-3 transition-colors
          ${invalid ? "border-red-400 bg-red-50/50" : open ? "border-navy bg-white ring-4 ring-navy/10" : "border-indigo-100 bg-[#f6f7ff] hover:border-indigo-200"}`}>
          <IconMapPin size={16} className={invalid ? "text-red-500" : "text-navy"} />
          <input value={open ? q : (location || "")} placeholder={location || `City, town or village in ${c.name}`}
                 onFocus={() => { setOpen(true); setQ(""); }}
                 onChange={(e) => { setQ(e.target.value); onLocation(e.target.value); }}
                 className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400" />
          {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-navy/30 border-t-navy" />}
        </div>
        {open && q.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-cardhover">
            {results.map((p) => (
              <button key={p.label} type="button" onClick={() => pick(p.label)}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-slate-700 hover:bg-navy-50">
                <IconMapPin size={13} className="shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate">{p.label}</span>
                <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-slate-500">{p.type}</span>
              </button>
            ))}
            {!busy && !results.length && (
              <p className="px-3.5 py-3 text-[12.5px] text-slate-400">No match in {c.name} — your typed place will be used.</p>
            )}
            {busy && !results.length && <p className="px-3.5 py-3 text-[12.5px] text-slate-400">Searching places…</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/* =====================================================================
   Salary: currency + pay period + min / max (Naukri-style ladders).
   ===================================================================== */
const PERIODS = [["monthly", "per month"], ["annual", "per year"], ["daily", "per day"],
                 ["hourly", "per hour"], ["contract", "per contract"], ["piece_rate", "per piece"]];

export function SalaryRangeField({ currency = "INR", basis = "monthly", min, max, onCurrency, onBasis, onMin, onMax }) {
  const [open, setOpen] = useState(false);
  const cur = currencyOf(currency);
  const steps = useMemo(() => salarySteps(currency), [currency]);
  const items = useMemo(() => CURRENCIES.map((x) => ({
    key: x.code, ...x, search: `${x.code} ${x.name} ${x.symbol}`.toLowerCase(),
  })), []);
  const selectCls = "w-full appearance-none rounded-2xl border-[1.5px] border-indigo-100 bg-[#f6f7ff] px-3.5 py-2.5 text-sm text-slate-800 outline-none hover:border-indigo-200 focus:border-navy focus:bg-white focus:ring-4 focus:ring-navy/10";
  const minNum = Number(min) || 0;

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-[150px_140px_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
        <PickList open={open} setOpen={setOpen} items={items} placeholder="Search currency…" width="w-80"
                  onPick={(it) => { onCurrency(it.code); onMin(""); onMax(""); }}
                  render={(it) => (<>
                    <span className="w-10 shrink-0 font-semibold text-slate-800">{it.code}</span>
                    <span className="min-w-0 flex-1 truncate">{it.name}</span>
                    <span className="shrink-0 text-slate-400">{it.symbol}</span>
                  </>)}
                  button={(
                    <button type="button" onClick={() => setOpen((o) => !o)}
                            className="flex w-full items-center gap-2 rounded-2xl border-[1.5px] border-indigo-100 bg-[#f6f7ff] px-3 py-2.5 text-left text-[13.5px] font-semibold text-slate-700 hover:border-indigo-200">
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-white px-1 text-[12px] font-bold text-brandgreen-600 shadow-sm">{cur.symbol}</span>
                      <span className="flex-1">{cur.code}</span>
                      <IconChevronDown size={14} className="text-slate-400" />
                    </button>
                  )} />
        <select className={selectCls} value={basis || "monthly"} onChange={(e) => onBasis(e.target.value)} aria-label="Pay period">
          {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className={selectCls} value={min ?? ""} onChange={(e) => {
          onMin(e.target.value);
          if (max !== "" && max != null && Number(max) < Number(e.target.value)) onMax("");
        }} aria-label="Minimum salary">
          <option value="">Minimum</option>
          {steps.map((v) => <option key={v} value={v}>{formatMoney(v, currency)}</option>)}
        </select>
        <span className="hidden text-center text-sm text-slate-400 sm:block">to</span>
        <select className={selectCls} value={max ?? ""} onChange={(e) => onMax(e.target.value)} aria-label="Maximum salary">
          <option value="">Maximum</option>
          {/* Only amounts at or above the minimum, so an impossible range can't be chosen. */}
          {steps.filter((v) => v >= minNum && v > 0).map((v) => <option key={v} value={v}>{formatMoney(v, currency)}</option>)}
        </select>
      </div>
      <p className="mt-1.5 text-xs text-slate-400">
        {min || max
          ? <>Shown to candidates as <b className="text-slate-600">{[min, max].filter((x) => x !== "" && x != null).map((x) => formatMoney(x, currency)).join(" – ")} {PERIODS.find(([k]) => k === (basis || "monthly"))?.[1]}</b></>
          : `Up to ${currency === "INR" ? "₹20 Cr" : formatMoney(1000000, currency)} — choose any currency.`}
      </p>
    </div>
  );
}
