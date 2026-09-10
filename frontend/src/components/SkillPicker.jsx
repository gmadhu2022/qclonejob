import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../lib/api";
import { IconSearch, IconSparkle } from "./icons";
import { useToast } from "./ui";

/**
 * Skill selector backed by the server's 1,000+ skill library.
 *
 * - Scopes to a sector when one is chosen, so a hospital recruiter isn't
 *   scrolling past Kubernetes.
 * - Type-ahead hits the API, with prefix matches ranked first.
 * - Accepts comma-separated input: typing "welding, fitting, safety" adds three.
 * - Free text is always allowed — the library is a shortcut, not a restriction.
 */
export default function SkillPicker({ label = "Key skills", values = [], onChange,
                                      sector, aiSuggestPath, aiBody, hint }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [pool, setPool] = useState([]);
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const ref = useRef(null);

  const fetchSkills = useCallback((q) => {
    const p = new URLSearchParams();
    if (sector) p.set("sector", sector);
    if (q) p.set("q", q);
    p.set("limit", "60");
    setLoading(true);
    api.get(`/api/public/skills?${p}`, { auth: false })
      .then((d) => { setPool(d.skills || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sector]);

  useEffect(() => { fetchSkills(""); }, [fetchSkills]);
  useEffect(() => {
    const t = setTimeout(() => fetchSkills(query), 180);   // debounce typing
    return () => clearTimeout(t);
  }, [query, fetchSkills]);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const addMany = (raw) => {
    const parts = String(raw).split(",").map((x) => x.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...values];
    for (const p of parts) {
      if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    onChange?.(next);
    setQuery("");
  };
  const remove = (v) => onChange?.(values.filter((x) => x !== v));

  const askAI = async () => {
    if (!aiSuggestPath) return;
    setAiBusy(true);
    try {
      const r = await api.post(aiSuggestPath, aiBody || {});
      const list = r.skills || r.options || r.suggested_skills || [];
      if (!list.length) return toast("No suggestions returned.", "error");
      setPool([...new Set([...list, ...pool])]);
      setOpen(true);
    } catch (err) { toast(err.message, "error"); }
    finally { setAiBusy(false); }
  };

  const shown = pool.filter((s) => !values.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="label !mb-0">{label}</label>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400">
            {total.toLocaleString()} skills{sector ? " in this industry" : " across all industries"}
          </span>
          {aiSuggestPath && (
            <button type="button" onClick={askAI} disabled={aiBusy}
                    className="flex items-center gap-1 text-xs font-semibold text-navy hover:underline disabled:opacity-50">
              <IconSparkle size={13} /> {aiBusy ? "Thinking…" : "Suggest with AI"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-xl border border-slate-300 bg-white p-2
                      transition-shadow focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/15">
        {values.map((v) => (
          <span key={v} className="group flex items-center gap-1 rounded-lg bg-navy-50 px-2 py-1 text-xs font-medium text-navy
                                   transition-colors hover:bg-navy hover:text-white">
            {v}
            <button type="button" onClick={() => remove(v)}
                    className="opacity-60 transition-opacity group-hover:opacity-100">×</button>
          </span>
        ))}
        <input
          className="min-w-[160px] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder-slate-400"
          value={query}
          placeholder={values.length ? "Add more…" : "Type a skill, or paste comma-separated skills"}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const v = e.target.value;
            // Typing a comma commits what came before it.
            if (v.includes(",")) { addMany(v); } else { setQuery(v); setOpen(true); }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addMany(query); }
            if (e.key === "Backspace" && !query && values.length) remove(values[values.length - 1]);
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (text.includes(",")) { e.preventDefault(); addMany(text); }
          }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {hint || "Type to search, press Enter to add, or paste a comma-separated list."}
      </p>

      {open && shown.length > 0 && (
        <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-cardhover">
          {loading && <p className="px-3.5 py-2 text-xs text-slate-400">Searching…</p>}
          {shown.map((s) => (
            <button key={s} type="button" onClick={() => addMany(s)}
                    className="flex w-full items-center justify-between px-3.5 py-2 text-left text-sm text-slate-700
                               transition-colors hover:bg-navy-50 hover:text-navy">
              {s}
              <span className="text-[10px] font-bold text-slate-300">+ add</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
