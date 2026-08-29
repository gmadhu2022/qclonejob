import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { DashboardLayout, StatusBadge, useToast } from "../../components/ui";
import { useDialog } from "../../components/Dialog";
import Chat from "../../components/Chat";
import BannerSlot from "../../components/BannerSlot";
import { SectorList, useTaxonomy } from "../../components/SectorPicker";
import ImageUpload from "../../components/ImageUpload";
import ResumeView from "./ResumeView";
import {
  IconUser, IconDoc, IconLayers, IconSearch, IconClipboard, IconEye, IconChat, IconDownload, IconCheck,
  IconSparkle, IconBriefcase, IconChart, IconStar, IconBookmark,
} from "../../components/icons";
import { Donut, MatchBar, SwitchableChart } from "../../components/charts";
import { AIButton, AIResult, AIList, useAI, useAICall } from "../../components/AIPanel";
import { Combobox, TagInput } from "../../components/fields";
import { CITIES, SKILLS, LANGUAGES, SALARY } from "../../lib/options";

const MENU = [
  { to: "/jobseeker", label: "Dashboard", icon: IconChart },
  { to: "/jobseeker/profile", label: "My Profile", icon: IconUser },
  { to: "/jobseeker/templates", label: "Resume Design", icon: IconLayers },
  { to: "/jobseeker/jobs", label: "Find Jobs", icon: IconSearch },
  { to: "/jobseeker/applied", label: "My Applications", icon: IconClipboard },
  { to: "/jobseeker/views", label: "Who Viewed Me", icon: IconEye },
  { to: "/jobseeker/messages", label: "Messages", icon: IconChat, badge: true },
];

export default function JobSeeker() {
  return (
    <DashboardLayout title="Job Seeker" menu={MENU}>
      {/* One sponsored slot per page, chosen by route so no two pages repeat
          the same advertiser. Sits in the content flow — never overlays anything. */}
      <BannerSlot audience="jobseekers" />
      <Routes>
        <Route index element={<Overview />} />
        <Route path="profile" element={<MyProfile />} />
        <Route path="templates" element={<TemplatePicker />} />
        <Route path="jobs" element={<FindJobs />} />
        <Route path="applied" element={<AppliedJobs />} />
        <Route path="views" element={<RecruiterViews />} />
        <Route path="messages" element={<Chat canBlock />} />
        <Route path="*" element={<Navigate to="/jobseeker" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

/* ================= Overview dashboard ================= */
function Overview() {
  const [d, setD] = useState(null);
  const [rec, setRec] = useState([]);
  useEffect(() => {
    const load = () => api.get("/api/jobseeker/dashboard").then(setD).catch(() => {});
    load(); const id = setInterval(load, 8000);
    api.get("/api/jobseeker/recommended?limit=3").then(setRec).catch(() => {});
    return () => clearInterval(id);
  }, []);
  if (!d) return <Loading />;
  const st = d.strength || {};
  const statusData = Object.entries(d.by_status || {})
    .filter(([, v]) => v > 0)
    .map(([label, value]) => ({ label: label.replace("Interview - ", ""), value, color: STATUS_BAR[label] || "bg-slate-400" }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Applications" value={d.applied} tone="navy" />
        <Stat label="Profile views" value={d.profile_views} tone="green" />
        <Stat label="Saved jobs" value={d.saved} tone="navy" />
        <Stat label="Open jobs" value={d.new_jobs} tone="green" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {statusData.length
            ? <SwitchableChart title="Application pipeline" data={statusData}
                               types={["bar", "hbar", "donut", "pie"]} height={210} />
            : <div className="card"><h3 className="mb-4 font-bold text-slate-800">Application pipeline</h3>
                <p className="py-10 text-center text-sm text-slate-400">Apply to a job to see your pipeline here.</p></div>}
        </div>

        <div className="card">
          <h3 className="mb-1 font-bold text-slate-800">Profile strength</h3>
          <p className="mb-3 text-xs text-slate-400">{st.level} · {st.profile_type === "worker" ? "Worker profile" : "Professional profile"}</p>
          <div className="flex flex-col items-center">
            <Donut value={st.score ?? 0} label={st.level} />
            <p className="mt-3 text-center text-[13px] text-slate-500">{st.message}</p>
            {st.missing?.length > 0 && (
              <div className="mt-4 w-full">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Add next (highest impact first)</p>
                <div className="space-y-1.5">
                  {st.missing.slice(0, 5).map((m) => (
                    <div key={m.key} className="flex items-center justify-between rounded-lg bg-amber-50 px-2.5 py-1.5">
                      <span className="text-[12.5px] font-medium text-amber-800">{m.label}</span>
                      <span className="text-[11px] font-bold text-amber-600">+{m.weight}%</span>
                    </div>
                  ))}
                </div>
                <Link to="/jobseeker/profile" className="btn mt-4 w-full !py-2 text-sm">Complete profile</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Top matches for you</h3>
          <Link to="/jobseeker/jobs" className="text-sm font-semibold text-navy hover:underline">View all →</Link>
        </div>
        <div className="space-y-3">
          {rec.map((j) => (
            <div key={j.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3 transition-colors hover:border-navy-200">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-800">{j.title}</p>
                <p className="text-xs text-slate-500">{j.location} · {j.category}</p>
              </div>
              <MatchBar score={j.match_score} />
            </div>
          ))}
          {rec.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Add skills to your profile to get matches.</p>}
        </div>
      </div>
    </div>
  );
}

const STATUS_BAR = {
  Applied: "bg-slate-400", "Under Review": "bg-amber-400", Shortlisted: "bg-navy",
  "Interview - Phase 1": "bg-blue-400", "Interview - Phase 2": "bg-blue-500", "Interview - Phase 3": "bg-blue-600",
  "Managerial Round": "bg-violet-500", Offered: "bg-brandgreen-400", Hired: "bg-brandgreen",
  "On Hold": "bg-slate-300", Rejected: "bg-red-400",
};

function Stat({ label, value, tone }) {
  return (
    <div className="card-hover text-center">
      <div className={`text-3xl font-extrabold ${tone === "green" ? "text-brandgreen-600" : "text-navy"}`}>{value ?? 0}</div>
      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

/* ================= My Profile — resume + inline editing (items 2 & 3) ================= */
function MyProfile() {
  const toast = useToast();
  const { enabled: aiOn } = useAI();
  const { call, busy: aiBusy } = useAICall();
  const [s, setS] = useState(null);
  const [meta, setMeta] = useState(null);
  const [editing, setEditing] = useState(null);   // section key being edited
  const [saving, setSaving] = useState(false);
  const [ai, setAi] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const load = () => api.get("/api/jobseeker/profile").then(setS);
  useEffect(() => {
    load();
    api.get("/api/jobseeker/templates").then((d) => setMeta(d.meta || []));
  }, []);

  const save = async (patch) => {
    setSaving(true);
    try {
      const saved = await api.put("/api/jobseeker/profile", { ...s, ...patch });
      setS(saved); setEditing(null);
      toast("Profile updated — your resume reflects the change.");
    } catch (err) { toast(err.message, "error"); }
    finally { setSaving(false); }
  };

  const importResume = async () => {
    const r = await call("/api/ai/resume/parse", { text: pasteText });
    if (!r) return;
    setS({ ...s,
      first_name: r.first_name || s.first_name, last_name: r.last_name || s.last_name,
      phone: r.phone || s.phone, location: r.location || s.location,
      career_objective: r.career_objective || s.career_objective,
      key_skills: r.key_skills?.length ? r.key_skills : s.key_skills,
      education: r.education?.length ? r.education : s.education,
      experience: r.experience?.length ? r.experience : s.experience,
      certifications: r.certifications?.length ? r.certifications : s.certifications,
      languages: r.languages?.length ? r.languages : s.languages });
    setPasteOpen(false); setPasteText("");
    toast("Imported — review, then press Save on any section.");
  };

  if (!s) return <Loading />;
  const tplMeta = meta?.find((m) => m.key === (s.resume_template || "classic"));
  const worker = (s.profile_type || "professional") === "worker";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      {/* -------- live resume preview -------- */}
      <div className="order-2 xl:order-1">
        <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-navy">My resume</h2>
            <p className="text-xs text-slate-400">
              Template: <b className="capitalize text-slate-600">{tplMeta?.name || s.resume_template}</b> ·
              edits on the right appear here instantly
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/jobseeker/templates" className="btn-outline btn-sm"><IconLayers size={14} /> Change design</Link>
            <button className="btn-outline btn-sm" onClick={() => window.print()}><IconDownload size={14} /> Download</button>
          </div>
        </div>
        <ResumeView seeker={s} meta={tplMeta} />
      </div>

      {/* -------- inline editor -------- */}
      <div className="no-print order-1 space-y-4 xl:order-2">
        <div className="card">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Profile details</h3>
            {saving && <span className="text-xs text-slate-400">Saving…</span>}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">Edit a section — the resume updates as soon as you save.</p>

          {aiOn && (
            <button className="btn-outline btn-sm mt-3 w-full" onClick={() => setPasteOpen((o) => !o)}>
              <IconSparkle size={14} /> Import from an existing resume
            </button>
          )}
          {pasteOpen && (
            <div className="mt-3 rounded-xl border border-slate-200 p-3">
              <textarea className="input" rows={6} value={pasteText} placeholder="Paste your old resume text here…"
                        onChange={(e) => setPasteText(e.target.value)} />
              <div className="mt-2 flex gap-2">
                <button className="btn-green btn-sm" onClick={importResume} disabled={aiBusy}>
                  {aiBusy ? "Reading…" : "Fill my profile"}
                </button>
                <button className="btn-outline btn-sm" onClick={() => setPasteOpen(false)}>Cancel</button>
              </div>
            </div>
          )}

          {aiOn && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <AIButton path="/api/ai/resume/review" className="btn-outline btn-sm"
                        onResult={(r) => setAi({ kind: "review", data: r })}>Review my resume</AIButton>
              <AIButton path="/api/ai/career/advice" className="btn-outline btn-sm"
                        onResult={(r) => setAi({ kind: "career", data: r })}>Career paths</AIButton>
            </div>
          )}

          {ai?.kind === "review" && (
            <AIResult title={`Recruiter review — ${ai.data.score}/100`} onClose={() => setAi(null)}>
              <p className="leading-relaxed">{ai.data.verdict}</p>
              <AIList label="Fix these first" items={ai.data.fix_now} tone="amber" />
              <AIList label="Already working" items={ai.data.good} tone="green" />
            </AIResult>
          )}
          {ai?.kind === "career" && (
            <AIResult title="Career paths" onClose={() => setAi(null)}>
              <p className="leading-relaxed">{ai.data.advice}</p>
              <AIList label="Target now" items={ai.data.now} tone="green" />
              <div className="mt-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">In ~2 years</p>
                {(ai.data.next || []).map((n, i) => (
                  <p key={i} className="mt-1 text-[13px] text-slate-600">
                    <b>{n.role}</b> — learn: {(n.skills || []).join(", ")}
                  </p>
                ))}
              </div>
            </AIResult>
          )}
        </div>

        {/* profile type switch drives which sections apply */}
        <div className="card">
          <label className="label">Profile type</label>
          <div className="grid grid-cols-2 gap-2">
            {[["professional", "Graduate / Professional"], ["worker", "Skilled / Worker"]].map(([v, l]) => (
              <button key={v} onClick={() => save({ profile_type: v })}
                className={`rounded-xl border-2 p-2.5 text-[12.5px] font-semibold transition-all ${
                  s.profile_type === v ? "border-navy bg-navy-50 text-navy" : "border-slate-200 text-slate-600 hover:border-navy-200"}`}>
                {l}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {worker ? "Your resume leads with work experience, trade skills and availability."
                    : "Your resume includes projects, education and a career objective."}
          </p>
        </div>

        <AccountCard />

        <EditCard title="Photo & basics" open={editing === "basics"} onOpen={() => setEditing(editing === "basics" ? null : "basics")}
                  summary={`${s.first_name || "—"} ${s.last_name || ""} · ${s.phone || "no phone"}`}>
          <ImageUpload kind="avatar" currentUrl={s.profile_picture_url}
                       onUploaded={(u) => setS({ ...s, profile_picture_url: u })} />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <TField label="First name" value={s.first_name} onChange={(v) => setS({ ...s, first_name: v })} />
            <TField label="Last name" value={s.last_name} onChange={(v) => setS({ ...s, last_name: v })} />
            <TField label="Phone" value={s.phone} onChange={(v) => setS({ ...s, phone: v })} />
            <Combobox label="Location" value={s.location} options={CITIES} onChange={(v) => setS({ ...s, location: v })} />
          </div>
          <TField label="Headline" value={s.headline} onChange={(v) => setS({ ...s, headline: v })}
                  hint="e.g. Mechanical Engineer | CAD & Design" />
          <SaveRow onSave={() => save({})} saving={saving} />
        </EditCard>

        {!worker && (
          <EditCard title="Career objective" open={editing === "objective"} onOpen={() => setEditing(editing === "objective" ? null : "objective")}
                    summary={s.career_objective ? `${s.career_objective.slice(0, 48)}…` : "Not added"}>
            <div className="flex justify-end">
              <AIButton path="/api/ai/resume/objective" className="btn-ghost btn-sm !text-navy"
                        onResult={(r) => setS({ ...s, career_objective: r.objective })}>Write with AI</AIButton>
            </div>
            <textarea className="input" rows={4} value={s.career_objective || ""}
                      onChange={(e) => setS({ ...s, career_objective: e.target.value })} />
            <SaveRow onSave={() => save({})} saving={saving} />
          </EditCard>
        )}

        <EditCard title={worker ? "Trade skills" : "Key skills"} open={editing === "skills"} onOpen={() => setEditing(editing === "skills" ? null : "skills")}
                  summary={`${(s.key_skills || []).length} added`}>
          <TagInput label="" values={s.key_skills || []} options={SKILLS}
                    onChange={(v) => setS({ ...s, key_skills: v })} aiSuggestPath="/api/ai/resume/skills" />
          <SaveRow onSave={() => save({})} saving={saving} />
        </EditCard>

        <EditCard title="Work experience" open={editing === "exp"} onOpen={() => setEditing(editing === "exp" ? null : "exp")}
                  summary={`${(s.experience || []).length} role(s)`}>
          <RepeatList items={s.experience || []} onChange={(v) => setS({ ...s, experience: v })}
                      addLabel="Add role"
                      fields={[["role", "Role / job title"], ["company", "Company"], ["years", "Duration (e.g. 2022–2024)"], ["description", "What you did"]]} />
          <SaveRow onSave={() => save({})} saving={saving} />
        </EditCard>

        {!worker && (
          <EditCard title="Projects" open={editing === "proj"} onOpen={() => setEditing(editing === "proj" ? null : "proj")}
                    summary={`${(s.projects || []).length} project(s)`}>
            <RepeatList items={s.projects || []} onChange={(v) => setS({ ...s, projects: v })}
                        addLabel="Add project"
                        fields={[["title", "Project title"], ["tech", "Tools / tech used"], ["description", "What it does"], ["link", "Link (optional)"]]} />
            <SaveRow onSave={() => save({})} saving={saving} />
          </EditCard>
        )}

        <EditCard title="Education" open={editing === "edu"} onOpen={() => setEditing(editing === "edu" ? null : "edu")}
                  summary={`${(s.education || []).length} qualification(s)`}>
          <RepeatList items={s.education || []} onChange={(v) => setS({ ...s, education: v })}
                      addLabel="Add education"
                      fields={[["degree", "Degree"], ["branch", "Branch"], ["institute", "Institute"],
                               ["year_of_passing", "Year"], ["percentage", "Percentage"], ["location", "Location"]]} />
          <SaveRow onSave={() => save({})} saving={saving} />
        </EditCard>

        <EditCard title="Availability & preferences" open={editing === "prefs"} onOpen={() => setEditing(editing === "prefs" ? null : "prefs")}
                  summary={s.availability || "Not set"}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Combobox label="Availability" value={s.availability} options={["Immediate", "15 days", "1 month", "2 months", "Weekends only"]}
                      onChange={(v) => setS({ ...s, availability: v })} />
            <Combobox label="Expected salary" value={s.expected_salary} options={SALARY}
                      onChange={(v) => setS({ ...s, expected_salary: v })} />
            <TField label="Total experience" value={s.total_experience} onChange={(v) => setS({ ...s, total_experience: v })} />
            <TField label="Notice period" value={s.notice_period} onChange={(v) => setS({ ...s, notice_period: v })} />
          </div>
          <TagInput label="Preferred locations" values={s.preferred_locations || []} options={CITIES}
                    onChange={(v) => setS({ ...s, preferred_locations: v })} />
          <SaveRow onSave={() => save({})} saving={saving} />
        </EditCard>

        <EditCard title="Certifications, languages & more" open={editing === "extra"} onOpen={() => setEditing(editing === "extra" ? null : "extra")}
                  summary={`${(s.certifications || []).length} certs · ${(s.languages || []).length} languages`}>
          <TagInput label="Certifications" values={s.certifications || []} onChange={(v) => setS({ ...s, certifications: v })} />
          <TagInput label="Languages" values={s.languages || []} options={LANGUAGES} onChange={(v) => setS({ ...s, languages: v })} />
          <TagInput label="Achievements" values={s.achievements || []} onChange={(v) => setS({ ...s, achievements: v })} />
          <div className="mt-3">
            <label className="label">Additional information</label>
            <textarea className="input" rows={3} value={s.additional_info || ""}
                      onChange={(e) => setS({ ...s, additional_info: e.target.value })} />
          </div>
          <SaveRow onSave={() => save({})} saving={saving} />
        </EditCard>
      </div>
    </div>
  );
}

/* Account settings — photo and password, where a user expects them (J2). */
function AccountCard() {
  const toast = useToast();
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [pic, setPic] = useState(null);
  const [pw, setPw] = useState({ old_password: "", new_password: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get("/api/jobseeker/profile").then((p) => setPic(p.profile_picture_url)).catch(() => {}); }, []);

  const change = async () => {
    if (pw.new_password.length < 6) return toast("New password must be at least 6 characters.", "error");
    if (pw.new_password !== pw.confirm) return toast("The two new passwords don't match.", "error");
    setBusy(true);
    try {
      await api.post("/api/auth/change-password",
        { old_password: pw.old_password || null, new_password: pw.new_password });
      setPw({ old_password: "", new_password: "", confirm: "" });
      dialog({ tone: "success", title: "Password changed",
               message: "Your password has been updated. Use it next time you sign in.",
               confirmLabel: "Done" });
    } catch (err) { toast(err.message, "error"); }
    finally { setBusy(false); }
  };

  return (
    <div className={`rounded-xl border bg-white transition-all ${open ? "border-navy shadow-card" : "border-slate-200 hover:border-navy-200"}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span>
          <span className="block text-[13.5px] font-semibold text-slate-800">Account & security</span>
          <span className="block text-xs text-slate-400">Profile photo and password</span>
        </span>
        <span className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="space-y-5 border-t border-slate-100 px-4 py-4">
          <div>
            <p className="mb-2 text-[12.5px] font-semibold text-slate-700">Profile photo</p>
            <ImageUpload kind="avatar" currentUrl={pic} onUploaded={setPic} />
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-2 text-[12.5px] font-semibold text-slate-700">Change password</p>
            <div className="space-y-2.5">
              <div>
                <label className="label !text-xs">Current password</label>
                <input className="input" type="password" value={pw.old_password}
                       onChange={(e) => setPw({ ...pw, old_password: e.target.value })} />
              </div>
              <div>
                <label className="label !text-xs">New password</label>
                <input className="input" type="password" value={pw.new_password}
                       onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
              </div>
              <div>
                <label className="label !text-xs">Confirm new password</label>
                <input className="input" type="password" value={pw.confirm}
                       onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
              </div>
              <button className="btn w-full !py-2 text-sm" onClick={change} disabled={busy}>
                {busy ? "Updating…" : "Update password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* collapsible edit section */
function EditCard({ title, summary, open, onOpen, children }) {
  return (
    <div className={`rounded-xl border bg-white transition-all ${open ? "border-navy shadow-card" : "border-slate-200 hover:border-navy-200"}`}>
      <button onClick={onOpen} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span>
          <span className="block text-[13.5px] font-semibold text-slate-800">{title}</span>
          <span className="block truncate text-xs text-slate-400">{summary}</span>
        </span>
        <span className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && <div className="space-y-3 border-t border-slate-100 px-4 py-4">{children}</div>}
    </div>
  );
}
function SaveRow({ onSave, saving }) {
  return <button className="btn w-full !py-2 text-sm" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save section"}</button>;
}
function TField({ label, value, onChange, hint }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
function RepeatList({ items, onChange, fields, addLabel }) {
  const set = (i, k, v) => { const next = [...items]; next[i] = { ...next[i], [k]: v }; onChange(next); };
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex justify-end">
            <button className="text-xs font-medium text-red-500 hover:underline"
                    onClick={() => onChange(items.filter((_, x) => x !== i))}>Remove</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map(([k, label]) => (
              <div key={k} className={k === "description" ? "sm:col-span-2" : ""}>
                <label className="label !text-xs">{label}</label>
                {k === "description"
                  ? <textarea className="input" rows={2} value={it[k] || ""} onChange={(e) => set(i, k, e.target.value)} />
                  : <input className="input" value={it[k] || ""} onChange={(e) => set(i, k, e.target.value)} />}
              </div>
            ))}
          </div>
        </div>
      ))}
      <button className="btn-outline btn-sm w-full" onClick={() => onChange([...items, {}])}>+ {addLabel}</button>
    </div>
  );
}

/* ================= Template gallery — 20 designs (item 4) ================= */
function TemplatePicker() {
  const toast = useToast();
  const [meta, setMeta] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [tier, setTier] = useState("All");
  const [seeker, setSeeker] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    api.get("/api/jobseeker/templates").then((d) => { setMeta(d.meta || []); setTiers(d.tiers || []); });
    api.get("/api/jobseeker/profile").then(setSeeker);
  }, []);

  const apply = async (t) => {
    try {
      const u = await api.put("/api/jobseeker/template", { resume_template: t });
      setSeeker(u); setPreview(null);
      toast(`"${meta.find((m) => m.key === t)?.name || t}" is now your resume design.`);
    } catch (err) { toast(err.message, "error"); }
  };

  if (!seeker) return <Loading />;
  const current = seeker.resume_template || "classic";
  const shown = tier === "All" ? meta : meta.filter((m) => m.tier === tier);

  if (preview) {
    const m = meta.find((x) => x.key === preview);
    return (
      <div>
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
          <button className="btn-outline btn-sm" onClick={() => setPreview(null)}>← Back to designs</button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Previewing <b className="text-navy">{m?.name}</b></span>
            {preview === current
              ? <span className="badge bg-brandgreen-50 text-brandgreen-600">Current</span>
              : <button className="btn-green btn-sm" onClick={() => apply(preview)}>Use this design</button>}
            <button className="btn-outline btn-sm" onClick={() => window.print()}><IconDownload size={14} /> Download</button>
          </div>
        </div>
        <ResumeView seeker={seeker} template={preview} meta={m} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-bold text-navy">Resume designs</h2>
        <span className="text-sm text-slate-500">
          {meta.length} designs · current: <b className="text-navy">{meta.find((m) => m.key === current)?.name || current}</b>
        </span>
      </div>
      <p className="mb-5 text-sm text-slate-500">Your information stays the same — only the design changes.</p>

      <div className="mb-5 flex flex-wrap gap-2">
        {["All", ...tiers].map((t) => (
          <button key={t} onClick={() => setTier(t)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tier === t ? "bg-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-navy-50 hover:text-navy"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {shown.map((t) => {
          const active = current === t.key;
          return (
            <div key={t.key}
                 className={`group overflow-hidden rounded-xl border-2 bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-cardhover ${
                   active ? "border-navy shadow-cardhover" : "border-slate-200"}`}>
              <div className="no-print relative h-[290px] overflow-hidden border-b border-slate-100 bg-slate-100">
                <div className="pointer-events-none absolute top-3"
                     style={{ width: 820, transform: "scale(0.32)", transformOrigin: "top left",
                              left: "50%", marginLeft: -(820 * 0.32) / 2 }}>
                  <ResumeView seeker={seeker} template={t.key} meta={t} />
                </div>
                <div className="absolute inset-0 transition-colors group-hover:bg-navy/5" />
                {active && (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-navy px-2.5 py-1 text-[11px] font-semibold text-white">
                    <IconCheck size={12} /> In use
                  </span>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {t.tier}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-slate-800">{t.name}</h3>
                <p className="mt-1 min-h-[34px] text-[12.5px] leading-snug text-slate-500">{t.desc}</p>
                <div className="mt-3 flex gap-2">
                  <button className="btn-outline btn-sm flex-1" onClick={() => setPreview(t.key)}><IconEye size={14} /> Preview</button>
                  <button className={`btn-sm flex-1 ${active ? "btn-outline !opacity-60" : "btn-green"}`}
                          disabled={active} onClick={() => apply(t.key)}>{active ? "Selected" : "Use"}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= Find Jobs — search + recommended + saved in one place (item 5) ================= */
function FindJobs() {
  const toast = useToast();
  const { enabled: aiOn } = useAI();
  const { call, busy: aiBusy } = useAICall();
  const [tab, setTab] = useState("recommended");
  const [jobs, setJobs] = useState([]);
  const [saved, setSaved] = useState([]);
  const [q, setQ] = useState(""); const [location, setLocation] = useState("");
  const [nl, setNl] = useState("");
  const [aiFor, setAiFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sector, setSector] = useState(null);
  const tax = useTaxonomy();

  const loadRecommended = async () => { setBusy(true); setJobs(await api.get("/api/jobseeker/recommended")); setBusy(false); };
  const loadSaved = async () => { setBusy(true); setSaved(await api.get("/api/jobseeker/saved-jobs")); setBusy(false); };
  const search = async () => {
    setBusy(true);
    const p = new URLSearchParams();
    if (q) p.set("q", q); if (location) p.set("location", location);
    setJobs(await api.get(`/api/jobseeker/jobs?${p}`)); setBusy(false);
  };

  useEffect(() => {
    if (tab === "recommended") loadRecommended();
    else if (tab === "saved") loadSaved();
    else if (tab === "browse") { if (sector) searchSector(sector); else setJobs([]); }
    else search();
  }, [tab]);

  const searchSector = async (key) => {
    setBusy(true);
    setJobs(await api.get(`/api/jobseeker/jobs?category=${encodeURIComponent(key)}`));
    setBusy(false);
  };

  const smartSearch = async () => {
    const r = await call("/api/ai/search/parse", { query: nl });
    if (!r) return;
    const p = new URLSearchParams();
    if (r.q) p.set("q", r.q);
    if (r.location) p.set("location", r.location);
    if (r.category) p.set("category", r.category);
    if (r.experience) p.set("experience", r.experience);
    setQ(r.q || ""); setLocation(r.location || "");
    setTab("search");
    setJobs(await api.get(`/api/jobseeker/jobs?${p}`));
    toast("Search understood — filters applied.");
  };

  const apply = async (id) => {
    try { toast((await api.post(`/api/jobseeker/jobs/${id}/apply`)).message); tab === "recommended" ? loadRecommended() : null; }
    catch (err) { toast(err.message, "error"); }
  };
  const save = async (id) => {
    try {
      toast((await api.post(`/api/jobseeker/jobs/${id}/save`)).message);
      if (tab === "saved") loadSaved(); else if (tab === "recommended") loadRecommended();
    } catch (err) { toast(err.message, "error"); }
  };

  const list = tab === "saved" ? saved : jobs;

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold text-navy">Find jobs</h2>

      <div className="mb-5 flex gap-1.5 rounded-xl bg-slate-100 p-1.5">
        {[["recommended", "Recommended"], ["browse", "Browse by sector"], ["search", "Search"], ["saved", "Saved"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${
              tab === k ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>{l}</button>
        ))}
      </div>

      {tab === "search" && (
        <>
          {aiOn && (
            <div className="card mb-4 border-navy-200 bg-navy-50/40">
              <label className="label flex items-center gap-1.5 !text-navy">
                <IconSparkle size={14} /> Describe what you want, in your own words
              </label>
              <div className="flex flex-wrap gap-2">
                <input className="input max-w-lg" value={nl} onChange={(e) => setNl(e.target.value)}
                       placeholder="e.g. fresher mechanical jobs in Hyderabad with CAD"
                       onKeyDown={(e) => e.key === "Enter" && smartSearch()} />
                <button className="btn" onClick={smartSearch} disabled={aiBusy || !nl.trim()}>
                  {aiBusy ? "Understanding…" : "Smart search"}
                </button>
              </div>
            </div>
          )}
          <div className="mb-5 flex flex-wrap items-end gap-2">
            <div className="max-w-xs flex-1"><label className="label">Keywords</label>
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="max-w-xs flex-1"><Combobox label="Location" value={location} options={CITIES} onChange={setLocation} /></div>
            <button className="btn" onClick={search}><IconSearch size={16} /> Search</button>
          </div>
        </>
      )}

      {busy && <p className="text-sm text-slate-400">Loading…</p>}

      <div className={tab === "browse" ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" : ""}>
      <div className="space-y-3">
        {list.map((j) => (
          <div key={j.id} className="card-hover">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-bold text-slate-800">{j.title}</h3>
                  {j.match_score != null && <MatchBar score={j.match_score} />}
                  {j.status && j.status !== "active" && <span className="badge bg-red-100 text-red-700">Closed</span>}
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {[j.location, j.category, j.experience, j.salary].filter(Boolean).join(" · ")}
                </p>
                {j.matched_skills?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {j.matched_skills.map((k) => <span key={k} className="badge bg-brandgreen-50 capitalize text-brandgreen-600">✓ {k}</span>)}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {aiOn && (
                  <>
                    <AIButton path={`/api/ai/jobs/${j.id}/explain`} onResult={(r) => setAiFor({ id: j.id, kind: "explain", data: r })}>Why this fits</AIButton>
                    <AIButton path={`/api/ai/jobs/${j.id}/interview-prep`} onResult={(r) => setAiFor({ id: j.id, kind: "prep", data: r })}>Interview prep</AIButton>
                  </>
                )}
                <button className="btn-outline btn-sm" onClick={() => save(j.id)}>
                  <IconBookmark size={14} /> {tab === "saved" ? "Remove" : j.saved ? "Saved" : "Save"}
                </button>
                <button className={`btn-sm ${j.applied ? "btn-outline !opacity-60" : "btn-green"}`}
                        disabled={j.applied || j.status === "closed"} onClick={() => apply(j.id)}>
                  {j.applied ? "Applied" : "Apply"}
                </button>
              </div>
            </div>

            {aiFor?.id === j.id && aiFor.kind === "explain" && (
              <AIResult title="Why this job fits you" onClose={() => setAiFor(null)}>
                <p className="leading-relaxed">{aiFor.data.summary}</p>
                <AIList label="Your strengths here" items={aiFor.data.strengths} tone="green" />
                <AIList label="Gaps to close" items={aiFor.data.gaps} tone="amber" />
                {aiFor.data.application_tip && (
                  <p className="mt-3 rounded-lg bg-white p-2.5 text-[13px] text-slate-600"><b>Tip:</b> {aiFor.data.application_tip}</p>
                )}
              </AIResult>
            )}
            {aiFor?.id === j.id && aiFor.kind === "prep" && (
              <AIResult title="Interview preparation" onClose={() => setAiFor(null)}>
                <ol className="space-y-2.5">
                  {(aiFor.data.questions || []).map((qq, i) => (
                    <li key={i}>
                      <p className="text-[13.5px] font-semibold text-slate-800">{i + 1}. {qq.q}</p>
                      <p className="text-[12.5px] text-slate-500">{qq.hint}</p>
                    </li>
                  ))}
                </ol>
                <AIList label="Ask them" items={aiFor.data.ask_them} />
              </AIResult>
            )}
          </div>
        ))}
        {!busy && list.length === 0 && (
          <Empty text={tab === "saved" ? "You haven't saved any jobs yet."
            : tab === "recommended" ? "No matches yet — add skills to your profile."
            : tab === "browse" ? "Pick an industry on the right to see its jobs."
            : "No jobs found. Try different keywords."} />
        )}
      </div>

      {/* industry rail — only on Browse, kept on the right so jobs get the width */}
      {tab === "browse" && (
        <aside className="order-first lg:order-last">
          <div className="lg:sticky lg:top-20 space-y-4">
            <div className="card !p-4">
              <h3 className="text-[13.5px] font-bold text-slate-800">Browse by industry</h3>
              <p className="mt-0.5 text-[11.5px] leading-snug text-slate-400">
                {tax ? `${tax.sectors.length} sectors · ${tax.role_count}+ roles` : "Loading…"}
              </p>
              <div className="mt-3">
                <SectorList sectors={tax?.sectors || []} value={sector}
                            onChange={(v) => { setSector(v); if (v) searchSector(v); else setJobs([]); }} />
              </div>
            </div>
            {sector && (
              <div className="card !p-4">
                <h3 className="mb-2 text-[13.5px] font-bold text-slate-800">Popular roles</h3>
                <div className="flex flex-wrap gap-1.5">
                  {(tax?.sectors.find((x) => x.key === sector)?.roles || []).slice(0, 22).map((r) => (
                    <button key={r} onClick={() => { setQ(r); setTab("search"); }}
                            className="badge bg-slate-100 text-slate-600 transition-colors hover:bg-navy hover:text-white">
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
      </div>
    </div>
  );
}

/* ================= Applications ================= */
function AppliedJobs() {
  const [apps, setApps] = useState([]);
  useEffect(() => {
    const load = () => api.get("/api/jobseeker/applications").then(setApps);
    load(); const id = setInterval(load, 8000); return () => clearInterval(id);
  }, []);
  return (
    <div>
      <h2 className="mb-5 text-xl font-bold text-navy">My applications</h2>
      <div className="card overflow-hidden !p-0">
        <table className="table">
          <thead><tr><th>Job title</th><th>Location</th><th>Applied on</th><th>Stage</th></tr></thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id}>
                <td className="font-medium text-slate-800">{a.job?.title}</td>
                <td>{a.job?.location}</td>
                <td>{new Date(a.applied_on).toLocaleDateString()}</td>
                <td><StatusBadge status={a.status} /></td>
              </tr>
            ))}
            {apps.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-slate-400">You haven't applied to any jobs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= Who viewed me — deduplicated (item 6) ================= */
function RecruiterViews() {
  const toast = useToast();
  const [views, setViews] = useState([]);
  const [chatWith, setChatWith] = useState(null);
  useEffect(() => {
    const load = () => api.get("/api/jobseeker/profile-views").then(setViews);
    load(); const id = setInterval(load, 10000); return () => clearInterval(id);
  }, []);
  if (chatWith) return (
    <div><button className="btn-outline btn-sm mb-4" onClick={() => setChatWith(null)}>← Back</button>
      <Chat openWith={chatWith} canBlock /></div>
  );
  return (
    <div>
      <h2 className="mb-1 text-xl font-bold text-navy">Who viewed me</h2>
      <p className="mb-5 text-sm text-slate-500">One row per company — repeat views are counted, not duplicated.</p>
      <div className="space-y-3">
        {views.map((v) => (
          <div key={v.id} className="card-hover flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-50 font-bold text-navy">
                {(v.company_name || "?")[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-slate-800">{v.company_name}</p>
                <p className="text-xs text-slate-500">
                  {[v.recruiter_name, v.location].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`badge ${v.action === "Downloaded" ? "bg-brandgreen-50 text-brandgreen-600" : "bg-navy-50 text-navy"}`}>
                {v.action}
              </span>
              {v.view_count > 1 && <span className="badge bg-slate-100 text-slate-600">{v.view_count}× viewed</span>}
              <span className="text-xs text-slate-400">Last: {new Date(v.viewed_at).toLocaleDateString()}</span>
              <button className="btn-outline btn-sm" onClick={() => v.viewer_user_id ? setChatWith(v.viewer_user_id) : toast("Chat unavailable.", "error")}>
                <IconChat size={14} /> Message
              </button>
            </div>
          </div>
        ))}
        {views.length === 0 && <Empty text="No recruiter has viewed your profile yet." />}
      </div>
    </div>
  );
}

const Loading = () => <p className="text-slate-400">Loading…</p>;
const Empty = ({ text }) => <div className="card text-center text-slate-400">{text}</div>;
