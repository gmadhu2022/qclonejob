import { useEffect, useState, useCallback } from "react";
import { api } from "../../lib/api";
import { useToast } from "../../components/ui";
import { useDialog, useConfirm } from "../../components/Dialog";
import { IconCheck, IconBlock, IconSearch } from "../../components/icons";

/* ================= Registrations — one tab for everything ================= */
export function Registrations() {
  const toast = useToast();
  const dialog = useDialog();
  const [data, setData] = useState(null);
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [reason, setReason] = useState({});

  const load = useCallback(() => {
    const p = new URLSearchParams({ kind, status });
    if (q) p.set("q", q);
    api.get(`/api/admin/registrations?${p}`).then(setData).catch(() => {});
  }, [kind, status, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);      // debounce search-as-you-type
    return () => clearTimeout(t);
  }, [load, q]);
  useEffect(() => { const i = setInterval(load, 20000); return () => clearInterval(i); }, [load]);

  const decide = async (row, decision) => {
    try {
      const r = await api.post(`/api/admin/approvals/${row.kind}/${row.id}`,
        { decision, reason: reason[`${row.kind}${row.id}`] || "" });
      dialog({ tone: decision === "approved" ? "success" : "info",
               title: decision === "approved" ? "Account approved" : "Registration rejected",
               message: r.message,
               note: decision === "approved"
                 ? "They can log in now and have been emailed."
                 : "They've been emailed with the reason you gave.",
               confirmLabel: "Done" });
      load();
    } catch (err) { toast(err.message, "error"); }
  };

  const KINDS = [["all", "All types"], ["institute", "Institutes"],
                 ["enterprise", "Employers"], ["jobseeker", "Job seekers"]];
  const STATUSES = [["pending", "Pending"], ["approved", "Approved"],
                    ["rejected", "Rejected"], ["all", "All"]];
  const KIND_STYLE = { institute: "bg-navy-50 text-navy",
                       enterprise: "bg-blue-50 text-blue-700",
                       jobseeker: "bg-brandgreen-50 text-brandgreen-600" };

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h2 className="text-xl font-bold text-navy">Registrations</h2>
        <p className="text-sm text-slate-500">
          Institutes, employers and job seekers — pending, approved and rejected, all in one place.
        </p>
      </div>

      {/* status tabs with live counts */}
      <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1.5">
        {STATUSES.map(([k, label]) => (
          <button key={k} onClick={() => setStatus(k)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-all ${
              status === k ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
            {label}
            {data && k === status && (
              <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500">
                {data.counts.all}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5 rounded-lg bg-slate-100 p-1">
          {KINDS.map(([k, label]) => (
            <button key={k} onClick={() => setKind(k)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                kind === k ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative min-w-[240px] flex-1">
          <input className="input !py-2 !pl-8 !text-[13px]"
                 placeholder="Search name, email, city, course or skill…"
                 value={q} onChange={(e) => setQ(e.target.value)} />
          <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {!data ? <p className="text-slate-400">Loading…</p> : (
        <div className="space-y-3">
          {data.items.map((r) => (
            <div key={`${r.kind}${r.id}`}
                 className="group rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200
                            hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-cardhover">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${KIND_STYLE[r.kind]}`}>
                    {(r.name || "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-800">{r.name}</h3>
                      <span className={`badge ${KIND_STYLE[r.kind]}`}>{r.kind}</span>
                      <span className={`badge ${
                        r.status === "approved" ? "bg-brandgreen-50 text-brandgreen-600"
                        : r.status === "pending" ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"}`}>{r.status}</span>
                      {r.source === "self" && <span className="badge bg-slate-100 text-slate-500">self-registered</span>}
                    </div>
                    <p className="text-[13px] text-slate-500">
                      {[r.email, r.phone, r.city].filter(Boolean).join(" · ")}
                    </p>
                    {r.extra && <p className="mt-0.5 truncate text-[12px] text-slate-400">{r.extra}</p>}
                    <p className="mt-1 text-[11px] text-slate-400">
                      Registered {new Date(r.created_at).toLocaleString()}
                      {r.approved_at && ` · decided ${new Date(r.approved_at).toLocaleDateString()}`}
                    </p>
                    {r.reason && <p className="mt-1 text-[12px] text-red-500">Reason: {r.reason}</p>}
                  </div>
                </div>

                {r.status === "pending" ? (
                  <div className="flex shrink-0 flex-col gap-2">
                    <button className="btn-green btn-sm" onClick={() => decide(r, "approved")}>
                      <IconCheck size={14} /> Approve
                    </button>
                    <button className="btn-outline btn-sm !text-red-600 hover:!border-red-300 hover:!bg-red-50"
                            onClick={() => decide(r, "rejected")}>
                      <IconBlock size={14} /> Reject
                    </button>
                  </div>
                ) : (
                  <span className={`shrink-0 text-[11px] font-semibold ${r.active ? "text-brandgreen-600" : "text-slate-400"}`}>
                    {r.active ? "Can log in" : "Login disabled"}
                  </span>
                )}
              </div>

              {r.status === "pending" && (
                <input className="input mt-3 !py-2 !text-xs" placeholder="Reason (emailed to them if rejected)"
                       value={reason[`${r.kind}${r.id}`] || ""}
                       onChange={(e) => setReason({ ...reason, [`${r.kind}${r.id}`]: e.target.value })} />
              )}
            </div>
          ))}
          {data.items.length === 0 && (
            <div className="card text-center text-slate-400">
              {q ? "Nothing matches your search." : `No ${status === "all" ? "" : status} registrations.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= Manager users (3a) + reset password (3e) ================= */
/* =====================================================================
   Manager users — staff accounts.

   Rebuilt: the old screen was three stacked cards (add form, raw credential
   dump, table, reset box) with no counts, no search, and no way to tell an
   admin from a manager at a glance.
   ===================================================================== */
export function Managers() {
  const toast = useToast();
  const confirm = useConfirm();
  const dialog = useDialog();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ role: "manager" });
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [resetEmail, setResetEmail] = useState("");

  const load = () => api.get("/api/admin/managers").then(setRows).catch(() => {});
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name?.trim()) return toast("Enter the person's name.", "error");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email || "")) {
      return toast("Enter a valid email address.", "error");
    }
    setBusy(true);
    try {
      const r = await api.post("/api/admin/managers", form);
      setForm({ role: "manager" });
      setAdding(false);
      load();
      /* Credentials go in a dialog rather than being left on the page. The old
         version printed the temporary password into a card that stayed visible
         until navigation — on a shared admin screen that is a password sitting
         in the open. */
      showCredentials(dialog, r);
    } catch (err) { toast(err.message, "error"); }
    finally { setBusy(false); }
  };

  const toggle = (u) => dialog({
    tone: u.is_active ? "info" : "success",
    title: u.is_active ? "Disable this account?" : "Enable this account?",
    message: u.is_active
      ? `${u.email} will be signed out and unable to log in until you re-enable them.`
      : `${u.email} will be able to sign in again.`,
    confirmLabel: u.is_active ? "Disable" : "Enable",
    secondary: { label: "Cancel" },
    onConfirm: async () => {
      try {
        await api.put(`/api/admin/managers/${u.id}/status`, { is_active: !u.is_active });
        confirm(u.is_active ? "Account disabled successfully" : "Account enabled successfully",
                { message: u.email });
        load();
      } catch (err) { toast(err.message, "error"); }
    },
  });

  const doReset = () => {
    if (!resetEmail.trim()) return toast("Enter the account's email address.", "error");
    dialog({
      tone: "info",
      title: "Reset this password?",
      message: `A new temporary password will be generated for ${resetEmail} and emailed to them. `
             + "Their current password stops working immediately.",
      confirmLabel: "Reset password",
      secondary: { label: "Cancel" },
      onConfirm: async () => {
        try {
          const r = await api.post("/api/admin/users/reset-password", { email: resetEmail });
          setResetEmail("");
          showCredentials(dialog, r, "Password reset successfully");
        } catch (err) { toast(err.message, "error"); }
      },
    });
  };

  const counts = {
    all: rows.length,
    admin: rows.filter((u) => u.role === "admin").length,
    manager: rows.filter((u) => u.role === "manager").length,
    disabled: rows.filter((u) => !u.is_active).length,
  };
  const term = q.trim().toLowerCase();
  const shown = rows.filter((u) => {
    if (filter === "admin" || filter === "manager") { if (u.role !== filter) return false; }
    else if (filter === "disabled" && u.is_active) return false;
    return !term || u.email.toLowerCase().includes(term);
  });

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-navy">Manager users</h2>
          <p className="text-sm text-slate-500">Staff accounts that help you run the platform.</p>
        </div>
        <button className="btn" onClick={() => setAdding((a) => !a)}>
          {adding ? "Close" : "+ Add team member"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["all", "Total staff", counts.all], ["admin", "Admins", counts.admin],
          ["manager", "Managers", counts.manager], ["disabled", "Disabled", counts.disabled]].map(
          ([key, label, value]) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`rounded-xl border p-4 text-left transition-all
                ${filter === key ? "border-navy bg-navy-50 shadow-sm"
                                 : "border-slate-200 bg-white hover:border-navy-200"}`}>
              <div className={`text-2xl font-extrabold ${key === "disabled" && value
                ? "text-amber-600" : "text-navy"}`}>{value}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
            </button>
          ))}
      </div>

      {adding && (
        <div className="card">
          <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            New team member
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Name <span className="text-red-400">*</span></label>
              <input className="input" placeholder="e.g. Priya Sharma" value={form.name || ""}
                     onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email (becomes User ID) <span className="text-red-400">*</span></label>
              <input className="input" type="email" placeholder="e.g. priya@qclonejob.com"
                     value={form.email || ""}
                     onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Role <span className="text-red-400">*</span></label>
              <select className="input" value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="manager">Manager — day-to-day moderation</option>
                <option value="admin">Admin — full platform access</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <p className="text-xs text-slate-400">
              A temporary password is generated and emailed. They'll be asked to change it on first sign-in.
            </p>
            <div className="flex-1" />
            <button className="btn-outline btn-sm" onClick={() => setAdding(false)} disabled={busy}>Cancel</button>
            <button className="btn !px-6" onClick={add} disabled={busy}>
              {busy ? "Adding…" : "Add user"}
            </button>
          </div>
        </div>
      )}

      <div className="card !p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
          <input className="input max-w-xs !py-2" placeholder="Search by email…"
                 value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="text-xs text-slate-400">
            {shown.length} of {rows.length} shown
          </span>
          {(filter !== "all" || term) && (
            <button onClick={() => { setFilter("all"); setQ(""); }}
                    className="text-xs font-semibold text-slate-400 hover:text-navy">Clear</button>
          )}
        </div>
        <table className="table">
          <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Created</th><th className="text-right">Action</th></tr></thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.id} className={u.is_active ? "" : "bg-slate-50/60"}>
                <td>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold
                      ${u.role === "admin" ? "bg-navy text-white" : "bg-navy-50 text-navy"}`}>
                      {(u.email || "?")[0].toUpperCase()}
                    </span>
                    <span className={`font-medium ${u.is_active ? "text-slate-800" : "text-slate-400"}`}>
                      {u.email}
                    </span>
                  </div>
                </td>
                <td>
                  <span className={`badge ${u.role === "admin"
                    ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"}`}>
                    {u.role}
                  </span>
                </td>
                <td>
                  <span className={`badge ${u.is_active
                    ? "bg-brandgreen-50 text-brandgreen-600" : "bg-amber-100 text-amber-700"}`}>
                    {u.is_active ? "active" : "disabled"}
                  </span>
                </td>
                <td className="whitespace-nowrap text-xs text-slate-400">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="text-right">
                  <button className="btn-outline btn-sm" onClick={() => toggle(u)}>
                    {u.is_active ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-slate-400">
                {rows.length === 0 ? "No staff accounts yet." : "No staff match this filter."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 className="font-semibold text-slate-700">Reset a user's password</h3>
        <p className="mt-0.5 text-xs text-slate-400">
          Works for any account on the platform, not just staff. Asks for confirmation first,
          because the old password stops working immediately.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className="input max-w-sm" placeholder="e.g. user@example.com" value={resetEmail}
                 onChange={(e) => setResetEmail(e.target.value)} />
          <button className="btn" onClick={doReset}><IconSearch size={15} /> Reset password</button>
        </div>
      </div>
    </div>
  );
}

/** Show generated credentials in a dialog instead of leaving them on screen. */
function showCredentials(dialog, r, title = "Team member added successfully") {
  dialog({
    tone: "success",
    title,
    message: `User ID: ${r.user_id}\nTemporary password: ${r.password}`,
    confirmLabel: "Done",
    note: "Copy this now — it is also emailed, but it won't be shown here again.",
    noteTone: "warn",
  });
}

/* ================= Subscriptions (3f, 3g) ================= */
export function Subscriptions() {
  const toast = useToast();
  const confirm = useConfirm();
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
    try {
      const r = await api.put(`/api/admin/subscriptions/${id}/cancel`);
      confirm("Subscription cancelled successfully", { message: r.message });
      load();
    }
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
