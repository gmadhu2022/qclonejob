import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "./ui";
import { IconSearch, IconCheck, IconSparkle } from "./icons";

/* ---------------- Floating-label input ---------------- */
export function Field({ label, value, onChange, type = "text", required, hint, error, ...rest }) {
  const [focus, setFocus] = useState(false);
  const filled = value !== undefined && value !== null && String(value).length > 0;
  return (
    <div>
      <div className="relative">
        <input
          {...rest}
          type={type}
          value={value ?? ""}
          required={required}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder=" "
          className={`peer w-full rounded-xl border bg-white px-3.5 pb-2 pt-6 text-sm text-slate-800
            transition-shadow focus:outline-none
            ${error ? "border-red-400 focus:ring-2 focus:ring-red-500/15"
                    : "border-slate-300 focus:border-navy focus:ring-2 focus:ring-navy/15"}`}
        />
        <label className={`pointer-events-none absolute left-3.5 transition-all duration-150
          ${focus || filled ? "top-1.5 text-[11px] font-semibold" : "top-1/2 -translate-y-1/2 text-sm"}
          ${error ? "text-red-500" : focus ? "text-navy" : "text-slate-400"}`}>
          {label}{required && <span className="text-red-400"> *</span>}
        </label>
      </div>
      {(hint || error) && (
        <p className={`mt-1 text-xs ${error ? "text-red-500" : "text-slate-400"}`}>{error || hint}</p>
      )}
    </div>
  );
}

/* ---------------- Searchable combobox ----------------
   Type to filter; allows free text; optional AI suggestions. */
export function Combobox({ label, value, onChange, options = [], placeholder = "Type to search…",
                          allowCustom = true, aiField, aiContext, required, hint }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [extra, setExtra] = useState([]);      // AI-suggested options
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const all = [...new Set([...options, ...extra])];
  const filtered = query
    ? all.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : all;

  const askAI = async () => {
    setLoading(true);
    try {
      const r = await api.post("/api/ai/suggest", { field: aiField, context: aiContext || "" });
      setExtra(r.options || []);
      if (!r.options?.length) toast("No extra suggestions.", "error");
    } catch (err) { toast(err.message, "error"); }
    finally { setLoading(false); }
  };

  const pick = (v) => { onChange?.(v); setQuery(""); setOpen(false); };

  return (
    <div ref={ref} className="relative">
      <label className="label">{label}{required && <span className="text-red-400"> *</span>}</label>
      <div className="relative">
        <input
          className="input pr-9"
          value={open ? query : (value || "")}
          placeholder={value || placeholder}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onChange={(e) => { setQuery(e.target.value); if (allowCustom) onChange?.(e.target.value); }}
        />
        <IconSearch size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}

      {open && (
        <div className="absolute z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-cardhover">
          {filtered.map((o) => (
            <button key={o} type="button" onClick={() => pick(o)}
              className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-navy-50 hover:text-navy">
              {o}{value === o && <IconCheck size={14} />}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3.5 py-3 text-sm text-slate-400">
              {allowCustom ? "No match — your typed value will be used." : "No matches."}
            </p>
          )}
          {aiField && (
            <button type="button" onClick={askAI} disabled={loading}
              className="mt-1 flex w-full items-center gap-2 border-t border-slate-100 px-3.5 py-2 text-left text-sm font-medium text-navy hover:bg-navy-50">
              <IconSparkle size={14} /> {loading ? "Thinking…" : "Suggest with AI"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Multi-select tag input ---------------- */
export function TagInput({ label, values = [], onChange, options = [], placeholder = "Type and press Enter",
                          aiSuggestPath, aiBody, hint }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggested, setSuggested] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const add = (v) => {
    const t = (v || "").trim();
    if (!t) return;
    if (!values.some((x) => x.toLowerCase() === t.toLowerCase())) onChange?.([...values, t]);
    setQuery("");
  };
  const remove = (v) => onChange?.(values.filter((x) => x !== v));

  const pool = [...new Set([...options, ...suggested])]
    .filter((o) => !values.some((v) => v.toLowerCase() === o.toLowerCase()))
    .filter((o) => !query || o.toLowerCase().includes(query.toLowerCase()));

  const askAI = async () => {
    if (!aiSuggestPath) return;
    setLoading(true);
    try {
      const r = await api.post(aiSuggestPath, aiBody || {});
      const list = r.skills || r.options || [];
      setSuggested(list);
      setOpen(true);
      if (!list.length) toast("No suggestions returned.", "error");
    } catch (err) { toast(err.message, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center justify-between">
        <label className="label">{label}</label>
        {aiSuggestPath && (
          <button type="button" onClick={askAI} disabled={loading}
            className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-navy hover:underline disabled:opacity-50">
            <IconSparkle size={13} /> {loading ? "Thinking…" : "Suggest with AI"}
          </button>
        )}
      </div>

      <div className="flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-xl border border-slate-300 bg-white p-2 focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/15">
        {values.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded-lg bg-navy-50 px-2 py-1 text-xs font-medium text-navy">
            {v}
            <button type="button" onClick={() => remove(v)} className="text-navy/60 hover:text-navy">×</button>
          </span>
        ))}
        <input
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder-slate-400"
          value={query} placeholder={values.length ? "" : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(query); }
            if (e.key === "Backspace" && !query && values.length) remove(values[values.length - 1]);
          }}
        />
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}

      {open && pool.length > 0 && (
        <div className="absolute z-40 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-cardhover">
          {suggested.length > 0 && (
            <p className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brandgreen-600">AI suggestions</p>
          )}
          {pool.map((o) => (
            <button key={o} type="button" onClick={() => add(o)}
              className="block w-full px-3.5 py-2 text-left text-sm text-slate-700 hover:bg-navy-50 hover:text-navy">
              + {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
