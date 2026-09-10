import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "./ui";
import { useDialog } from "./Dialog";
import { AIButton, AIResult, AIList, useAI, useAICall } from "./AIPanel";
import { Combobox } from "./fields";
import SkillPicker from "./SkillPicker";
import { useTaxonomy, SectorList, RolePicker } from "./SectorPicker";
import { IconSparkle } from "./icons";
import { CITIES, QUALIFICATIONS, EXPERIENCE } from "../lib/options";

/* =====================================================================
   Post a job — shared by the recruiter and institute portals.

   Institute used to have its own smaller PostJob: no sector/role taxonomy
   pickers, no JD parsing, no AI draft, and fewer fields. That is why the
   institute screen looked nothing like the recruiter one. Both now render
   this component.
   ===================================================================== */
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
  return (
    <div className="w-full">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-navy">{heading}</h2>
        {aiOn && (
          <div className="flex gap-2">
            <button className="btn-outline btn-sm" onClick={() => setJdOpen((o) => !o)}>
              <IconSparkle size={14} /> Upload / paste a JD
            </button>
          </div>
        )}
      </div>

      {jdOpen && (
        <div className="card mb-4 border-navy-200 bg-navy-50/40">
          <h3 className="font-semibold text-navy">Paste your job description</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Paste a JD from anywhere — AI fills in every field below automatically.
          </p>
          <label className="btn-outline btn-sm mt-3 inline-flex cursor-pointer">
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
            <button className="btn-green btn-sm" onClick={parseJD} disabled={aiBusy || jdText.trim().length < 40}>
              {aiBusy ? "Reading…" : "Auto-fill the form"}
            </button>
            <button className="btn-outline btn-sm" onClick={() => setJdOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ---------------- MAIN: the actual job posting form ---------------- */}
        <div className="order-2 lg:order-1">
          <div className="card grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            <div className="sm:col-span-2 2xl:col-span-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="label !mb-0">Job title <span className="text-red-400">*</span></label>
                {aiOn && form.title && (
                  <button className="btn-ghost btn-sm !text-navy" onClick={() => autoConfigure(form.title)} disabled={aiBusy}>
                    <IconSparkle size={13} /> {aiBusy ? "Configuring…" : "Auto-configure"}
                  </button>
                )}
              </div>
              <input className="input mt-1.5" value={form.title || ""} onChange={set("title")}
                     placeholder="e.g. Electrician, Cook, Staff Nurse, Software Engineer" />
              {form.sector && tax && (
                <p className="mt-1.5 text-xs text-slate-400">
                  Sector: <b className="text-navy">{tax.sectors.find((x) => x.key === form.sector)?.name}</b>
                  {" · "}
                  <button className="underline hover:text-navy" onClick={() => setForm({ ...form, sector: null })}>change</button>
                </p>
              )}
            </div>

            <div><label className="label">Job code</label>
              <input className="input" value={form.job_code || ""} onChange={set("job_code")} placeholder="e.g. ELEC/001" /></div>
            <Combobox label="Location" value={form.location} options={CITIES} onChange={setV("location")} />
            <Combobox label="Qualification/s" value={form.category} options={QUALIFICATIONS} onChange={setV("category")} aiField="required qualification" />
            <div><label className="label">No. of positions</label>
              <input className="input" value={form.no_of_positions || ""} onChange={set("no_of_positions")} /></div>

            <Combobox label="Job type" value={form.job_type} options={(tax?.job_types || []).map((t) => t.label)} onChange={setV("job_type")} />
            <Combobox label="Education required" value={form.education_level}
                      options={(tax?.education_levels || []).map((t) => t.label)} onChange={setV("education_level")} />
            <Combobox label="Experience" value={form.experience} options={EXPERIENCE} onChange={setV("experience")} />
            <div className="sm:col-span-2 2xl:col-span-3">
              <label className="label">Salary Range</label>
              <div className="flex items-center gap-2">
                <input className="input" value={form.wage_min || ""} onChange={set("wage_min")}
                       placeholder="e.g. 15,000" aria-label="Salary from" />
                <span className="shrink-0 text-sm text-slate-400">to</span>
                <input className="input" value={form.wage_max || ""} onChange={set("wage_max")}
                       placeholder="e.g. 25,000" aria-label="Salary to" />
              </div>
            </div>
            <div><label className="label">Shift</label>
              <input className="input" value={form.shift || ""} onChange={set("shift")} placeholder="Day / Night / Rotational" /></div>

            <div className="sm:col-span-2 2xl:col-span-3">
              <SkillPicker values={form.key_skills || []} onChange={setV("key_skills")} sector={form.sector}
                           aiSuggestPath={aiOn && form.title ? "/api/ai/job/classify" : null}
                           aiBody={{ title: form.title }} />
            </div>

            <div className="flex flex-wrap gap-4 sm:col-span-2 2xl:col-span-3">
              {[["is_urgent", "Urgent hiring"], ["accommodation", "Accommodation provided"], ["food_provided", "Food provided"]].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={!!form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} /> {l}
                </label>
              ))}
            </div>

            {aiDraft && (
              <div className="sm:col-span-2 2xl:col-span-3">
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
              </div>
            )}

            <div className="sm:col-span-2 2xl:col-span-3"><label className="label">Technical requirement</label>
              <input className="input" value={form.requirement_technical || ""} onChange={set("requirement_technical")} /></div>
            <div className="sm:col-span-2 2xl:col-span-3">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <label className="label !mb-0">Job description</label>
                {aiOn && (
                  /* Sits here rather than in the page header: by the time you've
                     entered the title, skills and technical requirement, the AI
                     has enough to write a usable draft — and the result lands in
                     the box directly below, where you can edit it. */
                  <button type="button" className="btn-outline btn-sm" onClick={draftWithAI} disabled={aiBusy}>
                    <IconSparkle size={14} />
                    {aiBusy ? "Drafting…" : form.description ? "Redraft with AI" : "Draft from title"}
                  </button>
                )}
              </div>
              <textarea className="input" rows={8} value={form.description || ""} onChange={set("description")}
                        placeholder="Describe the role, responsibilities and what a good candidate looks like — or press Draft from title and edit what comes back." />
              <p className="mt-1 text-xs text-slate-400">
                Anything AI writes lands here as normal text you can edit before posting.
              </p>
            </div>

            <p className="text-xs text-slate-400 sm:col-span-2 2xl:col-span-3">
              Filled in from your profile — edit if a different person handles this role.
            </p>
            <div><label className="label">Recruiter name</label>
              <input className="input" value={form.recruiter_name || ""} onChange={set("recruiter_name")} /></div>
            <div><label className="label">Recruiter phone</label>
              <input className="input" value={form.recruiter_phone || ""} onChange={set("recruiter_phone")} /></div>
            <div className="sm:col-span-2 2xl:col-span-3"><label className="label">Recruiter email</label>
              <input className="input" value={form.recruiter_email || ""} onChange={set("recruiter_email")} /></div>

            <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2 2xl:col-span-3">
              <input type="checkbox" checked={form.contact_visible}
                     onChange={(e) => setForm({ ...form, contact_visible: e.target.checked })} />
              Show recruiter contact details to job seekers
            </label>

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 sm:col-span-2 2xl:col-span-3">
              <button className="btn flex-1 !py-3" onClick={submit}>Post this job</button>
              <button className="btn-outline" onClick={() => { setForm({ contact_visible: true, key_skills: [] }); toast("Form cleared."); }}>
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* ---------------- RIGHT RAIL: pick sector & role ---------------- */}
        <aside className="order-1 lg:order-2">
          <div className="space-y-4 lg:sticky lg:top-20">
            <div className="card !p-4">
              <h3 className="text-[13.5px] font-bold text-slate-800">What kind of work is this?</h3>
              <p className="mt-0.5 text-[11.5px] leading-snug text-slate-400">
                {tax ? `${tax.sectors.length} sectors · ${tax.role_count}+ roles — daily wage to postgraduate`
                     : "Loading sectors…"}
              </p>
              <div className="mt-3">
                <SectorList sectors={tax?.sectors || []} value={form.sector} onChange={(v) => {
                  const sec = tax?.sectors.find((x) => x.key === v);
                  setForm({ ...form, sector: v,
                    education_level: sec?.education || form.education_level,
                    wage_basis: sec?.wage_basis || form.wage_basis });
                }} />
              </div>
            </div>

            {form.sector && (
              <div className="card !p-4">
                <h3 className="mb-2 text-[13.5px] font-bold text-slate-800">Pick the role</h3>
                <RolePicker sectors={tax?.sectors || []} sector={form.sector} value={form.title}
                            onChange={(r) => { setForm({ ...form, title: r }); if (aiOn) autoConfigure(r); }} />
                <p className="mt-2 text-[11px] text-slate-400">
                  Choosing a role fills the title and configures pay and education for you.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

