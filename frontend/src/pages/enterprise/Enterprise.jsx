import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { api, getToken, mediaUrl } from "../../lib/api";
import { DashboardLayout, StatusBadge, useToast } from "../../components/ui";
import { useDialog, useConfirm } from "../../components/Dialog";
import Chat from "../../components/Chat";
import ResumeView from "../jobseeker/ResumeView";
import UploadedResumeView from "../jobseeker/UploadedResumeView";

/* A seeker who ticked "show my uploaded resume to recruiters" should actually
   get that — otherwise the promise on their profile is false. Falls back to the
   generated resume whenever there is no file. */
const SeekerResume = ({ seeker, meta }) => (
  seeker?.prefer_uploaded_resume && seeker?.uploaded_resume_url
    ? <UploadedResumeView seeker={seeker} />
    : <ResumeView seeker={seeker} meta={meta} />
);
import {
  IconBuilding, IconSearch, IconBriefcase, IconClipboard, IconSparkle, IconChat, IconEye, IconDownload,
  IconChart, IconLayers, IconEdit, IconClose, IconRefresh, IconPrint, IconStar, IconCheck,
} from "../../components/icons";
import { MatchBar, SwitchableChart } from "../../components/charts";
import RichText, { Markdown } from "../../components/RichText";
import ImageUpload from "../../components/ImageUpload";
import PostJobForm from "../../components/PostJobForm";
import PlanPanel, { PlanGate, QuotaNotice } from "../../components/PlanPanel";
import ViewSwitcher from "../../components/ViewSwitcher";
import FitRating, { fitBand } from "../../components/FitRating";
import PhoneField from "../../components/PhoneField";
import BannerSlot from "../../components/BannerSlot";
import BannerAnalytics from "../../components/BannerAnalytics";
import { useTaxonomy } from "../../components/SectorPicker";
import SkillPicker from "../../components/SkillPicker";
import { AIButton, AIResult, AIList, useAI, useAICall } from "../../components/AIPanel";
import { Combobox, TagInput } from "../../components/fields";
import { QUALIFICATIONS, CITIES, EXPERIENCE } from "../../lib/options";

const MENU = [
  { to: "/enterprise", label: "Dashboard", icon: IconChart },
  { to: "/enterprise/profile", label: "Company profile", icon: IconBuilding },
  { to: "/enterprise/resumes", label: "Resume search", icon: IconSearch },
  { to: "/enterprise/post-job", label: "Post a job", icon: IconBriefcase },
  { to: "/enterprise/manage-jobs", label: "Manage jobs", icon: IconLayers },
  { to: "/enterprise/applications", label: "Applications", icon: IconClipboard },
  { to: "/enterprise/ads", label: "Post an Ad", icon: IconSparkle },
  { to: "/enterprise/messages", label: "Messages", icon: IconChat, badge: true },
  { to: "/enterprise/billing", label: "Plan & billing", icon: IconStar },
];

const STATUSES = ["Applied", "Under Review", "Shortlisted", "Rejected", "Selected"];

export default function Enterprise() {
  return (
    <DashboardLayout title="Recruiter / Enterprise" menu={MENU}>
      <PlanGate />
      <Routes>
        <Route index element={<Overview />} />
        <Route path="profile" element={<Profile />} />
        <Route path="manage-jobs" element={<ManageJobs />} />
        <Route path="resumes" element={<ResumeSearch />} />
        <Route path="post-job" element={<PostJob />} />
        <Route path="applications" element={<Applications />} />
        <Route path="ads" element={<PostBanner />} />
        <Route path="messages" element={<Chat canBlock />} />
        <Route path="billing" element={<PlanPanel />} />
        <Route path="*" element={<Navigate to="/enterprise" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

function Overview() {
  const [d, setD] = useState(null);
  const [jobs, setJobs] = useState([]);
  useEffect(() => {
    const load = () => {
      api.get("/api/enterprise/dashboard").then(setD).catch(() => {});
      api.get("/api/enterprise/jobs").then(setJobs).catch(() => {});
    };
    load(); const id = setInterval(load, 10000); return () => clearInterval(id);
  }, []);
  if (!d) return <Loading />;

  /* Stage colours run grey -> amber -> navy -> blue -> violet -> green, so the
     pipeline reads as progress at a glance rather than as unrelated buckets.
     Rejected is the only red. */
  const STATUS_COLOR = {
    Applied: "#94a3b8", "Under Review": "#f59e0b", Shortlisted: "#10256b",
    "Interview - Phase 1": "#60a5fa", "Interview - Phase 2": "#3b82f6",
    "Interview - Phase 3": "#2563eb", "Managerial Round": "#8b5cf6",
    Offered: "#4ade80", Hired: "#4faa38", "On Hold": "#cbd5e1",
    Rejected: "#ef4444",
  };
  const pipeline = Object.entries(d.by_status || {}).filter(([, v]) => v > 0)
    .map(([label, value]) => ({ label: label.replace("Interview - ", ""), value, color: STATUS_COLOR[label] }));

  // Left uncoloured on purpose: withColors() then gives each job its own hue,
  // which is the point of a per-job breakdown.
  const byJob = jobs.filter((j) => j.applicants > 0)
    .sort((a2, b2) => b2.applicants - a2.applicants).slice(0, 8)
    .map((j) => ({ label: j.title, value: j.applicants }));

  const byStatus = [
    { label: "Active", value: d.jobs_active, color: "#4faa38" },
    { label: "Closed", value: Math.max(0, (d.jobs_total || 0) - (d.jobs_active || 0)), color: "#94a3b8" },
  ];

  const byLocation = Object.entries(
    jobs.reduce((m, j) => (j.location ? { ...m, [j.location]: (m[j.location] || 0) + 1 } : m), {})
  ).map(([label, value]) => ({ label, value })).sort((x, y) => y.value - x.value).slice(0, 8);

  const applied = d.by_status?.Applied || 0;
  const hired = d.by_status?.Hired || 0;
  const shortlisted = (d.by_status?.Shortlisted || 0) + (d.by_status?.Offered || 0) + hired;
  const conversion = d.applications ? Math.round((shortlisted / d.applications) * 100) : 0;

  return (
    <div className="space-y-6">
      <BannerSlot audience="recruiters" compact />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Jobs posted" value={d.jobs_total} tone="navy" icon={IconBriefcase} />
        <Stat label="Active jobs" value={d.jobs_active} tone="green" icon={IconCheck} />
        <Stat label="Applications" value={d.applications} tone="blue" icon={IconClipboard} />
        <Stat label="Resumes viewed" value={d.resumes_viewed} tone="violet" icon={IconEye} />
        <Stat label="Shortlist rate" value={`${conversion}%`} tone="amber" icon={IconChart}
              hint={`${shortlisted} of ${d.applications || 0}`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <SwitchableChart title="Hiring pipeline" subtitle="Where every applicant currently sits"
                         data={pipeline} types={["bar", "hbar", "stacked", "donut", "pie", "radial"]} height={220} />
        <SwitchableChart title="Applications per job" subtitle="Your eight busiest postings"
                         data={byJob} types={["hbar", "bar", "donut", "radial", "area"]} height={220} />
        <SwitchableChart title="Jobs by location" subtitle="Where you're hiring"
                         data={byLocation} types={["hbar", "bar", "donut", "pie"]} height={220} />
        <SwitchableChart title="Posting status" subtitle="Active against closed"
                         data={byStatus} types={["donut", "stacked", "bar", "pie"]} height={220} />
      </div>

      {d.applications > 0 && (
        <div className="card">
          <h3 className="mb-3 font-bold text-slate-800">Funnel</h3>
          <div className="space-y-2">
            {[["Applications received", d.applications, "#94a3b8"],
              ["Shortlisted or better", shortlisted, "#10256b"],
              ["Hired", hired, "#4faa38"]].map(([label, value, hex]) => {
              const pct = d.applications ? Math.round((value / d.applications) * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-[12.5px]">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-bold tabular-nums text-slate-800">{value} · {pct}%</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full transition-all duration-500"
                         style={{ width: `${Math.max(2, pct)}%`, background: hex }} />
                  </div>
                </div>
              );
            })}
          </div>
          {applied > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              {applied} application(s) still sitting at &ldquo;Applied&rdquo; — move them along from the
              Applications tab.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const STAT_TONES = {
  navy:   { ring: "bg-navy-50 text-navy",                 text: "text-navy" },
  green:  { ring: "bg-brandgreen-50 text-brandgreen-600",  text: "text-brandgreen-600" },
  blue:   { ring: "bg-blue-50 text-blue-600",              text: "text-blue-600" },
  violet: { ring: "bg-violet-50 text-violet-600",          text: "text-violet-600" },
  amber:  { ring: "bg-amber-50 text-amber-600",            text: "text-amber-600" },
};

function Stat({ label, value, tone = "navy", icon: Icon, hint }) {
  const t = STAT_TONES[tone] || STAT_TONES.navy;
  return (
    <div className="card-hover flex items-center gap-3 !p-4">
      {Icon && (
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${t.ring}`}>
          <Icon size={20} />
        </span>
      )}
      <div className="min-w-0">
        <div className={`text-2xl font-extrabold leading-tight ${t.text}`}>{value}</div>
        <div className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
        {hint && <div className="text-[10px] text-slate-400">{hint}</div>}
      </div>
    </div>
  );
}

/* =====================================================================
   Manage Jobs
   ---------------------------------------------------------------------
   Four sub-tabs, matching the recruiter spec:

     Manage jobs    – cards with pipeline counts, search and status filter
     Modify the job – EVERY column on the job record is editable, with a
                      pencil (modify) affordance per column, a live count of
                      unsaved edits and a sticky SAVE bar
     Close the job  – flat list of jobs, CLOSE / REOPEN toggled per row and
                      applied together with one SAVE button
     Job responses  – jobs + response counts, job title hyperlinked through
                      to its applicants; each applicant shows the short
                      summary (name, education, location), the name opens
                      the full profile, which can be downloaded or saved
   ===================================================================== */
function ManageJobs() {
  const toast = useToast();
  const confirm = useConfirm();
  const dialog = useDialog();
  const tax = useTaxonomy();
  const [view, setView] = useState("jobs");        // jobs | close | responses
  const [jobs, setJobs] = useState(null);
  const [detail, setDetail] = useState(null);      // responses for one job
  const [editing, setEditing] = useState(null);    // job being modified
  const [original, setOriginal] = useState(null);  // pristine copy, for dirty-checking
  const [profile, setProfile] = useState(null);    // candidate profile being viewed
  const [tplMeta, setTplMeta] = useState([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all");
  const [jobView, setJobView] = useState("grid");
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/api/enterprise/jobs").then(setJobs);
  useEffect(() => { load(); }, []);

  /* ---------------- close / reopen a single job ---------------- */
  const closeJob = (job) => dialog({
    tone: "info",
    title: job.status === "active" ? "Close this job?" : "Reopen this job?",
    message: job.status === "active"
      ? `"${job.title}" will stop accepting applications and disappear from job search.`
      : `"${job.title}" will accept applications again.`,
    confirmLabel: job.status === "active" ? "Close job" : "Reopen",
    secondary: { label: "Cancel" },
    onConfirm: async () => {
      try {
        const status = job.status === "active" ? "closed" : "active";
        await api.put(`/api/enterprise/jobs/${job.id}/status`, { status });
        confirm(status === "closed" ? "Job closed successfully"
                                   : "Job reopened successfully",
                { message: `"${job.title}" ${status === "closed"
                    ? "no longer accepts applications and is hidden from job search."
                    : "is live again and accepting applications."}` });
        load();
      } catch (err) { toast(err.message, "error"); }
    },
  });

  /* ---------------- modify ---------------- */
  const openEdit = async (id) => {
    try {
      const job = await api.get(`/api/enterprise/jobs/${id}`);
      setEditing(job);
      setOriginal(job);                 // snapshot so we can show what changed
    } catch (err) { toast(err.message, "error"); }
  };
  const saveEdit = async () => {
    if (!editing.title?.trim()) return toast("Job title can't be empty.", "error");
    setSaving(true);
    try {
      await api.put(`/api/enterprise/jobs/${editing.id}`, editing);

      /* `status` is deliberately absent from JobBase, so PUT /jobs/{id} ignores
         it — sending it there would silently do nothing. It has its own
         validated endpoint, so post it separately when it actually changed. */
      if (original && editing.status !== original.status) {
        await api.put(`/api/enterprise/jobs/${editing.id}/status`, { status: editing.status });
      }

      dialog({ tone: "success", title: "Job updated",
               message: `"${editing.title}" has been saved.`, confirmLabel: "Done" });
      setEditing(null); setOriginal(null); load();
    } catch (err) { toast(err.message, "error"); }
    finally { setSaving(false); }
  };

  /* ---------------- responses ---------------- */
  const openResponses = async (id) => {
    try { setDetail(await api.get(`/api/enterprise/jobs/${id}/responses`)); }
    catch (err) { toast(err.message, "error"); }
  };

  /* Clicking an applicant's name opens their full profile, rendered with the
     same resume templates the candidate chose. `action` is recorded server-side
     so the seeker can see who viewed or downloaded them. */
  const openProfile = async (candidateId, action = "Viewed") => {
    try {
      const full = await api.get(`/api/enterprise/resumes/${candidateId}?action=${action}`);
      setProfile(full);
      if (!tplMeta.length) {
        const t = await api.get("/api/jobseeker/templates").catch(() => null);
        if (t) setTplMeta(t.meta || []);
      }
      if (action === "Downloaded") setTimeout(() => window.print(), 250);
    } catch (err) { toast(err.message, "error"); }
  };

  if (!jobs) return <Loading />;

  /* =========================================================
     Candidate profile — opened from an applicant's name
     ========================================================= */
  if (profile) {
    const meta = tplMeta.find((m) => m.key === (profile.resume_template || "classic"));
    const name = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email;
    return (
      <div>
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
          <button className="btn-outline btn-sm" onClick={() => setProfile(null)}>← Back to responses</button>
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline btn-sm" onClick={() => openProfile(profile.id, "Downloaded")}>
              <IconDownload size={14} /> Download profile
            </button>
            <button className="btn-outline btn-sm" onClick={() => window.print()}>
              <IconPrint size={14} /> Save at window
            </button>
          </div>
        </div>
        <p className="no-print mb-3 text-sm text-slate-500">
          Viewing <b className="text-slate-700">{name}</b>. Download saves a PDF through your
          browser's print dialog — choose "Save as PDF" as the destination.
        </p>
        <SeekerResume seeker={profile} meta={meta} />
      </div>
    );
  }

  /* =========================================================
     Modify the job — every column, with a SAVE button
     ========================================================= */
  if (editing) {
    const set = (k) => (v) => setEditing((e) => ({ ...e, [k]: v }));
    const setE = (k) => (ev) => setEditing((e) => ({ ...e, [k]: ev.target.value }));
    const setC = (k) => (ev) => setEditing((e) => ({ ...e, [k]: ev.target.checked }));

    const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    const changed = (k) => original && !same(editing[k], original[k]);
    const dirtyKeys = original ? Object.keys(editing).filter((k) => changed(k)) : [];

    /* A pencil sits on every column. Clicking it reverts that one column,
       which is what makes a per-column control useful once the field is
       already editable — you can undo a single mistake without reloading. */
    const Col = ({ k, label, span, children, hint }) => (
      <div className={span ? "sm:col-span-2 2xl:col-span-3" : ""}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label className="label !mb-0">{label}</label>
          <button type="button" title={changed(k) ? `Undo change to ${label}` : `Edit ${label}`}
                  onClick={() => changed(k) && set(k)(original[k])}
                  className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors
                    ${changed(k) ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                 : "text-slate-300 hover:text-navy"}`}>
            <IconEdit size={11} /> {changed(k) ? "undo" : ""}
          </button>
        </div>
        <div className={changed(k) ? "rounded-xl ring-2 ring-amber-300/70" : ""}>{children}</div>
        {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
    );
    const Txt = ({ k, ...rest }) => (
      <input className="input" value={editing[k] ?? ""} onChange={setE(k)} {...rest} />
    );

    return (
      <div className="max-w-5xl pb-24">
        <button className="btn-outline btn-sm mb-4" onClick={() => { setEditing(null); setOriginal(null); }}>
          ← Back to jobs
        </button>
        <h2 className="mb-1 text-xl font-bold text-navy">Modify the job</h2>
        <p className="mb-4 text-sm text-slate-500">
          Every column is editable. Changed columns are highlighted — use the pencil to undo one.
        </p>

        {/* ---- Role ---- */}
        <Section title="Role">
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            <Col k="title" label="Job title"><Txt k="title" /></Col>
            <Col k="job_code" label="Job code"><Txt k="job_code" placeholder="e.g. ELEC/001" /></Col>
            <Col k="sector" label="Sector"
                 hint={sectorName(tax, editing.sector) ? `Currently: ${sectorName(tax, editing.sector)}` : "Not set"}>
              <select className="input" value={editing.sector ?? ""} onChange={setE("sector")}>
                <option value="">— none —</option>
                {(tax?.sectors || []).map((s) => (
                  <option key={s.key} value={s.key}>{s.name}</option>
                ))}
              </select>
            </Col>
            <Col k="category" label="Qualification/s">
              <Combobox value={editing.category} options={QUALIFICATIONS} onChange={set("category")} />
            </Col>
            <Col k="location" label="Location">
              <Combobox value={editing.location} options={CITIES} onChange={set("location")} />
            </Col>
            <Col k="no_of_positions" label="No. of positions"><Txt k="no_of_positions" inputMode="numeric" /></Col>
          </div>
        </Section>

        {/* ---- Compensation & terms ---- */}
        <Section title="Compensation and terms">
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            <Col k="job_type" label="Job type">
              <Combobox value={editing.job_type} options={(tax?.job_types || []).map((t) => t.label)}
                        onChange={set("job_type")} />
            </Col>
            {/* wage_basis stores a taxonomy KEY (that's what sector auto-config
                writes), so show the label but keep the key as the value. */}
            <Col k="wage_basis" label="Wage basis">
              <select className="input" value={editing.wage_basis ?? ""} onChange={setE("wage_basis")}>
                <option value="">— none —</option>
                {(tax?.wage_basis || []).map((w) => (
                  <option key={w.key} value={w.key}>{w.label}</option>
                ))}
              </select>
            </Col>
            <Col k="experience" label="Experience">
              <Combobox value={editing.experience} options={EXPERIENCE} onChange={set("experience")} />
            </Col>
            <Col k="wage_min" label="Salary from"><Txt k="wage_min" placeholder="e.g. 15,000" /></Col>
            <Col k="wage_max" label="Salary to"><Txt k="wage_max" placeholder="e.g. 25,000" /></Col>
            <Col k="salary" label="Salary (free text)" hint="Shown when a range isn't set.">
              <Txt k="salary" />
            </Col>
            <Col k="shift" label="Shift"><Txt k="shift" placeholder="Day / Night / Rotational" /></Col>
            <Col k="education_level" label="Education required">
              <Combobox value={editing.education_level}
                        options={(tax?.education_levels || []).map((t) => t.label)}
                        onChange={set("education_level")} />
            </Col>
            <Col k="gender_preference" label="Gender preference"
                 hint="Leave blank unless the role legally requires it.">
              <Combobox value={editing.gender_preference} options={["", "Female", "Male", "Any"]}
                        onChange={set("gender_preference")} />
            </Col>
          </div>
        </Section>

        {/* ---- Requirements ---- */}
        <Section title="Requirements">
          <div className="grid gap-4">
            <Col k="key_skills" label="Key skills" span>
              <SkillPicker values={editing.key_skills || []} sector={editing.sector}
                           onChange={set("key_skills")} />
            </Col>
            <Col k="requirement_education" label="Education requirement" span>
              <textarea className="input" rows={3} value={editing.requirement_education ?? ""}
                        onChange={setE("requirement_education")} />
            </Col>
            <Col k="requirement_technical" label="Technical requirement" span>
              <textarea className="input" rows={3} value={editing.requirement_technical ?? ""}
                        onChange={setE("requirement_technical")} />
            </Col>
            <Col k="description" label="Description" span>
              <textarea className="input" rows={7} value={editing.description ?? ""}
                        onChange={setE("description")} />
            </Col>
          </div>
        </Section>

        {/* ---- Recruiter contact ---- */}
        <Section title="Recruiter contact">
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            <Col k="recruiter_name" label="Recruiter name"><Txt k="recruiter_name" /></Col>
            <Col k="recruiter_phone" label="Recruiter phone"><Txt k="recruiter_phone" inputMode="tel" /></Col>
            <Col k="recruiter_email" label="Recruiter email"><Txt k="recruiter_email" type="email" /></Col>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={!!editing.contact_visible} onChange={setC("contact_visible")} />
            Show recruiter contact details to job seekers
          </label>
        </Section>

        {/* ---- Options ---- */}
        <Section title="Options">
          <div className="flex flex-wrap gap-5">
            {[["is_urgent", "Urgent hiring"], ["accommodation", "Accommodation provided"],
              ["food_provided", "Food provided"]].map(([k, l]) => (
              <label key={k} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-600
                                         ${changed(k) ? "bg-amber-50 ring-1 ring-amber-300" : ""}`}>
                <input type="checkbox" checked={!!editing[k]} onChange={setC(k)} /> {l}
              </label>
            ))}
          </div>
          <div className="mt-4 max-w-xs">
            <Col k="status" label="Posting status">
              <Combobox value={editing.status} options={["active", "closed"]} onChange={set("status")} />
            </Col>
          </div>
        </Section>

        {/* ---- sticky save bar ---- */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <span className="text-sm text-slate-500">
              {dirtyKeys.length
                ? <><b className="text-amber-600">{dirtyKeys.length}</b> unsaved change{dirtyKeys.length > 1 ? "s" : ""}</>
                : "No changes yet"}
            </span>
            <div className="flex-1" />
            <button className="btn-outline btn-sm" disabled={!dirtyKeys.length || saving}
                    onClick={() => setEditing(original)}>Reset all</button>
            <button className="btn !px-8" onClick={saveEdit} disabled={saving || !dirtyKeys.length}>
              {saving ? "Saving…" : "SAVE"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================
     Applicants for one job (short summary; name opens profile)
     ========================================================= */
  if (detail) {
    return (
      <div>
        <button className="btn-outline btn-sm mb-4" onClick={() => setDetail(null)}>← Back to responses</button>
        <h2 className="mb-1 text-xl font-bold text-navy">{detail.job.title}</h2>
        <p className="mb-4 text-sm text-slate-500">
          {detail.responses.length} response(s) · {detail.job.job_code || "no code"} · {detail.job.location}
          <span className="ml-2 text-slate-400">Click a name to open the full profile.</span>
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          {detail.responses.map((r) => (
            <div key={r.application_id}
                 className="group rounded-xl border border-slate-200 bg-white p-4 transition-all
                            hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-cardhover">
              <div className="flex items-start gap-3">
                <button onClick={() => openProfile(r.candidate_id)} className="shrink-0">
                  {r.photo
                    ? <img src={mediaUrl(r.photo)} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-200" />
                    : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 font-bold text-navy">
                        {(r.name || "?")[0].toUpperCase()}</div>}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => openProfile(r.candidate_id)}
                            className="font-bold text-navy hover:underline">{r.name}</button>
                    <MatchBar score={r.match_score} />
                  </div>
                  <p className="text-[12.5px] text-slate-500">{r.education}</p>
                  <p className="text-[12px] text-slate-400">{r.location}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(r.key_skills || []).slice(0, 5).map((k) => (
                      <span key={k} className="badge bg-slate-100 text-slate-600">{k}</span>
                    ))}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                <button className="btn-outline btn-sm flex-1" onClick={() => openProfile(r.candidate_id)}>
                  <IconEye size={14} /> Open profile
                </button>
                <button className="btn-outline btn-sm flex-1"
                        onClick={() => openProfile(r.candidate_id, "Downloaded")}>
                  <IconDownload size={14} /> Download
                </button>
                <span className="shrink-0 self-center text-[11px] text-slate-400">
                  {new Date(r.applied_on).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
          {detail.responses.length === 0 && (
            <div className="card col-span-full text-center text-slate-400">No responses yet.</div>
          )}
        </div>
      </div>
    );
  }

  const filtered = jobs
    .filter((j) => tab === "all" || j.status === tab)
    .filter((j) => !q || `${j.title} ${j.location} ${(j.key_skills || []).join(" ")}`.toLowerCase().includes(q.toLowerCase()));
  const counts = { all: jobs.length, active: jobs.filter((j) => j.status === "active").length,
                   closed: jobs.filter((j) => j.status === "closed").length };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Manage jobs</h2>
          <p className="text-sm text-slate-500">
            {jobs.reduce((a, j) => a + j.applicants, 0)} responses across {jobs.length} jobs
          </p>
        </div>
        {view !== "close" && (
          <input className="input max-w-xs" placeholder="Search jobs, location or skill…"
                 value={q} onChange={(e) => setQ(e.target.value)} />
        )}
      </div>

      <div className="mb-4 flex gap-1.5 rounded-xl bg-slate-100 p-1.5">
        {[["jobs", "Manage jobs"], ["close", "Close the job"], ["responses", "Job responses"]].map(([k, label]) => (
          <button key={k} onClick={() => setView(k)}
            className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${
              view === k ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>{label}</button>
        ))}
      </div>

      {view === "close" ? (
        <CloseJobs jobs={jobs} onSaved={load} />
      ) : view === "responses" ? (
        <div className="card overflow-hidden !p-0">
          <table className="table">
            <thead><tr><th>Job title</th><th>Code</th><th>Location</th><th>Status</th>
              <th className="text-right">Responses</th></tr></thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="cursor-pointer" onClick={() => openResponses(j.id)}>
                  <td>
                    <button className="font-semibold text-navy hover:underline">{j.title}</button>
                  </td>
                  <td className="text-slate-500">{j.job_code || "—"}</td>
                  <td className="text-slate-500">{j.location}</td>
                  <td>
                    <span className={`badge ${j.status === "active" ? "bg-brandgreen-50 text-brandgreen-600" : "bg-slate-100 text-slate-500"}`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className={`font-bold ${j.applicants ? "text-navy" : "text-slate-300"}`}>{j.applicants}</span>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-400">No jobs posted yet.</td></tr>
              )}
            </tbody>
          </table>
          <p className="px-4 py-3 text-xs text-slate-400">Click a job title to see its applicants.</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 rounded-lg bg-slate-100 p-1">
            {["all", "active", "closed"].map((k) => (
              <button key={k} onClick={() => setTab(k)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                  tab === k ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
                {k} ({counts[k]})
              </button>
            ))}
          </div>
            <div className="flex-1" />
            <ViewSwitcher value={jobView} onChange={setJobView} />
          </div>

          {jobView === "compact" ? (
            <div className="card overflow-hidden !p-0">
              <table className="table">
                <thead><tr><th>Job title</th><th>Location</th><th>Status</th>
                  <th className="text-right">Responses</th><th className="text-right">Actions</th></tr></thead>
                <tbody>
                  {filtered.map((j) => (
                    <tr key={j.id}>
                      <td>
                        <button className="font-semibold text-navy hover:underline"
                                onClick={() => openEdit(j.id)}>{j.title}</button>
                        <div className="text-[11px] text-slate-400">{j.job_code || "no code"}</div>
                      </td>
                      <td className="text-slate-500">{j.location || "—"}</td>
                      <td>
                        <span className={`badge ${j.status === "active"
                          ? "bg-brandgreen-50 text-brandgreen-600" : "bg-slate-100 text-slate-500"}`}>
                          {j.status}
                        </span>
                      </td>
                      <td className="text-right font-bold text-navy">{j.applicants}</td>
                      <td className="text-right">
                        <button className="btn-outline btn-sm mr-1" onClick={() => openEdit(j.id)}>Modify</button>
                        <button className="btn-outline btn-sm" onClick={() => openResponses(j.id)}>Responses</button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="py-10 text-center text-slate-400">No jobs match.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
          <div className={jobView === "list"
            ? "grid max-w-lg gap-4"                   /* one grid-sized card per row */
            : "grid gap-4 lg:grid-cols-2"}>
            {filtered.map((j) => (
              <div key={j.id}
                   className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200
                              hover:-translate-y-1 hover:border-navy-200 hover:shadow-cardhover">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-800">{j.title}</h3>
                        <button onClick={() => openEdit(j.id)} title="Modify this job"
                                className="rounded-md p-1 text-slate-300 transition-colors hover:bg-navy-50 hover:text-navy">
                          <IconEdit size={14} />
                        </button>
                        {j.is_urgent && <span className="badge bg-red-100 text-red-700">Urgent</span>}
                        <span className={`badge ${j.status === "active" ? "bg-brandgreen-50 text-brandgreen-600" : "bg-slate-100 text-slate-500"}`}>
                          {j.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[13px] text-slate-500">
                        {[j.job_code, j.location, j.experience].filter(Boolean).join(" · ")}
                      </p>
                      <p className="text-[12px] text-slate-400">
                        {j.no_of_positions} position(s)
                        {(j.wage_min || j.salary) && ` · ${j.salary || `${j.wage_min}${j.wage_max ? " – " + j.wage_max : ""}`}`}
                      </p>
                      {/* Expiry is why an active job can stop attracting
                          applicants, so it belongs on the card rather than
                          only in the post confirmation. */}
                      <ExpiryNote expiresAt={j.expires_at} status={j.status} />
                    </div>
                    <button onClick={() => { setView("responses"); openResponses(j.id); }} className="shrink-0 text-center">
                      <div className="text-2xl font-extrabold text-navy hover:underline">{j.applicants}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">responses</div>
                    </button>
                  </div>

                  {(j.key_skills || []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {j.key_skills.slice(0, 6).map((k) => (
                        <span key={k} className="badge bg-slate-100 text-slate-600">{k}</span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[["New", j.new_applicants, "text-slate-600"],
                      ["Shortlisted", j.shortlisted, "text-navy"],
                      ["Hired", j.hired, "text-brandgreen-600"]].map(([label, val, cls]) => (
                      <div key={label} className="rounded-lg bg-slate-50 py-1.5 text-center transition-colors group-hover:bg-navy-50/60">
                        <div className={`text-sm font-bold ${cls}`}>{val}</div>
                        <div className="text-[10px] text-slate-400">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                  <button className="btn-outline btn-sm flex-1" onClick={() => openEdit(j.id)}>
                    <IconEdit size={13} /> Modify
                  </button>
                  <button className="btn-outline btn-sm flex-1" onClick={() => openResponses(j.id)}>Responses</button>
                  <button className="btn-outline btn-sm" onClick={() => closeJob(j)}>
                    {j.status === "active" ? <><IconClose size={13} /> Close</> : <><IconRefresh size={13} /> Reopen</>}
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="card col-span-full text-center text-slate-400">
                {q ? "No jobs match your search." : "You haven't posted any jobs yet."}
              </div>
            )}
          </div>
          )}
        </>
      )}
    </div>
  );
}

/* Sector column stores the taxonomy key; this resolves it for display. */
function sectorName(tax, key) {
  if (!key) return null;
  return ((tax?.sectors || []).find((s) => s.key === key) || {}).name || key;
}

/* Section wrapper used by the Modify screen. */
function Section({ title, children }) {
  return (
    <div className="card mb-4">
      <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------------
   Close the job — the spec asks for a list of jobs, a CLOSE button and a
   SAVE button. Toggles are staged locally so several jobs can be closed or
   reopened in one pass, then committed together by SAVE.
   --------------------------------------------------------------------- */
function CloseJobs({ jobs, onSaved }) {
  const toast = useToast();
  const [pending, setPending] = useState({});   // { [jobId]: "active" | "closed" }
  const [saving, setSaving] = useState(false);

  const statusOf = (j) => pending[j.id] ?? j.status;
  const toggle = (j) => {
    const next = statusOf(j) === "active" ? "closed" : "active";
    setPending((p) => {
      const copy = { ...p };
      if (next === j.status) delete copy[j.id];   // back to original — not a change
      else copy[j.id] = next;
      return copy;
    });
  };

  const ids = Object.keys(pending);
  const save = async () => {
    setSaving(true);
    let ok = 0;
    const failed = [];
    for (const id of ids) {
      try {
        await api.put(`/api/enterprise/jobs/${id}/status`, { status: pending[id] });
        ok += 1;
      } catch (err) {
        failed.push((jobs.find((j) => String(j.id) === String(id)) || {}).title || id);
      }
    }
    setSaving(false);
    setPending({});
    await onSaved();
    if (failed.length) toast(`${ok} saved. Failed: ${failed.join(", ")}`, "error");
    else toast(`${ok} job${ok === 1 ? "" : "s"} updated.`);
  };

  if (!jobs.length) {
    return <div className="card text-center text-slate-400">You haven't posted any jobs yet.</div>;
  }

  return (
    <div>
      <div className="card overflow-hidden !p-0">
        <table className="table">
          <thead><tr><th>Job title</th><th>Code</th><th>Location</th>
            <th className="text-right">Responses</th><th>Status</th><th className="text-right">Action</th></tr></thead>
          <tbody>
            {jobs.map((j) => {
              const st = statusOf(j);
              const dirty = st !== j.status;
              return (
                <tr key={j.id} className={dirty ? "bg-amber-50/60" : ""}>
                  <td className="font-semibold text-slate-700">{j.title}</td>
                  <td className="text-slate-500">{j.job_code || "—"}</td>
                  <td className="text-slate-500">{j.location || "—"}</td>
                  <td className="text-right text-slate-500">{j.applicants}</td>
                  <td>
                    <span className={`badge ${st === "active" ? "bg-brandgreen-50 text-brandgreen-600" : "bg-slate-100 text-slate-500"}`}>
                      {st}
                    </span>
                    {dirty && <span className="ml-1 text-[10px] font-bold text-amber-600">unsaved</span>}
                  </td>
                  <td className="text-right">
                    <button className="btn-outline btn-sm" onClick={() => toggle(j)}>
                      {st === "active" ? <><IconClose size={13} /> CLOSE</> : <><IconRefresh size={13} /> REOPEN</>}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-sm text-slate-500">
          {ids.length
            ? <><b className="text-amber-600">{ids.length}</b> job{ids.length > 1 ? "s" : ""} pending</>
            : "Toggle a job to close or reopen it, then save."}
        </span>
        <div className="flex-1" />
        <button className="btn-outline btn-sm" disabled={!ids.length || saving}
                onClick={() => setPending({})}>Cancel</button>
        <button className="btn !px-8" onClick={save} disabled={!ids.length || saving}>
          {saving ? "Saving…" : "SAVE"}
        </button>
      </div>
    </div>
  );
}

/* =====================================================================
   Company profile
   ---------------------------------------------------------------------
   Read mode is a clean summary: banner, About us, and a details grid that
   reflows 1 -> 2 -> 3 columns so nothing stretches across a wide screen.

   Edit mode is the only place the logo uploader appears — changing the
   logo is an edit, so it belongs behind "Edit profile" with everything
   else rather than sitting on the read-only view.
   ===================================================================== */
function Profile() {
  const toast = useToast();
  const confirm = useConfirm();
  const [p, setP] = useState(null);
  const [draft, setDraft] = useState(null);   // edits live here until saved
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get("/api/enterprise/profile").then(setP).catch(() => {}); }, []);

  /* Functional updates: ImageUpload's onUploaded resolves after the upload
     finishes and would otherwise write back a stale snapshot, discarding
     anything typed while the logo was uploading. */
  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));

  const startEdit = () => { setDraft({ ...p }); setEdit(true); };
  const cancelEdit = () => { setDraft(null); setEdit(false); };

  const save = async () => {
    if (!draft.name?.trim()) return toast("Company name can't be empty.", "error");
    setSaving(true);
    try {
      const saved = await api.put("/api/enterprise/profile", draft);
      setP(saved); setDraft(null); setEdit(false);
      confirm("Company profile updated successfully",
              { message: "Your changes are live on your company page and job postings." });
    } catch (err) { toast(err.message, "error"); }
    finally { setSaving(false); }
  };

  if (!p) return <Loading />;

  const view = edit ? draft : p;
  const location = [view.city, view.state, view.country].filter(Boolean).join(", ");

  return (
    <div className="max-w-5xl space-y-5">
      {/* ---------------- banner ---------------- */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-navy to-navy-600 p-6 text-white">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 ring-2 ring-white/25">
            {view.logo_url
              ? <img src={mediaUrl(view.logo_url)} alt="" className="h-full w-full object-contain" />
              : <span className="text-2xl font-extrabold text-navy">{(view.name || "?")[0]}</span>}
          </div>
          <div className="min-w-0 flex-1">
            {/* While editing, the name lives in the Company name field below.
                Showing it here as well meant two copies on screen, one of them
                not editable — confusing about which one is real. */}
            {edit ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Editing profile</p>
                <p className="text-sm text-navy-100">Changes apply when you press Save profile.</p>
              </>
            ) : (
              <h2 className="truncate text-2xl font-extrabold">{view.name}</h2>
            )}
            {!edit && location && <p className="text-sm text-navy-100">{location}</p>}
            {!edit && view.authorised_person_name && (
              <p className="text-xs text-white/60">
                {[view.authorised_person_name, view.designation].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          {edit ? (
            <div className="flex shrink-0 gap-2">
              <button className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-navy hover:bg-white/90 disabled:opacity-60"
                      onClick={save} disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
              <button className="rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10"
                      onClick={cancelEdit} disabled={saving}>Cancel</button>
            </div>
          ) : (
            <button className="shrink-0 rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10"
                    onClick={startEdit}>
              <IconEdit size={14} /> Edit profile
            </button>
          )}
        </div>
      </div>

      {edit ? (
        <>
          {/* Name and logo sit side by side: they are the two things that
              identify the company, and the logo is what the name looks like. */}
          <div className="card">
            <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              Company identity
            </h3>
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-w-0 space-y-4">
                <F2 label="Company name" value={draft.name} onChange={set("name")} />
                <F2 label="Website" value={draft.website} onChange={set("website")}
                    placeholder="www.yourcompany.com" />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <label className="label">Company logo</label>
                <ImageUpload kind="logo" round={false} currentUrl={draft.logo_url}
                             doneText="Logo saved."
                             onUploaded={(u) => set("logo_url")(u)} />
                <p className="mt-2 text-[11px] leading-snug text-slate-400">
                  Saves as soon as it uploads — it doesn't wait for Save profile.
                </p>
              </div>
            </div>
          </div>

          <FormCard title="Contact">
            <div className="sm:col-span-2 xl:col-span-3">
              <PhoneField label="Phone" value={draft.phone} onChange={set("phone")} />
            </div>
          </FormCard>

          <FormCard title="Address">
            <F2 label="Address line 1" value={draft.address1} onChange={set("address1")} span />
            <F2 label="Address line 2" value={draft.address2} onChange={set("address2")} span />
            <Combobox label="City" value={draft.city} options={CITIES} onChange={set("city")} />
            <F2 label="District" value={draft.district} onChange={set("district")} />
            <F2 label="State" value={draft.state} onChange={set("state")} />
            <F2 label="Country" value={draft.country} onChange={set("country")} />
          </FormCard>

          <FormCard title="Contact person">
            <F2 label="Authorised person" value={draft.authorised_person_name}
                onChange={set("authorised_person_name")} />
            <F2 label="Designation" value={draft.designation} onChange={set("designation")} />
            <F2 label="Promoter's name" value={draft.promoter_name} onChange={set("promoter_name")} />
          </FormCard>

          <FormCard title="Statutory">
            <F2 label="GST No." value={draft.gst_no} onChange={set("gst_no")} />
            <F2 label="PAN No." value={draft.pan_no} onChange={set("pan_no")} />
          </FormCard>

          <div className="card">
            <RichText label="About the organisation" value={draft.about} onChange={set("about")} rows={10}
                      hint="Describe your company, culture and what you're hiring for. Formatting: **bold**, ## heading, - list." />
          </div>

          <div className="sticky bottom-0 flex items-center gap-3 border-t border-slate-200 bg-white/95 py-3 backdrop-blur">
            <span className="text-sm text-slate-500">Changes aren't saved until you press Save.</span>
            <div className="flex-1" />
            <button className="btn-outline" onClick={cancelEdit} disabled={saving}>Cancel</button>
            <button className="btn !px-8" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="card">
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">About us</h3>
            <Markdown text={p.about} />
          </div>

          {/* Details reflow 1 -> 2 -> 3 columns; label sits above the value so
              nothing is stranded at opposite edges of a wide card. */}
          <div className="card">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Company details</h3>
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              <Row k="Email" v={p.email} />
              <Row k="Phone" v={p.phone} />
              <Row k="Website" v={p.website} link={p.website} />
              <Row k="City" v={p.city} />
              <Row k="District" v={p.district} />
              <Row k="State" v={p.state} />
              <Row k="Country" v={p.country} />
              <Row k="Address" v={[p.address1, p.address2].filter(Boolean).join(", ")} />
              <Row k="Authorised person" v={p.authorised_person_name} />
              <Row k="Designation" v={p.designation} />
              <Row k="Promoter" v={p.promoter_name} />
              <Row k="GST No." v={p.gst_no} />
              <Row k="PAN No." v={p.pan_no} />
            </dl>
          </div>
        </>
      )}
    </div>
  );
}

/* Card wrapper for a group of profile fields. */
function FormCard({ title, children }) {
  return (
    <div className="card">
      <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  );
}

function F2({ label, value, onChange, span, placeholder }) {
  return (
    <div className={span ? "sm:col-span-2 xl:col-span-3" : ""}>
      <label className="label">{label}</label>
      <input className="input" value={value || ""} placeholder={placeholder}
             onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ResumeSearch() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [instituteId, setInstituteId] = useState("");
  const [education, setEducation] = useState("");
  const [branch, setBranch] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [minPct, setMinPct] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [view, setView] = useState("grid");
  const [institutes, setInstitutes] = useState([]);
  const [jobSkills, setJobSkills] = useState([]);   // skills across your postings
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [viewing, setViewing] = useState(null);      // full-page resume preview
  const [tplMeta, setTplMeta] = useState([]);
  const [chatWith, setChatWith] = useState(null);
  const [brief, setBrief] = useState(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    setBusy(true);
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (location) p.set("location", location);
    if (instituteId) p.set("institute_id", instituteId);
    if (education) p.set("education", education);
    if (branch) p.set("branch", branch);
    if (yearFrom) p.set("year_from", yearFrom);
    if (yearTo) p.set("year_to", yearTo);
    if (minPct) p.set("min_percentage", minPct);
    try { setRows(await api.get(`/api/enterprise/resumes?${p}`)); }
    catch (err) { toast(err.message, "error"); }
    finally { setBusy(false); }
  };

  const clearFilters = () => {
    setLocation(""); setInstituteId(""); setEducation("");
    setBranch(""); setYearFrom(""); setYearTo(""); setMinPct("");
  };

  useEffect(() => {
    search();
    // Only institutes that actually have students, so the dropdown can't offer
    // a filter that returns nothing.
    api.get("/api/enterprise/institutes").then(setInstitutes).catch(() => {});
    /* Suggestions come from the skills on YOUR OWN postings, not the full
       1,147-skill library: if you never asked for Kubernetes, offering it as a
       search term only leads to an empty result set. */
    api.get("/api/enterprise/jobs").then((js) => {
      const all = new Set();
      (js || []).forEach((j) => (j.key_skills || []).forEach((k) => k && all.add(k.trim())));
      setJobSkills([...all].sort((a2, b2) => a2.localeCompare(b2)));
    }).catch(() => {});
    // eslint-disable-next-line
  }, []);

  /* Live search on the keyword box, debounced so it doesn't fire per
     keystroke. Comma-separated terms are supported, so a recruiter can build
     "AutoCAD, SolidWorks" by clicking suggestions or typing. */
  useEffect(() => {
    const t = setTimeout(search, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  const terms = q.split(",").map((t) => t.trim()).filter(Boolean);
  const lastTerm = (q.split(",").pop() || "").trim().toLowerCase();
  const suggestions = jobSkills
    .filter((k) => !terms.some((t) => t.toLowerCase() === k.toLowerCase()))
    .filter((k) => !lastTerm || k.toLowerCase().includes(lastTerm))
    .slice(0, 10);

  const addSkill = (k) => {
    // Replace the part being typed, keep everything already committed.
    const head = q.split(",").slice(0, -1).map((t) => t.trim()).filter(Boolean);
    setQ([...head, k].join(", ") + ", ");
  };

  /* Live results: changing any dropdown re-runs the search, so there is no
     Apply step. Debounced because Year-from/to and Minimum percentage are
     typed, and firing a request per keystroke would hammer the API. */
  useEffect(() => {
    const t = setTimeout(search, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [location, instituteId, education, branch, yearFrom, yearTo, minPct]);

  const open = async (id, action) => {
    try {
      const full = await api.get(`/api/enterprise/resumes/${id}?action=${action}`);
      setBrief(null);            // resume view shows ONLY the resume
      setViewing(full);
      if (!tplMeta.length) {
        // template metadata drives which layout to render
        const t = await api.get("/api/jobseeker/templates").catch(() => null);
        if (t) setTplMeta(t.meta || []);
      }
      if (action === "Downloaded") setTimeout(() => window.print(), 200);
    } catch (err) { toast(err.message, "error"); }
  };

  const message = async (id) => {
    try { setChatWith((await api.post("/api/chat/start", { jobseeker_id: id })).user_id); }
    catch (err) { toast(err.message, "error"); }
  };

  if (chatWith) return (
    <div><button className="btn-outline btn-sm mb-4" onClick={() => setChatWith(null)}>← Back to search</button>
      <Chat openWith={chatWith} canBlock /></div>
  );

  /* ---- full-page resume preview (item 11) ---- */
  if (viewing) {
    const meta = tplMeta.find((m) => m.key === (viewing.resume_template || "classic"));
    const name = `${viewing.first_name || ""} ${viewing.last_name || ""}`.trim() || viewing.email;
    return (
      <div>
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
          <button className="btn-outline btn-sm"
                  onClick={() => { setViewing(null); setBrief(null); }}>← Back to candidates</button>
          <div className="flex flex-wrap gap-2">
            <AIButton path={`/api/ai/candidate/${viewing.id}/summary`} className="btn-outline btn-sm"
                      onResult={(r) => setBrief({ name, data: r })}>AI screening brief</AIButton>
            <button className="btn-outline btn-sm" onClick={() => message(viewing.id)}><IconChat size={14} /> Message</button>
            <button className="btn-outline btn-sm" onClick={() => window.print()}><IconDownload size={14} /> Download</button>
          </div>
        </div>
        {brief && (
          <AIResult title={`Screening brief — ${brief.name}`} onClose={() => setBrief(null)}>
            <p className="leading-relaxed">{brief.data.summary}</p>
            <AIList label="Strengths" items={brief.data.strengths} tone="green" />
            <AIList label="Gaps" items={brief.data.gaps} tone="amber" />
            <AIList label="Screening questions" items={brief.data.screening_questions} />
          </AIResult>
        )}
        <SeekerResume seeker={viewing} meta={meta} />
      </div>
    );
  }

  const activeFilters = [location, instituteId, education, branch, yearFrom, yearTo, minPct]
    .filter(Boolean).length;

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold text-navy">Find candidates</h2>

      {/* One search bar by default. Everything else is behind "Advanced
          search", so the common case (type a skill, press enter) stays a
          single field instead of a wall of filters. */}
      <div className="relative mb-3 flex gap-2">
        <div className="relative flex-1">
          <input className="input w-full" value={q}
                 onChange={(e) => { setQ(e.target.value); setSuggestOpen(true); }}
                 onFocus={() => setSuggestOpen(true)}
                 onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
                 onKeyDown={(e) => e.key === "Enter" && search()}
                 placeholder="Type a skill — results update as you type. Separate several with commas." />

          {suggestOpen && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl
                            border border-slate-200 bg-white py-1 shadow-cardhover">
              <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Skills from your postings
              </p>
              <div className="max-h-56 overflow-y-auto">
                {suggestions.map((k) => (
                  <button key={k} type="button" onMouseDown={() => addSkill(k)}
                          className="block w-full px-3 py-1.5 text-left text-[13px] text-slate-600 hover:bg-navy-50 hover:text-navy">
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button className="btn shrink-0" onClick={search}><IconSearch size={16} /> Search</button>
      </div>

      {terms.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {terms.map((t) => (
            <span key={t} className="badge flex items-center gap-1 bg-navy-50 text-navy">
              {t}
              <button type="button" title={`Remove ${t}`}
                      onClick={() => setQ(terms.filter((x) => x !== t).join(", "))}
                      className="text-navy/50 hover:text-navy">×</button>
            </span>
          ))}
          <button type="button" onClick={() => setQ("")}
                  className="text-xs font-semibold text-slate-400 hover:text-navy">Clear all</button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setAdvanced((a) => !a)}
                className="text-sm font-semibold text-navy hover:underline">
          {advanced ? "− Hide advanced search" : "⚙ Advanced search"}
        </button>
        {activeFilters > 0 && (
          <>
            <span className="badge bg-navy-50 text-navy">{activeFilters} filter(s) applied</span>
            <button type="button" onClick={() => { clearFilters(); }}
                    className="text-xs font-semibold text-slate-400 hover:text-navy">Clear</button>
          </>
        )}
        <div className="flex-1" />
        <span className="text-xs text-slate-400">{rows.length} candidate(s)</span>
        <ViewSwitcher value={view} onChange={setView} />
      </div>

      {advanced && (
        <div className="card mb-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Combobox label="Location" value={location} options={CITIES} onChange={setLocation}
                      placeholder="e.g. Hyderabad" />
            <div>
              <label className="label">Institute</label>
              <select className="input" value={instituteId}
                      onChange={(e) => setInstituteId(e.target.value)}>
                <option value="">Any institute</option>
                {institutes.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} ({i.students})</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">
                Candidates registered by that institute.
              </p>
            </div>
            <Combobox label="Education" value={education} options={QUALIFICATIONS}
                      onChange={setEducation} placeholder="e.g. B.Tech" />
            <div>
              <label className="label">Branch</label>
              <input className="input" value={branch} onChange={(e) => setBranch(e.target.value)}
                     placeholder="e.g. Mechanical" />
            </div>
            <div>
              <label className="label">Year of passing</label>
              <div className="flex items-center gap-2">
                <input className="input" value={yearFrom} inputMode="numeric"
                       onChange={(e) => setYearFrom(e.target.value.replace(/\D/g, "").slice(0, 4))}
                       placeholder="From" />
                <span className="text-xs text-slate-400">to</span>
                <input className="input" value={yearTo} inputMode="numeric"
                       onChange={(e) => setYearTo(e.target.value.replace(/\D/g, "").slice(0, 4))}
                       placeholder="To" />
              </div>
            </div>
            <div>
              <label className="label">Minimum percentage</label>
              <input className="input" value={minPct} inputMode="decimal"
                     onChange={(e) => setMinPct(e.target.value.replace(/[^\d.]/g, ""))}
                     placeholder="e.g. 60" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <p className="text-xs text-slate-400">
              Results update as you choose — no need to press anything.
            </p>
            <div className="flex-1" />
            <button className="btn-outline btn-sm" onClick={clearFilters}>Reset filters</button>
          </div>
        </div>
      )}

      {brief && (
        <AIResult title={`Candidate brief — ${brief.name}`} onClose={() => setBrief(null)}>
          <p className="leading-relaxed">{brief.data.summary}</p>
          <AIList label="Strengths" items={brief.data.strengths} tone="green" />
          <AIList label="Gaps" items={brief.data.gaps} tone="amber" />
          <AIList label="Screening questions" items={brief.data.screening_questions} />
        </AIResult>
      )}

      {busy && <p className="text-sm text-slate-400">Searching…</p>}

      {/* Compact is a table, so it renders separately; grid and list share the
          same card and differ only in how many fit per row. */}
      {view === "compact" ? (
        <div className="card overflow-hidden !p-0">
          <table className="table">
            <thead><tr><th>Candidate</th><th>Location</th><th>Skills</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {rows.map((s2) => (
                <tr key={s2.id}>
                  <td>
                    <button className="font-semibold text-navy hover:underline"
                            onClick={() => open(s2.id, "Viewed")}>
                      {`${s2.first_name || ""} ${s2.last_name || ""}`.trim() || s2.email}
                    </button>
                    <div className="text-[11px] text-slate-400">{s2.email}</div>
                  </td>
                  <td className="text-slate-500">{s2.location || "—"}</td>
                  <td className="text-slate-500">
                    {(s2.key_skills || []).slice(0, 4).join(", ") || "—"}
                  </td>
                  <td className="text-right">
                    <button className="btn-outline btn-sm" onClick={() => open(s2.id, "Viewed")}>View</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="py-10 text-center text-slate-400">No candidates match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
      /* List = the same card as grid, one per row, so candidates are compared
         one at a time. The width is capped: stretched across 1000px+ a single
         candidate reads as mostly empty space, and the buttons drift far from
         the name they belong to. */
      <div className={view === "list"
        /* Width tracks the grid it is imitating: the grid is 2-up at md and
           3-up at xl, so a single card is ~517px then ~339px. Without the xl
           step the list card would stay wider than the grid card on exactly
           the screens most recruiters use. */
        ? "grid max-w-lg gap-4 xl:max-w-xs"
        : "grid gap-4 md:grid-cols-2 xl:grid-cols-3"}>
        {rows.map((s) => (
          <div key={s.id} className="card-hover flex flex-col">
            <div className="flex items-center gap-3">
              {s.profile_picture_url
                ? <img src={mediaUrl(s.profile_picture_url)} alt=""
                       className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
                : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy-50 font-bold text-navy">
                    {(s.first_name || s.email || "?")[0].toUpperCase()}</div>}
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-800">
                  {`${s.first_name || ""} ${s.last_name || ""}`.trim() || s.email}
                </p>
                <p className="truncate text-xs text-slate-500">{s.headline || s.location || "—"}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(s.key_skills || []).slice(0, 5).map((k) => (
                <span key={k} className="badge bg-slate-100 text-slate-600">{k}</span>
              ))}
            </div>
            <p className="mt-2 flex-1 text-xs text-slate-400">
              {(s.education || []).map((e) => e.degree).filter(Boolean).join(", ") || "No education listed"}
            </p>
            <div className="mt-3 flex gap-2">
              <button className="btn-outline btn-sm flex-1" onClick={() => open(s.id, "Viewed")}>
                <IconEye size={14} /> View resume
              </button>
              {brief?.id === s.id ? (
                <button className="btn-outline btn-sm !border-navy !text-navy"
                        onClick={() => setBrief(null)} title="Hide brief">
                  Hide brief
                </button>
              ) : (
                <AIButton path={`/api/ai/candidate/${s.id}/summary`} className="btn-outline btn-sm"
                          title="AI brief about this candidate"
                          onResult={(r) => setBrief({ id: s.id, name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.email, data: r })}>
                  Brief
                </AIButton>
              )}
              <button className="btn-outline btn-sm" onClick={() => message(s.id)}><IconChat size={14} /></button>
            </div>
          </div>
        ))}
        {!busy && rows.length === 0 && <div className="card col-span-full text-center text-slate-400">No matching candidates.</div>}
      </div>
      )}
    </div>
  );
}

/* Post a job now lives in components/PostJobForm.jsx, shared with the
   institute portal so the two can never drift apart again. */
function PostJob() {
  return (
    <>
      {/* Renders nothing until the quota is nearly gone, so it warns rather
          than nags. Turns red and blocks nothing once exhausted — the server
          returns 402 and the form surfaces that message. */}
      <QuotaNotice kind="jobs" />
      <PostJobForm endpoint="/api/enterprise/jobs" />
    </>
  );
}

function Applications() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState([]);
  const [pipeline, setPipeline] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const [chatWith, setChatWith] = useState(null);
  const [viewing, setViewing] = useState(null);     // full candidate profile
  const [summary, setSummary] = useState(null);     // quick summary panel
  const [tplMeta, setTplMeta] = useState([]);

  /* Open the applicant's full profile from their card. Recorded as a view so
     the seeker sees it in "Who viewed me", same as from Resume search. */
  const openCandidate = async (candidateId, action = "Viewed") => {
    try {
      setViewing(await api.get(`/api/enterprise/resumes/${candidateId}?action=${action}`));
      if (!tplMeta.length) {
        const t = await api.get("/api/jobseeker/templates").catch(() => null);
        if (t) setTplMeta(t.meta || []);
      }
      if (action === "Downloaded") setTimeout(() => window.print(), 250);
    } catch (err) { toast(err.message, "error"); }
  };

  const load = async (f = filter, term = q) => {
    const p = new URLSearchParams();
    if (f && f !== "All") p.set("status", f);
    if (term) p.set("q", term);
    setRows(await api.get(`/api/enterprise/applications?${p}`));
    setPipeline(await api.get("/api/enterprise/pipeline"));
  };
  useEffect(() => {
    api.get("/api/enterprise/statuses").then((d) => setStatuses(d.statuses));
    load();
    const id = setInterval(() => load(), 10000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { load(filter, q); }, [filter]);

  const setStatus = async (id, status) => {
    try {
      await api.put(`/api/enterprise/applications/${id}/status`, { status });
      confirm("Candidate progress modified successfully",
              { message: `This candidate has been moved to "${status}".` });
      load();
    }
    catch (err) { toast(err.message, "error"); }
  };

  /* Quick summary — a light panel, deliberately not the full resume.
     Clicking a card should tell you whether this person is worth opening, not
     make you wait for a full profile render and then navigate back. */
  if (summary) {
    const band = fitBand(summary.match_score || 0);
    return (
      <div className="mx-auto max-w-2xl">
        <button className="btn-outline btn-sm mb-4" onClick={() => setSummary(null)}>← Back to pipeline</button>
        <div className="card">
          <div className="flex flex-wrap items-start gap-4">
            {summary.photo
              ? <img src={mediaUrl(summary.photo)} alt="" className="h-16 w-16 rounded-full object-cover ring-1 ring-slate-200" />
              : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-navy-50 text-xl font-bold text-navy">
                  {(summary.candidate_name || "?")[0].toUpperCase()}</div>}
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold text-navy">{summary.candidate_name}</h2>
              <p className="text-sm text-slate-500">
                {[summary.headline, summary.location].filter(Boolean).join(" · ") || "—"}
              </p>
              <p className="mt-1 text-[12.5px] text-slate-500">
                Applied for <b className="text-slate-700">{summary.job_title}</b> on{" "}
                {new Date(summary.applied_on).toLocaleDateString()}
              </p>
            </div>
            <StatusBadge status={summary.status} />
          </div>

          {/* fit */}
          <div className={`mt-5 rounded-xl p-4 ${band.bg}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`text-sm font-bold ${band.text}`}>{band.label}</span>
              <FitRating score={summary.match_score || 0} />
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
              <div className="h-full rounded-full transition-all duration-500"
                   style={{ width: `${Math.max(3, summary.match_score || 0)}%`, background: band.bar }} />
            </div>
            {summary.job_skills_total > 0 && (
              <p className={`mt-2 text-xs ${band.text}`}>
                Has {(summary.matched_skills || []).length} of the {summary.job_skills_total} skills
                this job asked for.
              </p>
            )}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <SumBlock title="Matching skills">
              {(summary.matched_skills || []).length ? (
                <div className="flex flex-wrap gap-1.5">
                  {summary.matched_skills.map((k) => (
                    <span key={k} className="badge bg-brandgreen-50 capitalize text-brandgreen-600">✓ {k}</span>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-400">None of the job's listed skills.</p>}
            </SumBlock>
            <SumBlock title="Other skills">
              <div className="flex flex-wrap gap-1.5">
                {(summary.key_skills || [])
                  .filter((k) => !(summary.matched_skills || []).map((m) => m.toLowerCase()).includes(k.toLowerCase()))
                  .map((k) => <span key={k} className="badge bg-slate-100 text-slate-600">{k}</span>)}
              </div>
            </SumBlock>
            <SumBlock title="Education">
              <p className="text-sm text-slate-600">
                {(summary.education || []).join(", ") || "Not listed"}
              </p>
            </SumBlock>
            <SumBlock title="Contact">
              <p className="text-sm text-slate-600">{summary.email || "—"}</p>
              <p className="text-sm text-slate-600">{summary.phone || "—"}</p>
            </SumBlock>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button className="btn" onClick={() => { setSummary(null); openCandidate(summary.candidate_id); }}>
              <IconEye size={15} /> Open full resume
            </button>
            <button className="btn-outline" onClick={() => setChatWith(summary.candidate_user_id)}>
              <IconChat size={15} /> Message
            </button>
            <div className="flex-1" />
            <button className="btn-green" onClick={() => { setStatus(summary.application_id, "Shortlisted"); setSummary(null); }}>
              Shortlist
            </button>
            <button className="btn-outline !text-red-500"
                    onClick={() => { setStatus(summary.application_id, "Rejected"); setSummary(null); }}>
              Reject
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewing) {
    const meta = tplMeta.find((m) => m.key === (viewing.resume_template || "classic"));
    return (
      <div>
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
          <button className="btn-outline btn-sm" onClick={() => setViewing(null)}>← Back to applications</button>
          <button className="btn-outline btn-sm" onClick={() => openCandidate(viewing.id, "Downloaded")}>
            <IconDownload size={14} /> Download profile
          </button>
        </div>
        <SeekerResume seeker={viewing} meta={meta} />
      </div>
    );
  }

  if (chatWith) return (
    <div><button className="btn-outline btn-sm mb-4" onClick={() => setChatWith(null)}>← Back</button>
      <Chat openWith={chatWith} canBlock /></div>
  );

  const counts = pipeline?.counts || {};
  const chips = ["All", "Active", ...statuses];

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-navy">Candidate pipeline</h2>
      <p className="mb-4 text-sm text-slate-500">
        {pipeline ? `${pipeline.total} applications · ${pipeline.active} still in play` : "Loading…"}
      </p>

      {/* status filter chips (item 11) */}
      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((st) => {
          const n = st === "All" ? pipeline?.total : st === "Active" ? pipeline?.active : counts[st];
          return (
            <button key={st} onClick={() => setFilter(st)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === st ? "bg-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-navy-50 hover:text-navy"}`}>
              {st.replace("Interview - ", "")}
              {n != null && <span className={`rounded-full px-1.5 text-[10px] ${filter === st ? "bg-white/20" : "bg-white"}`}>{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex gap-2">
        <input className="input max-w-sm" placeholder="Search candidate name or skill…" value={q}
               onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(filter, q)} />
        <button className="btn-outline" onClick={() => load(filter, q)}><IconSearch size={15} /> Filter</button>
      </div>

      <div className="space-y-3">
        {rows.map((a) => (
          <div key={a.application_id}
               onClick={() => setSummary(a)}
               title="Click for a quick summary"
               className="card-hover cursor-pointer">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <button type="button" className="shrink-0"
                        onClick={(e) => { e.stopPropagation(); openCandidate(a.candidate_id); }}>
                  {a.photo
                    ? <img src={mediaUrl(a.photo)} alt="" className="h-11 w-11 rounded-full object-cover" />
                    : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-50 font-bold text-navy">
                        {(a.candidate_name || "?")[0].toUpperCase()}</div>}
                </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* A button rather than a click handler on the whole card:
                        the status dropdown and chat button live inside it. */}
                    <button type="button"
                            onClick={(e) => { e.stopPropagation(); openCandidate(a.candidate_id); }}
                            className="font-bold text-slate-800 hover:text-navy hover:underline">
                      {a.candidate_name}
                    </button>
                    {a.match_score != null && <FitRating score={a.match_score} />}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {[a.headline, a.location].filter(Boolean).join(" · ")} · applied for <b>{a.job_title}</b>
                  </p>
                  {/* Skills the JOB asked for and this candidate has are
                      green; the rest of their skills stay grey. The recruiter
                      can see at a glance what the rating is made of. */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {(a.matched_skills || []).map((k) => (
                      <span key={k} className="badge bg-brandgreen-50 capitalize text-brandgreen-600">✓ {k}</span>
                    ))}
                    {(a.key_skills || [])
                      .filter((k) => !(a.matched_skills || []).map((m) => m.toLowerCase()).includes(k.toLowerCase()))
                      .slice(0, 4).map((k) => (
                        <span key={k} className="badge bg-slate-100 text-slate-600">{k}</span>
                    ))}
                    {a.job_skills_total > 0 && (
                      <span className="text-[11px] text-slate-400">
                        {(a.matched_skills || []).length} of {a.job_skills_total} required skills
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <StatusBadge status={a.status} />
                <div className="flex gap-2">
                  <select className="input !w-auto !py-1.5 !text-xs" value={a.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setStatus(a.application_id, e.target.value)}>
                    {statuses.map((st) => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <button className="btn-ghost btn-sm" onClick={() => a.candidate_user_id && setChatWith(a.candidate_user_id)}>
                    <IconChat size={15} />
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <button className="btn-sm rounded-lg bg-brandgreen px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brandgreen-600"
                          onClick={(e) => { e.stopPropagation(); setStatus(a.application_id, "Shortlisted"); }}>Shortlist</button>
                  <button className="btn-sm rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                          onClick={(e) => { e.stopPropagation(); setStatus(a.application_id, "Rejected"); }}>Reject</button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="card text-center text-slate-400">No candidates in this stage.</div>}
      </div>
    </div>
  );
}

function PostBanner() {
  const toast = useToast();
  const confirm = useConfirm();
  const { enabled: aiOn } = useAI();
  const { call, busy: aiBusy } = useAICall();
  const [form, setForm] = useState({ audience: "jobseekers", theme: "navy", autoplay: true, muted: true, priority: 0 });
  const [mine, setMine] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [copy, setCopy] = useState(null);
  const [view, setView] = useState("create");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = () => api.get("/api/enterprise/banners").then(setMine).catch(() => {});
  useEffect(() => { load(); }, []);

  const uploadMedia = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/media", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setForm((f) => ({ ...f, media_url: data.url, media_type: data.media_type }));
      toast(data.message);
    } catch (err) { toast(err.message, "error"); }
    finally { setUploading(false); }
  };

  const writeCopy = async () => {
    const r = await call("/api/ai/banner/copy", {
      goal: form.goal || "attract job seekers",
      company: form.company_name, role: form.title, audience: form.audience,
    });
    if (r) { setCopy(r); }
  };

  const submit = async () => {
    if (!form.title?.trim()) return toast("Give your banner a title.", "error");
    try {
      const editing = !!form.id;
      const r = editing
        ? await api.put(`/api/enterprise/banners/${form.id}`, form)
        : await api.post("/api/enterprise/banners", form);
      confirm(editing ? "Ad updated successfully" : "Ad posted successfully",
              { message: r.message });
      setForm({ audience: "jobseekers", theme: "navy", autoplay: true, muted: true, priority: 0 });
      setCopy(null); load();
    } catch (err) { toast(err.message, "error"); }
  };

  const toggleStatus = async (b) => {
    try {
      await api.put(`/api/enterprise/banners/${b.id}/status`, { status: b.status === "active" ? "paused" : "active" });
      load();
    } catch (err) { toast(err.message, "error"); }
  };

  const THEME_SWATCH = { navy: "bg-navy", green: "bg-brandgreen-600", slate: "bg-slate-800", cobalt: "bg-blue-800" };

  if (view === "manage") {
    return (
      <div className="max-w-5xl">
        <AdTabs view={view} setView={setView} />
      {view === "post" && <QuotaNotice kind="ads" />}
        <ManageAds onEdit={(b) => { setForm({ ...b }); setView("create"); }} />
      </div>
    );
  }

  if (view === "performance") {
    return (
      <div className="max-w-6xl">
        <AdTabs view={view} setView={setView} />
        <BannerAnalytics endpoint="/api/enterprise/banners/analytics"
                         title="Your banner performance"
                         subtitle="Views and clicks for the banners you've published." />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <AdTabs view={view} setView={setView} />
      <h2 className="mb-1 text-xl font-bold text-navy">{form.id ? "Modify the ad" : "Post an ad"}</h2>
      <p className="mb-5 text-sm text-slate-500">
        One banner shows per page, chosen so different pages feature different advertisers.
      </p>

      {/* ---- media picker ---- */}
      <div className="card mb-4">
        <h3 className="font-semibold text-slate-700">1. Choose your media</h3>
        <p className="mt-0.5 text-xs text-slate-400">
          Upload an image, GIF or video — or paste a video link. Images are optimised to 1080p automatically.
        </p>

        {/* Audio removed: a banner slot has no audible surface, so an audio ad
            could never actually play anywhere it is shown. */}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[["image", "🖼️", "Image", "JPG/PNG/WEBP · 8 MB"],
            ["gif", "🎞️", "GIF", "Animated · 12 MB"],
            ["video", "🎬", "Video", "MP4/WEBM/MOV · 50 MB"]].map(([k, icon, label, hint]) => (
            <label key={k}
              className={`cursor-pointer rounded-xl border-2 p-3 text-center transition-all hover:-translate-y-0.5 ${
                form.media_type === k ? "border-navy bg-navy-50" : "border-slate-200 hover:border-navy-200"}`}>
              <input type="file" className="hidden"
                     accept={k === "image" ? "image/png,image/jpeg,image/webp"
                             : k === "gif" ? "image/gif"
                             : "video/mp4,video/webm,video/quicktime,video/*"}
                     onChange={(e) => uploadMedia(e.target.files?.[0])} />
              <span className="text-2xl">{icon}</span>
              <p className={`mt-1 text-[12.5px] font-bold ${form.media_type === k ? "text-navy" : "text-slate-700"}`}>{label}</p>
              <p className="text-[10px] leading-tight text-slate-400">{hint}</p>
            </label>
          ))}
        </div>

        {/* ---- video by URL ----
            Hosting a 50 MB MP4 is the expensive way to run a video ad. A link
            to a video the company already has on YouTube or Vimeo costs
            nothing and is what most recruiters actually have to hand. */}
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <label className="label">…or paste a video link</label>
          <div className="flex flex-wrap gap-2">
            <input className="input flex-1" value={form.video_url || ""}
                   placeholder="YouTube, Vimeo or a direct .mp4 link"
                   onChange={(e) => setForm({ ...form, video_url: e.target.value })} />
            <button type="button" className="btn-outline shrink-0"
                    onClick={() => {
                      const embed = toEmbedUrl(form.video_url);
                      if (!embed) return toast("That doesn't look like a YouTube, Vimeo or .mp4 link.", "error");
                      setForm((f) => ({ ...f, media_type: "video", media_url: "", video_url: f.video_url }));
                      toast("Video link added — see the preview below.");
                    }}>
              Use link
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Nothing is uploaded — the ad embeds the video from where it already lives.
          </p>
        </div>

        {uploading && <p className="mt-2 text-sm text-slate-400">Uploading…</p>}

        {(form.media_url || form.video_url) && (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            {form.video_url && toEmbedUrl(form.video_url) ? (
              toEmbedUrl(form.video_url).direct
                ? <video src={form.video_url} className="h-48 w-full object-cover" controls muted />
                : <iframe src={toEmbedUrl(form.video_url).src} title="Ad video preview"
                          className="h-48 w-full" allowFullScreen />
            ) : form.media_type === "video"
              ? <video src={mediaUrl(form.media_url)} className="h-48 w-full object-cover" muted autoPlay loop />
              : <img src={mediaUrl(form.media_url)} alt="" className="h-48 w-full object-cover" />}
          </div>
        )}
      </div>

      {/* ---- copy ---- */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-700">2. Write your message</h3>
          {aiOn && (
            <button className="btn-outline btn-sm" onClick={writeCopy} disabled={aiBusy}>
              <IconSparkle size={14} /> {aiBusy ? "Writing…" : "Write with AI"}
            </button>
          )}
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 2xl:col-span-3"><label className="label">Banner title</label>
            <input className="input" value={form.title || ""} onChange={set("title")} placeholder="e.g. Walk-in drive this Sunday" /></div>
          <div className="sm:col-span-2 2xl:col-span-3"><label className="label">Message</label>
            <textarea className="input" rows={2} value={form.text_content || ""} onChange={set("text_content")} /></div>
          <div><label className="label">Button label</label>
            <input className="input" value={form.cta_label || ""} onChange={set("cta_label")} placeholder="View jobs" /></div>
          <div><label className="label">Button link</label>
            <input className="input" value={form.cta_link || ""} onChange={set("cta_link")} placeholder="https://…" /></div>
        </div>
        {copy && (
          <AIResult title="AI copy" onClose={() => setCopy(null)}>
            <p className="font-semibold text-slate-800">{copy.title}</p>
            <p className="mt-0.5">{copy.text_content}</p>
            <button className="btn-green btn-sm mt-3"
                    onClick={() => { setForm({ ...form, title: copy.title, text_content: copy.text_content, cta_label: copy.cta_label || form.cta_label }); setCopy(null); }}>
              Use this
            </button>
            {(copy.alternatives || []).map((alt, i) => (
              <div key={i} className="mt-3 border-t border-brandgreen-100 pt-2">
                <p className="text-[13px] font-semibold text-slate-700">{alt.title}</p>
                <p className="text-[12.5px] text-slate-600">{alt.text_content}</p>
                <button className="mt-1 text-xs font-semibold text-navy hover:underline"
                        onClick={() => setForm({ ...form, title: alt.title, text_content: alt.text_content })}>Use this instead</button>
              </div>
            ))}
          </AIResult>
        )}
      </div>

      {/* ---- audience + style ---- */}
      <div className="card mb-4">
        <h3 className="font-semibold text-slate-700">3. Audience & style</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Who sees this?</label>
            <div className="grid grid-cols-3 gap-2">
              {[["jobseekers", "Job seekers"], ["recruiters", "Recruiters"], ["all", "Everyone"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setForm({ ...form, audience: k })}
                  className={`rounded-lg border-2 px-2 py-2 text-[12px] font-semibold transition-all ${
                    form.audience === k ? "border-navy bg-navy-50 text-navy" : "border-slate-200 text-slate-600 hover:border-navy-200"}`}>
                  {l}
                </button>
              ))}
            </div>
            {form.audience !== "recruiters" && (
              <p className="mt-1.5 text-xs text-brandgreen-600">Shows on every job-seeker page.</p>
            )}
          </div>
          <div>
            <label className="label">Colour theme</label>
            <div className="flex gap-2">
              {Object.keys(THEME_SWATCH).map((t) => (
                <button key={t} type="button" onClick={() => setForm({ ...form, theme: t })}
                  className={`h-9 w-9 rounded-lg ${THEME_SWATCH[t]} ring-offset-2 transition-all ${
                    form.theme === t ? "ring-2 ring-navy" : ""}`} aria-label={t} />
              ))}
            </div>
          </div>
          <div><label className="label">Start date</label><input className="input" type="date" value={form.start_date || ""} onChange={set("start_date")} /></div>
          <div><label className="label">End date</label><input className="input" type="date" value={form.end_date || ""} onChange={set("end_date")} /></div>
          {form.media_type === "video" && (
            <div className="flex gap-4 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={!!form.autoplay} onChange={(e) => setForm({ ...form, autoplay: e.target.checked })} /> Autoplay
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={!!form.muted} onChange={(e) => setForm({ ...form, muted: e.target.checked })} /> Start muted
              </label>
            </div>
          )}
        </div>
        <button className="btn mt-4 w-full" onClick={submit}>Publish banner</button>
      </div>

      {/* ---- live banners ---- */}
      {mine.length > 0 && (
        <div className="card">
          <h3 className="mb-3 font-semibold text-slate-700">Your banners</h3>
          <div className="space-y-2">
            {mine.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-slate-800">{b.title}</p>
                  <p className="text-xs text-slate-400">
                    {b.media_type} · {b.audience} · {b.impressions} views · {b.clicks} clicks
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${b.status === "active" ? "bg-brandgreen-50 text-brandgreen-600" : "bg-slate-100 text-slate-500"}`}>{b.status}</span>
                  <button className="btn-outline btn-sm" onClick={() => toggleStatus(b)}>
                    {b.status === "active" ? "Pause" : "Resume"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const Row = ({ k, v, link }) => (
  <div className="min-w-0 border-b border-slate-100 pb-2 last:border-0">
    <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
    <dd className="mt-0.5 truncate text-sm text-slate-700" title={v || undefined}>
      {v
        ? (link
            ? <a href={/^https?:/.test(link) ? link : `https://${link}`} target="_blank" rel="noopener noreferrer"
                 className="text-navy hover:underline">{v}</a>
            : v)
        : <span className="text-slate-300">—</span>}
    </dd>
  </div>
);
const F = ({ label, onChange, span }) => <div className={span ? "sm:col-span-2" : ""}><label className="label">{label}</label><input className="input" onChange={onChange} /></div>;
const Loading = () => <p className="text-slate-400">Loading…</p>;


function AdTabs({ view, setView }) {
  return (
    <div className="mb-4 flex gap-1.5 rounded-xl bg-slate-100 p-1.5">
      {[["create", "Post an ad"], ["manage", "Manage ads"], ["performance", "Performance"]].map(([k, l]) => (
        <button key={k} onClick={() => setView(k)}
          className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${
            view === k ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>{l}</button>
      ))}
    </div>
  );
}

/* Manage Ads — modify, close and set validity on live ads. */
function ManageAds({ onEdit }) {
  const toast = useToast();
  const confirm = useConfirm();
  const dialog = useDialog();
  const [rows, setRows] = useState(null);
  const [dates, setDates] = useState({});
  const load = () => api.get("/api/enterprise/banners").then(setRows);
  useEffect(() => { load(); }, []);

  const setStatus = async (b) => {
    try {
      const status = b.status === "active" ? "paused" : "active";
      await api.put(`/api/enterprise/banners/${b.id}/status`, { status });
      confirm(status === "paused" ? "Ad closed successfully" : "Ad reopened successfully",
              { message: `"${b.title}" is ${status === "paused" ? "no longer showing" : "showing again"}.` });
      load();
    } catch (err) { toast(err.message, "error"); }
  };
  const saveValidity = async (b) => {
    const d = dates[b.id] || {};
    try {
      await api.put(`/api/enterprise/banners/${b.id}`,
        { start_date: d.start ?? b.start_date, end_date: d.end ?? b.end_date });
      confirm("Ad validity updated successfully",
              { message: `"${b.title}" now runs ${(d.start ?? b.start_date) || "no start date"} to ${(d.end ?? b.end_date) || "no end date"}.` });
      load();
    } catch (err) { toast(err.message, "error"); }
  };
  const remove = (b) => dialog({
    tone: "error", title: "Delete this ad?",
    message: `"${b.title}" and its performance history will be permanently removed.`,
    confirmLabel: "Delete", secondary: { label: "Keep it" },
    onConfirm: async () => {
      try {
        await api.del(`/api/enterprise/banners/${b.id}`);
        confirm("Ad deleted successfully", { message: `"${b.title}" has been removed.` });
        load();
      }
      catch (err) { toast(err.message, "error"); }
    },
  });

  if (!rows) return <p className="text-slate-400">Loading…</p>;
  if (!rows.length) return <div className="card text-center text-slate-400">You haven't posted any ads yet.</div>;

  const expired = (b) => b.end_date && new Date(b.end_date) < new Date();

  return (
    <div className="space-y-3">
      {rows.map((b) => (
        <div key={b.id}
             className="group rounded-xl border border-slate-200 bg-white p-4 transition-all
                        hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-cardhover">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              {b.media_url && b.media_type !== "audio" && (
                <img src={mediaUrl(b.media_url)} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover ring-1 ring-slate-200" />
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-slate-800">{b.title}</h3>
                  <span className={`badge ${b.status === "active" && !expired(b)
                    ? "bg-brandgreen-50 text-brandgreen-600" : "bg-slate-100 text-slate-500"}`}>
                    {expired(b) ? "expired" : b.status}
                  </span>
                  <span className="badge bg-slate-100 text-slate-500">{b.media_type}</span>
                  <span className="badge bg-navy-50 text-navy">{b.audience}</span>
                </div>
                <p className="truncate text-[13px] text-slate-500">{b.text_content}</p>
                <p className="mt-1 text-[11.5px] text-slate-400">
                  {b.impressions} views · {b.clicks} clicks
                  {b.impressions ? ` · ${((b.clicks / b.impressions) * 100).toFixed(1)}% CTR` : ""}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button className="btn-outline btn-sm" onClick={() => onEdit(b)}>Modify</button>
              <button className="btn-outline btn-sm" onClick={() => setStatus(b)}>
                {b.status === "active" ? "Close" : "Reopen"}
              </button>
              <button className="btn-outline btn-sm !text-red-600 hover:!bg-red-50" onClick={() => remove(b)}>
                Delete
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3">
            <div>
              <label className="label !text-[11px]">Valid from</label>
              <input type="date" className="input !py-1.5 !text-xs"
                     defaultValue={b.start_date || ""}
                     onChange={(e) => setDates({ ...dates, [b.id]: { ...dates[b.id], start: e.target.value } })} />
            </div>
            <div>
              <label className="label !text-[11px]">Valid to</label>
              <input type="date" className="input !py-1.5 !text-xs"
                     defaultValue={b.end_date || ""}
                     onChange={(e) => setDates({ ...dates, [b.id]: { ...dates[b.id], end: e.target.value } })} />
            </div>
            <button className="btn-outline btn-sm" onClick={() => saveValidity(b)}>Save validity</button>
            {expired(b) && <span className="text-[11.5px] text-amber-600">This ad has passed its end date.</span>}
          </div>
        </div>
      ))}
    </div>
  );
}


/* Turn a pasted video link into something embeddable.
   Returns { src, direct } or null when the link isn't recognised, so the UI
   can refuse it up front rather than rendering a broken player in the ad. */
function toEmbedUrl(url) {
  const u = (url || "").trim();
  if (!u) return null;
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { src: `https://www.youtube.com/embed/${yt[1]}`, direct: false };
  const vim = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vim) return { src: `https://player.vimeo.com/video/${vim[1]}`, direct: false };
  if (/^https?:\/\/\S+\.(mp4|webm|mov)(\?\S*)?$/i.test(u)) return { src: u, direct: true };
  return null;
}





function SumBlock({ title, children }) {
  return (
    <div>
      <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{title}</h4>
      {children}
    </div>
  );
}


/* Remaining validity on a posting. Silent for closed jobs — the status badge
   already explains those — and amber in the last three days, which is when a
   recruiter can still act on it. */
function ExpiryNote({ expiresAt, status }) {
  if (!expiresAt || status !== "active") return null;
  const ms = new Date(expiresAt) - Date.now();
  const days = Math.ceil(ms / 86400000);
  if (ms <= 0) {
    return (
      <p className="mt-0.5 text-[11.5px] font-semibold text-red-500">
        Expired — no longer shown in search
      </p>
    );
  }
  return (
    <p className={`mt-0.5 text-[11.5px] ${days <= 3 ? "font-semibold text-amber-600" : "text-slate-400"}`}>
      {days === 1 ? "Expires tomorrow" : `Expires in ${days} days`}
      {days <= 3 && " — repost to keep it live"}
    </p>
  );
}
