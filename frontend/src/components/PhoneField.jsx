import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, findCountry, DEFAULT_ISO } from "../lib/countries";
import Flag from "./Flag";
import { RegLabel, RegError } from "./RegField";
import { IconPhone } from "./icons";

/**
 * Phone input: searchable country picker (flag + dial code) beside a field
 * that accepts digits only.
 *
 * The value is stored as a single E.164-ish string, "+91 9876543210", so
 * nothing on the backend has to change — Institute.phone, Enterprise.phone and
 * the OTP endpoints all keep taking one string.
 *
 * Digits are capped at the selected country's real national number length
 * (India 10, US 10, UK 10, UAE 9 …) rather than a blanket 15, so a typo that
 * adds an extra digit is refused at the point of typing.
 */
export default function PhoneField({
  label = "Contact Number",
  value = "",
  onChange,
  required,
  hint,
  placeholder,
  error,
  variant,
}) {
  const reg = variant === "reg";
  const [touched, setTouched] = useState(false);
  const [focus, setFocus] = useState(false);
  // Like the other registration fields: show "required" once Submit is pressed.
  const rootRef = useRef(null);
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!reg || !form) return;
    const on = () => setTouched(true);
    form.addEventListener("submit", on, true);
    return () => form.removeEventListener("submit", on, true);
  }, [reg]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef(null);

  // Split the stored "+91 98765..." back into country + national digits
  const parsed = useMemo(() => splitPhone(value), [value]);
  const country = findCountry(parsed.iso) || findCountry(DEFAULT_ISO);
  const digits = parsed.national;

  const emit = (iso, nat) => {
    const c = findCountry(iso) || country;
    const clean = String(nat || "").replace(/\D/g, "").slice(0, c.length);
    onChange?.(clean ? `${c.dial} ${clean}` : "");
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return COUNTRIES;
    return COUNTRIES.filter((c) =>
      c.name.toLowerCase().includes(s) || c.dial.includes(s) || c.iso.toLowerCase() === s);
  }, [q]);

  const short = digits.length > 0 && digits.length < country.length;
  const regError = reg && touched
    ? (required && !digits ? `${label} is required`
       : short ? `${country.name} numbers are ${country.length} digits — ${country.length - digits.length} more to go`
       : null)
    : null;

  return (
    <div ref={rootRef}>
      {reg ? <RegLabel label={label} required={required} /> : label && (
        <label className="label">
          {label}{required && <span className="text-red-500"> *</span>}
        </label>
      )}

      {/* No overflow-hidden here. The country dropdown is absolutely positioned
          inside this row, and clipping the row clipped the dropdown to ~44px —
          which is why the country list appeared blank. Corners are rounded on
          the child elements instead. */}
      <div className={reg
        ? `flex items-stretch rounded-2xl border-[1.5px] transition-colors
           ${regError ? "border-red-400 bg-red-50/50"
             : focus ? "border-navy bg-white ring-4 ring-navy/10"
             : touched && digits.length === country.length ? "border-brandgreen-400 bg-white"
             : "border-indigo-100 bg-[#f6f7ff] hover:border-indigo-200"}`
        : `flex items-stretch rounded-xl border bg-white transition-colors
        ${error || short ? "border-red-300" : "border-slate-200 focus-within:border-navy"}`}>
        {reg && (
          <span className={`my-1.5 ml-1.5 flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-lg border-[1.5px] bg-white
                            ${regError ? "border-red-300 text-red-500" : "border-indigo-100 text-navy"}`}>
            <IconPhone size={15} />
          </span>
        )}

        {/* ---- country picker ---- */}
        <div className="relative" ref={boxRef}>
          <button type="button" onClick={() => { setOpen((o) => !o); setQ(""); }}
                  className={reg
                    ? "flex h-full items-center gap-1.5 border-r border-indigo-100 px-2.5 text-sm font-semibold text-slate-700"
                    : `flex h-full items-center gap-1.5 rounded-l-xl border-r border-slate-200 bg-slate-50/70 px-3
                             text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100`}>
            <Flag iso={country.iso} emoji={country.flag} size={22} />
            <span className="tabular-nums">{country.dial}</span>
            <span className={`text-[9px] text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
          </button>

          {open && (
            <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-cardhover">
              <div className="border-b border-slate-100 p-2">
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                       placeholder="Search country or code…"
                       /* This input sits inside the registration <form>, so a
                          bare Enter would submit the whole form. Enter picks the
                          first match instead. */
                       onKeyDown={(e) => {
                         if (e.key !== "Enter") return;
                         e.preventDefault();
                         if (results[0]) { emit(results[0].iso, digits); setOpen(false); }
                       }}
                       className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm outline-none" />
              </div>
              <ul className="max-h-64 overflow-y-auto py-1">
                {results.map((c) => (
                  <li key={c.iso}>
                    <button type="button"
                            onClick={() => { emit(c.iso, digits); setOpen(false); }}
                            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors
                              ${c.iso === country.iso ? "bg-navy-50 font-semibold text-navy" : "text-slate-600 hover:bg-slate-50"}`}>
                      <Flag iso={c.iso} emoji={c.flag} size={20} />
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="shrink-0 tabular-nums text-slate-400">{c.dial}</span>
                    </button>
                  </li>
                ))}
                {!results.length && (
                  <li className="px-3 py-4 text-center text-sm text-slate-400">No country matches that.</li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* ---- number ---- */}
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={digits}
          placeholder={placeholder || "#".repeat(country.length)}
          /* Strip on change AND block non-digit keys, so a pasted "+91-98 76"
             is cleaned rather than rejected, and typing a letter does nothing. */
          onKeyDown={(e) => {
            if (e.key.length === 1 && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
          }}
          onChange={(e) => emit(country.iso, e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => { setFocus(false); setTouched(true); }}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm tabular-nums outline-none"
        />

        <span className={`self-center pr-3 text-[11px] tabular-nums
          ${digits.length === country.length ? "text-brandgreen-600" : "text-slate-300"}`}>
          {digits.length}/{country.length}
        </span>
      </div>

      {reg && <RegError error={regError} hint={hint} />}
      {!reg && short && (
        <p className="mt-1 text-xs text-red-500">
          {country.name} numbers are {country.length} digits — {country.length - digits.length} more to go.
        </p>
      )}
      {!reg && hint && !short && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/** "+91 9876543210" -> { iso: "IN", national: "9876543210" } */
export function splitPhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return { iso: DEFAULT_ISO, national: "" };
  if (!raw.startsWith("+")) return { iso: DEFAULT_ISO, national: raw.replace(/\D/g, "") };
  const digitsOnly = raw.replace(/[^\d]/g, "");
  // longest dial code first, so +1 doesn't swallow +1242
  const match = [...COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => digitsOnly.startsWith(c.dial.replace("+", "")));
  if (!match) return { iso: DEFAULT_ISO, national: digitsOnly };
  return { iso: match.iso, national: digitsOnly.slice(match.dial.length - 1) };
}
