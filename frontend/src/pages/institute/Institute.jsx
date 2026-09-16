import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { api, getToken, mediaUrl } from "../../lib/api";
import { DashboardLayout, useToast } from "../../components/ui";
import { useDialog, useConfirm } from "../../components/Dialog";
import { IconBuilding, IconUpload, IconBriefcase, IconChart, IconChat } from "../../components/icons";
import Chat from "../../components/Chat";
import ImageUpload from "../../components/ImageUpload";
import RichText, { Markdown } from "../../components/RichText";
import PhoneField from "../../components/PhoneField";
import PostJobForm from "../../components/PostJobForm";
import { SwitchableChart } from "../../components/charts";
import { Combobox, TagInput } from "../../components/fields";
import { CITIES, COURSES } from "../../lib/options";

const MENU = [
  { to: "/institute", label: "Dashboard", icon: IconChart },
  { to: "/institute/profile", label: "Institute profile", icon: IconBuilding },
  { to: "/institute/upload", label: "Data upload", icon: IconUpload },
  /*{ to: "/institute/post-job", label: "Post a job", icon: IconBriefcase },*/
  /* Institutes could already be messaged, but had nowhere to read it — a
     "new message" notification linked to a route that didn't exist. */
  { to: "/institute/messages", label: "Messages", icon: IconChat, badge: true },
];

export default function Institute() {
  return (
    <DashboardLayout title="Institute" menu={MENU}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="upload" element={<DataUpload />} />
        {/* Student search is hidden (requirement 1e). Re-enable by restoring
            this route and its menu entry. */}
        <Route path="post-job" element={<PostJob />} />
        <Route path="messages" element={<Chat canBlock />} />
        <Route path="*" element={<Navigate to="/institute" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

/* =====================================================================
   Dashboard — numbers only.

   Previously the dashboard and the profile were one "Profile summary"
   screen, so placement stats sat above the logo uploader and the About
   editor. They answer different questions and are now separate pages,
   matching how the recruiter portal splits Dashboard from Company profile.
   ===================================================================== */
function Dashboard() {
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/api/institute/summary").then(setD).catch(() => {}); }, []);
  if (!d) return <p className="text-slate-400">Loading…</p>;

  const i = d.institute;
  const placementSplit = [
    { label: "Placed", value: d.placed, color: "bg-brandgreen" },
    { label: "Applied, not placed", value: Math.max(0, d.applications - d.placed) },
    { label: "Yet to apply", value: Math.max(0, d.students_total - d.applications) },
  ];
  const readiness = [
    { label: "Resume ready", value: d.students_with_resume, color: "bg-brandgreen" },
    { label: "No resume yet", value: Math.max(0, d.students_total - d.students_with_resume) },
  ];

  return (
    <div className="max-w-6xl space-y-5">
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <Kpi label="Students" value={d.students_total} />
        <Kpi label="With resume" value={d.students_with_resume} />
        <Kpi label="Applications" value={d.applications} />
        <Kpi label="Placed" value={d.placed} tone="green" />
        <Kpi label="Placement rate" value={`${d.placement_rate}%`} tone="green" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SwitchableChart title="Placement breakdown"
                         subtitle="Where your students are in the process"
                         data={placementSplit} />
        <SwitchableChart title="Resume readiness"
                         subtitle="Students can't be shortlisted without a resume"
                         data={readiness} types={["donut", "stacked", "bar", "hbar", "pie", "radial"]} />
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
    </div>
  );
}

/* =====================================================================
   Institute profile — deliberately the same shape as the recruiter's
   Company profile: gradient banner, identity card with the logo beside the
   name, grouped FormCards, sticky save bar, and a read view that reflows
   1 -> 2 -> 3 columns.
   ===================================================================== */
function Profile() {
  const toast = useToast();
  const confirm = useConfirm();
  const [p, setP] = useState(null);
  const [draft, setDraft] = useState(null);
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get("/api/institute/profile").then(setP).catch(() => {}); }, []);

  // Functional update: ImageUpload's onUploaded resolves after the upload
  // finishes and would otherwise write back a stale snapshot.
  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));

  const startEdit = () => { setDraft({ ...p }); setEdit(true); };
  const cancelEdit = () => { setDraft(null); setEdit(false); };

  const save = async () => {
    if (!draft.name?.trim()) return toast("Institute name can't be empty.", "error");
    setSaving(true);
    try {
      const saved = await api.put("/api/institute/profile", {
        ...draft,
        present_strength: draft.present_strength ? Number(draft.present_strength) : null,
        courses: draft.courses || [],
      });
      setP(saved); setDraft(null); setEdit(false);
      confirm("Institute profile updated successfully",
              { message: "Your changes are live on your institute page." });
    } catch (err) { toast(err.message, "error"); }
    finally { setSaving(false); }
  };

  if (!p) return <p className="text-slate-400">Loading…</p>;

  const view = edit ? draft : p;
  const location = [view.city, view.state, view.country].filter(Boolean).join(", ");

  return (
    <div className="max-w-5xl space-y-5">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-navy to-navy-600 p-6 text-white">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 ring-2 ring-white/25">
            {view.logo_url
              ? <img src={mediaUrl(view.logo_url)} alt="" className="h-full w-full object-contain" />
              : <span className="text-2xl font-extrabold text-navy">{(view.name || "?")[0]}</span>}
          </div>
          <div className="min-w-0 flex-1">
            {/* While editing, the name lives in the field below — two copies on
                screen, one not editable, is confusing about which is real. */}
            {edit ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Editing profile</p>
                <p className="text-sm text-navy-100">Changes apply when you press Save profile.</p>
              </>
            ) : (
              <>
                <h2 className="truncate text-2xl font-extrabold">{view.name}</h2>
                {location && <p className="text-sm text-navy-100">{location}</p>}
                {view.authorised_person_name && (
                  <p className="text-xs text-white/60">
                    {[view.authorised_person_name, view.designation].filter(Boolean).join(" · ")}
                  </p>
                )}
              </>
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
                    onClick={startEdit}>Edit profile</button>
          )}
        </div>
      </div>

      {edit ? (
        <>
          <div className="card">
            <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              Institute identity
            </h3>
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-w-0 space-y-4">
                <F label="Institute name" value={draft.name} onChange={set("name")}
                   placeholder="e.g. Coco Soft Institute" />
                <F label="Website" value={draft.website} onChange={set("website")}
                   placeholder="www.yourinstitute.edu" />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <label className="label">Institute logo</label>
                <ImageUpload kind="logo" round={false} currentUrl={draft.logo_url}
                             doneText="Logo saved."
                             onUploaded={(u) => set("logo_url")(u)} />
                <p className="mt-2 text-[11px] leading-snug text-slate-400">
                  Saves as soon as it uploads — it doesn't wait for Save profile.
                </p>
              </div>
            </div>
          </div>

          <FormCard title="Capacity and contact">
            <F label="Present strength" value={draft.present_strength}
               onChange={set("present_strength")} numeric placeholder="e.g. 1200" />
            {/* Contact person next to the number it belongs to, matching the
                registration form. */}
            <F label="Contact Person" value={draft.authorised_person_name}
               onChange={set("authorised_person_name")}
               placeholder="e.g. Priya Sharma, Placement Officer" />
            <div className="sm:col-span-2 xl:col-span-3">
              <PhoneField label="Institute phone" value={draft.phone} onChange={set("phone")} />
            </div>
            <p className="text-xs text-slate-400 sm:col-span-2 xl:col-span-3">
              Present strength is the maximum number of students you can register — bulk uploads
              are checked against it.
            </p>
          </FormCard>

          <FormCard title="Address">
            <F label="Address line 1" value={draft.address1} onChange={set("address1")} span
               placeholder="e.g. Plot 42, Kukatpally" />
            <F label="Address line 2" value={draft.address2} onChange={set("address2")} span
               placeholder="Optional" />
            <Combobox label="City" value={draft.city} options={CITIES} onChange={set("city")}
                      placeholder="e.g. Hyderabad" />
            <F label="District" value={draft.district} onChange={set("district")}
               placeholder="e.g. Medchal-Malkajgiri" />
            <F label="State" value={draft.state} onChange={set("state")} placeholder="e.g. Telangana" />
            <F label="Country" value={draft.country} onChange={set("country")} placeholder="e.g. INDIA" />
          </FormCard>

          <FormCard title="Contact person">
            <F label="Designation" value={draft.designation} onChange={set("designation")}
               placeholder="e.g. Placement Officer" />
            <F label="Promoter's name" value={draft.promoter_name} onChange={set("promoter_name")}
               placeholder="e.g. Ramesh Kumar" />
            <div className="sm:col-span-2 xl:col-span-3">
              <PhoneField label="Authorised person phone" value={draft.authorised_person_phone}
                          onChange={set("authorised_person_phone")} />
            </div>
            <F label="Authorised person email" value={draft.authorised_person_email}
               onChange={set("authorised_person_email")} span placeholder="e.g. priya@institute.edu" />
          </FormCard>

          <div className="card">
            <label className="label">Courses offered</label>
            {/* Full catalogue, not just degree names: institutes teach AI, film
                making, MLT, welding, IELTS. Anything unlisted can be typed. */}
            <TagInput values={draft.courses || []} onChange={set("courses")} options={COURSES}
                      placeholder="e.g. Artificial Intelligence, Python Programming, DMLT" />
            <p className="mt-1.5 text-xs text-slate-400">
              Pick as many as you run — recruiters and students filter by course.
            </p>
          </div>

          <div className="card">
            <RichText label="About the institute" value={draft.about} onChange={set("about")} rows={10}
                      hint="Facilities, placement record, accreditations. **bold**, ## heading, - lists work." />
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
            <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">About the institute</h3>
            <Markdown text={p.about} />
          </div>

          <div className="card">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Institute details</h3>
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              <Row k="Email" v={p.email} />
              <Row k="Phone" v={p.phone} />
              <Row k="Website" v={p.website} link={p.website} />
              <Row k="Present strength" v={p.present_strength} />
              <Row k="City" v={p.city} />
              <Row k="District" v={p.district} />
              <Row k="State" v={p.state} />
              <Row k="Country" v={p.country} />
              <Row k="Address" v={[p.address1, p.address2].filter(Boolean).join(", ")} />
              <Row k="Authorised person" v={p.authorised_person_name} />
              <Row k="Designation" v={p.designation} />
              <Row k="Authorised person phone" v={p.authorised_person_phone} />
              <Row k="Authorised person email" v={p.authorised_person_email} />
              <Row k="Promoter" v={p.promoter_name} />
              <Row k="Courses" v={(p.courses || []).join(", ")} />
            </dl>
          </div>
        </>
      )}
    </div>
  );
}

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
  const confirm = useConfirm();
  const dialog = useDialog();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [batch, setBatch] = useState(null);
  const [history, setHistory] = useState([]);
  const [uploadErrors, setUploadErrors] = useState(null);
  const loadHistory = () => api.get("/api/institute/upload-history").then(setHistory).catch(() => {});
  useEffect(() => { loadHistory(); }, []);

  /**
   * Download the template.
   *
   * Three things matter here and all three were wrong before:
   *  - check res.ok, or a 401 gets saved AS the .xlsx and Excel refuses to open it
   *  - append the anchor to the DOM before clicking (Firefox ignores detached ones)
   *  - revoke the object URL on a delay, or the download is cut short
   */
  const downloadTemplate = async (format = "xlsx") => {
    try {
      const path = format === "csv"
        ? "/api/institute/upload-template.csv"
        : "/api/institute/upload-template";
      const res = await fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) {
        let msg = `Download failed (${res.status})`;
        try { msg = (await res.json()).detail || msg; } catch { /* not JSON */ }
        throw new Error(msg);
      }
      const type = format === "csv"
        ? "text/csv;charset=utf-8"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const blob = new Blob([await res.arrayBuffer()], { type });
      if (blob.size < 500) throw new Error("The downloaded file looks empty. Please try again.");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qclonejob_student_upload_template.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(`Template downloaded (${format.toUpperCase()}).`);
    } catch (err) { toast(err.message, "error"); }
  };

  const upload = async () => {
    if (!file) return toast("Choose an Excel file first.", "error");
    setBusy(true);
    try {
      setUploadErrors(null);
      const res = await api.upload("/api/institute/upload", file);
      setResults(res.results);
      setBatch(res.batch);
      loadHistory();
      confirm("Bulk upload completed successfully", { message: res.message });
    } catch (err) {
      /* A popup, not a toast: the server lists every bad cell, and a toast
         truncates it, auto-dismisses, and collapses the line breaks — losing
         the one thing the institute needs, which row and what to type. */
      const msg = err.message || "Upload failed.";
      const malformed = /problem\(s\) found in this sheet|malformed student data/i.test(msg);
      const noCapacity = /no student capacity set/i.test(msg);
      const overCapacity = /room for|capacity is/i.test(msg);

      if (malformed) {
        // Lines look like: row 3 (Name) | Field | 'value' | how to fix it
        const parsed = msg.split("\n").slice(1).filter(Boolean).map((line) => {
          const p2 = line.replace(/^•\s*/, "").split("|").map((x) => x.trim());
          return p2.length >= 4
            ? { where: p2[0], field: p2[1], value: p2[2], fix: p2.slice(3).join(" | ") }
            : { where: "", field: "", value: "", fix: line };
        });
        setUploadErrors(parsed);          // rendered as a table under the form
        dialog({
          tone: "error",
          title: "This sheet has records that can't be imported",
          message: `${parsed.length} problem(s) found. Nothing was imported, so your existing `
                 + "students are untouched.\n\nFix the rows listed below the form, then upload again.",
          confirmLabel: "Show me the rows",
          note: "Row numbers match your spreadsheet — the header is row 1, so the first "
              + "student is row 2.",
          noteTone: "warn",
        });
      } else if (noCapacity || overCapacity) {
        dialog({
          tone: "error",
          title: noCapacity ? "Set your student capacity first"
                            : "That's more students than your capacity allows",
          message: msg.split("\n").filter(Boolean).join("\n"),
          confirmLabel: noCapacity ? "Go to profile" : "Got it",
          ...(noCapacity ? { onConfirm: () => navigate("/institute/profile") } : {}),
          note: "Nothing was imported.",
          noteTone: "warn",
        });
      } else {
        toast(msg, "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const errorTable = uploadErrors && uploadErrors.length > 0 && (
    <div className="card mb-5 !border-red-200 !bg-red-50/40">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-red-700">
          {uploadErrors.length} record(s) need fixing
        </h3>
        <span className="badge bg-white text-red-600">Nothing was imported</span>
        <div className="flex-1" />
        <button className="btn-outline btn-sm" onClick={() => setUploadErrors(null)}>Dismiss</button>
      </div>
      <div className="overflow-x-auto rounded-xl bg-white">
        <table className="table">
          <thead><tr><th>Where</th><th>Column</th><th>What you entered</th><th>What it should be</th></tr></thead>
          <tbody>
            {uploadErrors.map((e, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap font-semibold text-slate-700">{e.where}</td>
                <td className="whitespace-nowrap text-slate-500">{e.field}</td>
                <td className="break-all font-mono text-[12px] text-red-600">{e.value}</td>
                <td className="text-slate-600">{e.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Row numbers match your spreadsheet: the header is row 1, so the first student is row 2.
        Correct these cells and upload the same file again.
      </p>
    </div>
  );

  return (
    <div className="max-w-5xl">
      <h1 className="mb-2 text-xl font-semibold">Data upload</h1>
      <p className="mb-4 text-sm text-gray-600">
        Upload an Excel of one or many students. A resume is auto-created from the available
        columns, stored in the database, and each student is emailed their login credentials.
      </p>

      {errorTable}

      <div className="card">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button className="btn-outline" onClick={() => downloadTemplate("xlsx")}>Download template (Excel)</button>
          <button className="btn-outline btn-sm" onClick={() => downloadTemplate("csv")}>CSV version</button>
          <span className="text-xs text-slate-400">
            Excel may show "Protected View" for downloaded files — click <b>Enable Editing</b>.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input type="file" accept=".xlsx,.xls,.xlsm,.csv" onChange={(e) => setFile(e.target.files[0])} />
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
              <td>
                <span className="flex items-center gap-2">
                  {s.profile_picture_url
                    ? <img src={mediaUrl(s.profile_picture_url)} alt="" className="h-8 w-8 rounded-full object-cover" />
                    : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-50 text-[11px] font-bold text-navy">
                        {(s.first_name || s.email || "?")[0].toUpperCase()}</span>}
                  {`${s.first_name || ""} ${s.last_name || ""}`.trim() || "—"}
                </span>
              </td>
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

/* Shared with the recruiter portal — same design, same fields, same
   taxonomy pickers. The institute version used to be a reduced form. */
function PostJob() {
  return <PostJobForm endpoint="/api/institute/jobs"
                      postedNote="Your students and matching job seekers will be alerted automatically." />;
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

/* Same shape as the recruiter profile's F2, including placeholder support —
   the two profile screens should not diverge over a missing prop. */
function F({ label, value, onChange, span, numeric, placeholder }) {
  return (
    <div className={span ? "sm:col-span-2 xl:col-span-3" : ""}>
      <label className="label">{label}</label>
      <input className="input" value={value ?? ""} placeholder={placeholder}
             inputMode={numeric ? "numeric" : undefined}
             onChange={(e) => onChange(numeric ? e.target.value.replace(/\D/g, "") : e.target.value)} />
    </div>
  );
}
