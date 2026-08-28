import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { api, getToken } from "../../lib/api";
import { DashboardLayout, StatusBadge, useToast } from "../../components/ui";
import { useDialog } from "../../components/Dialog";
import Chat from "../../components/Chat";
import ResumeView from "../jobseeker/ResumeView";
import {
  IconBuilding, IconSearch, IconBriefcase, IconClipboard, IconSparkle, IconChat, IconEye, IconDownload,
  IconChart, IconLayers,
} from "../../components/icons";
import { BarChart, MatchBar } from "../../components/charts";
import ImageUpload from "../../components/ImageUpload";
import BannerSlot from "../../components/BannerSlot";
import BannerAnalytics from "../../components/BannerAnalytics";
import { SectorList, RolePicker, useTaxonomy } from "../../components/SectorPicker";
import { AIButton, AIResult, AIList, useAI, useAICall } from "../../components/AIPanel";
import { Combobox, TagInput } from "../../components/fields";
import { QUALIFICATIONS, CITIES, EXPERIENCE, SKILLS } from "../../lib/options";

const MENU = [
  { to: "/enterprise", label: "Dashboard", icon: IconChart },
  { to: "/enterprise/profile", label: "Company profile", icon: IconBuilding },
  { to: "/enterprise/resumes", label: "Resume search", icon: IconSearch },
  { to: "/enterprise/post-job", label: "Post a job", icon: IconBriefcase },
  { to: "/enterprise/manage-jobs", label: "Manage jobs", icon: IconLayers },
  { to: "/enterprise/applications", label: "Applications", icon: IconClipboard },
  { to: "/enterprise/banner", label: "Post a banner", icon: IconSparkle },
  { to: "/enterprise/messages", label: "Messages", icon: IconChat, badge: true },
];

const STATUSES = ["Applied", "Under Review", "Shortlisted", "Rejected", "Selected"];

export default function Enterprise() {
  return (
    <DashboardLayout title="Recruiter / Enterprise" menu={MENU}>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="profile" element={<Profile />} />
        <Route path="manage-jobs" element={<ManageJobs />} />
        <Route path="resumes" element={<ResumeSearch />} />
        <Route path="post-job" element={<PostJob />} />
        <Route path="applications" element={<Applications />} />
        <Route path="banner" element={<PostBanner />} />
        <Route path="messages" element={<Chat canBlock />} />
        <Route path="*" element={<Navigate to="/enterprise" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

function Overview() {
  const [d, setD] = useState(null);
  useEffect(() => {
    const load = () => api.get("/api/enterprise/dashboard").then(setD).catch(() => {});
    load(); const id = setInterval(load, 8000); return () => clearInterval(id);
  }, []);
  if (!d) return <Loading />;
  const statusData = Object.entries(d.by_status || {}).map(([label, value]) => ({
    label, value,
    color: { Applied: "bg-slate-400", "Under Review": "bg-amber-400", Shortlisted: "bg-navy",
             Rejected: "bg-red-400", Selected: "bg-brandgreen" }[label],
  }));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Jobs posted" value={d.jobs_total} />
        <Stat label="Active jobs" value={d.jobs_active} tone="green" />
        <Stat label="Applications" value={d.applications} />
        <Stat label="Resumes viewed" value={d.resumes_viewed} tone="green" />
      </div>
      <BannerSlot audience="recruiters" compact />

      <div className="card">
        <h3 className="mb-4 font-bold text-slate-800">Hiring pipeline</h3>
        <BarChart data={statusData} height={180} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className="card-hover text-center">
      <div className={`text-3xl font-extrabold ${tone === "green" ? "text-brandgreen-600" : "text-navy"}`}>{value}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

function ManageJobs() {
  const toast = useToast();
  const [jobs, setJobs] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => api.get("/api/enterprise/jobs").then(setJobs);
  useEffect(() => { load(); }, []);
  const toggle = async (job) => {
    const status = job.status === "active" ? "closed" : "active";
    try { toast((await api.put(`/api/enterprise/jobs/${job.id}/status`, { status })).message); load(); }
    catch (err) { toast(err.message, "error"); }
  };
  const viewApplicants = async (id) => {
    try { setOpen(await api.get(`/api/enterprise/jobs/${id}/applicants`)); }
    catch (err) { toast(err.message, "error"); }
  };
  if (!jobs) return <Loading />;
  if (open) {
    return (
      <div>
        <button className="btn-outline btn-sm mb-4" onClick={() => setOpen(null)}>← Back to jobs</button>
        <h2 className="mb-4 text-xl font-bold text-navy">Applicants — {open.job.title}</h2>
        <div className="card overflow-hidden !p-0">
          <table className="table">
            <thead><tr><th>Candidate</th><th>Location</th><th>Skills</th><th>Applied</th><th>Status</th></tr></thead>
            <tbody>
              {open.applicants.map((a) => (
                <tr key={a.application_id}>
                  <td className="font-medium text-slate-800">{a.candidate_name}</td>
                  <td>{a.location}</td><td>{(a.key_skills || []).join(", ")}</td>
                  <td>{new Date(a.applied_on).toLocaleDateString()}</td>
                  <td><StatusBadge status={a.status} /></td>
                </tr>
              ))}
              {open.applicants.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400">No applicants yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-navy">Manage jobs</h2>
      <div className="space-y-3">
        {jobs.map((j) => (
          <div key={j.id} className="card-hover flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-slate-800">{j.title}</h3>
                <span className={`badge ${j.status === "active" ? "bg-brandgreen-50 text-brandgreen-600" : "bg-slate-100 text-slate-500"}`}>
                  {j.status}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {j.job_code ? `${j.job_code} · ` : ""}{j.location} · {j.no_of_positions} position(s)
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button className="btn-outline btn-sm" onClick={() => viewApplicants(j.id)}>Applicants</button>
              <button className="btn-outline btn-sm" onClick={() => toggle(j)}>
                {j.status === "active" ? "Close" : "Reopen"}
              </button>
            </div>
          </div>
        ))}
        {jobs.length === 0 && <div className="card text-center text-slate-400">You haven't posted any jobs yet.</div>}
      </div>
    </div>
  );
}

function Profile() {
  const [p, setP] = useState(null);
  useEffect(() => { api.get("/api/enterprise/profile").then(setP).catch(() => {}); }, []);
  if (!p) return <Loading />;
  return (
    <div className="max-w-4xl">
      <h2 className="mb-5 text-xl font-bold text-navy">{p.name}</h2>
      <div className="card mb-5">
        <h3 className="mb-3 font-semibold text-slate-700">Company logo</h3>
        <ImageUpload kind="logo" round={false} currentUrl={p.logo_url}
                     onUploaded={(u) => setP({ ...p, logo_url: u })} />
      </div>
      <div className="card space-y-1 text-sm">
        <Row k="Email" v={p.email} /><Row k="Phone" v={p.phone} />
        <Row k="City / State" v={`${p.city || "—"}, ${p.state || "—"}`} />
        <Row k="Authorised person" v={p.authorised_person_name} /><Row k="Designation" v={p.designation} />
        <Row k="GST / PAN" v={`${p.gst_no || "—"} / ${p.pan_no || "—"}`} /><Row k="About" v={p.about} />
      </div>
    </div>
  );
}

function ResumeSearch() {
  const toast = useToast();
  const [q, setQ] = useState(""); const [location, setLocation] = useState("");
  const [rows, setRows] = useState([]);
  const [viewing, setViewing] = useState(null);      // full-page resume preview
  const [tplMeta, setTplMeta] = useState([]);
  const [chatWith, setChatWith] = useState(null);
  const [brief, setBrief] = useState(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    setBusy(true);
    const p = new URLSearchParams();
    if (q) p.set("q", q); if (location) p.set("location", location);
    setRows(await api.get(`/api/enterprise/resumes?${p}`)); setBusy(false);
  };
  useEffect(() => { search(); }, []);

  const open = async (id, action) => {
    try {
      const full = await api.get(`/api/enterprise/resumes/${id}?action=${action}`);
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
          <button className="btn-outline btn-sm" onClick={() => setViewing(null)}>← Back to candidates</button>
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
        <ResumeView seeker={viewing} meta={meta} />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold text-navy">Find candidates</h2>
      <div className="mb-5 flex flex-wrap items-end gap-2">
        <div className="max-w-xs flex-1"><label className="label">Skills / keywords</label>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. AutoCAD" /></div>
        <div className="max-w-xs flex-1"><Combobox label="Location" value={location} options={CITIES} onChange={setLocation} /></div>
        <button className="btn" onClick={search}><IconSearch size={16} /> Search</button>
      </div>

      {brief && (
        <AIResult title={`Candidate brief — ${brief.name}`} onClose={() => setBrief(null)}>
          <p className="leading-relaxed">{brief.data.summary}</p>
          <AIList label="Strengths" items={brief.data.strengths} tone="green" />
          <AIList label="Gaps" items={brief.data.gaps} tone="amber" />
          <AIList label="Screening questions" items={brief.data.screening_questions} />
        </AIResult>
      )}

      {busy && <p className="text-sm text-slate-400">Searching…</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((s) => (
          <div key={s.id} className="card-hover flex flex-col">
            <div className="flex items-center gap-3">
              {s.profile_picture_url
                ? <img src={s.profile_picture_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-50 font-bold text-navy">
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
              <AIButton path={`/api/ai/candidate/${s.id}/summary`} className="btn-outline btn-sm"
                        title="AI brief about this candidate"
                        onResult={(r) => setBrief({ name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.email, data: r })}>
                Brief
              </AIButton>
              <button className="btn-outline btn-sm" onClick={() => message(s.id)}><IconChat size={14} /></button>
            </div>
          </div>
        ))}
        {!busy && rows.length === 0 && <div className="card col-span-full text-center text-slate-400">No matching candidates.</div>}
      </div>
    </div>
  );
}

function PostJob() {
  const toast = useToast();
  const dialog = useDialog();
  const { enabled: aiOn } = useAI();
  const { call, busy: aiBusy } = useAICall();
  const [form, setForm] = useState({ contact_visible: true, key_skills: [] });
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
    const r = await call("/api/ai/job/describe", {
      title: form.title, location: form.location, category: form.category,
      experience: form.experience, salary: form.salary, skills: form.key_skills,
    });
    if (r) setAiDraft(r);
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
      const job = await api.post("/api/enterprise/jobs", { ...form, key_skills: form.key_skills || [] });
      dialog({
        tone: "success",
        title: "Job posted successfully",
        message: `"${form.title}" is now live and visible to job seekers.`,
        details: [
          ["Job title", form.title],
          ...(job?.job_code || form.job_code ? [["Job code", job?.job_code || form.job_code]] : []),
          ...(form.location ? [["Location", form.location]] : []),
          ...(form.no_of_positions ? [["Positions", String(form.no_of_positions)]] : []),
        ],
        note: "Job seekers whose skills match will be alerted automatically.",
        confirmLabel: "Done",
      });
      setForm({ contact_visible: true, key_skills: [] });
    } catch (err) { toast(err.message, "error"); }
  };
  return (
    <div className="w-full">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-navy">Post a job</h2>
        {aiOn && (
          <div className="flex gap-2">
            <button className="btn-outline btn-sm" onClick={() => setJdOpen((o) => !o)}>
              <IconSparkle size={14} /> Paste a JD
            </button>
            <button className="btn-outline btn-sm" onClick={draftWithAI} disabled={aiBusy}>
              <IconSparkle size={14} /> {aiBusy ? "Drafting…" : "Draft from title"}
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
          <textarea className="input mt-3" rows={8} value={jdText} placeholder="Paste the full job description here…"
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
              <TagInput label="Key skills" values={form.key_skills || []} options={SKILLS} onChange={setV("key_skills")} />
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
                  <button className="btn-green btn-sm mt-3" onClick={applyDraft}>Use this draft</button>
                </AIResult>
              </div>
            )}

            <div className="sm:col-span-2 2xl:col-span-3"><label className="label">Education requirement</label>
              <input className="input" value={form.requirement_education || ""} onChange={set("requirement_education")} /></div>
            <div className="sm:col-span-2 2xl:col-span-3"><label className="label">Technical requirement</label>
              <input className="input" value={form.requirement_technical || ""} onChange={set("requirement_technical")} /></div>
            <div className="sm:col-span-2 2xl:col-span-3"><label className="label">Job description</label>
              <textarea className="input" rows={6} value={form.description || ""} onChange={set("description")} /></div>

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

function Applications() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [pipeline, setPipeline] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const [chatWith, setChatWith] = useState(null);

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
    try { await api.put(`/api/enterprise/applications/${id}/status`, { status }); toast(`Moved to "${status}".`); load(); }
    catch (err) { toast(err.message, "error"); }
  };

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
          <div key={a.application_id} className="card-hover">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {a.photo
                  ? <img src={a.photo} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                  : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy-50 font-bold text-navy">
                      {(a.candidate_name || "?")[0].toUpperCase()}</div>}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-800">{a.candidate_name}</p>
                    {a.match_score != null && <MatchBar score={a.match_score} />}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {[a.headline, a.location].filter(Boolean).join(" · ")} · applied for <b>{a.job_title}</b>
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(a.key_skills || []).slice(0, 5).map((k) => (
                      <span key={k} className="badge bg-slate-100 text-slate-600">{k}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <StatusBadge status={a.status} />
                <div className="flex gap-2">
                  <select className="input !w-auto !py-1.5 !text-xs" value={a.status}
                          onChange={(e) => setStatus(a.application_id, e.target.value)}>
                    {statuses.map((st) => <option key={st} value={st}>{st}</option>)}
                  </select>
                  <button className="btn-ghost btn-sm" onClick={() => a.candidate_user_id && setChatWith(a.candidate_user_id)}>
                    <IconChat size={15} />
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <button className="btn-sm rounded-lg bg-brandgreen px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brandgreen-600"
                          onClick={() => setStatus(a.application_id, "Shortlisted")}>Shortlist</button>
                  <button className="btn-sm rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                          onClick={() => setStatus(a.application_id, "Rejected")}>Reject</button>
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
      const r = await api.post("/api/enterprise/banners", form);
      toast(r.message);
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

  if (view === "performance") {
    return (
      <div className="max-w-6xl">
        <div className="mb-4 flex gap-1.5 rounded-xl bg-slate-100 p-1.5">
          {[["create", "Create banner"], ["performance", "Performance"]].map(([k, l]) => (
            <button key={k} onClick={() => setView(k)}
              className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${
                view === k ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>{l}</button>
          ))}
        </div>
        <BannerAnalytics endpoint="/api/enterprise/banners/analytics"
                         title="Your banner performance"
                         subtitle="Views and clicks for the banners you've published." />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex gap-1.5 rounded-xl bg-slate-100 p-1.5">
        {[["create", "Create banner"], ["performance", "Performance"]].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)}
            className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${
              view === k ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>{l}</button>
        ))}
      </div>
      <h2 className="mb-1 text-xl font-bold text-navy">Promotional banners</h2>
      <p className="mb-5 text-sm text-slate-500">
        One banner shows per page, chosen so different pages feature different advertisers.
      </p>

      {/* ---- media picker ---- */}
      <div className="card mb-4">
        <h3 className="font-semibold text-slate-700">1. Choose your media</h3>
        <p className="mt-0.5 text-xs text-slate-400">
          HD image, animated GIF, video or audio. Images are optimised to 1080p automatically.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {[["image", "🖼️", "Image", "JPG/PNG/WEBP · 8 MB"],
            ["gif", "🎞️", "GIF", "Animated · 12 MB"],
            ["video", "🎬", "Video", "MP4/WEBM · 50 MB"],
            ["audio", "🔊", "Audio", "MP3/WAV · 15 MB"]].map(([k, icon, label, hint]) => (
            <label key={k}
              className={`cursor-pointer rounded-xl border-2 p-3 text-center transition-all hover:-translate-y-0.5 ${
                form.media_type === k ? "border-navy bg-navy-50" : "border-slate-200 hover:border-navy-200"}`}>
              <input type="file" className="hidden"
                     accept={k === "image" ? "image/png,image/jpeg,image/webp" : k === "gif" ? "image/gif" : k === "video" ? "video/*" : "audio/*"}
                     onChange={(e) => uploadMedia(e.target.files?.[0])} />
              <span className="text-2xl">{icon}</span>
              <p className={`mt-1 text-[12.5px] font-bold ${form.media_type === k ? "text-navy" : "text-slate-700"}`}>{label}</p>
              <p className="text-[10px] leading-tight text-slate-400">{hint}</p>
            </label>
          ))}
        </div>
        {uploading && <p className="mt-2 text-sm text-slate-400">Uploading…</p>}
        {form.media_url && (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            {form.media_type === "video" ? <video src={form.media_url} className="h-40 w-full object-cover" muted autoPlay loop />
              : form.media_type === "audio" ? <audio src={form.media_url} controls className="w-full p-3" />
              : <img src={form.media_url} alt="" className="h-40 w-full object-cover" />}
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

const Row = ({ k, v }) => <div className="flex justify-between border-b border-slate-100 py-1.5 last:border-0"><span className="text-slate-400">{k}</span><span className="text-slate-700">{v || "—"}</span></div>;
const F = ({ label, onChange, span }) => <div className={span ? "sm:col-span-2" : ""}><label className="label">{label}</label><input className="input" onChange={onChange} /></div>;
const Loading = () => <p className="text-slate-400">Loading…</p>;
