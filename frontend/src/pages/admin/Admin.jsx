import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { api } from "../../lib/api";
import { DashboardLayout, useToast } from "../../components/ui";
import { useDialog } from "../../components/Dialog";
import { RegistrationFields, buildRegistrationPayload, validateRegistration } from "../../components/RegistrationForm";
import { IconChart, IconBuilding, IconBriefcase, IconUser, IconSparkle, IconCheck, IconShield, IconStar } from "../../components/icons";
import BannerAnalytics from "../../components/BannerAnalytics";
import { BarChart } from "../../components/charts";
import { Registrations, Managers, Subscriptions } from "./AdminExtra";

const MENU = [
  { to: "/admin", label: "Reports", icon: IconChart },
  { to: "/admin/registrations", label: "Registrations", icon: IconCheck },
  { to: "/admin/add", label: "Add accounts", icon: IconBuilding },
  { to: "/admin/managers", label: "Manager users", icon: IconShield },
  { to: "/admin/subscriptions", label: "Subscriptions", icon: IconStar },
  { to: "/admin/banners", label: "Banner analytics", icon: IconSparkle },
];

export default function Admin() {
  return (
    <DashboardLayout title="Admin" menu={MENU}>
      <Routes>
        <Route index element={<Reports />} />
        <Route path="add" element={<AddAccounts />} />
        <Route path="institutes" element={<Institutes />} />
        <Route path="enterprises" element={<Enterprises />} />
        <Route path="jobseekers" element={<JobSeekers />} />
        <Route path="registrations" element={<Registrations />} />
        <Route path="approvals" element={<Registrations />} />
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
  const toast = useToast();
  const dialog = useDialog();
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
  const clearLog = (status) => dialog({
    tone: "info",
    title: status === "failed" ? "Clear failed emails?" : "Clear all email history?",
    message: status === "failed"
      ? "This removes only the failed delivery records."
      : "This permanently removes every email delivery record. Sent emails are unaffected.",
    confirmLabel: "Clear",
    secondary: { label: "Keep history" },
    onConfirm: async () => {
      try {
        const r = await api.del(`/api/admin/email-log${status ? `?status=${status}` : ""}`);
        toast(r.message);
        api.get("/api/admin/email-log?limit=8").then(setMail).catch(() => {});
      } catch (err) { toast(err.message, "error"); }
    },
  });

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
            <Link to="/admin/registrations"
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
          <div className="mb-2 flex justify-end gap-2">
            {mail?.totals?.failed > 0 && (
              <button className="btn-outline btn-sm !text-red-600 hover:!bg-red-50"
                      onClick={() => clearLog("failed")}>Clear failures</button>
            )}
            {mail?.totals?.total > 0 && (
              <button className="btn-outline btn-sm" onClick={() => clearLog()}>Clear all history</button>
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

function AddAccounts() {
  const [tab, setTab] = useState("institute");
  const TABS = [["institute", "Institute"], ["enterprise", "Employer"], ["jobseeker", "Job seeker"]];
  return (
    <div className="max-w-5xl">
      <h2 className="mb-1 text-xl font-bold text-navy">Add accounts</h2>
      <p className="mb-4 text-sm text-slate-500">Create an account directly — credentials are emailed automatically.</p>
      <div className="mb-5 flex gap-1.5 rounded-xl bg-slate-100 p-1.5">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${
              tab === k ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>{label}</button>
        ))}
      </div>
      {tab === "institute" && <Institutes />}
      {tab === "enterprise" && <Enterprises />}
      {tab === "jobseeker" && <JobSeekers />}
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

/* =====================================================================
   Admin account creation.

   These three used to be hand-rolled mini-forms (a bare <F> helper, 6-9
   fields, no logo upload, no country codes, no taxonomy) — which is exactly
   why they looked nothing like the pages the same people register through.
   All three now render RegistrationFields, the same component the public
   registration pages use, in `admin` mode (no OTP panel, since an admin
   can't receive someone else's codes and the admin endpoints don't check
   them). Fields, layout, validation and payload are now identical.
   ===================================================================== */
function AccountCreator({ role, title, listPath, createPath, columns, renderRow }) {
  const toast = useToast();
  const dialog = useDialog();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({});
  const [formKey, setFormKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = () => api.get(listPath).then(setRows).catch(() => {});
  useEffect(() => { load(); }, [listPath]);

  const reset = () => { setForm({}); setFormKey((k) => k + 1); };

  const add = async () => {
    const err = validateRegistration(role, form);
    if (err) return toast(err, "error");
    setBusy(true);
    try {
      const r = await api.post(createPath, buildRegistrationPayload(role, form));
      showCreds(dialog, r);
      reset(); load();
    } catch (err2) { toast(err2.message, "error"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <RegistrationFields role={role} form={form} setForm={setForm} formKey={formKey} admin />

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn !py-3" onClick={add} disabled={busy}>
          {busy ? "Creating…" : `Create ${title.toLowerCase()}`}
        </button>
        <button type="button" className="btn-outline !py-3" onClick={reset} disabled={busy}>
          Clear
        </button>
      </div>
      <p className="text-center text-sm text-slate-500">
        Fields marked <span className="font-semibold text-red-400">*</span> are required.
        A temporary password is generated and emailed; they can sign in with it straight away.
      </p>

      <div className="card !p-0">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Existing {title.toLowerCase()}s ({rows.length})
          </h3>
        </div>
        <table className="table">
          <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map(renderRow)}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length} className="py-8 text-center text-slate-400">
                None yet.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Institutes() {
  return (
    <AccountCreator role="institute" title="Institute"
      listPath="/api/admin/institutes" createPath="/api/admin/institutes"
      columns={["Name", "Email", "City", "Status"]}
      renderRow={(r) => (
        <tr key={r.id}>
          <td className="font-medium text-slate-800">{r.name}</td>
          <td className="text-slate-500">{r.email}</td>
          <td className="text-slate-500">{r.city || "—"}</td>
          <td>
            <span className={`badge ${r.approval_status === "approved"
              ? "bg-brandgreen-50 text-brandgreen-600" : "bg-amber-100 text-amber-700"}`}>
              {r.approval_status}
            </span>
          </td>
        </tr>
      )} />
  );
}

function Enterprises() {
  return (
    <AccountCreator role="enterprise" title="Employer"
      listPath="/api/admin/enterprises" createPath="/api/admin/enterprises"
      columns={["Company", "Email", "City", "Status"]}
      renderRow={(r) => (
        <tr key={r.id}>
          <td className="font-medium text-slate-800">{r.name}</td>
          <td className="text-slate-500">{r.email}</td>
          <td className="text-slate-500">{r.city || "—"}</td>
          <td>
            <span className={`badge ${r.approval_status === "approved"
              ? "bg-brandgreen-50 text-brandgreen-600" : "bg-amber-100 text-amber-700"}`}>
              {r.approval_status}
            </span>
          </td>
        </tr>
      )} />
  );
}

function JobSeekers() {
  return (
    <AccountCreator role="jobseeker" title="Job seeker"
      listPath="/api/admin/jobseekers" createPath="/api/admin/jobseekers"
      columns={["Name", "Email", "Location", "Resume"]}
      renderRow={(r) => (
        <tr key={r.id}>
          <td className="font-medium text-slate-800">
            {`${r.first_name || ""} ${r.last_name || ""}`.trim() || "—"}
          </td>
          <td className="text-slate-500">{r.email}</td>
          <td className="text-slate-500">{r.location || "—"}</td>
          <td>
            {/* Every seeker gets a resume the moment the profile exists — it is
                rendered from the profile record, so there's nothing to build. */}
            <span className="badge bg-brandgreen-50 text-brandgreen-600">
              {r.resume_template || "classic"}
            </span>
          </td>
        </tr>
      )} />
  );
}

