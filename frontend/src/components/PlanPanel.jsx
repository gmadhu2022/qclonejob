import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useToast } from "./ui";
import { useConfirm, useDialog } from "./Dialog";
import { IconCheck, IconLock, IconSparkle } from "./icons";

/* =====================================================================
   Plan, quota and (mocked) checkout.

   The quota numbers shown here are a display hint only — the same limits are
   enforced on the write endpoints, so nothing here can be bypassed by editing
   the page.

   PAYMENT IS MOCKED. The Razorpay screen below is a visual stand-in: the
   fields are inert, no card data is collected, nothing is sent anywhere and no
   Razorpay SDK is loaded. See the note in the checkout panel and the comment
   on POST /api/enterprise/plan/upgrade for what a real integration replaces.
   ===================================================================== */

/* =====================================================================
   PlanGate — shown once, on a recruiter's first visit.

   Mounted at the portal shell so it appears whatever page they land on. It
   only fires when the account is on the free Standard plan AND has posted
   nothing yet, which is the closest reliable signal for "just registered"
   without adding a first_login column: an established free-tier user with
   jobs already up is not shown a welcome dialog.

   Dismissal is remembered per session so navigating between tabs doesn't
   re-open it.
   ===================================================================== */
let planGateShown = false;

export function PlanGate() {
  const dialog = useDialog();
  const navigate = useNavigate();

  useEffect(() => {
    if (planGateShown) return;
    api.get("/api/enterprise/plan").then((d) => {
      if (planGateShown) return;
      const brandNew = d.plan === "standard" && d.jobs.used === 0 && d.ads.used === 0;
      if (!brandNew) return;
      planGateShown = true;
      dialog({
        tone: "info",
        title: "Welcome — you're on the Standard plan",
        message: "Standard is free and includes 5 job posts, 1 advertisement with 5-minute "
               + "validity, and 25 resume views.\n\n"
               + "You can start posting straight away, or pick a larger plan now.",
        confirmLabel: "See plans",
        secondary: { label: "Start with Standard" },
        onConfirm: () => navigate("/enterprise/billing"),
      });
    }).catch(() => {});
    // eslint-disable-next-line
  }, []);

  return null;
}

/* Quota banner for the top of any page that creates something. Renders
   nothing while there is still room, so it can be dropped in without
   cluttering the common case. */
export function QuotaNotice({ kind = "jobs" }) {
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  useEffect(() => { api.get("/api/enterprise/plan").then(setD).catch(() => {}); }, []);
  if (!d) return null;
  const q = d[kind];
  if (!q || !q.limit) return null;                 // 0 == unlimited
  const left = q.remaining;
  if (left > 1) return null;                       // plenty left: stay quiet

  const out = left <= 0;
  const noun = kind === "ads" ? "advertisement" : "job post";
  return (
    <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3
      ${out ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
      <span className={`text-sm font-semibold ${out ? "text-red-700" : "text-amber-800"}`}>
        {out
          ? `You've used all ${q.limit} ${noun}${q.limit === 1 ? "" : "s"} on ${d.plan_name}.`
          : `Only 1 ${noun} left on ${d.plan_name}.`}
      </span>
      <div className="flex-1" />
      <button className="btn btn-sm" onClick={() => navigate("/enterprise/billing")}>
        Upgrade plan
      </button>
    </div>
  );
}

export default function PlanPanel() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [checkout, setCheckout] = useState(null);   // plan being "paid" for

  const load = () => api.get("/api/enterprise/plan").then(setData).catch(() => {});
  useEffect(() => { load(); }, []);

  if (!data) return <p className="text-slate-400">Loading…</p>;

  if (checkout) {
    return (
      <MockRazorpay
        plan={checkout}
        onBack={() => setCheckout(null)}
        onPaid={async () => {
          try {
            const r = await api.post("/api/enterprise/plan/upgrade", { plan: checkout.key });
            setCheckout(null);
            await load();
            confirm("Plan upgraded successfully", {
              message: `${r.message}\n\nReference: ${r.reference}`,
              note: "This was a mock payment — no money was charged.",
              noteTone: "warn",
            });
          } catch (err) { toast(err.message, "error"); }
        }}
      />
    );
  }

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h2 className="text-xl font-bold text-navy">Your plan</h2>
        <p className="text-sm text-slate-500">
          You're on <b className="text-navy">{data.plan_name}</b>
          {data.expires_at && ` · renews ${new Date(data.expires_at).toLocaleDateString()}`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <QuotaBar label="Job posts" used={data.jobs.used} limit={data.jobs.limit} />
        <QuotaBar label="Advertisements" used={data.ads.used} limit={data.ads.limit} />
      </div>

      <p className="text-xs text-slate-400">
        Ads on this plan stay live for{" "}
        <b className="text-slate-600">{formatMinutes(data.ad_validity_minutes)}</b> after posting.
      </p>

      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Upgrade your plan
        </h3>
        <div className="grid gap-4 lg:grid-cols-4 sm:grid-cols-2">
          {data.plans.map((p) => {
            const current = p.key === data.plan;
            return (
              <div key={p.key}
                   className={`flex flex-col rounded-xl border p-5 transition-all
                     ${current ? "border-navy bg-navy-50/50 shadow-sm"
                               : "border-slate-200 bg-white hover:-translate-y-1 hover:shadow-cardhover"}`}>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-800">{p.name}</h4>
                  {current && <span className="badge bg-navy text-white">Current</span>}
                </div>
                <p className="text-xs text-slate-400">{p.tagline}</p>
                <p className="mt-3 text-2xl font-extrabold text-navy">
                  {p.price === 0 ? "Free" : `₹${p.price.toLocaleString("en-IN")}`}
                  {p.price > 0 && <span className="text-xs font-medium text-slate-400"> / {p.days}d</span>}
                </p>
                <ul className="mt-3 flex-1 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[12.5px] text-slate-600">
                      <IconCheck size={13} className="mt-0.5 shrink-0 text-brandgreen-600" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={`mt-4 w-full ${current ? "btn-outline" : "btn"} btn-sm !py-2.5`}
                  disabled={current || p.price === 0}
                  onClick={() => setCheckout(p)}>
                  {current ? "Your plan" : p.price === 0 ? "Free plan" : "Upgrade"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatMinutes(m) {
  if (!m) return "—";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  if (m < 60 * 24) return `${Math.round(m / 60)} hour(s)`;
  return `${Math.round(m / (60 * 24))} day(s)`;
}

export function QuotaBar({ label, used, limit }) {
  const unlimited = !limit;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const full = !unlimited && used >= limit;
  return (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${full ? "text-red-500" : "text-navy"}`}>
          {used} / {unlimited ? "∞" : limit}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full transition-all duration-500
            ${full ? "bg-red-400" : pct > 75 ? "bg-amber-400" : "bg-brandgreen"}`}
             style={{ width: unlimited ? "100%" : `${Math.max(3, pct)}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-slate-400">
        {unlimited ? "Unlimited on this plan."
          : full ? "Limit reached — upgrade to add more."
          : `${limit - used} remaining.`}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Mocked Razorpay checkout.

   Deliberately non-functional: every input is disabled and the method tabs
   don't switch anything, because a checkout that LOOKS live but silently
   discards card details is worse than one that plainly says it's a demo.
   Back navigation is explicit at the top and bottom, and the browser Back
   button also works since this is state, not a route.
   --------------------------------------------------------------------- */
function MockRazorpay({ plan, onBack, onPaid }) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto max-w-lg">
      <button onClick={onBack} className="btn-outline btn-sm mb-4">← Back to plans</button>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-cardhover">
        <div className="flex items-center justify-between bg-[#072654] px-5 py-4 text-white">
          <div>
            <div className="text-lg font-extrabold tracking-tight">Razorpay</div>
            <div className="text-[11px] text-white/60">QCloneJob · Secure checkout</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-white/60">Amount</div>
            <div className="text-xl font-extrabold">₹{plan.price.toLocaleString("en-IN")}</div>
          </div>
        </div>

        <div className="border-b border-amber-200 bg-amber-50 px-5 py-2.5">
          <p className="text-[12px] font-semibold text-amber-800">
            Demo checkout — no payment is taken
          </p>
          <p className="text-[11px] text-amber-700">
            The fields below are inactive and nothing is collected or sent.
          </p>
        </div>

        <div className="p-5">
          <p className="text-sm font-semibold text-slate-700">{plan.name} plan</p>
          <p className="text-xs text-slate-400">{plan.days} days · {plan.tagline}</p>

          <div className="mt-4 flex gap-1.5 rounded-lg bg-slate-100 p-1">
            {["Card", "UPI", "Net Banking", "Wallet"].map((m, i) => (
              <button key={m} type="button" disabled
                      className={`flex-1 rounded-md px-2 py-1.5 text-[11.5px] font-semibold
                        ${i === 0 ? "bg-white text-navy shadow-sm" : "text-slate-400"}`}>
                {m}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3 opacity-60">
            <div>
              <label className="label">Card number</label>
              <input className="input" disabled placeholder="4111 1111 1111 1111" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Expiry</label>
                <input className="input" disabled placeholder="MM / YY" />
              </div>
              <div>
                <label className="label">CVV</label>
                <input className="input" disabled placeholder="•••" />
              </div>
            </div>
            <div>
              <label className="label">Name on card</label>
              <input className="input" disabled placeholder="As printed on the card" />
            </div>
          </div>

          <button className="btn mt-5 w-full !py-3" disabled={busy}
                  onClick={async () => { setBusy(true); await onPaid(); setBusy(false); }}>
            {busy ? "Activating…" : <><IconSparkle size={15} /> Simulate successful payment</>}
          </button>

          <button onClick={onBack} disabled={busy}
                  className="mt-2 w-full rounded-lg py-2 text-sm font-semibold text-slate-400 hover:text-navy">
            Cancel and go back
          </button>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <IconLock size={11} /> Real payments would be verified by a signed webhook,
            never by the browser.
          </p>
        </div>
      </div>
    </div>
  );
}
