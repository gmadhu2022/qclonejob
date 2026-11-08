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

  const current = data.plans.find((p) => p.key === data.plan) || {};
  const popularKey = (data.plans.find((p) => /popular/i.test(p.tagline || "")) || {}).key || "growth";
  const curIdx = data.plans.findIndex((p) => p.key === data.plan);

  return (
    <div className="max-w-6xl space-y-8">
      {/* ---- header ---- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-[24px] font-bold leading-tight text-slate-900">Plans &amp; billing</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">Track what you've used and pick the plan that fits your hiring.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-50 px-3 py-1 text-[12px] font-semibold text-navy ring-1 ring-inset ring-navy-100">
          <span className="h-1.5 w-1.5 rounded-full bg-brandgreen" /> Current plan: {data.plan_name}
        </span>
      </div>

      {/* ---- current plan summary + usage ---- */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="border-b border-slate-100 p-6 lg:border-b-0 lg:border-r">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Your plan</p>
            <p className="mt-2 font-heading text-[26px] font-bold leading-none text-slate-900">{data.plan_name}</p>
            <p className="mt-2 text-[13px] text-slate-500">
              {current.price ? `₹${current.price.toLocaleString("en-IN")} for ${current.days} days` : "Free forever"}
            </p>
            <div className="mt-4 space-y-1.5 text-[12.5px] text-slate-600">
              <p className="flex items-center gap-2"><IconCalendarDot />
                {data.expires_at ? <>Renews on <b className="text-slate-800">{new Date(data.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</b></> : "No renewal needed"}
              </p>
              <p className="flex items-center gap-2"><IconCalendarDot />
                Ads stay live for <b className="text-slate-800">{formatMinutes(data.ad_validity_minutes)}</b>
              </p>
            </div>
            {curIdx < data.plans.length - 1 && (
              <a href="#plans" className="btn btn-sm mt-5 !rounded-full !px-5">
                <IconSparkle size={14} /> Upgrade plan
              </a>
            )}
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-2">
            <QuotaBar label="Job posts" used={data.jobs.used} limit={data.jobs.limit} />
            <QuotaBar label="Advertisements" used={data.ads.used} limit={data.ads.limit} />
          </div>
        </div>
      </div>

      {/* ---- plans ---- */}
      <div id="plans" className="scroll-mt-6">
        <div className="mb-5 text-center">
          <h3 className="font-heading text-[20px] font-bold text-slate-900">Choose the right plan for your hiring</h3>
          <p className="mt-1 text-[13px] text-slate-500">Upgrade any time — your new limits apply as soon as the upgrade completes.</p>
        </div>

        <div className="grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {data.plans.map((p, i) => {
            const isCurrent = p.key === data.plan;
            const popular = p.key === popularKey;
            const lower = i < curIdx;
            const perDay = p.price && p.days ? Math.round(p.price / p.days) : 0;
            return (
              <div key={p.key}
                   className={`relative flex flex-col rounded-2xl bg-white p-6 transition-all duration-300
                     ${popular ? "border-2 border-navy shadow-[0_20px_45px_-20px_rgba(79,70,229,.55)] xl:-translate-y-2"
                       : isCurrent ? "border-2 border-slate-300"
                       : "border border-slate-200 hover:-translate-y-1 hover:border-navy-200 hover:shadow-cardhover"}`}>
                {popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-navy px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white shadow-md">
                    ★ Most popular
                  </span>
                )}
                {isCurrent && !popular && (
                  <span className="absolute -top-3 left-6 rounded-full bg-slate-800 px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider text-white">
                    Current plan
                  </span>
                )}

                <h4 className="font-heading text-[17px] font-bold text-slate-900">{p.name}</h4>
                <p className="mt-0.5 min-h-[18px] text-[12.5px] text-slate-500">{p.tagline}</p>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="font-heading text-[34px] font-bold leading-none tracking-tight text-slate-900">
                    {p.price === 0 ? "Free" : `₹${p.price.toLocaleString("en-IN")}`}
                  </span>
                  {p.price > 0 && <span className="text-[13px] font-medium text-slate-400">/ {p.days} days</span>}
                </div>
                <p className="mt-1.5 h-4 text-[11.5px] font-medium text-brandgreen-600">
                  {perDay ? `≈ ₹${perDay} per day` : p.price === 0 ? "No card needed" : ""}
                </p>

                <button
                  className={`mt-5 w-full rounded-full py-2.5 text-[13.5px] font-semibold transition-all
                    ${isCurrent ? "cursor-default bg-slate-100 text-slate-500"
                      : lower || p.price === 0 ? "cursor-not-allowed border border-slate-200 text-slate-400"
                      : popular ? "bg-navy text-white shadow-md hover:bg-indigo-700"
                      : "border-[1.5px] border-navy text-navy hover:bg-navy hover:text-white"}`}
                  disabled={isCurrent || lower || p.price === 0}
                  onClick={() => setCheckout(p)}>
                  {isCurrent ? <span className="inline-flex items-center gap-1.5"><IconCheck size={14} /> Your current plan</span>
                    : lower || p.price === 0 ? "Included" : `Upgrade to ${p.name}`}
                </button>

                <div className="my-5 h-px bg-slate-100" />
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">What's included</p>
                <ul className="flex-1 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13px] text-slate-700">
                      <span className={`mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full
                                        ${popular ? "bg-navy text-white" : "bg-brandgreen-50 text-brandgreen-600"}`}>
                        <IconCheck size={11} strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

function IconCalendarDot() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-navy">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-slate-700">{label}</span>
        <span className="text-[12px] font-semibold text-slate-400">{unlimited ? "Unlimited" : `${pct}% used`}</span>
      </div>
      <p className={`mt-2 font-heading text-[26px] font-bold leading-none tabular-nums ${full ? "text-red-500" : "text-slate-900"}`}>
        {used}<span className="text-[15px] font-semibold text-slate-400"> / {unlimited ? "∞" : limit}</span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
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
   Test-mode checkout.

   A full payment flow — method choice, field validation, a simulated bank
   authentication step, success / failure — so the upgrade can be exercised
   end to end. NOTHING typed here leaves the browser: no field is sent to the
   server, stored or logged; only the plan key is posted once the simulated
   payment succeeds. It is styled as QCloneJob's own checkout and labelled
   TEST MODE throughout, so it can never be mistaken for a live payment page.

   Going live = replace this component with the payment provider's official
   checkout script and activate the plan from a signed webhook (see
   POST /api/enterprise/plan/upgrade).
   --------------------------------------------------------------------- */
const luhn = (num) => {
  const d = num.replace(/\D/g, "");
  if (d.length < 12) return false;
  let s = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = +d[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    s += n; alt = !alt;
  }
  return s % 10 === 0;
};
const cardBrand = (num) => {
  const d = num.replace(/\D/g, "");
  if (/^4/.test(d)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "MASTERCARD";
  if (/^(60|65|81|82|508)/.test(d)) return "RUPAY";
  if (/^3[47]/.test(d)) return "AMEX";
  return "";
};
const TEST_BANKS = ["Demo Bank", "Sandbox Bank", "Test Co-operative Bank", "Example Bank"];
const TEST_WALLETS = ["Demo Wallet", "Sandbox Pay", "Test Wallet"];
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export function MockRazorpay({ plan, onBack, onPaid }) {
  const [method, setMethod] = useState("card");
  const [step, setStep] = useState("pay");          // pay | processing | bank | upi-wait | success | failed
  const [card, setCard] = useState({ number: "", exp: "", cvv: "", name: "" });
  const [touched, setTouched] = useState({});
  const [vpa, setVpa] = useState("");
  const [bank, setBank] = useState("");
  const [wallet, setWallet] = useState("");
  const [otp, setOtp] = useState("");
  const [seconds, setSeconds] = useState(300);
  const [failReason, setFailReason] = useState("");
  const [ref, setRef] = useState("");
  const [activating, setActivating] = useState(false);

  // Clear every typed value when the checkout closes.
  useEffect(() => () => { setCard({ number: "", exp: "", cvv: "", name: "" }); setOtp(""); }, []);

  // UPI collect-request countdown.
  useEffect(() => {
    if (step !== "upi-wait") return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [step]);

  const errs = {
    number: !luhn(card.number) ? "Enter a valid card number" : "",
    exp: (() => {
      const m = card.exp.match(/^(\d{2})\s*\/\s*(\d{2})$/);
      if (!m) return "Use MM / YY";
      const mm = +m[1], yy = 2000 + +m[2];
      if (mm < 1 || mm > 12) return "Invalid month";
      const now = new Date();
      if (yy < now.getFullYear() || (yy === now.getFullYear() && mm < now.getMonth() + 1)) return "Card has expired";
      return "";
    })(),
    cvv: !/^\d{3,4}$/.test(card.cvv) ? "3 or 4 digits" : "",
    name: card.name.trim().length < 2 ? "Name as on card" : "",
  };
  const vpaErr = /^[\w.-]{2,}@[a-z]{2,}$/i.test(vpa.trim()) ? "" : "Enter a UPI ID like name@bank";
  const canPay = method === "card" ? !Object.values(errs).some(Boolean)
    : method === "upi" ? !vpaErr : method === "netbanking" ? !!bank : !!wallet;

  const fmtNum = (v) => v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
  const fmtExp = (v) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d; };

  const pay = () => {
    setTouched({ number: true, exp: true, cvv: true, name: true, vpa: true });
    if (!canPay) return;
    setStep("processing");
    setTimeout(() => {
      if (method === "upi") { setSeconds(300); setStep("upi-wait"); }
      else setStep("bank");
    }, 1400);
  };

  const succeed = async () => {
    setStep("processing");
    const r = `pay_TEST${Math.random().toString(36).slice(2, 12).toUpperCase()}`;
    setRef(r);
    setTimeout(() => setStep("success"), 1200);
  };
  const fail = (why) => { setFailReason(why); setStep("failed"); };

  const activate = async () => {
    setActivating(true);
    try { await onPaid(); } finally { setActivating(false); }
  };

  const methodLabel = method === "card" ? `${cardBrand(card.number) || "Card"} •••• ${card.number.replace(/\D/g, "").slice(-4)}`
    : method === "upi" ? vpa : method === "netbanking" ? bank : wallet;

  const field = (k, label, props) => (
    <div className={props.span ? "col-span-2" : ""}>
      <label className="mb-1 block text-[12px] font-semibold text-slate-600">{label}</label>
      <div className={`flex items-center rounded-xl border-[1.5px] bg-white px-3 transition-colors focus-within:border-navy focus-within:ring-4 focus-within:ring-navy/10
        ${touched[k] && errs[k] ? "border-red-400" : "border-slate-200"}`}>
        <input {...props.input} value={card[k]} autoComplete="off"
               onBlur={() => setTouched((t) => ({ ...t, [k]: true }))}
               onChange={(e) => setCard((c) => ({ ...c, [k]: props.fmt ? props.fmt(e.target.value) : e.target.value }))}
               className="min-w-0 flex-1 bg-transparent py-2.5 text-[14px] tracking-wide text-slate-800 outline-none placeholder:tracking-normal placeholder:text-slate-300" />
        {props.suffix}
      </div>
      {touched[k] && errs[k] && <p className="mt-1 text-[11px] font-medium text-red-500">{errs[k]}</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl">
      <button onClick={onBack} disabled={step === "processing"} className="btn-outline btn-sm mb-4 !rounded-full">← Back to plans</button>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_30px_70px_-35px_rgba(15,23,42,.45)]">
        {/* test-mode ribbon */}
        <div className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-amber-950">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-950" /> Test mode — no real money moves, nothing you type leaves this page
        </div>

        <div className="grid md:grid-cols-[300px_minmax(0,1fr)]">
          {/* ---------- order summary ---------- */}
          <aside className="relative overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-navy to-violet-600 p-6 text-white">
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white font-heading text-[15px] font-extrabold text-navy">QJ</span>
                <div>
                  <p className="font-heading text-[15px] font-bold leading-tight">QCloneJob</p>
                  <p className="text-[11px] text-white/60">Secure checkout</p>
                </div>
              </div>
              <div className="mt-8">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/50">Paying for</p>
                <p className="mt-1 font-heading text-[18px] font-bold">{plan.name} plan</p>
                <p className="text-[12.5px] text-white/70">{plan.days} days · {plan.tagline}</p>
              </div>
              <div className="mt-6 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
                <div className="flex justify-between text-[12.5px] text-white/70"><span>Plan price</span><span>{inr(plan.price)}</span></div>
                <div className="mt-3 flex items-end justify-between border-t border-white/15 pt-3">
                  <span className="text-[12.5px] font-semibold">Total payable</span>
                  <span className="font-heading text-[26px] font-bold leading-none">{inr(plan.price)}</span>
                </div>
              </div>
              <ul className="mt-6 space-y-2 text-[12px] text-white/75">
                {(plan.features || []).slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-2"><IconCheck size={13} className="mt-0.5 shrink-0 text-emerald-300" /> {f}</li>
                ))}
              </ul>
              <p className="mt-8 flex items-center gap-1.5 text-[11px] text-white/50"><IconLock size={11} /> Test environment · nothing is charged</p>
            </div>
          </aside>

          {/* ---------- payment panel ---------- */}
          <div className="min-h-[520px] p-6 sm:p-8">
            {step === "pay" && (
              <>
                <p className="font-heading text-[18px] font-bold text-slate-900">Choose a payment method</p>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[["card", "Card", "Visa · MC · RuPay"], ["upi", "UPI", "Any UPI app"],
                    ["netbanking", "Net banking", "All banks"], ["wallet", "Wallet", "Popular wallets"]].map(([k, l, s]) => (
                    <button key={k} type="button" onClick={() => setMethod(k)}
                            className={`rounded-2xl border-2 px-3 py-3 text-left transition-all focus:outline-none
                              ${method === k ? "border-navy bg-navy-50/60 shadow-sm" : "border-slate-200 hover:border-navy-200"}`}>
                      <span className={`block text-[13.5px] font-bold ${method === k ? "text-navy" : "text-slate-800"}`}>{l}</span>
                      <span className="block text-[11px] text-slate-500">{s}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-6">
                  {method === "card" && (
                    <div className="grid grid-cols-2 gap-4">
                      {field("number", "Card number", { span: true, fmt: fmtNum,
                        input: { inputMode: "numeric", placeholder: "4111 1111 1111 1111" },
                        suffix: cardBrand(card.number) && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-slate-600">{cardBrand(card.number)}</span> })}
                      {field("exp", "Expiry", { fmt: fmtExp, input: { inputMode: "numeric", placeholder: "MM / YY" } })}
                      {field("cvv", "CVV", { fmt: (v) => v.replace(/\D/g, "").slice(0, 4), input: { inputMode: "numeric", placeholder: "•••", type: "password" } })}
                      {field("name", "Name on card", { span: true, input: { placeholder: "As printed on the card" } })}
                      <button type="button" onClick={() => setCard({ number: "4111 1111 1111 1111", exp: "12 / 30", cvv: "123", name: "Test User" })}
                              className="col-span-2 justify-self-start text-[12px] font-semibold text-navy hover:underline">
                        Use a test card
                      </button>
                    </div>
                  )}
                  {method === "upi" && (
                    <div className="grid items-center gap-6 sm:grid-cols-[1fr_auto]">
                      <div>
                        <label className="mb-1 block text-[12px] font-semibold text-slate-600">UPI ID</label>
                        <input value={vpa} onChange={(e) => setVpa(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, vpa: true }))}
                               placeholder="yourname@bank" autoComplete="off"
                               className={`w-full rounded-xl border-[1.5px] px-3 py-2.5 text-[14px] outline-none focus:border-navy focus:ring-4 focus:ring-navy/10 ${touched.vpa && vpaErr ? "border-red-400" : "border-slate-200"}`} />
                        {touched.vpa && vpaErr && <p className="mt-1 text-[11px] font-medium text-red-500">{vpaErr}</p>}
                        <button type="button" onClick={() => setVpa("success@demo")} className="mt-2 text-[12px] font-semibold text-navy hover:underline">Use a test UPI ID</button>
                      </div>
                      <div className="flex flex-col items-center gap-1.5">
                        <TestQR />
                        <span className="text-[10.5px] font-semibold text-slate-400">Test QR — not scannable</span>
                      </div>
                    </div>
                  )}
                  {method === "netbanking" && (
                    <div className="grid grid-cols-2 gap-2">
                      {TEST_BANKS.map((b) => (
                        <button key={b} type="button" onClick={() => setBank(b)}
                                className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-3 text-left text-[13px] font-semibold transition-all
                                  ${bank === b ? "border-navy bg-navy-50/60 text-navy" : "border-slate-200 text-slate-700 hover:border-navy-200"}`}>
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-extrabold text-slate-500">{b.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
                          {b}
                        </button>
                      ))}
                    </div>
                  )}
                  {method === "wallet" && (
                    <div className="grid grid-cols-3 gap-2">
                      {TEST_WALLETS.map((w) => (
                        <button key={w} type="button" onClick={() => setWallet(w)}
                                className={`rounded-xl border-2 px-3 py-4 text-center text-[13px] font-semibold transition-all
                                  ${wallet === w ? "border-navy bg-navy-50/60 text-navy" : "border-slate-200 text-slate-700 hover:border-navy-200"}`}>
                          {w}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button className="btn mt-8 w-full !rounded-xl !py-3.5 text-[15px] shadow-[0_12px_26px_-12px_rgba(79,70,229,.9)]"
                        onClick={pay} disabled={!canPay && method !== "card"}>
                  Pay {inr(plan.price)}
                </button>
                <button onClick={onBack} className="mt-2 w-full rounded-xl py-2 text-[13px] font-semibold text-slate-400 hover:text-navy">
                  Cancel and go back
                </button>
              </>
            )}

            {step === "processing" && (
              <div className="flex h-full min-h-[440px] flex-col items-center justify-center text-center">
                <svg className="h-12 w-12 animate-spin text-navy" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".15" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <p className="mt-5 font-heading text-[17px] font-bold text-slate-900">Processing your payment…</p>
                <p className="mt-1 text-[13px] text-slate-500">Please don't close or refresh this page.</p>
              </div>
            )}

            {step === "bank" && (
              <div className="mx-auto max-w-sm">
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between bg-slate-800 px-4 py-3 text-white">
                    <span className="font-heading text-[14px] font-bold">{method === "netbanking" ? bank : method === "wallet" ? wallet : "Demo Bank"} · Test</span>
                    <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9.5px] font-extrabold text-amber-950">SIMULATOR</span>
                  </div>
                  <div className="p-5">
                    <p className="text-[13px] text-slate-600">Authorise a payment of <b className="text-slate-900">{inr(plan.price)}</b> to <b className="text-slate-900">QCloneJob</b></p>
                    <p className="mt-0.5 text-[12px] text-slate-400">{methodLabel}</p>
                    <label className="mb-1 mt-5 block text-[12px] font-semibold text-slate-600">One-time password</label>
                    <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                           inputMode="numeric" placeholder="••••••" autoComplete="off"
                           className="w-full rounded-xl border-[1.5px] border-slate-200 px-3 py-2.5 text-center font-mono text-[18px] tracking-[0.5em] outline-none focus:border-navy focus:ring-4 focus:ring-navy/10" />
                    <p className="mt-1.5 text-[11.5px] text-slate-400">Test OTP: <b className="font-mono text-slate-600">123456</b> succeeds, anything else fails.</p>
                    <button className="btn mt-5 w-full !rounded-xl !py-3" disabled={otp.length < 6}
                            onClick={() => (otp === "123456" ? succeed() : fail("The bank declined the one-time password."))}>
                      Submit OTP
                    </button>
                    <button onClick={() => fail("You cancelled the payment at the bank.")}
                            className="mt-2 w-full rounded-xl py-2 text-[12.5px] font-semibold text-slate-400 hover:text-red-500">
                      Cancel payment
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === "upi-wait" && (
              <div className="flex min-h-[440px] flex-col items-center justify-center text-center">
                <div className="relative flex h-20 w-20 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-navy/20" />
                  <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-navy text-[13px] font-bold text-white">UPI</span>
                </div>
                <p className="mt-5 font-heading text-[17px] font-bold text-slate-900">Approve the request in your UPI app</p>
                <p className="mt-1 text-[13px] text-slate-500">A collect request for {inr(plan.price)} was sent to <b>{vpa}</b></p>
                <p className="mt-3 font-mono text-[22px] font-bold tabular-nums text-navy">
                  {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
                </p>
                <div className="mt-6 flex gap-2">
                  <button className="btn !rounded-full !px-5" onClick={succeed}>Simulate approve</button>
                  <button className="btn-outline !rounded-full !px-5" onClick={() => fail("The UPI request was declined.")}>Simulate decline</button>
                </div>
              </div>
            )}

            {step === "success" && (
              <div className="flex min-h-[440px] flex-col items-center justify-center text-center">
                <span className="chart-pop flex h-20 w-20 items-center justify-center rounded-full bg-brandgreen text-white shadow-[0_14px_30px_-12px_rgba(79,170,56,.8)]">
                  <IconCheck size={38} strokeWidth={3} />
                </span>
                <p className="mt-5 font-heading text-[22px] font-bold text-slate-900">Payment successful</p>
                <p className="mt-1 text-[13.5px] text-slate-500">{inr(plan.price)} paid for the {plan.name} plan (test mode).</p>
                <div className="mt-5 w-full max-w-xs rounded-2xl bg-slate-50 p-4 text-left text-[12.5px]">
                  <div className="flex justify-between"><span className="text-slate-500">Payment ID</span><span className="font-mono font-semibold text-slate-800">{ref}</span></div>
                  <div className="mt-1.5 flex justify-between"><span className="text-slate-500">Method</span><span className="font-semibold text-slate-800">{methodLabel}</span></div>
                  <div className="mt-1.5 flex justify-between"><span className="text-slate-500">Date</span><span className="font-semibold text-slate-800">{new Date().toLocaleString("en-IN")}</span></div>
                </div>
                <button className="btn mt-6 !rounded-full !px-8" onClick={activate} disabled={activating}>
                  {activating ? "Activating plan…" : `Activate ${plan.name} plan`}
                </button>
              </div>
            )}

            {step === "failed" && (
              <div className="flex min-h-[440px] flex-col items-center justify-center text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-[0_14px_30px_-12px_rgba(239,68,68,.8)]">
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </span>
                <p className="mt-5 font-heading text-[22px] font-bold text-slate-900">Payment failed</p>
                <p className="mt-1 max-w-xs text-[13.5px] text-slate-500">{failReason} No money was taken.</p>
                <div className="mt-6 flex gap-2">
                  <button className="btn !rounded-full !px-6" onClick={() => { setOtp(""); setStep("pay"); }}>Try again</button>
                  <button className="btn-outline !rounded-full !px-6" onClick={onBack}>Back to plans</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Decorative, deliberately non-scannable QR-style tile for the test UPI tab. */
function TestQR() {
  const cells = [];
  let seed = 7;
  for (let i = 0; i < 121; i++) { seed = (seed * 9301 + 49297) % 233280; cells.push(seed / 233280 > 0.5); }
  const finder = (x, y) => (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7);
  return (
    <div className="grid grid-cols-11 gap-[2px] rounded-xl border border-slate-200 bg-white p-2.5 opacity-80">
      {cells.map((on, i) => {
        const x = i % 11, y = Math.floor(i / 11);
        return <span key={i} className={`h-2.5 w-2.5 rounded-[2px] ${finder(x, y) || on ? "bg-slate-800" : "bg-transparent"}`} />;
      })}
    </div>
  );
}
