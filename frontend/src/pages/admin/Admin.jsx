import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { DashboardLayout, useToast } from "../../components/ui";
import { useDialog } from "../../components/Dialog";
import { IconChart, IconBuilding, IconBriefcase, IconUser, IconSparkle, IconCheck, IconShield, IconStar } from "../../components/icons";
import BannerAnalytics from "../../components/BannerAnalytics";
import { BarChart } from "../../components/charts";
import { Approvals, Managers, Subscriptions } from "./AdminExtra";

const MENU = [
  { to: "/admin", label: "Reports", icon: IconChart },
  { to: "/admin/institutes", label: "Institutes", icon: IconBuilding },
  { to: "/admin/enterprises", label: "Enterprises", icon: IconBriefcase },
  { to: "/admin/jobseekers", label: "Job seekers", icon: IconUser },
  { to: "/admin/approvals", label: "Approvals", icon: IconCheck },
  { to: "/admin/managers", label: "Manager users", icon: IconShield },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: IconStar },
  { to: "/admin/banners", label: "Banner analytics", icon: IconSparkle },
];

export default function Admin() {
  return (
    <DashboardLayout title="Admin" menu={MENU}>
      <Routes>
        <Route index element={<Reports />} />
        <Route path="institutes" element={<Institutes />} />
        <Route path="enterprises" element={<Enterprises />} />
        <Route path="jobseekers" element={<JobSeekers />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="managers" element={<Managers />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="banners" element={
          <BannerAnalytics endpoint="/api/admin/banners/analytics"
                           title="Platform banner analytics"
                           subtitle="Every advertiser's performance across the platform." />
        } />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

function Reports() {
  const [s, setS] = useState(null);
  const [appr, setAppr] = useState(null);
  const [mail, setMail] = useState(null);
  const [subs, setSubs] = useState([]);
  useEffect(() => {
    const load = () => {
      api.get("/api/admin/reports/summary").then(setS).catch(() => {});
      api.get("/api/admin/approvals").then(setAppr).catch(() => {});
      api.get("/api/admin/email-log?limit=8").then(setMail).catch(() => {});
      api.get("/api/admin/subscriptions").then(setSubs).catch(() => {});
    };
    load(); const id = setInterval(load, 15000); return () => clearInterval(id);
  }, []);
  if (!s) return <p className="text-slate-400">Loading…</p>;

  const pending = appr ? Object.values(appr.counts).reduce((a, b) => a + b, 0) : 0;
  const revenue = subs.filter((r) => r.status === "active").reduce((a, r) => a + (r.amount || 0), 0);
  const mailFailed = mail?.totals?.failed || 0;

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-navy">Platform overview</h2>
        <p className="text-sm text-slate-500">Live across every account on QCloneJob.</p>
      </div>

      {/* attention strip — only shows when something needs doing */}
      {(pending > 0 || mailFailed > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {pending > 0 && (
            <Link to="/admin/approvals"
                  className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100">
              <span className="text-sm font-semibold text-amber-800">
                {pending} account{pending === 1 ? "" : "s"} waiting for approval
              </span>
              <span className="text-xs font-bold text-amber-700">Review →</span>
            </Link>
          )}
          {mailFailed > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <span className="text-sm font-semibold text-red-800">
                {mailFailed} email{mailFailed === 1 ? "" : "s"} failed to send
              </span>
              <span className="text-xs font-bold text-red-700">See email log below</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
        <Stat label="Institutes" value={s.institutes} />
        <Stat label="Employers" value={s.enterprises} />
        <Stat label="Job seekers" value={s.jobseekers} />
        <Stat label="Jobs" value={s.jobs} />
        <Stat label="Applications" value={s.applications} />
        <Stat label="Pending" value={pending} tone={pending ? "amber" : "navy"} />
        <Stat label="Revenue" value={`$${revenue.toLocaleString()}`} tone="green" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 font-bold text-slate-800">Accounts on the platform</h3>
          <BarChart data={[
            { label: "Institutes", value: s.institutes, color: "bg-navy" },
            { label: "Employers", value: s.enterprises, color: "bg-blue-500" },
            { label: "Seekers", value: s.jobseekers, color: "bg-brandgreen" },
            { label: "Jobs", value: s.jobs, color: "bg-amber-400" },
            { label: "Applications", value: s.applications, color: "bg-violet-500" },
          ]} height={190} />
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Email delivery</h3>
            {mail && (
              <span className="text-xs text-slate-400">
                {mail.totals.sent} sent · {mail.totals.failed} failed · {mail.totals.console} console
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {(mail?.items || []).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-slate-700">{m.to}</p>
                  <p className="truncate text-[11px] text-slate-400">{m.subject}</p>
                  {m.error && <p className="truncate text-[11px] text-red-500" title={m.error}>{m.error}</p>}
                </div>
                <span className={`badge shrink-0 ${
                  m.status === "sent" ? "bg-brandgreen-50 text-brandgreen-600"
                  : m.status === "failed" ? "bg-red-100 text-red-700"
                  : "bg-slate-100 text-slate-500"}`}>{m.status}</span>
              </div>
            ))}
            {(!mail || mail.items.length === 0) && (
              <p className="py-6 text-center text-sm text-slate-400">No emails sent yet.</p>
            )}
          </div>
        </div>
      </div>

      <EmailDiagnostics />
      <AIDiagnostics />
    </div>
  );
}

function AIDiagnostics() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const load = async () => {
    setErr(null); setData(null);
    try { setData(await api.get("/api/ai/models")); }
    catch (e) { setErr(e.message); toast(e.message, "error"); }
  };
  return (
    <div className="card max-w-xl">
      <h3 className="font-semibold text-slate-700">AI model check</h3>
      <p className="mt-1 text-xs text-slate-500">
        Groq retires model IDs over time. This lists exactly what your API key supports right now.
      </p>
      <button className="btn mt-3" onClick={load}>Check my models</button>
      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      {data && (
        <div className="mt-4">
          <p className="text-sm">
            Configured: <b className="text-navy">{data.configured}</b>{" "}
            {data.configured_is_valid
              ? <span className="badge bg-brandgreen-50 text-brandgreen-600">valid</span>
              : <span className="badge bg-red-100 text-red-700">not available — change it</span>}
          </p>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">
            Available to your key ({data.available.length})
          </p>
          <div className="mt-1.5 max-h-52 overflow-y-auto rounded-lg border border-slate-200">
            {data.available.map((m) => (
              <div key={m} className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5 last:border-0">
                <code className="text-[12px] text-slate-700">{m}</code>
                <button className="text-[11px] font-semibold text-navy hover:underline"
                        onClick={() => { navigator.clipboard?.writeText(m); toast(`Copied "${m}" — paste into GROQ_MODEL in backend/.env and restart.`); }}>
                  Copy
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmailDiagnostics() {
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  const [to, setTo] = useState("");
  const [result, setResult] = useState(null);
  useEffect(() => { api.get("/api/health/email-config").then(setCfg).catch(() => {}); }, []);
  const test = async () => {
    setResult(null);
    try { const r = await api.post("/api/health/email-test", { to }); setResult(r); toast(r.ok ? "Test sent." : "Test failed.", r.ok ? "success" : "error"); }
    catch (err) { toast(err.message, "error"); }
  };
  return (
    <div className="card mt-6 max-w-xl">
      <h3 className="font-semibold text-slate-700">Email diagnostics</h3>
      {cfg && (
        <p className="mt-1 text-xs text-slate-500">
          Mode: <b>{cfg.email_enabled ? "SMTP (live)" : "Console (dev)"}</b> · {cfg.smtp_host}:{cfg.smtp_port} · user {cfg.smtp_user || "—"} · password {cfg.password_set ? "set" : "not set"}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <input className="input max-w-xs" placeholder="send test to…" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="btn" onClick={test}>Send test</button>
      </div>
      {result && (
        <p className={`mt-3 text-sm ${result.ok ? "text-brandgreen-600" : "text-red-600"}`}>
          {result.ok ? `Sent via ${result.sent_via}` : `Error: ${result.error}`}
        </p>
      )}
      {cfg && !cfg.email_enabled && (
        <p className="mt-2 text-xs text-slate-400">Emails are printing to the backend console. To send real Gmail, set EMAIL_ENABLED=True and a Gmail App Password in backend/.env.</p>
      )}
    </div>
  );
}
function Stat({ label, value, tone }) {
  const tones = { green: "text-brandgreen-600", amber: "text-amber-600" };
  return (
    <div className="card-hover text-center">
      <div className={`text-2xl font-extrabold ${tones[tone] || "text-navy"}`}>{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

/* Shared credential-result banner shown after creating an account */
function CredResult({ res }) {
  if (!res) return null;
  return (
    <div className="card mt-3 text-sm">
      <p className="font-semibold">{res.status}</p>
      <p>User ID: <b>{res.user_id}</b></p>
      <p>Temporary password: <b>{res.password}</b> (also emailed)</p>
    </div>
  );
}

function showCreds(dialog, r) {
  dialog({
    tone: r.email_sent === false ? "info" : "success",
    title: r.status || "Account created",
    message: "Share these credentials with the account holder.",
    details: [["User ID", r.user_id], ["Temporary password", r.password]],
    note: r.email_status === "sent"
      ? `Emailed to ${r.email}.`
      : r.email_status === "console"
        ? "Email is switched off — copy these now (also printed in the server console)."
        : `Email failed: ${r.email_error || "unknown error"}. Copy these now.`,
    noteTone: r.email_status === "sent" ? "info" : "warn",
    confirmLabel: "Copied",
  });
}

function Institutes() {
  const toast = useToast();
  const dialog = useDialog();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ country: "INDIA" });
  const [res, setRes] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const load = () => api.get("/api/admin/institutes").then(setRows);
  useEffect(() => { load(); }, []);

  const add = async () => {
    try {
      const body = { ...form, courses: (form.courses || "").split(",").map(x => x.trim()).filter(Boolean),
        present_strength: form.present_strength ? Number(form.present_strength) : null };
      const r = await api.post("/api/admin/institutes", body);
      setRes(r); showCreds(dialog, r); setForm({ country: "INDIA" }); load();
    } catch (err) { toast(err.message, "error"); }
  };
  const reset = async (id) => {
    try { const r = await api.post(`/api/admin/institutes/${id}/reset-password`); setRes(r); toast("Password reset; email sent"); }
    catch (err) { toast(err.message, "error"); }
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Institutes</h1>
      <div className="card grid gap-3 sm:grid-cols-2">
        <F label="Institute name" onChange={set("name")} span />
        <F label="Email (becomes User ID)" onChange={set("email")} span />
        <F label="Phone" onChange={set("phone")} />
        <F label="City" onChange={set("city")} />
        <F label="State" onChange={set("state")} />
        <F label="Promoter" onChange={set("promoter_name")} />
        <F label="Authorised person" onChange={set("authorised_person_name")} />
        <F label="Courses (comma separated)" onChange={set("courses")} span />
        <F label="Present strength" onChange={set("present_strength")} />
        <div className="sm:col-span-2"><button className="btn" onClick={add}>Add institute</button></div>
      </div>
      <CredResult res={res} />
      <table className="table mt-4">
        <thead><tr><th>Name</th><th>Email</th><th>City</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}><td>{r.name}</td><td>{r.email}</td><td>{r.city}</td>
              <td><button className="btn-outline" onClick={() => reset(r.id)}>Reset password</button></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Enterprises() {
  const toast = useToast();
  const dialog = useDialog();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ country: "INDIA" });
  const [res, setRes] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const load = () => api.get("/api/admin/enterprises").then(setRows);
  useEffect(() => { load(); }, []);

  const add = async () => {
    try { const r = await api.post("/api/admin/enterprises", form); setRes(r); showCreds(dialog, r); setForm({ country: "INDIA" }); load(); }
    catch (err) { toast(err.message, "error"); }
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Enterprises</h1>
      <div className="card grid gap-3 sm:grid-cols-2">
        <F label="Company name" onChange={set("name")} span />
        <F label="Email (becomes User ID)" onChange={set("email")} span />
        <F label="Phone" onChange={set("phone")} />
        <F label="City" onChange={set("city")} />
        <F label="State" onChange={set("state")} />
        <F label="GST No." onChange={set("gst_no")} />
        <F label="PAN No." onChange={set("pan_no")} />
        <div className="sm:col-span-2"><button className="btn" onClick={add}>Add enterprise</button></div>
      </div>
      <CredResult res={res} />
      <table className="table mt-4">
        <thead><tr><th>Name</th><th>Email</th><th>City</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.email}</td><td>{r.city}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function JobSeekers() {
  const toast = useToast();
  const dialog = useDialog();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({});
  const [res, setRes] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const load = () => api.get("/api/admin/jobseekers").then(setRows);
  useEffect(() => { load(); }, []);

  const add = async () => {
    try {
      const body = { ...form, key_skills: (form.skills || "").split(",").map(x => x.trim()).filter(Boolean) };
      const r = await api.post("/api/admin/jobseekers", body);
      setRes(r); showCreds(dialog, r); setForm({}); load();
    } catch (err) { toast(err.message, "error"); }
  };

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Job seekers</h1>
      <div className="card grid gap-3 sm:grid-cols-2">
        <F label="First name" onChange={set("first_name")} />
        <F label="Last name" onChange={set("last_name")} />
        <F label="Email (becomes User ID)" onChange={set("email")} span />
        <F label="Phone" onChange={set("phone")} />
        <F label="Location" onChange={set("location")} />
        <F label="Key skills (comma separated)" onChange={set("skills")} span />
        <div className="sm:col-span-2"><button className="btn" onClick={add}>Add job seeker</button></div>
      </div>
      <CredResult res={res} />
      <table className="table mt-4">
        <thead><tr><th>Name</th><th>Email</th><th>Location</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td>{`${r.first_name || ""} ${r.last_name || ""}`.trim() || "—"}</td><td>{r.email}</td><td>{r.location}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function F({ label, onChange, span }) {
  return <div className={span ? "sm:col-span-2" : ""}><label className="label">{label}</label><input className="input" onChange={onChange} /></div>;
}
