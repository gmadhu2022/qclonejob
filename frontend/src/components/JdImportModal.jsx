import { useEffect, useState } from "react";
import { apiUrl, getToken } from "../lib/api";
import { formatMoney } from "../lib/currencies";
import FileDrop from "./FileDrop";
import { IconSparkle, IconCheck, IconClose, IconDoc } from "./icons";

/* =====================================================================
   "Auto-fill from a document" — a separate popup, not part of the form.

   1. Upload a PDF / Word / Excel / CSV / text file, or paste the text.
   2. The server reads it (AI when switched on, rule-based otherwise).
   3. Every field found is listed by section with a tick; the recruiter can
      untick or edit anything, then Apply fills the form for a final review.
   ===================================================================== */
const SECTIONS = [
  ["Role basics", [["title", "Job title"], ["job_code", "Job code"], ["location", "Location"],
                   ["no_of_positions", "No. of positions"], ["category", "Qualification"]]],
  ["Requirements & pay", [["job_type", "Job type"], ["experience", "Experience"], ["shift", "Shift"],
                          ["salary", "Salary"], ["key_skills", "Skills"], ["perks", "Perks"]]],
  ["Description", [["requirement_technical", "Technical requirement"], ["description", "Job description"]]],
  ["Contact", [["recruiter_name", "Recruiter name"], ["recruiter_phone", "Recruiter phone"], ["recruiter_email", "Recruiter email"]]],
];
const ACCEPT = ".pdf,.docx,.txt,.md,.csv,.xlsx,.xls";
const BASIS = { monthly: "per month", annual: "per year", daily: "per day", hourly: "per hour" };

export default function JdImportModal({ open, onClose, onApply }) {
  const [mode, setMode] = useState("file");          // file | paste
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [step, setStep] = useState("pick");          // pick | reading | review
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [vals, setVals] = useState({});
  const [use, setUse] = useState({});

  useEffect(() => {
    if (!open) return;
    setStep("pick"); setError(""); setResult(null); setFile(null); setText("");
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open, onClose]);

  if (!open) return null;

  const read = async () => {
    setError(""); setStep("reading");
    try {
      const fd = new FormData();
      if (mode === "file" && file) fd.append("file", file);
      else fd.append("text", text);
      const res = await fetch(apiUrl("/api/ai/job/import"), {
        method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Couldn't read that document.");
      const f = data.fields || {};
      const salary = f.wage_min || f.wage_max
        ? `${[f.wage_min, f.wage_max].filter(Boolean).map((v) => formatMoney(v, f.salary_currency || "INR")).join(" – ")} ${BASIS[f.wage_basis] || ""}`.trim()
        : (f.salary || f.salary_raw || "");
      const perks = [f.is_urgent && "Urgent hiring", f.accommodation && "Accommodation", f.food_provided && "Food provided"].filter(Boolean).join(", ");
      const v = { ...f, salary, perks, key_skills: Array.isArray(f.key_skills) ? f.key_skills : (f.key_skills ? String(f.key_skills).split(/[,;]/).map((x) => x.trim()).filter(Boolean) : []) };
      const u = {};
      SECTIONS.forEach(([, items]) => items.forEach(([k]) => { u[k] = has(v[k]); }));
      setResult(data); setVals(v); setUse(u); setStep("review");
    } catch (e) {
      setError(e.message); setStep("pick");
    }
  };

  const has = (x) => (Array.isArray(x) ? x.length > 0 : x !== null && x !== undefined && String(x).trim() !== "" && x !== false);
  const found = Object.keys(use).filter((k) => has(vals[k])).length;
  const chosen = Object.keys(use).filter((k) => use[k] && has(vals[k])).length;

  const apply = () => {
    const f = result?.fields || {};
    const out = {};
    const keep = (k) => use[k] && has(vals[k]);
    ["title", "job_code", "location", "category", "job_type", "experience", "shift",
     "requirement_technical", "description", "recruiter_name", "recruiter_phone", "recruiter_email"].forEach((k) => {
      if (keep(k)) out[k] = String(vals[k]);
    });
    if (keep("no_of_positions")) out.no_of_positions = String(vals.no_of_positions).replace(/\D/g, "");
    if (keep("key_skills")) out.key_skills = vals.key_skills;
    if (keep("salary")) {
      if (f.wage_min) out.wage_min = f.wage_min;
      if (f.wage_max) out.wage_max = f.wage_max;
      if (f.salary_currency) out.salary_currency = f.salary_currency;
      if (f.wage_basis) out.wage_basis = f.wage_basis;
    }
    if (keep("perks")) {
      if (f.is_urgent) out.is_urgent = true;
      if (f.accommodation) out.accommodation = true;
      if (f.food_provided) out.food_provided = true;
    }
    onApply(out, chosen);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && step !== "reading" && onClose()}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Auto-fill from a document">
        {/* header */}
        <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy to-violet-500 text-white"><IconSparkle size={18} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="font-heading text-[17px] font-bold text-slate-900">Auto-fill from a document</h3>
            <p className="text-[12.5px] text-slate-500">
              {step === "review" ? "Check what was found — untick or edit anything — then apply it to the form."
                : "Upload or paste a job description. Every section of the form is filled in for you to review."}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={step === "reading"} aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"><IconClose size={16} /></button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "pick" && (
            <>
              <div className="mb-4 inline-flex rounded-full bg-slate-100 p-1 text-[13px] font-semibold">
                {[["file", "Upload a file"], ["paste", "Paste text"]].map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setMode(k)}
                          className={`rounded-full px-4 py-1.5 transition-all ${mode === k ? "bg-white text-navy shadow-sm" : "text-slate-500"}`}>{l}</button>
                ))}
              </div>
              {mode === "file" ? (
                <FileDrop accept={ACCEPT} file={file} onPick={(f) => { setFile(f); setError(""); }} onClear={() => setFile(null)}
                          title="Drop your job description here, or click to browse"
                          hint="PDF, Word (.docx), Excel, CSV or text — up to 8 MB" />
              ) : (
                <textarea className="input" rows={12} value={text} onChange={(e) => setText(e.target.value)}
                          placeholder={"Paste the whole job description, e.g.\n\nJob Title: Hotel Receptionist\nLocation: Kukatpally, Hyderabad\nSalary: ₹18,000 – 25,000 per month\nSkills: Front desk, Guest handling\n…"} />
              )}
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {[["1", "Upload or paste"], ["2", "We read every section"], ["3", "You review, then post"]].map(([n, t]) => (
                  <div key={n} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[10.5px] font-bold text-white">{n}</span>{t}
                  </div>
                ))}
              </div>
              {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">{error}</p>}
            </>
          )}

          {step === "reading" && (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
              <svg className="h-11 w-11 animate-spin text-navy" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".15" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <p className="mt-4 font-heading text-[16px] font-bold text-slate-900">Reading your document…</p>
              <p className="mt-1 text-[12.5px] text-slate-500">Finding title, location, salary, skills, description and contact.</p>
            </div>
          )}

          {step === "review" && (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                  <IconCheck size={12} strokeWidth={3} /> {found} field{found === 1 ? "" : "s"} found
                </span>
                {result?.file && <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600"><IconDoc size={12} /> {result.file}</span>}
                <span className="rounded-full bg-navy-50 px-2.5 py-1 font-semibold text-navy">{result?.source === "ai" ? "Read by AI" : "Read by smart parser"}</span>
              </div>
              <div className="space-y-4">
                {SECTIONS.map(([title, items]) => (
                  <div key={title} className="overflow-hidden rounded-2xl border border-slate-200">
                    <p className="bg-slate-50 px-4 py-2 text-[11.5px] font-bold uppercase tracking-wider text-slate-500">{title}</p>
                    <ul className="divide-y divide-slate-100">
                      {items.map(([k, label]) => {
                        const ok = has(vals[k]);
                        const readOnly = ["salary", "perks", "key_skills"].includes(k);
                        return (
                          <li key={k} className={`flex items-start gap-3 px-4 py-2.5 ${ok ? "" : "opacity-60"}`}>
                            <input type="checkbox" className="mt-1.5 h-4 w-4 accent-navy" disabled={!ok}
                                   checked={ok && !!use[k]} onChange={(e) => setUse((u) => ({ ...u, [k]: e.target.checked }))} />
                            <span className="w-36 shrink-0 pt-1 text-[12.5px] font-semibold text-slate-600">{label}</span>
                            <div className="min-w-0 flex-1">
                              {!ok ? (
                                <span className="inline-block pt-1 text-[12.5px] text-slate-400">Not found — fill it in on the form</span>
                              ) : k === "key_skills" ? (
                                <div className="flex flex-wrap gap-1 pt-0.5">
                                  {vals.key_skills.map((s) => (
                                    <span key={s} className="inline-flex items-center gap-1 rounded-full bg-navy-50 py-0.5 pl-2 pr-1 text-[12px] font-medium text-navy">
                                      {s}
                                      <button type="button" aria-label={`Remove ${s}`} onClick={() => setVals((v) => ({ ...v, key_skills: v.key_skills.filter((x) => x !== s) }))}
                                              className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-navy hover:text-white"><IconClose size={9} strokeWidth={3} /></button>
                                    </span>
                                  ))}
                                </div>
                              ) : k === "description" ? (
                                <textarea className="input !py-2 !text-[13px]" rows={4} value={vals.description}
                                          onChange={(e) => setVals((v) => ({ ...v, description: e.target.value }))} />
                              ) : readOnly ? (
                                <span className="inline-block pt-1 text-[13px] font-semibold text-slate-800">{vals[k]}</span>
                              ) : (
                                <input className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-[13px] font-semibold text-slate-800 hover:border-slate-200 focus:border-navy focus:bg-white focus:outline-none"
                                       value={vals[k]} onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))} />
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-3.5">
          {step === "review" ? (
            <>
              <button type="button" className="text-[13px] font-semibold text-slate-500 hover:text-navy" onClick={() => setStep("pick")}>← Use another document</button>
              <button type="button" className="btn !rounded-full !px-6" disabled={!chosen} onClick={apply}>
                <IconCheck size={15} /> Apply {chosen} field{chosen === 1 ? "" : "s"} to the form
              </button>
            </>
          ) : (
            <>
              <p className="text-[11.5px] text-slate-400">Your file is only read to fill this form — it isn't stored.</p>
              <button type="button" className="btn !rounded-full !px-6" onClick={read}
                      disabled={step === "reading" || (mode === "file" ? !file : text.trim().length < 20)}>
                <IconSparkle size={15} /> Read and fill
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
