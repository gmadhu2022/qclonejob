import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api";
import { useToast } from "../../components/ui";
import { useDialog } from "../../components/Dialog";
import { IconCheck, IconBlock, IconSearch } from "../../components/icons";

/* ================= Approvals (3b, 3c, 3d) ================= */
export function Approvals() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("institutes");
  const [reason, setReason] = useState({});

  const load = useCallback(() => {
    api.get("/api/admin/approvals").then(setData).catch(() => {});
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const decide = async (kind, id, decision) => {
    try {
      const r = await api.post(`/api/admin/approvals/${kind}/${id}`,
        { decision, reason: reason[`${kind}${id}`] || "" });
      toast(r.message);
      load();
    } catch (err) { toast(err.message, "error"); }
  };

  if (!data) return <p className="text-slate-400">Loading…</p>;
  const TABS = [
    ["institutes", "Institutes", "institute"],
    ["enterprises", "Employers", "enterprise"],
    ["jobseekers", "Job seekers", "jobseeker"],
  ];
  const rows = data[tab] || [];
  const kind = TABS.find((t) => t[0] === tab)[2];
  const total = Object.values(data.counts).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-5xl">
      <h2 className="mb-1 text-xl font-bold text-navy">Approvals</h2>
      <p className="mb-4 text-sm text-slate-500">
        {total === 0 ? "Nothing waiting — you're all caught up."
                     : `${total} account${total === 1 ? "" : "s"} waiting for review.`}
      </p>

      <div className="mb-5 flex gap-1.5 rounded-xl bg-slate-100 p-1.5">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${
              tab === k ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
            {label}
            {data.counts[k] > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">
                {data.counts[k]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800">{r.name}</h3>
                <p className="text-sm text-slate-500">{r.email}{r.phone ? ` · ${r.phone}` : ""}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {[r.city, r.location, r.website].filter(Boolean).join(" · ")}
                  {r.gst_no && ` · GST ${r.gst_no}`}
                  {r.pan_no && ` · PAN ${r.pan_no}`}
                </p>
                {(r.courses?.length > 0 || r.skills?.length > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(r.courses || r.skills || []).slice(0, 8).map((c) => (
                      <span key={c} className="badge bg-slate-100 text-slate-600">{c}</span>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-slate-400">
                  Registered {new Date(r.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <button className="btn-green btn-sm" onClick={() => decide(kind, r.id, "approved")}>
                  <IconCheck size={14} /> Approve
                </button>
                <button className="btn-outline btn-sm !text-red-600 hover:!border-red-300 hover:!bg-red-50"
                        onClick={() => decide(kind, r.id, "rejected")}>
                  <IconBlock size={14} /> Reject
                </button>
              </div>
            </div>
            <input className="input mt-3 !py-2 !text-xs" placeholder="Reason (shown to them if rejected)"
                   value={reason[`${kind}${r.id}`] || ""}
                   onChange={(e) => setReason({ ...reason, [`${kind}${r.id}`]: e.target.value })} />
          </div>
        ))}
        {rows.length === 0 && (
          <div className="card text-center text-slate-400">No pending {tab}.</div>
        )}
      </div>
    </div>
  );
}

/* ================= Manager users (3a) + reset password (3e) ================= */
export function Managers() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ role: "manager" });
  const [result, setResult] = useState(null);
  const [resetEmail, setResetEmail] = useState("");
  const [resetOut, setResetOut] = useState(null);

  const load = () => api.get("/api/admin/managers").then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async () => {
    try {
      const r = await api.post("/api/admin/managers", form);
      setResult(r); toast(r.status); setForm({ role: "manager" }); load();
    } catch (err) { toast(err.message, "error"); }
  };
  const toggle = async (u) => {
    try {
      const r = await api.put(`/api/admin/managers/${u.id}/status`, { is_active: !u.is_active });
      toast(r.message); load();
    } catch (err) { toast(err.message, "error"); }
  };
  const doReset = async () => {
    try {
      const r = await api.post("/api/admin/users/reset-password", { email: resetEmail });
      setResetOut(r); toast(r.status);
    } catch (err) { toast(err.message, "error"); }
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h2 className="text-xl font-bold text-navy">Manager users</h2>
        <p className="text-sm text-slate-500">Staff accounts that help you run the platform.</p>
      </div>

      <div className="card grid gap-4 sm:grid-cols-2">
        <div><label className="label">Name</label>
          <input className="input" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label className="label">Email (becomes User ID)</label>
          <input className="input" type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex items-end"><button className="btn w-full" onClick={add}>Add user</button></div>
      </div>

      {result && (
        <div className="card text-sm">
          <p className="font-semibold text-brandgreen-600">{result.status}</p>
          <p className="mt-1">User ID: <b>{result.user_id}</b></p>
          <p>Temporary password: <b>{result.password}</b> (also emailed)</p>
        </div>
      )}

      <div className="card overflow-hidden !p-0">
        <table className="table">
          <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="font-medium text-slate-800">{u.email}</td>
                <td className="capitalize">{u.role}</td>
                <td>
                  <span className={`badge ${u.is_active ? "bg-brandgreen-50 text-brandgreen-600" : "bg-slate-100 text-slate-500"}`}>
                    {u.is_active ? "active" : "disabled"}
                  </span>
                </td>
                <td className="text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="text-right">
                  <button className="btn-outline btn-sm" onClick={() => toggle(u)}>
                    {u.is_active ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 className="font-semibold text-slate-700">Reset a user's password</h3>
        <p className="mt-0.5 text-xs text-slate-400">Works for any account. The new password is emailed to them.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className="input max-w-sm" placeholder="user@example.com" value={resetEmail}
                 onChange={(e) => setResetEmail(e.target.value)} />
          <button className="btn" onClick={doReset}><IconSearch size={15} /> Reset password</button>
        </div>
        {resetOut && (
          <p className="mt-3 text-sm">
            New password for <b>{resetOut.user_id}</b>: <b className="text-navy">{resetOut.password}</b>
          </p>
        )}
      </div>
    </div>
  );
}

/* ================= Subscriptions (3f, 3g) ================= */
export function Subscriptions() {
  const toast = useToast();
  const dialog = useDialog();
  const [plans, setPlans] = useState([]);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ plan: "growth" });
  const [filter, setFilter] = useState("all");

  const load = () => api.get("/api/admin/subscriptions").then(setRows).catch(() => {});
  useEffect(() => {
    api.get("/api/admin/plans").then((d) => setPlans(d.plans)).catch(() => {});
    load();
  }, []);

  const submit = async () => {
    if (!form.email?.trim()) return toast("Enter the user's email.", "error");
    try {
      const r = await api.post("/api/admin/subscriptions", form);
      const plan = plans.find((p) => p.key === form.plan);
      dialog({
        tone: "success",
        title: r.message.includes("renewed") ? "Subscription renewed" : "Subscription activated",
        message: r.message,
        details: [["Account", form.email], ["Plan", plan?.name || form.plan],
                  ["Amount", plan ? (plan.price === 0 ? "Free" : `$${plan.price}`) : "—"]],
        confirmLabel: "Done",
      });
      load();
    } catch (err) { toast(err.message, "error"); }
  };
  const cancel = async (id) => {
    try { const r = await api.put(`/api/admin/subscriptions/${id}/cancel`); toast(r.message); load(); }
    catch (err) { toast(err.message, "error"); }
  };

  const active = rows.filter((r) => r.status === "active");
  const revenue = active.reduce((a, r) => a + (r.amount || 0), 0);
  const expiringSoon = active.filter((r) => (r.days_left ?? 999) <= 7).length;
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-navy">Subscriptions</h2>
        <p className="text-sm text-slate-500">Activate a plan for an account, or renew an existing one.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Total revenue" value={`$${revenue.toLocaleString()}`} tone="green" />
        <Kpi label="Active plans" value={active.length} />
        <Kpi label="Expiring in 7 days" value={expiringSoon} tone={expiringSoon ? "amber" : "navy"} />
        <Kpi label="All subscriptions" value={rows.length} />
      </div>

      {/* plan cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {plans.map((p) => {
          const selected = form.plan === p.key;
          const popular = p.key === "growth";
          return (
            <button key={p.key} onClick={() => setForm({ ...form, plan: p.key })}
              className={`relative overflow-hidden rounded-2xl border-2 p-5 text-left transition-all duration-200
                          hover:-translate-y-1 hover:shadow-cardhover ${
                selected ? "border-navy bg-navy-50/50 shadow-cardhover" : "border-slate-200 bg-white"}`}>
              {popular && (
                <span className="absolute right-0 top-0 rounded-bl-lg bg-brandgreen px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  Popular
                </span>
              )}
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{p.name}</p>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold text-navy">
                  {p.price === 0 ? "Free" : `$${p.price}`}
                </span>
                {p.price > 0 && <span className="text-xs text-slate-400">/ {p.days}d</span>}
              </div>
              <p className="mt-1 text-[12px] text-slate-500">{p.tagline}</p>
              <ul className="mt-3 space-y-1.5">
                {(p.features || []).map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-[12px] text-slate-600">
                    <IconCheck size={12} className="mt-0.5 shrink-0 text-brandgreen" />{f}
                  </li>
                ))}
              </ul>
              {selected && (
                <p className="mt-3 rounded-lg bg-navy px-2 py-1 text-center text-[11px] font-bold text-white">
                  Selected
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* assign */}
      <div className="card">
        <h3 className="mb-3 font-bold text-slate-800">Assign a plan</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="label">User email</label>
            <input className="input" placeholder="hr@company.com" value={form.email || ""}
                   onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Plan</label>
            <select className="input" value={form.plan}
                    onChange={(e) => setForm({ ...form, plan: e.target.value })}>
              {plans.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name} — {p.price === 0 ? "Free" : `$${p.price}`}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={!!form.auto_renew}
                   onChange={(e) => setForm({ ...form, auto_renew: e.target.checked })} />
            Auto-renew when it expires
          </label>
          <button className="btn !px-6" onClick={submit}>Subscribe / Renew</button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Renewing an active plan extends it from its current end date, so no paid days are lost.
        </p>
      </div>

      {/* table */}
      <div className="card overflow-hidden !p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h3 className="font-bold text-slate-800">All subscriptions</h3>
          <div className="flex gap-1.5 rounded-lg bg-slate-100 p-1">
            {["all", "active", "expired", "cancelled"].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-all ${
                  filter === f ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <table className="table">
          <thead>
            <tr><th>Account</th><th>Plan</th><th className="text-right">Amount</th><th>Status</th>
              <th>Expires</th><th className="text-right">Days left</th><th></th></tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="font-medium text-slate-800">{r.email}</span>
                  <span className="block text-xs capitalize text-slate-400">{r.role}</span>
                </td>
                <td className="capitalize font-medium text-navy">{r.plan}</td>
                <td className="text-right font-semibold text-slate-700">
                  {r.amount ? `$${r.amount.toLocaleString()}` : "Free"}
                </td>
                <td>
                  <span className={`badge ${r.status === "active" ? "bg-brandgreen-50 text-brandgreen-600"
                    : r.status === "expired" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                    {r.status}
                  </span>
                </td>
                <td className="text-xs">{r.expires_at ? new Date(r.expires_at).toLocaleDateString() : "—"}</td>
                <td className="text-right">
                  {r.days_left == null ? "—" : (
                    <span className={`font-bold ${r.days_left <= 7 ? "text-amber-600" : "text-slate-600"}`}>
                      {r.days_left}
                    </span>
                  )}
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <button className="btn-outline btn-sm"
                            onClick={() => setForm({ email: r.email, plan: r.plan })}>Renew</button>
                    {r.status === "active" && (
                      <button className="btn-outline btn-sm !text-red-600 hover:!bg-red-50"
                              onClick={() => cancel(r.id)}>Cancel</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-slate-400">No {filter === "all" ? "" : filter} subscriptions.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }) {
  const tones = { green: "text-brandgreen-600", amber: "text-amber-600", navy: "text-navy" };
  return (
    <div className="card-hover text-center">
      <div className={`text-2xl font-extrabold ${tones[tone] || "text-navy"}`}>{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}
