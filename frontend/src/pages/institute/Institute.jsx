import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { api, getToken } from "../../lib/api";
import { DashboardLayout, useToast } from "../../components/ui";
import { useDialog } from "../../components/Dialog";
import { IconBuilding, IconUpload, IconSearch, IconBriefcase } from "../../components/icons";
import ImageUpload from "../../components/ImageUpload";
import RichText, { Markdown } from "../../components/RichText";
import { AIResult, AIList, useAI, useAICall } from "../../components/AIPanel";
import SkillPicker from "../../components/SkillPicker";
import { Combobox, TagInput } from "../../components/fields";
import { QUALIFICATIONS, CITIES, EXPERIENCE, SKILLS } from "../../lib/options";
import { IconSparkle } from "../../components/icons";

const MENU = [
  { to: "/institute", label: "Profile summary", icon: IconBuilding },
  { to: "/institute/upload", label: "Data upload", icon: IconUpload },
  { to: "/institute/post-job", label: "Post a job", icon: IconBriefcase },
];

export default function Institute() {
  return (
    <DashboardLayout title="Institute" menu={MENU}>
      <Routes>
        <Route index element={<Profile />} />
        <Route path="upload" element={<DataUpload />} />
        {/* Student search is hidden (requirement 1e). Re-enable by restoring
            this route and its menu entry. */}
        <Route path="post-job" element={<PostJob />} />
        <Route path="*" element={<Navigate to="/institute" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

function Profile() {
  const [d, setD] = useState(null);
  const [p, setP] = useState(null);
  const [editAbout, setEditAbout] = useState(false);
  const toast = useToast();
  const saveAbout = async () => {
    try { setP(await api.put("/api/institute/profile", p)); setEditAbout(false); toast("About updated."); }
    catch (err) { toast(err.message, "error"); }
  };
  useEffect(() => {
    api.get("/api/institute/summary").then(setD).catch(() => {});
    api.get("/api/institute/profile").then(setP).catch(() => {});
  }, []);
  if (!d || !p) return <p className="text-slate-400">Loading…</p>;
  const i = d.institute;
  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">{i.name}</h2>
          <p className="text-sm text-slate-500">{[i.city, i.state].filter(Boolean).join(", ")}</p>
        </div>
        <span className={`badge ${i.approval_status === "approved"
          ? "bg-brandgreen-50 text-brandgreen-600"
          : i.approval_status === "pending" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
          {i.approval_status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Students" value={d.students_total} />
        <Kpi label="With resume" value={d.students_with_resume} />
        <Kpi label="Applications" value={d.applications} />
        <Kpi label="Placed" value={d.placed} tone="green" />
        <Kpi label="Placement rate" value={`${d.placement_rate}%`} tone="green" />
      </div>

      {d.last_upload && (
        <div className="card">
          <h3 className="font-semibold text-slate-700">Last data upload</h3>
          <p className="mt-1 text-sm text-slate-600">
            <b>{d.last_upload.filename}</b> · {d.last_upload.created} student(s) created ·{" "}
            {new Date(d.last_upload.uploaded_at).toLocaleString()}
          </p>
        </div>
      )}

      <div className="card">
        <h3 className="mb-3 font-semibold text-slate-700">Institute logo</h3>
        <ImageUpload kind="logo" round={false} currentUrl={p.logo_url}
                     onUploaded={(u) => setP({ ...p, logo_url: u })} />
      </div>

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">About the institute</h3>
          <button className="btn-outline btn-sm" onClick={() => setEditAbout((e) => !e)}>
            {editAbout ? "Cancel" : "Edit"}
          </button>
        </div>
        {editAbout ? (
          <>
            <RichText value={p.about} onChange={(v) => setP({ ...p, about: v })} rows={8} />
            <button className="btn btn-sm mt-3" onClick={saveAbout}>Save</button>
          </>
        ) : <Markdown text={p.about} />}
      </div>

      <div className="card space-y-1 text-sm">
        <Row k="Email" v={i.email} />
        <Row k="Phone" v={i.phone} />
        <Row k="City / State" v={`${i.city || "—"}, ${i.state || "—"}`} />
        <Row k="Website" v={i.website} />
        <Row k="Courses" v={(i.courses || []).join(", ")} />
        <Row k="Present strength" v={i.present_strength} />
        <Row k="Jobs posted" v={d.jobs_posted} />
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }) {
  return (
    <div className="card-hover text-center">
      <div className={`text-2xl font-extrabold ${tone === "green" ? "text-brandgreen-600" : "text-navy"}`}>{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

/* THE emphasized flow: upload Excel -> auto resumes -> emailed credentials */
function DataUpload() {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [batch, setBatch] = useState(null);
  const [history, setHistory] = useState([]);
  const loadHistory = () => api.get("/api/institute/upload-history").then(setHistory).catch(() => {});
  useEffect(() => { loadHistory(); }, []);

  const downloadTemplate = async () => {
    // fetch with auth then trigger a browser download
    const res = await fetch("/api/institute/upload-template", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "qclonejob_student_upload_template.xlsx"; a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async () => {
    if (!file) return toast("Choose an Excel file first.", "error");
    setBusy(true);
    try {
      const res = await api.upload("/api/institute/upload", file);
      setResults(res.results);
      setBatch(res.batch);
      loadHistory();
      toast(res.message);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <h1 className="mb-2 text-xl font-semibold">Data upload</h1>
      <p className="mb-4 text-sm text-gray-600">
        Upload an Excel of one or many students. A resume is auto-created from the available
        columns, stored in the database, and each student is emailed their login credentials.
      </p>

      <div className="card">
        <button className="btn-outline mb-4" onClick={downloadTemplate}>Download template</button>
        <div className="flex items-center gap-3">
          <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files[0])} />
          <button className="btn" onClick={upload} disabled={busy}>
            {busy ? "Uploading…" : "Upload & create accounts"}
          </button>
        </div>
      </div>

      {batch && (
        <div className="card mt-4 border-brandgreen-100 bg-brandgreen-50/40">
          <h3 className="font-semibold text-brandgreen-600">Upload complete</h3>
          <p className="mt-1 text-sm text-slate-700">
            <b>{batch.filename}</b> · uploaded {new Date(batch.uploaded_at).toLocaleString()}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="badge bg-white text-slate-600">{batch.total_rows} rows read</span>
            <span className="badge bg-brandgreen-50 text-brandgreen-600">{batch.created} created</span>
            {batch.duplicates > 0 && <span className="badge bg-amber-100 text-amber-700">{batch.duplicates} duplicates ignored</span>}
            {batch.skipped > 0 && <span className="badge bg-slate-100 text-slate-600">{batch.skipped} skipped</span>}
          </div>
        </div>
      )}

      {results && (
        <div className="card mt-4">
          <h2 className="mb-2 font-semibold">Result</h2>
          <table className="table">
            <thead><tr><th>Student</th><th>User ID</th><th>Password</th><th>Status</th></tr></thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td>{r.row}</td>
                  <td>{r.user_id || "—"}</td>
                  <td>{r.password || "—"}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-500">
            Passwords are shown once here for your reference; students also receive them by email.
          </p>
        </div>
      )}

      {history.length > 0 && (
        <div className="card mt-4">
          <h3 className="mb-3 font-semibold text-slate-700">Upload history</h3>
          <table className="table">
            <thead><tr><th>File</th><th>Uploaded on</th><th className="text-right">Rows</th>
              <th className="text-right">Created</th><th className="text-right">Duplicates</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="font-medium text-slate-700">{h.filename}</td>
                  <td>{new Date(h.uploaded_at).toLocaleString()}</td>
                  <td className="text-right">{h.total_rows}</td>
                  <td className="text-right text-brandgreen-600">{h.created}</td>
                  <td className="text-right text-amber-600">{h.duplicates}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StudentSearch() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rows, setRows] = useState([]);

  const search = async () => {
    const params = new URLSearchParams();
    if (email) params.set("email", email);
    if (phone) params.set("phone", phone);
    setRows(await api.get(`/api/institute/students?${params}`));
  };
  useEffect(() => { search(); }, []);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Student search</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input max-w-xs" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <button className="btn" onClick={search}>Search</button>
      </div>
      <table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Location</th><th>Key skills</th></tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td>{`${s.first_name || ""} ${s.last_name || ""}`.trim() || "—"}</td>
              <td>{s.email}</td>
              <td>{s.phone}</td>
              <td>{s.location}</td>
              <td>{(s.key_skills || []).join(", ")}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} className="text-gray-500">No students found.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function PostJob() {
  const toast = useToast();
  const dialog = useDialog();
  const { enabled: aiOn } = useAI();
  const { call, busy: aiBusy } = useAICall();
  const [form, setForm] = useState({ contact_visible: true, key_skills: [] });
  const [aiDraft, setAiDraft] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setV = (k) => (v) => setForm({ ...form, [k]: v });

  const [jdText, setJdText] = useState("");
  const [jdOpen, setJdOpen] = useState(false);

  // Accepts a pasted JD or an uploaded .txt/.md/.csv file; AI fills every field.
  const readFile = async (file) => {
    if (!file) return;
    const text = await file.text().catch(() => "");
    if (!text.trim()) return toast("Couldn't read that file. Paste the text instead.", "error");
    setJdText(text.slice(0, 20000));
  };

  const parseJD = async () => {
    const r = await call("/api/ai/job/parse", { text: jdText });
    if (!r) return;
    setForm((f) => ({
      ...f,
      title: r.title || f.title, job_code: r.job_code || f.job_code,
      category: r.category || f.category, location: r.location || f.location,
      experience: r.experience || f.experience, salary: r.salary || f.salary,
      wage_min: r.wage_min || f.wage_min, wage_max: r.wage_max || f.wage_max,
      requirement_education: r.requirement_education || f.requirement_education,
      requirement_technical: r.requirement_technical || f.requirement_technical,
      description: r.description || f.description,
      key_skills: r.key_skills?.length ? r.key_skills : f.key_skills,
    }));
    setJdOpen(false); setJdText("");
    toast("Fields filled from your JD — review, then post.");
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
    setForm({ ...form, description: aiDraft.description || form.description,
      requirement_education: aiDraft.requirement_education || form.requirement_education,
      requirement_technical: aiDraft.requirement_technical || form.requirement_technical,
      key_skills: aiDraft.key_skills?.length ? aiDraft.key_skills : form.key_skills });
    setAiDraft(null); toast("Draft applied — edit before posting.");
  };

  const submit = async () => {
    try {
      const job = await api.post("/api/institute/jobs", { ...form, key_skills: form.key_skills || [] });
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
    <div className="max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-navy">Post a job</h2>
        {aiOn && (
          <div className="flex gap-2">
            <button className="btn-outline btn-sm" onClick={() => setJdOpen((o) => !o)}>
              <IconSparkle size={14} /> Upload / paste a JD
            </button>
            <button className="btn-outline btn-sm" onClick={draftWithAI} disabled={aiBusy}>
              <IconSparkle size={14} /> {aiBusy ? "Drafting…" : "Draft from title"}
            </button>
          </div>
        )}
      </div>

      {jdOpen && (
        <div className="card mb-4 border-navy-200 bg-navy-50/40">
          <h3 className="font-semibold text-navy">Upload or paste your job description</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            AI reads it and fills every field below. You review and correct anything before posting.
          </p>
          <label className="btn-outline btn-sm mt-3 inline-flex cursor-pointer">
            Choose a file (.txt, .md, .csv)
            <input type="file" accept=".txt,.md,.csv,.json" className="hidden"
                   onChange={(e) => readFile(e.target.files?.[0])} />
          </label>
          <textarea className="input mt-3" rows={8} value={jdText}
                    placeholder="…or paste the full job description here"
                    onChange={(e) => setJdText(e.target.value)} />
          <div className="mt-3 flex gap-2">
            <button className="btn-green btn-sm" onClick={parseJD} disabled={aiBusy || jdText.trim().length < 40}>
              {aiBusy ? "Reading…" : "Auto-fill the form"}
            </button>
            <button className="btn-outline btn-sm" onClick={() => setJdOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
      <div className="card grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><label className="label">Job title *</label>
          <input className="input" value={form.title || ""} onChange={set("title")} /></div>
        <div><label className="label">Job code</label><input className="input" value={form.job_code || ""} onChange={set("job_code")} /></div>
        <Combobox label="Location" value={form.location} options={CITIES} onChange={setV("location")} />
        <Combobox label="Qualification/s" value={form.category} options={QUALIFICATIONS} onChange={setV("category")} aiField="required qualification" />
        <Combobox label="Experience" value={form.experience} options={EXPERIENCE} onChange={setV("experience")} />
        <div className="sm:col-span-2">
          <label className="label">Salary Range</label>
          <div className="flex items-center gap-2">
            <input className="input" value={form.wage_min || ""} onChange={set("wage_min")} placeholder="e.g. 15,000" />
            <span className="shrink-0 text-sm text-slate-400">to</span>
            <input className="input" value={form.wage_max || ""} onChange={set("wage_max")} placeholder="e.g. 25,000" />
          </div>
        </div>
        <div className="sm:col-span-2">
          <SkillPicker values={form.key_skills || []} onChange={setV("key_skills")} sector={form.sector}
                           aiSuggestPath={aiOn && form.title ? "/api/ai/job/classify" : null}
                           aiBody={{ title: form.title }} />
        </div>
        {aiDraft && (
          <div className="sm:col-span-2">
            <AIResult title="AI draft" onClose={() => setAiDraft(null)}>
              <p className="whitespace-pre-line leading-relaxed">{aiDraft.description}</p>
              <AIList label="Responsibilities" items={aiDraft.responsibilities} />
              <button className="btn-green btn-sm mt-3" onClick={applyDraft}>Use this draft</button>
            </AIResult>
          </div>
        )}
        <div className="sm:col-span-2"><label className="label">Description</label>
          <textarea className="input" rows={5} value={form.description || ""} onChange={set("description")} /></div>
        <div className="sm:col-span-2"><button className="btn" onClick={submit}>Post job</button></div>
      </div>
    </div>
  );
}

function Row({ k, v }) {
  return <div className="flex justify-between border-b border-gray-100 py-1"><span className="text-gray-500">{k}</span><span>{v || "—"}</span></div>;
}
function F({ label, onChange, span }) {
  return <div className={span ? "sm:col-span-2" : ""}><label className="label">{label}</label><input className="input" onChange={onChange} /></div>;
}
