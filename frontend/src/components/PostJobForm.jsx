import { Fragment, useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { useToast } from "./ui";
import { useDialog } from "./Dialog";
import { AIButton, AIResult, AIList, useAI, useAICall } from "./AIPanel";
import { Combobox } from "./fields";
import SkillPicker from "./SkillPicker";
import { useTaxonomy, SectorList, RolePicker } from "./SectorPicker";
import { IconSparkle, IconEye, IconCheck, IconMapPin, IconClipboard, IconStar, IconBriefcase, IconUsers, IconDoc, IconLayers, IconUser, IconPhone, IconMail } from "./icons";
import { AdStep } from "./AdKit";
import { JobLocationField, SalaryRangeField } from "./JobLocationSalary";
import { COUNTRY_CURRENCY, formatMoney, salarySteps } from "../lib/currencies";
import JdImportModal from "./JdImportModal";
import { SectorImage } from "./SectorIcon";
import { CITIES, QUALIFICATIONS, EXPERIENCE, SHIFTS, SALARY_STEPS, formatSalary } from "../lib/options";

/* =====================================================================
   Post a job — shared by the recruiter and institute portals.

   Institute used to have its own smaller PostJob: no sector/role taxonomy
   pickers, no JD parsing, no AI draft, and fewer fields. That is why the
   institute screen looked nothing like the recruiter one. Both now render
   this component.
   ===================================================================== */
/* Module scope, not inside PostJobForm. A component defined inside another is
   a new type on every render, so React throws the old subtree away instead of
   updating it. Harmless for this read-only row, but the same pattern in a
   panel containing an input destroys the field on every keystroke — so it
   does not belong inside a render body at all. */
function Row({ label, value }) {
  return (
    <div className="flex gap-3 border-b border-slate-100 py-1.5 last:border-0">
      <span className="w-36 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="min-w-0 flex-1 text-sm text-slate-700">
        {value || <span className="text-slate-300">— not set</span>}
      </span>
    </div>
  );
}

export default function PostJobForm({
  /* The only difference between the recruiter and institute versions was the
     endpoint. Both take schemas.JobBase server-side, so one form serves both
     and they can no longer drift apart in fields or layout. */
  endpoint = "/api/enterprise/jobs",
  heading = "Post a job",
  postedNote = "Job seekers whose skills match will be alerted automatically.",
} = {}) {
  const toast = useToast();
  const dialog = useDialog();
  const { enabled: aiOn } = useAI();
  const { call, busy: aiBusy } = useAICall();
  const [form, setForm] = useState({ contact_visible: true, key_skills: [] });

  /* Prefill the recruiter contact from the signed-in profile.
     Only fills BLANK fields, so it can't overwrite something already typed,
     and the inputs stay editable — a company may want a different contact per
     posting. `endpoint` decides which profile to read, since this component is
     shared with the institute portal. */
  useEffect(() => {
    const path = endpoint.includes("/institute/")
      ? "/api/institute/profile" : "/api/enterprise/profile";
    api.get(path).then((p) => {
      setForm((f) => ({
        ...f,
        recruiter_name: f.recruiter_name || p.authorised_person_name || p.name || "",
        recruiter_phone: f.recruiter_phone || p.phone || "",
        recruiter_email: f.recruiter_email || p.email || "",
      }));
    }).catch(() => {});   // prefill is a convenience; never block the form
  }, [endpoint]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setV = (k) => (v) => setForm({ ...form, [k]: v });
  const [aiDraft, setAiDraft] = useState(null);
  const tax = useTaxonomy();

  const [jdText, setJdText] = useState("");
  const [jdOpen, setJdOpen] = useState(false);
  const [preview, setPreview] = useState(false);   // last look before posting
  /* The sector + role picker is big; once a role is chosen it folds into a
     one-line summary so the posting fields come up. Clicking anywhere outside
     the picker also folds it (only when there is a role to summarise). */
  const [pickerOpen, setPickerOpen] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const pickerRef = useRef(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setForm((f) => { if (f.sector && String(f.title || "").trim()) setPickerOpen(false); return f; });
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen]);
  /* Which required fields are currently missing. Kept in state so the FIELDS
     can show the error, not just a toast in the corner — "Please fill in:
     Skills Required" is useless if you cannot find Skills Required. */
  const [invalid, setInvalid] = useState([]);
  const previewRef = useRef(null);

  /* Clear a field's error the moment it is filled, rather than making the
     person press Post again to find out they fixed it. */
  const clearInvalid = (key) => setInvalid((xs) => xs.filter((k) => k !== key));

  /* A plain, specific message under each mandatory field that is empty. */
  const REQUIRED_MSG = {
    title: "Job title is mandatory — please enter the role you're hiring for, e.g. Electrician.",
    location: "Location is mandatory — please choose the city where this job is based.",
    shift: "Shift is mandatory — please select the working shift, e.g. Day shift.",
    key_skills: "Skills are mandatory — add at least one skill; this is what matches your job to candidates.",
    description: "Job description is mandatory — please describe the work, or press Draft from title.",
  };
  const bad = (k) => invalid.includes(k);
  const badRing = (k) => (bad(k) ? "rounded-2xl p-1.5 ring-2 ring-red-400 bg-red-50/40" : "");
  const FieldError = ({ k }) => (bad(k) ? (
    <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-[12.5px] font-medium text-red-600">
      <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">!</span>
      {REQUIRED_MSG[k]}
    </p>
  ) : null);

  /* After a failed Post, bring the FIRST missing field to the middle of the
     screen and put the cursor in it — the sticky progress bar at the top
     would otherwise cover a field scrolled to the very top. */
  const formRootRef = useRef(null);
  const [scrollTick, setScrollTick] = useState(0);
  useEffect(() => {
    if (!scrollTick) return;
    const id = requestAnimationFrame(() => {
      const el = formRootRef.current?.querySelector('[data-invalid="true"]');
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => el.querySelector("input, textarea, select")?.focus({ preventScroll: true }), 450);
    });
    return () => cancelAnimationFrame(id);
  }, [scrollTick]);

  /* Bring the preview into view when it opens.
     The panel renders ABOVE the form, so from the Preview button — which sits
     at the very bottom — opening it changed nothing you could see. The page
     silently grew taller somewhere off-screen and the button appeared dead.
     Runs after the paint, because the panel does not exist to scroll to until
     React has rendered it. */
  useEffect(() => {
    if (!preview) return;
    const id = requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(id);
  }, [preview]);

  const parseJD = async () => {
    const r = await call("/api/ai/job/parse", { text: jdText });
    if (!r) return;
    setForm({
      ...form,
      title: r.title || form.title,
      job_code: r.job_code || form.job_code,
      category: r.category || form.category,
      location: r.location || form.location,
      no_of_positions: r.no_of_positions || form.no_of_positions,
      experience: r.experience || form.experience,
      salary: r.salary || form.salary,
      requirement_education: r.requirement_education || form.requirement_education,
      requirement_technical: r.requirement_technical || form.requirement_technical,
      description: r.description || form.description,
      key_skills: r.key_skills?.length ? r.key_skills : form.key_skills,
      recruiter_name: r.recruiter_name || form.recruiter_name,
      recruiter_email: r.recruiter_email || form.recruiter_email,
      recruiter_phone: r.recruiter_phone || form.recruiter_phone,
    });
    setJdOpen(false); setJdText("");
    toast("Fields filled from your JD — review, then post.");
  };

  const autoConfigure = async (title) => {
    const r = await call("/api/ai/job/classify", { title });
    if (!r) return;
    setForm((f) => ({
      ...f,
      sector: r.sector || f.sector,
      education_level: r.education_level || f.education_level,
      wage_basis: r.wage_basis || f.wage_basis,
      job_type: r.job_type || f.job_type,
      key_skills: f.key_skills?.length ? f.key_skills : (r.suggested_skills || []),
    }));
    toast("Form configured for this role.");
  };

  const draftWithAI = async () => {
    if (!form.title?.trim()) return toast("Enter a job title first.", "error");
    /* Send the technical requirement too — a recruiter who has typed
       "PLC, SCADA, 3 years on packaging lines" should get a description that
       reflects it, not a generic one built from the title alone. */
    const r = await call("/api/ai/job/describe", {
      title: form.title, location: form.location, category: form.category,
      experience: form.experience, salary: form.salary, skills: form.key_skills,
      requirement_technical: form.requirement_technical,
      requirement_education: form.requirement_education,
    });
    if (!r) return;
    /* Write straight into the Job description box rather than parking it behind
       a "Use this draft" click. It lands as ordinary text in an editable
       textarea, so the recruiter edits it in place — which is what they were
       going to do anyway. The panel below still shows responsibilities and
       suggested skills, which don't have a field of their own. */
    setForm((f) => ({
      ...f,
      description: r.description || f.description,
      requirement_technical: f.requirement_technical || r.requirement_technical || "",
      key_skills: f.key_skills?.length ? f.key_skills : (r.key_skills || []),
    }));
    setAiDraft(r);
    toast("Description drafted — edit it below before posting.");
  };
  const applyDraft = () => {
    setForm({
      ...form,
      description: aiDraft.description || form.description,
      requirement_education: aiDraft.requirement_education || form.requirement_education,
      requirement_technical: aiDraft.requirement_technical || form.requirement_technical,
      key_skills: aiDraft.key_skills?.length ? aiDraft.key_skills : form.key_skills,
    });
    setAiDraft(null);
    toast("Draft applied — edit anything before posting.");
  };
  const submit = async () => {
    /* The five starred fields, checked before anything is posted.
       They were unvalidated on BOTH sides: the schema only required a title,
       so a job could go live with no location, no skills and no description —
       and with alerts now firing on submit, that advert reaches every matching
       candidate before anyone notices. The server enforces the same five. */
    const missing = [
      [!(form.title || "").trim(), "Job Title", "title"],
      [!(form.location || "").trim(), "Location", "location"],
      [!(form.key_skills || []).length, "Skills Required", "key_skills"],
      [!(form.shift || "").trim(), "Job Shift", "shift"],
      [!(form.description || "").trim(), "Job Description", "description"],
    ].filter(([bad]) => bad);
    if (missing.length) {
      /* Mark the fields first, THEN toast. The toast handler scans the page
         for anything marked invalid and scrolls to the first one, so the
         order matters: toast first and there is nothing to find yet. */
      setInvalid(missing.map(([, , key]) => key));
      setScrollTick((t) => t + 1);
      return toast(`Please fill the mandatory field${missing.length === 1 ? "" : "s"} marked in red: ${missing.map(([, name]) => name).join(", ")}.`, "error");
    }
    setInvalid([]);
    try {
      const job = await api.post(endpoint, { ...form, key_skills: form.key_skills || [] });

      /* The expiry comes back from the SERVER, not from a constant here: the
         cap is enforced server-side, so quoting a locally-computed date could
         disagree with what was actually saved. */
      const expiry = job?.expires_at ? new Date(job.expires_at) : null;
      const daysLeft = expiry
        ? Math.max(0, Math.round((expiry - Date.now()) / 86400000))
        : null;

      dialog({
        tone: "success",
        title: "Job posted successfully",
        message: `"${form.title}" is now live and visible to job seekers.`
               + (expiry
                    ? `\n\nIt stays live for ${daysLeft} day(s) and expires on `
                      + `${expiry.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}.`
                    : ""),
        details: [
          ["Job title", form.title],
          ...(job?.job_code || form.job_code ? [["Job code", job?.job_code || form.job_code]] : []),
          ...(form.location ? [["Location", form.location]] : []),
          ...(form.no_of_positions ? [["Positions", String(form.no_of_positions)]] : []),
          ...(expiry ? [["Valid until", expiry.toLocaleDateString()]] : []),
        ],
        note: expiry
          ? `${postedNote} After ${expiry.toLocaleDateString()} it stops appearing in search `
            + "automatically — reopen or repost it from Manage jobs if you're still hiring."
          : postedNote,
        confirmLabel: "Done",
      });
      // Keep the recruiter contact across postings — retyping it for every job
      // is the kind of friction that makes people leave contact_visible off.
      setForm((f) => ({
        contact_visible: true, key_skills: [],
        recruiter_name: f.recruiter_name, recruiter_phone: f.recruiter_phone,
        recruiter_email: f.recruiter_email,
      }));
    } catch (err) { toast(err.message, "error"); }
  };
  const checks = [form.title, form.location, form.category, form.no_of_positions, form.job_type,
    form.education_level, form.experience, form.wage_min, form.shift, (form.key_skills || []).length,
    form.description, form.recruiter_name];
  const done = checks.filter((v) => (typeof v === "number" ? v > 0 : String(v ?? "").trim())).length;
  const pct = Math.round((done / checks.length) * 100);
  const salaryText = form.salary || [form.wage_min, form.wage_max].filter((v) => v !== "" && v != null)
    .map((v) => formatMoney(v, form.salary_currency || "INR")).join(" – ");
  const sectorName = form.sector && tax ? tax.sectors.find((x) => x.key === form.sector)?.name : null;
  const R = 22, C = 2 * Math.PI * R;
  const STEPS = [
    ["pj-1", "Role basics", !!(String(form.title || "").trim() && String(form.location || "").trim())],
    ["pj-2", "Requirements & pay", !!(String(form.shift || "").trim() && (form.key_skills || []).length)],
    ["pj-3", "Description", !!String(form.description || "").trim()],
    ["pj-4", "Contact", !!String(form.recruiter_name || form.recruiter_email || "").trim()],
  ];
  const STEP_KEYS = { "pj-1": ["title", "location"], "pj-2": ["shift", "key_skills"], "pj-3": ["description"], "pj-4": [] };
  const stepErr = (id) => STEP_KEYS[id].some((k) => invalid.includes(k));
  const goStep = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div ref={formRootRef} className="w-full">
      {preview && (() => {
        const has = (v) => (Array.isArray(v) ? v.length > 0 : String(v ?? "").trim() !== "");
        const facts = [
          [IconMapPin, "Location", [form.location, (form.country && form.country !== "IN") ? form.country : null].filter(Boolean).join(", "), "pj-1"],
          [IconClipboard, "Salary", salaryText && `${salaryText} ${({ monthly: "per month", annual: "per year", daily: "per day", hourly: "per hour" })[form.wage_basis || "monthly"] || ""}`, "pj-2"],
          [IconStar, "Job shift", form.shift, "pj-2"],
          [IconBriefcase, "Experience", form.experience, "pj-2"],
          [IconUsers, "No of positions", form.no_of_positions, "pj-1"],
          [IconDoc, "Qualification", form.category || form.education_level, "pj-1"],
          [IconLayers, "Job type", form.job_type, "pj-2"],
        ];
        const missing = [
          ["Job title", form.title, "pj-1"], ["Location", form.location, "pj-1"], ["Job shift", form.shift, "pj-2"],
          ["Skills required", form.key_skills, "pj-2"], ["Salary", salaryText, "pj-2"], ["Job description", form.description, "pj-3"],
        ].filter(([, v]) => !has(v));
        const jump = (id) => { setPreview(false); setTimeout(() => goStep(id), 60); };
        return (
          <div ref={previewRef} className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_-34px_rgba(79,70,229,.55)]">
            {/* bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-6 py-3">
              <h3 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-navy">
                <IconEye size={15} /> Preview — what candidates will see
              </h3>
              <div className="flex gap-2">
                <button type="button" className="btn-outline btn-sm !rounded-full" onClick={() => setPreview(false)}>Close preview</button>
                <button type="button" className="btn btn-sm !rounded-full !px-4" onClick={submit}>Post this job</button>
              </div>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              {/* ---- job detail, as candidates see it ---- */}
              <div className="min-w-0">
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-slate-900">
                  <div className="relative flex items-start gap-4">
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200">
                      {form.sector
                        ? <SectorImage name={tax?.sectors.find((x) => x.key === form.sector)?.icon} sector={form.sector} size={44} />
                        : <span className="font-heading text-2xl font-bold text-navy">{(form.title || "?")[0].toUpperCase()}</span>}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-heading text-[24px] font-bold leading-tight">{form.title || "Untitled job"}</h4>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500">
                        {sectorName && <span>{sectorName}</span>}
                        {form.location && <span className="inline-flex items-center gap-1"><IconMapPin size={13} />{form.location}</span>}
                        {form.job_code && <span className="text-slate-400">#{form.job_code}</span>}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {form.is_urgent && <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-600 ring-1 ring-red-100">🔥 Urgent hiring</span>}
                        {form.accommodation && <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-100">🏠 Accommodation</span>}
                        {form.food_provided && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-100">🍱 Food provided</span>}
                        {form.no_of_positions && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">{form.no_of_positions} opening{String(form.no_of_positions) === "1" ? "" : "s"}</span>}
                      </div>
                    </div>
                  </div>
                  {salaryText && (
                    <div className="relative mt-5 inline-flex items-baseline gap-2 rounded-xl bg-emerald-50 px-4 py-2 ring-1 ring-emerald-100">
                      <span className="font-heading text-[20px] font-bold text-emerald-700">{salaryText}</span>
                      <span className="text-[12px] text-emerald-700/70">{({ monthly: "per month", annual: "per year", daily: "per day", hourly: "per hour" })[form.wage_basis || "monthly"] || ""}</span>
                    </div>
                  )}
                </div>

                {/* key facts */}
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {facts.map(([Ic, label, v]) => (
                    <div key={label} className={`flex items-center gap-3 rounded-xl border p-3 ${has(v) ? "border-slate-200 bg-white" : "border-dashed border-slate-200 bg-slate-50/60"}`}>
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${has(v) ? "bg-navy-50 text-navy" : "bg-white text-slate-300"}`}><Ic size={16} /></span>
                      <div className="min-w-0">
                        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                        <p className={`truncate text-[13.5px] font-semibold ${has(v) ? "text-slate-800" : "text-slate-300"}`}>{has(v) ? v : "not set"}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* skills */}
                <div className="mt-5">
                  <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-slate-400">Skills required</p>
                  {has(form.key_skills)
                    ? <div className="flex flex-wrap gap-1.5">{form.key_skills.map((k) => <span key={k} className="rounded-full bg-navy-50 px-3 py-1 text-[12.5px] font-semibold text-navy ring-1 ring-inset ring-navy-100">{k}</span>)}</div>
                    : <p className="text-[13px] text-slate-300">not set</p>}
                </div>

                {/* description */}
                <div className="mt-5">
                  <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-slate-400">Job description</p>
                  <div className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-[14px] leading-relaxed text-slate-700">
                    {form.description || <span className="text-slate-400">No description written yet.</span>}
                  </div>
                  {form.requirement_technical && (
                    <p className="mt-3 text-[13px] text-slate-600"><b className="text-slate-800">Technical requirement:</b> {form.requirement_technical}</p>
                  )}
                </div>
              </div>

              {/* ---- side: apply + contact + checklist ---- */}
              <aside className="space-y-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <button type="button" disabled className="w-full cursor-default rounded-xl bg-[#1e3a8a] py-3 text-[14px] font-bold text-white shadow-[0_10px_24px_-12px_rgba(30,58,138,.9)]">Apply now</button>
                  <p className="mt-2 text-center text-[11px] text-slate-400">Candidates apply with one tap</p>
                </div>
                {form.contact_visible && (form.recruiter_name || form.recruiter_phone || form.recruiter_email) && (
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Contact</p>
                    <ul className="space-y-2 text-[13px] text-slate-700">
                      {form.recruiter_name && <li className="flex items-center gap-2"><IconUser size={14} className="text-navy" />{form.recruiter_name}</li>}
                      {form.recruiter_phone && <li className="flex items-center gap-2"><IconPhone size={14} className="text-navy" />{form.recruiter_phone}</li>}
                      {form.recruiter_email && <li className="flex min-w-0 items-center gap-2"><IconMail size={14} className="shrink-0 text-navy" /><span className="truncate">{form.recruiter_email}</span></li>}
                    </ul>
                  </div>
                )}
                <div className={`rounded-2xl border p-4 ${missing.length ? "border-amber-200 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/60"}`}>
                  <p className={`mb-2 text-[12.5px] font-bold ${missing.length ? "text-amber-800" : "text-emerald-700"}`}>
                    {missing.length ? `Before you post · ${missing.length} to add` : "✓ Ready to post"}
                  </p>
                  {missing.length ? (
                    <ul className="space-y-1.5">
                      {missing.map(([label, , id]) => (
                        <li key={label}>
                          <button type="button" onClick={() => jump(id)}
                                  className="flex w-full items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-left text-[12.5px] text-slate-700 ring-1 ring-amber-100 hover:ring-amber-300">
                            {label} <span className="text-[11.5px] font-semibold text-navy">Add →</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-[12px] text-emerald-700/80">Every key detail is filled in.</p>}
                </div>
                {/* Named here rather than after posting: once the alerts are out, the
                    advert is in thousands of inboxes and cannot be corrected there. */}
                <p className="text-[11.5px] leading-snug text-slate-400">
                  Anything showing “not set” will simply be missing from the advert. Close this
                  to keep editing, or Post this job when it reads the way you want.
                </p>
              </aside>
            </div>
          </div>
        );
      })()}

      <JdImportModal open={importOpen} onClose={() => setImportOpen(false)}
        onApply={(vals, n) => {
          /* Snap imported salary to the dropdown steps so the selects show it. */
          const cur = vals.salary_currency || form.salary_currency || "INR";
          const steps = salarySteps(cur);
          const snap = (v, up) => {
            const x = Number(v); if (!x) return "";
            const pickd = up ? steps.find((s2) => s2 >= x) : [...steps].reverse().find((s2) => s2 <= x);
            return String(pickd ?? (up ? steps[steps.length - 1] : steps[0]));
          };
          const next = { ...vals };
          if (vals.wage_min) next.wage_min = snap(vals.wage_min, false);
          if (vals.wage_max) next.wage_max = snap(vals.wage_max, true);
          setForm((f) => ({ ...f, ...next }));
          setInvalid([]);
          if (next.title) setPickerOpen(false);
          setImportOpen(false);
          toast(`${n} field${n === 1 ? "" : "s"} filled from your document — review each section, then post.`);
          setTimeout(() => goStep("pj-1"), 80);
        }} />

      {/* ---------------- header ---------------- */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-[24px] font-bold leading-tight text-slate-900">{heading}</h2>
          <p className="mt-1 text-[13.5px] text-slate-500">Fill in four short sections — fields marked <span className="text-red-500">*</span> are required.</p>
        </div>
        <button type="button" onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-navy to-violet-500 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(79,70,229,.9)] hover:brightness-110">
          <IconSparkle size={14} /> Auto-fill from a document
        </button>
      </div>

      {/* ---------------- the ONE progress + action bar (sticky) ---------------- */}
      <div className="sticky top-0 z-40 -mx-1 mb-5 px-1 pt-1">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-[0_10px_30px_-22px_rgba(15,23,42,.6)] backdrop-blur">
          <div className="relative h-10 w-10 shrink-0">
            <svg width="40" height="40" viewBox="0 0 56 56" className="-rotate-90">
              <circle cx="28" cy="28" r={R} fill="none" stroke="#eef2ff" strokeWidth="7" />
              <circle cx="28" cy="28" r={R} fill="none" strokeWidth="7" strokeLinecap="round"
                      stroke={pct === 100 ? "#4faa38" : "#4f46e5"} strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)}
                      style={{ transition: "stroke-dashoffset .6s ease" }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10.5px] font-bold text-slate-900">{pct}%</span>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {STEPS.map(([id, label, ok], i) => (
              <Fragment key={id}>
                <button type="button" onClick={() => goStep(id)} title={label}
                        className={`flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-semibold transition-colors
                          ${stepErr(id) ? "text-red-600 hover:bg-red-50" : ok ? "text-emerald-700 hover:bg-emerald-50" : "text-slate-600 hover:bg-slate-100"}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold
                    ${stepErr(id) ? "bg-red-500 text-white" : ok ? "bg-brandgreen text-white" : "bg-slate-100 text-slate-500"}`}>
                    {stepErr(id) ? "!" : ok ? <IconCheck size={11} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="hidden truncate lg:inline">{label}</span>
                </button>
                {i < STEPS.length - 1 && <span className={`h-0.5 min-w-3 flex-1 rounded-full ${ok ? "bg-brandgreen" : "bg-slate-200"}`} />}
              </Fragment>
            ))}
          </div>
          <button type="button" className="btn-outline btn-sm !rounded-full hidden sm:inline-flex" onClick={() => setPreview(true)}>
            <IconEye size={14} /> Preview
          </button>
          <button type="button" className="btn btn-sm !rounded-full !px-4" onClick={submit}>Post this job</button>
        </div>
      </div>

      {jdOpen && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-navy-200 bg-gradient-to-br from-navy-50/70 via-white to-violet-50/50 p-6">
          <h3 className="flex items-center gap-2 font-heading text-[15px] font-bold text-navy"><IconSparkle size={15} /> Paste your job description</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Paste a JD from anywhere — AI fills in every field below automatically.
          </p>
          <label className="btn-outline btn-sm mt-3 inline-flex cursor-pointer !rounded-full">
            Choose a file (.txt, .md, .csv)
            <input type="file" accept=".txt,.md,.csv,.json" className="hidden"
                   onChange={async (e) => {
                     const f = e.target.files?.[0];
                     if (!f) return;
                     const text = await f.text().catch(() => "");
                     if (text.trim()) setJdText(text.slice(0, 20000));
                     else toast("Couldn't read that file. Paste the text instead.", "error");
                   }} />
          </label>
          <textarea className="input mt-3" rows={8} value={jdText} placeholder="…or paste the full job description here"
                    onChange={(e) => setJdText(e.target.value)} />
          <div className="mt-3 flex gap-2">
            <button className="btn-green btn-sm !rounded-full" onClick={parseJD} disabled={aiBusy || jdText.trim().length < 40}>
              {aiBusy ? "Reading…" : "Auto-fill the form"}
            </button>
            <button className="btn-outline btn-sm !rounded-full" onClick={() => setJdOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ---------------- MAIN: the job posting form ---------------- */}
        <div className="order-2 space-y-5 lg:order-1">
          {/* 1 — role basics */}
          <div id="pj-1" className="scroll-mt-4" />
          <AdStep plain n={1} title="Role basics" sub="What the job is and where it is.">
            <div ref={pickerRef} className="mb-5">
              {!pickerOpen && form.sector ? (
                /* ---- folded summary ---- */
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-300 bg-gradient-to-r from-navy-50/70 to-white p-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                    <SectorImage name={tax?.sectors.find((x) => x.key === form.sector)?.icon} sector={form.sector} size={34} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Type of work</p>
                    <p className="truncate text-[14px] font-semibold text-slate-800">
                      {sectorName}
                      {form.title && <><span className="mx-1.5 text-slate-300">›</span><span className="text-navy">{form.title}</span></>}
                    </p>
                  </div>
                  <button type="button" onClick={() => setPickerOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:border-navy hover:text-navy">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-slate-800">What kind of work is this?</p>
                    <div className="flex items-center gap-3">
                      <p className="text-[11.5px] text-slate-400">
                        {tax ? `${tax.sectors.length} sectors · ${tax.role_count}+ roles — daily wage to postgraduate` : "Loading sectors…"}
                      </p>
                      {form.sector && (
                        <button type="button" onClick={() => setPickerOpen(false)} title="Minimise"
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11.5px] font-semibold text-slate-600 hover:bg-navy-50 hover:text-navy">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 15l-6-6-6 6" /></svg>
                          Minimise
                        </button>
                      )}
                    </div>
                  </div>
                  <SectorList layout="strip" sectors={tax?.sectors || []} value={form.sector} onChange={(v) => {
                    const sec = tax?.sectors.find((x) => x.key === v);
                    setForm({ ...form, sector: v,
                      education_level: sec?.education || form.education_level,
                      wage_basis: sec?.wage_basis || form.wage_basis });
                  }} />
                  {form.sector && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3">
                      <p className="mb-2 text-[12.5px] font-semibold text-slate-700">Pick the role</p>
                      <RolePicker sectors={tax?.sectors || []} sector={form.sector} value={form.title}
                                  onChange={(r) => { setForm({ ...form, title: r }); setPickerOpen(false); if (aiOn) autoConfigure(r); }} />
                      <p className="mt-2 text-[11px] text-slate-400">
                        Choosing a role fills the title and configures pay and education for you.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="label !mb-0">Job title <span className="text-red-400">*</span></label>
                  {aiOn && form.title && (
                    <button className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-3 py-1 text-[12px] font-semibold text-navy hover:bg-navy hover:text-white"
                            onClick={() => autoConfigure(form.title)} disabled={aiBusy}>
                      <IconSparkle size={12} /> {aiBusy ? "Configuring…" : "Auto-configure"}
                    </button>
                  )}
                </div>
                <div data-invalid={bad("title") ? "true" : undefined}>
                  <input className={`input mt-1.5 !py-3 !text-[15px] font-semibold ${bad("title") ? "!border-red-400 !bg-red-50/50 !ring-4 !ring-red-100" : ""}`}
                         value={form.title || ""} aria-invalid={bad("title")}
                         onChange={(e) => { set("title")(e); if (e.target.value.trim()) clearInvalid("title"); }}
                         placeholder="e.g. Electrician, Cook, Staff Nurse, Software Engineer" />
                  <FieldError k="title" />
                </div>
                {form.sector && tax && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400">
                    Sector: <span className="rounded-full bg-navy-50 px-2 py-0.5 font-semibold text-navy">{sectorName}</span>
                    <button className="underline hover:text-navy" onClick={() => setForm({ ...form, sector: null })}>change</button>
                  </p>
                )}
              </div>
              <div><label className="label">Job code</label>
                <input className="input" value={form.job_code || ""} onChange={set("job_code")} placeholder="e.g. ELEC/001" /></div>
              <div className="sm:col-span-2" data-invalid={bad("location") ? "true" : undefined}>
                <label className="label">Location <span className="text-red-400">*</span></label>
                <JobLocationField country={form.country || "IN"} location={form.location} invalid={bad("location")}
                  onCountry={(cc) => setForm((f) => ({ ...f, country: cc,
                    salary_currency: COUNTRY_CURRENCY[cc] || f.salary_currency || "INR", wage_min: "", wage_max: "" }))}
                  onLocation={(v) => { setForm((f) => ({ ...f, location: v })); if (String(v || "").trim()) clearInvalid("location"); }} />
                <FieldError k="location" />
              </div>
              <Combobox label="Qualification/s" value={form.category} options={QUALIFICATIONS} onChange={setV("category")} aiField="required qualification" />
              <div><label className="label">No. of positions</label>
                <input className="input" value={form.no_of_positions || ""} onChange={set("no_of_positions")} placeholder="e.g. 5" /></div>
            </div>
          </AdStep>

          {/* 2 — requirements & pay */}
          <div id="pj-2" className="scroll-mt-4" />
          <AdStep plain n={2} title="Requirements & pay" sub="Who you're looking for, and what you offer.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Combobox label="Job type" value={form.job_type} options={(tax?.job_types || []).map((t) => t.label)} onChange={setV("job_type")} />
              <Combobox label="Education required" value={form.education_level}
                        options={(tax?.education_levels || []).map((t) => t.label)} onChange={setV("education_level")} />
              <Combobox label="Experience" value={form.experience} options={EXPERIENCE} onChange={setV("experience")} />
              {/* Combobox, not a plain select: a recruiter with an unusual shift can still type it. */}
              <div data-invalid={bad("shift") ? "true" : undefined}>
                <div className={badRing("shift")}>
                  <Combobox label="Shift" required value={form.shift} options={SHIFTS}
                            onChange={(v) => { setForm((f) => ({ ...f, shift: v })); if (String(v || "").trim()) clearInvalid("shift"); }}
                            placeholder="Select or type a shift" />
                </div>
                <FieldError k="shift" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Salary Range</label>
                <SalaryRangeField currency={form.salary_currency || "INR"} basis={form.wage_basis || "monthly"}
                  min={form.wage_min ?? ""} max={form.wage_max ?? ""}
                  onCurrency={(c) => setForm((f) => ({ ...f, salary_currency: c }))}
                  onBasis={(v) => setForm((f) => ({ ...f, wage_basis: v }))}
                  onMin={(v) => setForm((f) => ({ ...f, wage_min: v }))}
                  onMax={(v) => setForm((f) => ({ ...f, wage_max: v }))} />
              </div>

              <div className="sm:col-span-2" data-invalid={invalid.includes("key_skills") ? "true" : undefined}>
                <label className="label">Skills Required <span className="font-semibold text-red-400">*</span></label>
                <div className={badRing("key_skills")}>
                  <SkillPicker values={form.key_skills || []}
                               onChange={(v) => { setV("key_skills")(v); clearInvalid("key_skills"); }}
                               sector={form.sector}
                               aiSuggestPath={aiOn && form.title ? "/api/ai/job/classify" : null}
                               aiBody={{ title: form.title }} />
                </div>
                <FieldError k="key_skills" />
              </div>

              <div className="flex flex-wrap gap-2 sm:col-span-2">
                {[["is_urgent", "Urgent hiring", "🔥", "border-red-300 bg-red-50 text-red-700"],
                  ["accommodation", "Accommodation provided", "🏠", "border-sky-300 bg-sky-50 text-sky-700"],
                  ["food_provided", "Food provided", "🍱", "border-amber-300 bg-amber-50 text-amber-700"]].map(([k, l, ic, on]) => (
                  <button key={k} type="button" aria-pressed={!!form[k]} onClick={() => setForm({ ...form, [k]: !form[k] })}
                          className={`inline-flex items-center gap-2 rounded-full border-[1.5px] px-3.5 py-2 text-[13px] font-semibold transition-all
                            ${form[k] ? `${on} shadow-sm` : "border-slate-200 bg-white text-slate-600 hover:border-navy-200"}`}>
                    <span aria-hidden="true">{ic}</span> {l}
                    {form[k] && <IconCheck size={13} />}
                  </button>
                ))}
              </div>
            </div>
          </AdStep>

          {/* 3 — description */}
          <div id="pj-3" className="scroll-mt-4" />
          <AdStep plain n={3} title="Description" sub="Tell candidates what the work involves."
                  action={aiOn && (
                    /* By now the AI has enough to write a usable draft; it lands in the box below. */
                    <button type="button" className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-navy to-violet-500 px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-md hover:brightness-110"
                            onClick={draftWithAI} disabled={aiBusy}>
                      <IconSparkle size={13} />
                      {aiBusy ? "Drafting…" : form.description ? "Redraft with AI" : "Draft from title"}
                    </button>
                  )}>
            <div className="space-y-4">
              {aiDraft && (
                <AIResult title="AI draft" onClose={() => setAiDraft(null)}>
                  <p className="whitespace-pre-line leading-relaxed">{aiDraft.description}</p>
                  <AIList label="Responsibilities" items={aiDraft.responsibilities} />
                  {aiDraft.key_skills?.length > 0 && (
                    <p className="mt-2 text-[13px]"><b>Skills:</b> {aiDraft.key_skills.join(", ")}</p>
                  )}
                  <button className="btn-green btn-sm mt-3" onClick={applyDraft}>
                    Also apply skills &amp; requirements
                  </button>
                </AIResult>
              )}
              <div><label className="label">Technical requirement</label>
                <input className="input" value={form.requirement_technical || ""} onChange={set("requirement_technical")} /></div>
              <div>
                <label className="label">Job description <span className="text-red-400">*</span></label>
<div data-invalid={bad("description") ? "true" : undefined}>
                                <textarea className={`input ${bad("description") ? "!border-red-400 !bg-red-50/50 !ring-4 !ring-red-100" : ""}`} rows={8} value={form.description || ""} aria-invalid={bad("description")}
                          onChange={(e) => { set("description")(e); if (e.target.value.trim()) clearInvalid("description"); }}
                          placeholder="Describe the role, responsibilities and what a good candidate looks like — or press Draft from title and edit what comes back." />
                <FieldError k="description" />
                </div>
                <div className="mt-1 flex justify-between text-xs text-slate-400">
                  <span>Anything AI writes lands here as normal text you can edit before posting.</span>
                  <span className="tabular-nums">{(form.description || "").length}</span>
                </div>
              </div>
            </div>
          </AdStep>

          {/* 4 — contact */}
          <div id="pj-4" className="scroll-mt-4" />
          <AdStep plain n={4} title="Contact" sub="Filled in from your profile — edit if a different person handles this role.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Recruiter name</label>
                <input className="input" value={form.recruiter_name || ""} onChange={set("recruiter_name")} /></div>
              <div><label className="label">Recruiter phone</label>
                <input className="input" value={form.recruiter_phone || ""} onChange={set("recruiter_phone")} /></div>
              <div className="sm:col-span-2"><label className="label">Recruiter email</label>
                <input className="input" value={form.recruiter_email || ""} onChange={set("recruiter_email")} /></div>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:col-span-2">
                Show recruiter contact details to job seekers
                <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${form.contact_visible ? "bg-navy" : "bg-slate-300"}`}>
                  <input type="checkbox" className="sr-only" checked={!!form.contact_visible}
                         onChange={(e) => setForm({ ...form, contact_visible: e.target.checked })} />
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.contact_visible ? "left-[22px]" : "left-0.5"}`} />
                </span>
              </label>
            </div>
          </AdStep>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <button type="button" className="text-[13px] font-semibold text-slate-400 hover:text-red-500"
                    onClick={() => { setForm({ contact_visible: true, key_skills: [] }); setInvalid([]); toast("Form cleared."); }}>
              Clear form
            </button>
            <div className="flex gap-2">
              <button type="button" className="btn-outline !rounded-full" onClick={() => setPreview(true)}><IconEye size={15} /> Preview</button>
              <button className="btn !rounded-full !px-7" onClick={submit}>Post this job</button>
            </div>
          </div>
        </div>

        {/* ---------------- RIGHT RAIL ---------------- */}
        <aside className="order-1 lg:order-2">
          <div className="space-y-4 lg:sticky lg:top-24">
            {/* compact live job card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Live preview <span className="flex items-center gap-1 normal-case tracking-normal"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> as candidates see it</span>
              </p>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 font-heading font-bold text-navy">{(form.title || "?")[0].toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="truncate font-heading text-[15px] font-bold text-slate-900">{form.title || "Job title"}</p>
                  <p className="truncate text-[12px] text-slate-500">{[form.location, form.shift].filter(Boolean).join(" · ") || "Location · Shift"}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                {salaryText && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">{salaryText}{({ monthly: "/mo", annual: "/yr", daily: "/day", hourly: "/hr" })[form.wage_basis || "monthly"] || ""}</span>}
                {form.experience && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{form.experience}</span>}
                {form.is_urgent && <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-600">Urgent</span>}
              </div>
              {(form.key_skills || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {form.key_skills.slice(0, 4).map((k) => <span key={k} className="rounded-md bg-navy-50 px-1.5 py-0.5 text-[10.5px] font-medium text-navy">{k}</span>)}
                  {form.key_skills.length > 4 && <span className="text-[10.5px] text-slate-400">+{form.key_skills.length - 4}</span>}
                </div>
              )}
            </div>

            {/* guidance: only quality tips the required-field checks don't already cover,
                and only the ones still open — so nothing here repeats the step bar. */}
            {(() => {
              const nSkills = (form.key_skills || []).length;
              const descLen = String(form.description || "").trim().length;
              const tips = [
                [!!(form.wage_min || form.wage_max), "Show the salary range", "Candidates skip posts that hide pay.", "pj-2"],
                [nSkills >= 3 && nSkills <= 6, "List 3–6 key skills",
                  nSkills > 6 ? `You have ${nSkills} — keep the 6 that matter most.` : `You have ${nSkills} — add ${3 - nSkills} more for better matches.`, "pj-2"],
                [descLen >= 150, "Write 150+ characters",
                  descLen ? `${descLen} so far — add duties, timings and who fits.` : "Describe duties, timings and who fits.", "pj-3"],
                [!!(form.accommodation || form.food_provided || form.is_urgent), "Mention perks or urgency",
                  "Food, stay or urgent hiring lifts responses.", "pj-2"],
                [!!form.contact_visible && !!(form.recruiter_phone || form.recruiter_email), "Show how to reach you",
                  "Visible contact details build trust.", "pj-4"],
              ];
              const open = tips.filter(([ok]) => !ok);
              const done = tips.length - open.length;
              if (!open.length) {
                return (
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><IconCheck size={16} strokeWidth={3} /></span>
                    <div>
                      <p className="text-[13px] font-bold text-emerald-800">Great post</p>
                      <p className="text-[11.5px] text-emerald-700/80">Pay, skills, description, perks and contact are all covered.</p>
                    </div>
                  </div>
                );
              }
              return (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Make it stand out</p>
                    <span className="text-[11.5px] font-semibold text-slate-500">{done}/{tips.length} done</span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {tips.map(([ok], i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-200"}`} />)}
                  </div>
                  <ul className="mt-3 space-y-1">
                    {open.map(([, t, d, id]) => (
                      <li key={t}>
                        <button type="button" onClick={() => goStep(id)}
                                className="group flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-slate-50">
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12.5px] font-semibold text-slate-800">{t}</span>
                            <span className="block text-[11.5px] leading-snug text-slate-500">{d}</span>
                          </span>
                          <span className="shrink-0 self-center text-[11.5px] font-semibold text-navy opacity-60 group-hover:opacity-100">Fix →</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </div>
        </aside>
      </div>
    </div>
  );
}
