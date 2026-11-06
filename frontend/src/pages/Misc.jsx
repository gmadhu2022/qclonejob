import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui";
import { useDialog, useConfirm } from "../components/Dialog";
import { IconUser, IconBriefcase, IconBuilding } from "../components/icons";
import Logo from "../components/Logo";
import SiteHeader from "../components/SiteHeader";
import { IconCheck, IconEye, IconLock } from "../components/icons";
import { RegistrationFields, buildRegistrationPayload, validateRegistration, EMAIL_PATTERN } from "../components/RegistrationForm";

/* Simple centred shell used by the auth-adjacent pages */
function AuthShell({ title, subtitle, children, wide }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <SiteHeader />
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className={wide ? "w-full max-w-2xl" : "w-full max-w-md"}>
          {/* Back navigation, in the same top-left position as every other
              screen. Uses history so it returns wherever you came from —
              home, the login page, or a deep link — and falls back to home
              when this page was opened directly and there is nothing to go
              back to. */}
          <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
                  className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-navy">
            ← Back
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function ChangePassword() {
  const { auth, logout } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [show, setShow] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/auth/change-password", { old_password: oldPw || null, new_password: newPw });
      confirm("Password changed successfully", { message: "Please sign in again with your new password." });
      logout(); navigate("/login");
    } catch (err) { toast(err.message, "error"); }
  };

  return (
    <AuthShell title="Change password" subtitle={`Set a new password for ${auth?.email || "your account"}.`}>
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="label">Current password <span className="font-normal text-slate-400">(leave blank on first login)</span></label>
          <input className="input" type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label !mb-0">New password</label>
            <button type="button" onClick={() => setShow((v) => !v)} className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-navy">
              <IconEye size={13} /> {show ? "Hide" : "Show"}
            </button>
          </div>
          <input className="input" type={show ? "text" : "password"} value={newPw} required minLength={6}
                 onChange={(e) => setNewPw(e.target.value)} />
          <p className="mt-1.5 text-xs text-slate-400">At least 6 characters.</p>
        </div>
        <button className="btn w-full">Change password</button>
      </form>
    </AuthShell>
  );
}

const REG_ROLES = [
  { key: "jobseeker", label: "Job Seeker", tag: "Find work", icon: IconUser },
  { key: "enterprise", label: "Recruiter", tag: "Hire talent", icon: IconBriefcase },
  { key: "institute", label: "Institute", tag: "Place students", icon: IconBuilding },
];

/* ---------------------------------------------------------------------
   Registration layout: one card, light-grey step rail on the left (account
   type + numbered steps whose circles sit on the rail's edge), white form
   panel on the right. Steps follow each role's real flow.
   --------------------------------------------------------------------- */
const okEmail = (v) => EMAIL_PATTERN.test((v || "").trim());
const REG_STEPS = {
  jobseeker: [
    { label: "Your details", hint: "Name, email, phone", find: "First name",
      done: (f) => Boolean((f.first_name || "").trim()) && okEmail(f.email) },
    { label: "Create account", hint: "Login details emailed", find: "Create account", done: () => false },
  ],
  enterprise: [
    { label: "Company details", hint: "Name, mail, contact", find: "Company details",
      done: (f) => Boolean((f.name || "").trim() && (f.authorised_person_name || "").trim() && f.phone) && okEmail(f.email) },
    { label: "Address", hint: "Office and pincode", find: "Address",
      done: (f) => Boolean((f.address1 || "").trim()) && /^\d{6}$/.test(f.pincode || "") },
    { label: "Verify & submit", hint: "Email OTP and security check", find: "Verify your email",
      done: (f) => Boolean(f.email_verified && (f.captcha_answer || "").trim()) },
  ],
  institute: [
    { label: "Institute details", hint: "Name, contact, capacity", find: "Institute details",
      done: (_, stage) => stage >= 2 },
    { label: "Verify email", hint: "6-digit code", find: "Verify your email",
      done: (_, stage) => stage >= 3 },
    { label: "Complete profile", hint: "Password, address, courses", find: "Create your password",
      done: (f) => (f.password || "").length >= 6 && f.password === f.confirm_password },
  ],
};

function findSection(text) {
  return [...document.querySelectorAll(".reg-panel h3, .reg-panel h4, .reg-panel label, .reg-panel button")]
    .find((el) => el.textContent.trim().toLowerCase().startsWith(text.toLowerCase())) || null;
}
/* On desktop the form panel is its own scroll area and the page does not
   scroll; on phones the page scrolls as usual. Everything below asks which
   one is actually scrolling right now. */
function regScroller() {
  const p = document.querySelector(".reg-panel");
  if (p && p.scrollHeight > p.clientHeight + 1 && getComputedStyle(p).overflowY !== "visible") return p;
  return null;
}

function scrollToSection(text) {
  const el = findSection(text);
  if (!el) return;
  const panel = regScroller();
  if (panel) {
    const top = el.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop - 24;
    panel.scrollTo({ top, behavior: "smooth" });
  } else {
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: "smooth" });
  }
}

/* Scroll-spy: which step's section the reader is looking at. A section is
   "current" once its heading has passed 40% of the way down the visible
   area. Sections not on the page yet (institute stages) are skipped. */
function useSectionSpy(steps, deps) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const panel = regScroller();
      const viewTop = panel ? panel.getBoundingClientRect().top : 0;
      const viewH = panel ? panel.clientHeight : window.innerHeight;
      const line = viewTop + viewH * 0.4;
      let idx = 0;
      steps.forEach((st, i) => {
        const el = findSection(st.find);
        if (el && el.getBoundingClientRect().top <= line) idx = i;
      });
      // At the very bottom the last reachable step is current — but only once
      // the reader has actually scrolled (a short form starts "at the bottom").
      const y = panel ? panel.scrollTop : window.scrollY;
      const atEnd = panel ? panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 4
                          : window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (y > 40 && atEnd) {
        for (let i = steps.length - 1; i >= 0; i--) if (findSection(steps[i].find)) { idx = Math.max(idx, i); break; }
      }
      setCurrent(idx);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    const panel = document.querySelector(".reg-panel");
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    panel?.addEventListener("scroll", on, { passive: true });
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      panel?.removeEventListener("scroll", on);
      cancelAnimationFrame(raf);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return current;
}

function RegShell({ role, onRole, steps, form, stage, complete, title, subtitle, children }) {
  const navigate = useNavigate();
  const states = steps.map((s) => complete || s.done(form, stage));
  const spy = useSectionSpy(steps, [role, stage, complete]);
  const active = complete ? -1 : spy;
  return (
    <div className="flex min-h-screen flex-col bg-slate-100/70 lg:h-screen lg:overflow-hidden">
      <SiteHeader />
      <div className="flex flex-1 justify-center px-4 py-5 sm:px-6 lg:min-h-0 lg:py-4">
        <div className="w-full max-w-5xl lg:h-full">
          <div className="grid overflow-clip rounded-3xl bg-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.25)] ring-1 ring-slate-200/70 lg:h-full lg:grid-cols-[210px_minmax(0,1fr)]">
            {/* ---------- Left rail: pinned, fits the screen; only the form scrolls ---------- */}
            <aside className="reg-rail relative lg:border-r lg:border-slate-200">
              <div className="relative z-10 flex flex-col gap-4 p-4 lg:h-full lg:gap-0">
                <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
                        className="mb-1 inline-flex w-fit items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-white hover:text-navy lg:mb-3">
                  ← Back
                </button>
                {/* Account type — compact segmented list */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">I'm registering as</span>
                  <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200 lg:grid-cols-1">
                    {REG_ROLES.map((r) => {
                      const on = role === r.key;
                      return (
                        <button key={r.key} type="button" onClick={() => onRole(r.key)} disabled={complete}
                          className={`flex items-center gap-2 rounded-xl px-2 py-1 text-left transition-all duration-200 disabled:cursor-default
                            ${on ? "bg-gradient-to-r from-navy to-indigo-500 text-white shadow-md" : "text-slate-600 hover:bg-slate-50"}`}>
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md
                            ${on ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>
                            <r.icon size={13} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[12px] font-bold">{r.label}</span>
                                                      </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Progress */}
                <div className="lg:mt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Your progress</span>
                    <span className="text-[11px] font-bold text-navy">{states.filter(Boolean).length}/{steps.length}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-brandgreen to-navy transition-[width] duration-500"
                         style={{ width: `${(states.filter(Boolean).length / steps.length) * 100}%` }} />
                  </div>
                </div>

                {/* Steps — circles straddle the rail's right edge on desktop */}
                <ol className="relative flex gap-2 lg:mt-4 lg:block lg:flex-1 lg:space-y-2.5">
                  {/* connector line behind the circles */}
                  <span aria-hidden="true" className="absolute -right-4 top-5 bottom-5 hidden w-px bg-slate-200 lg:block" />
                  {steps.map((s, i) => {
                    const done = states[i];
                    const on = i === active;
                    return (
                      <li key={s.label} className="relative flex-1">
                        <button type="button" onClick={() => !complete && scrollToSection(s.find)}
                                className={`group flex w-full items-center gap-3 rounded-xl py-1 pl-2 pr-2 text-left transition-colors lg:pr-6
                                            ${on ? "bg-white shadow-sm ring-1 ring-indigo-100" : "hover:bg-white/60"}`}>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-[13px] font-bold transition-colors ${on ? "text-navy" : done ? "text-slate-700" : "text-slate-400"}`}>
                              {s.label}
                            </span>
                            <span className="hidden truncate text-[10.5px] text-slate-400 lg:block">{s.hint}</span>
                          </span>
                          <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold
                                            transition-all duration-300 lg:absolute lg:-right-[34px] lg:top-1/2 lg:-translate-y-1/2
                                            ${on ? `${done ? "bg-brandgreen text-white" : "bg-white text-navy"} shadow-[0_8px_24px_-6px_rgba(79,70,229,.55)] ring-[3px] ring-navy`
                                              : done ? "bg-brandgreen text-white shadow-[0_8px_20px_-6px_rgba(79,170,56,.7)]"
                                              : "bg-white text-slate-400 shadow ring-1 ring-slate-200"}`}>
                            {done && !on ? <IconCheck size={16} /> : i + 1}
                            {on && <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-navy/30" />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>

                {/* Help card */}
                <div className="hidden rounded-2xl bg-gradient-to-br from-navy to-indigo-500 p-3 text-white shadow-lg lg:block [@media(max-height:620px)]:!hidden">
                  <span className="text-[12px] font-bold">Need help signing up?</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-white/75">
                    Write to <a href="mailto:support@qclonejob.com" className="font-semibold text-white underline-offset-2 hover:underline">support@qclonejob.com</a>
                  </span>
                  <span className="mt-2 block border-t border-white/15 pt-2 text-[11px] text-white/75">
                    Already registered?{" "}
                    <Link to={`/login/${role}`} className="font-semibold text-white hover:underline">Log in</Link>
                  </span>
                </div>
              </div>
            </aside>

            {/* ---------- Form panel ---------- */}
            <section className="reg-panel min-w-0 p-5 sm:p-8 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:pl-12">
              <h1 className="font-heading text-[24px] font-bold uppercase leading-tight tracking-[0.04em] text-slate-900 sm:text-[28px]"><span className="bg-gradient-to-r from-slate-900 via-navy to-indigo-500 bg-clip-text text-transparent">{title}</span></h1>
              <span aria-hidden="true" className="mt-2 block h-1 w-12 rounded-full bg-gradient-to-r from-brandgreen to-navy" />
              {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
              <div className="mt-6">{children}</div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Register() {
  /* Account type is chosen HERE rather than on the login page. The URL param
     is only a starting value, so /register/enterprise still deep-links, and
     bare /register opens on Job Seeker. Switching is in-page: all three forms
     live on this screen and only the selected one renders. */
  const { role: urlRole } = useParams();
  /* Which registration form opens, in order of how explicit the signal is:
       1. /register/<role>            — the person clicked a role-specific link
       2. /register?as=<role>         — the header's Login menu carries this
       3. the portal picked at sign-in — remembered by the login page
       4. jobseeker                   — the common case
     Defaulting straight to jobseeker was wrong: someone who clicked Register
     from the RECRUITER login landed on a student form and had to notice the
     mismatch and re-pick, which most people do not. */
  const [params] = useSearchParams();
  const [role, setRole] = useState(() => {
    const valid = (k) => REG_ROLES.some((r) => r.key === k);
    const asked = params.get("as");
    if (valid(urlRole)) return urlRole;
    if (valid(asked)) return asked;
    const remembered = localStorage.getItem("hire_login_role");
    if (valid(remembered)) return remembered;
    return "jobseeker";
  });
  const toast = useToast();
  const dialog = useDialog();
  const navigate = useNavigate();
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);        // optional company details
  const [formKey, setFormKey] = useState(0);      // bumped on Clear to reset children
  /* Staged registration for the INSTITUTE only:
       1  contact details  ->  Register
       2  the email OTP box
       3  the rest of the form + password  ->  Submit

     The recruiter form is deliberately NOT staged. Its requirements list is
     fields -> captcha -> Register, with no OTP step, and gating it behind one
     was actively harmful: the captcha and the Submit button both lived at
     stage 3, so on any deployment where email isn't configured the code never
     arrived, the recruiter never left stage 2, and registration was simply
     impossible. A bot check that can only be reached through a working mail
     server is not a bot check. */
  const [stage, setStage] = useState(1);
  const [otpSendTick, setOtpSendTick] = useState(0);
  const isEnt = role === "enterprise";
  const isInst = role === "institute";

  /* Stage 1 -> 2. Validates the fields we actually have yet, checks the email
     isn't already registered, then bumps otpSendTick to send the code. The
     availability check happens HERE rather than at submit: verifying an OTP
     and filling in a whole form only to be told the address is taken is a
     miserable way to find out. */
  const startVerification = async () => {
    const name = (form.name || "").trim();
    if (!name) return toast(`${isInst ? "Institute" : "Organisation"} Name is required.`, "error");
    const email = (form.email || "").trim();
    if (!EMAIL_PATTERN.test(email)) {
      return toast("Enter a valid Official Mail address, e.g. name@institute.edu", "error");
    }
    if (!form.phone) return toast("Enter your Contact Number.", "error");
    if (isInst) {
      if (!(form.authorised_person_name || "").trim()) {
        return toast("Enter the Contact Person's name.", "error");
      }
      if (!String(form.total_capacity || "").trim()) {
        return toast("Enter your Total Capacity.", "error");
      }
      if (!String(form.current_strength || "").trim()) {
        return toast("Enter your Current Strength.", "error");
      }
      if (Number(form.current_strength) > Number(form.total_capacity)) {
        return toast("Current Strength can't be more than Total Capacity.", "error");
      }
    }

    setBusy(true);
    try {
      const check = await api.get(
        `/api/public/email-available?email=${encodeURIComponent(email)}`, { auth: false });
      if (!check.available) {
        setBusy(false);
        return dialog({
          tone: "error",
          title: "That email is already registered",
          message: check.message,
          confirmLabel: "Go to login",
          onConfirm: () => navigate(`/login/${role}`),
        });
      }
    } catch {
      /* The check is a courtesy, not a gate — if it can't run, carry on and
         let the registration endpoint be the authority. */
    }
    setBusy(false);
    setStage(2);
    setOtpSendTick((t) => t + 1);
  };

  // Either code unlocks the remaining fields; the other is still asked for.
  const onOtpVerified = () => setStage(3);


  /* Functional updates are essential here, not stylistic.
     ImageUpload's onUploaded fires ~1s after the file is picked, from a closure
     captured at pick time. With `setForm({ ...form, ... })` that stale `form`
     overwrites everything typed while the upload was in flight — which is how
     a filled-in Official Mail ended up as null and the register call 422'd. */
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setV = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  // Contact Number is numeric only, per the registration spec.
  const setPhone = (v) => setForm((f) => ({ ...f, phone: String(v || "").replace(/\D/g, "").slice(0, 10) }));

  const switchRole = (key) => {
    if (key === role) return;
    // A half-finished recruiter form must not leak into the institute one:
    // the field sets differ and stale OTP verification would carry over.
    setRole(key); setForm({}); setStage(1); setOtpSendTick(0);
    setFormKey((k) => k + 1);
  };

  const clearForm = () => {
    setForm({});
    setStage(1);
    setOtpSendTick(0);
    setMore(false);
    setFormKey((k) => k + 1);   // remounts OTP fields + logo uploader
    toast("Form cleared.");
  };

  const submit = async (e) => {
    e.preventDefault();

    const err = validateRegistration(role, form);
    if (err) return toast(err, "error");

    /* Unverified contact details are the most common reason a registration is
       rejected by the server, and a toast for it is too easy to miss. */
    if (role === "enterprise" || role === "institute") {
      /* Email only. The phone number is collected but not code-verified, so
         gating on it would block registration on a number nobody checked. */
      if (!form.email_verified) {
        return dialog({
          tone: "info",
          title: "Verify your email address",
          message: "Enter the 6-digit code we sent to "
                 + `${(form.email || "your email address")} before submitting.`,
          confirmLabel: "Got it",
          note: "Not arrived? Check your spam folder, or press Resend. Codes expire after a "
              + "few minutes.",
          noteTone: "warn",
        });
      }
    }

    doSubmit();
  };

  const doSubmit = async () => {
    setBusy(true);
    try {
      const path = role === "enterprise" ? "/api/public/register/enterprise"
                 : role === "institute" ? "/api/public/register/institute"
                 : "/api/public/register/jobseeker";
      const body = buildRegistrationPayload(role, form);
      const res = await api.post(path, body, { auth: false });
      setResult(res);
      /* An institute chose its own password, so there is nothing to show it and
         nothing to write down — the dialog would only be handing back a secret
         it already knows. A generated password (recruiter, job seeker) still
         has to be displayed, because it exists nowhere else on screen. */
      const chosePassword = Boolean(body.password);
      dialog({
        tone: "success",
        title: chosePassword ? "Registration Successful" : "Profile created successfully",
        message: res.status,
        details: chosePassword
          ? [["User ID", res.user_id], ["Password", "the password you just chose"]]
          : [["User ID", res.user_id], ["Password", res.password]],
        note: chosePassword
          ? "You can log in straight away with your official email and that password."
          : res.email_status === "sent"
            ? `Your login details were emailed to ${res.email}.`
            : res.email_status === "console"
              ? "Email sending is switched off, so save these details now — they are also printed in the server console."
              : `We could not email these details (${res.email_error || "delivery failed"}). Please save them now.`,
        noteTone: chosePassword || res.email_status === "sent" ? "info" : "warn",
        confirmLabel: chosePassword ? "Continue to login" : "Save & continue",
      });
    } catch (err) { toast(err.message, "error"); }
    finally { setBusy(false); }
  };

  if (result) {
    /* Requirement 10 — "Registration Successful", and a Login button that is
       actually usable. Anyone still waiting on approval is told so plainly
       rather than being sent to a login that will refuse them. */
    const pending = /pending/i.test(result.status || "");
    return (
      <RegShell role={role} onRole={() => {}} steps={REG_STEPS[role]} form={form} stage={stage} complete
                title="" subtitle="">
        <div className="mx-auto max-w-md py-6 text-center">
          <div className="reg-burst relative mx-auto flex h-28 w-28 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-brandgreen-100" />
            <span className="absolute inset-3 rounded-full bg-brandgreen-200/70" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brandgreen text-white shadow-lg">
              <IconCheck size={30} />
            </span>
            {Array.from({ length: 12 }).map((_, i) => (
              <span key={i} className="reg-ray absolute left-1/2 top-1/2 h-2 w-1 rounded-full"
                    style={{ background: i % 2 ? "#4f46e5" : "#4faa38", "--r": `${i * 30}deg` }} />
            ))}
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-brandgreen-600">
            {pending ? "Registration received" : "Setup completed!"}
          </p>
          <h2 className="mt-2 font-heading text-[24px] font-bold uppercase tracking-[0.04em] text-slate-900">
            {pending ? result.status : "Registration Successful"}
          </h2>
          <p className="mt-3 text-sm text-slate-500">
            Your User ID is <b className="text-slate-700">{result.email}</b>
            {result.password
              ? " — your password was emailed to that address."
              : ". Sign in with the password you just chose."}
          </p>
          <Link to={`/login/${role}`} className={`mt-8 w-full !py-3 ${pending ? "btn-outline" : "btn"}`}>
            {pending ? "Go to login" : "Login"}
          </Link>
          {pending && (
            <p className="mt-3 text-xs text-slate-400">
              Logging in before approval will be refused — that's expected. We'll email you once it's activated.
            </p>
          )}
        </div>
      </RegShell>
    );
  }

  return (
    <RegShell role={role} onRole={switchRole} steps={REG_STEPS[role]} form={form} stage={stage}
      title={isInst ? "Institute Sign Up" : isEnt ? "Employer Sign Up" : "Job Seeker Sign Up"}
      subtitle={isInst ? "Onboard your students in bulk and connect them to employers."
                       : isEnt ? "Post jobs, search resumes and manage applications."
                       : "Build your resume, apply to jobs and track every application."}>
      <form onSubmit={submit} className="space-y-4">
        <RegistrationFields role={role} form={form} setForm={setForm} formKey={formKey}
                            stage={isInst ? stage : 3}
                            otpSendTick={otpSendTick}
                            onVerified={onOtpVerified} />

        {isInst ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {stage === 1 ? (
                /* type="button": stage 1 is not a form submit, it only sends the
                   codes. Leaving it as a submit would POST a half-filled form. */
                <button type="button" className="btn !py-3" onClick={startVerification}>
                  Register
                </button>
              ) : stage === 2 ? (
                <button type="button" className="btn !py-3" disabled>
                  Verify your email to continue
                </button>
              ) : (
                <button className="btn !py-3" disabled={busy}>
                  {busy ? "Submitting…" : "Submit"}
                </button>
              )}
              <button type="button" className="btn-outline !py-3" onClick={clearForm} disabled={busy}>
                Clear
              </button>
            </div>

            {stage === 1 && (
              <p className="text-center text-xs text-slate-400">
                We'll email you a 6-digit code to confirm your address, then show the
                rest of the form.
              </p>
            )}
            <p className="text-center text-sm text-slate-500">
              Fields marked <span className="font-semibold text-red-400">*</span> are required.
              Already registered?{" "}
              <Link to={`/login/${role}`} className="font-semibold text-navy hover:underline">Log in</Link>
            </p>
          </>
        ) : (
          <div className="card">
            <button className="btn w-full !py-3" disabled={busy}>
              {busy ? "Creating account…" : "Create account"}
            </button>
            <p className="mt-3 text-center text-sm text-slate-500">
              Fields marked <span className="font-semibold text-red-400">*</span> are required.
              Already registered?{" "}
              <Link to={`/login/${role}`} className="font-semibold text-navy hover:underline">Log in</Link>
            </p>
          </div>
        )}
      </form>
    </RegShell>
  );
}


export function StaticPage({ title, children }) {
  return (
    <AuthShell title={title}>
      <div className="card text-[15px] leading-relaxed text-slate-600">{children}</div>
      <Link to="/" className="btn-outline mt-5 inline-block">← Back to home</Link>
    </AuthShell>
  );
}


/* Declared at module scope, NOT inside ForgotPassword.
   ----------------------------------------------------
   Defining a component inside another component creates a NEW component type
   on every render. React compares types, sees a different one, and unmounts
   the old subtree instead of updating it — so the input inside was destroyed
   and recreated on each keystroke, losing focus after a single character.
   `stage` is passed in rather than closed over, which is what let this move
   out of the render body. */
function Step({ stage, n, label, children }) {
  return (
    <div className={stage >= n ? "" : "pointer-events-none select-none opacity-40"}>
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold
          ${stage > n ? "bg-brandgreen-50 text-brandgreen-600"
                      : stage === n ? "bg-navy text-white" : "bg-slate-100 text-slate-400"}`}>
          {stage > n ? "\u2713" : n}
        </span>
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      {children}
    </div>
  );
}

export function ForgotPassword() {
  /* Reset by OTP, revealed one block at a time.
     ------------------------------------------
     The old screen emailed a reset LINK, which needs a working inbox on the
     same device you're sitting at. A code can be read on a phone and typed on
     a laptop, which is how most people actually recover an account.

     Each stage unlocks the next, and none of them appear early: showing the
     new-password boxes before the code is verified invites people to fill them
     in and then lose the typing when the code turns out to be wrong. */
  const toast = useToast();
  const navigate = useNavigate();
  const { setSession } = useAuth();

  const STAGE = { EMAIL: 1, OTP: 2, PASSWORD: 3 };
  const [stage, setStage] = useState(STAGE.EMAIL);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [devCode, setDevCode] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /* Stage 1 -> the Send OTP button. The address is checked against real
     accounts first, so nobody waits for a code that was never sent. */
  const checkEmail = async () => {
    setError(null); setBusy(true);
    try {
      await api.post("/api/auth/reset/check-email", { email }, { auth: false });
      setStage(STAGE.OTP);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const sendOtp = async () => {
    setError(null); setBusy(true);
    try {
      const r = await api.post("/api/auth/otp/send",
        { target: email, channel: "email", purpose: "reset" }, { auth: false });
      setDevCode(r.dev_code || null);
      setCooldown(30);
      toast(r.delivery === "console"
        ? "Code generated — check the server console (email sending isn't configured yet)."
        : `OTP sent to ${email}.`);
    } catch (err) { setError(err.message); toast(err.message, "error"); }
    finally { setBusy(false); }
  };

  /* The code isn't verified on its own: a standalone check would burn the
     code, and then the password submit would have nothing left to prove. It's
     verified once, together with the new password, on the final submit. */
  const finish = async () => {
    if (pw !== confirm) { setError("Passwords are not matching"); return; }
    if (pw.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError(null); setBusy(true);
    try {
      /* One address can hold an account per portal, so the reset must say
         which. The portal picked on the sign-in page is remembered there, and
         that is the one they came from. Without it the server refuses rather
         than resetting the wrong account — correct, but a dead end for the
         user. */
      const r = await api.post("/api/auth/reset-with-otp",
        { email, code, new_password: pw, confirm_password: confirm,
          role: localStorage.getItem("hire_login_role") || undefined }, { auth: false });
      /* Requirement 4 — straight to the dashboard. Making someone who just
         proved ownership of the account log in again is pure friction. */
      setSession(r);
      toast("Password updated.");
      navigate(`/${r.role}`, { replace: true });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <AuthShell title="Forgot your password?"
               subtitle="Confirm your User ID, verify a code, then set a new password.">
      <div className="card space-y-5">
        <Step stage={stage} n={STAGE.EMAIL} label="Your User ID">
          <div className="flex gap-2">
            <input className={`input ${error && stage === STAGE.EMAIL ? "!border-red-400 !bg-red-50/40" : ""}`}
                   type="email" value={email} placeholder="you@company.com"
                   autoComplete="username" disabled={stage > STAGE.EMAIL}
                   onChange={(e) => { setEmail(e.target.value); setError(null); }}
                   onKeyDown={(e) => e.key === "Enter" && stage === STAGE.EMAIL && checkEmail()} />
            {stage === STAGE.EMAIL ? (
              <button className="btn shrink-0" onClick={checkEmail} disabled={busy || !email.trim()}>
                {busy ? "Checking…" : "Continue"}
              </button>
            ) : (
              <button className="btn-outline shrink-0"
                      onClick={() => { setStage(STAGE.EMAIL); setCode(""); setDevCode(null); }}>
                Change
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">Your User ID is your registered email address.</p>
        </Step>

        {stage >= STAGE.OTP && (
          <Step stage={stage} n={STAGE.OTP} label="Verify with OTP">
            {!devCode && cooldown === 0 && !code ? null : null}
            <div className="flex gap-2">
              <input className="input tracking-[0.4em]" maxLength={6} placeholder="000000"
                     inputMode="numeric" value={code}
                     onChange={(e) => { setCode(e.target.value.replace(/[^0-9]/g, "")); setError(null); }} />
              <button className="btn-outline shrink-0 whitespace-nowrap" onClick={sendOtp}
                      disabled={busy || cooldown > 0}>
                {cooldown > 0 ? `${cooldown}s` : "Send OTP"}
              </button>
            </div>
            {code.length === 6 && stage === STAGE.OTP && (
              <button className="btn mt-2 w-full" onClick={() => setStage(STAGE.PASSWORD)}>
                Continue
              </button>
            )}
            {devCode && (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Development mode — your code is <b className="font-mono tracking-widest">{devCode}</b>.
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Press Send OTP, then enter the 6-digit code we email you. It doesn't expire.
            </p>
          </Step>
        )}

        {stage >= STAGE.PASSWORD && (
          <Step stage={stage} n={STAGE.PASSWORD} label="New password">
            <div className="space-y-3">
              <div>
                <label className="label">New password</label>
                <input className="input" type={show ? "text" : "password"} value={pw}
                       autoComplete="new-password" placeholder="At least 6 characters"
                       onChange={(e) => { setPw(e.target.value); setError(null); }} />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input className={`input ${confirm && pw !== confirm ? "!border-red-400 !bg-red-50/40" : ""}
                                   ${confirm && pw === confirm && pw.length >= 6 ? "!border-brandgreen !bg-brandgreen-50/40" : ""}`}
                       type={show ? "text" : "password"} value={confirm}
                       autoComplete="new-password" placeholder="Type it again"
                       onChange={(e) => { setConfirm(e.target.value); setError(null); }} />
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
                Show passwords
              </label>
              <button className="btn w-full" onClick={finish}
                      disabled={busy || !pw || !confirm}>
                {busy ? "Updating…" : "Update password & continue"}
              </button>
            </div>
          </Step>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{error}</p>
        )}

        <p className="text-center text-sm text-slate-500">
          Remembered it? <Link to="/login" className="font-semibold text-navy hover:underline">Log in</Link>
        </p>
      </div>
    </AuthShell>
  );
}

export function ResetPassword() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post("/api/auth/reset-password", { token, new_password: pw }, { auth: false });
      toast(r.message);
      navigate("/login");
    } catch (err) { toast(err.message, "error"); }
    finally { setBusy(false); }
  };

  if (!token) {
    return (
      <AuthShell title="Invalid reset link" subtitle="This link is missing its token.">
        <div className="card">
          <p className="text-sm text-slate-500">Request a fresh link and try again.</p>
          <Link to="/forgot-password" className="btn mt-4 w-full">Request a new link</Link>
        </div>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you haven't used before.">
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <label className="label !mb-0">New password</label>
            <button type="button" onClick={() => setShow((v) => !v)}
                    className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-navy">
              <IconEye size={13} /> {show ? "Hide" : "Show"}
            </button>
          </div>
          <input className="input" type={show ? "text" : "password"} value={pw} required minLength={6}
                 onChange={(e) => setPw(e.target.value)} />
          <p className="mt-1.5 text-xs text-slate-400">At least 6 characters.</p>
        </div>
        <button className="btn w-full" disabled={busy}>{busy ? "Updating…" : "Reset password"}</button>
      </form>
    </AuthShell>
  );
}
