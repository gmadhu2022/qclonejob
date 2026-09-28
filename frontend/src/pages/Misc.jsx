import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui";
import { useDialog, useConfirm } from "../components/Dialog";
import { IconUser, IconBriefcase, IconBuilding } from "../components/icons";
import Logo from "../components/Logo";
import { IconCheck, IconEye, IconLock } from "../components/icons";
import { RegistrationFields, buildRegistrationPayload, validateRegistration, EMAIL_PATTERN } from "../components/RegistrationForm";

/* Simple centred shell used by the auth-adjacent pages */
function AuthShell({ title, subtitle, children, wide }) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-100 bg-white px-6 py-3">
        <div className="mx-auto max-w-6xl"><Link to="/"><Logo className="h-9" /></Link></div>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className={wide ? "w-full max-w-2xl" : "w-full max-w-md"}>
          {/* Back navigation, in the same top-left position as every other
              screen. Uses history so it returns wherever you came from —
              home, the login page, or a deep link — and falls back to home
              when this page was opened directly and there is nothing to go
              back to. */}
          <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
                  className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500
                             transition-colors hover:text-navy">
            ← Back
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy">{title}</h1>
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

export function Register() {
  /* Account type is chosen HERE rather than on the login page. The URL param
     is only a starting value, so /register/enterprise still deep-links, and
     bare /register opens on Job Seeker. Switching is in-page: all three forms
     live on this screen and only the selected one renders. */
  const { role: urlRole } = useParams();
  const [role, setRole] = useState(
    REG_ROLES.some((r) => r.key === urlRole) ? urlRole : "jobseeker");
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
       actually usable. An institute that set its own password can sign in
       immediately; anyone still waiting on approval is told so plainly rather
       than being sent to a login that will refuse them. */
    const pending = /pending/i.test(result.status || "");
    return (
      <AuthShell title={pending ? "Registration received" : "Registration Successful"}
                 subtitle={pending
                   ? "We'll email you as soon as your account is activated."
                   : "Your account is ready to use."}>
        <div className="card text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brandgreen-50 text-brandgreen-600">
            <IconCheck size={26} />
          </div>
          <p className="mt-4 text-lg font-extrabold text-navy">
            {pending ? result.status : "Registration Successful"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Your User ID is <b className="text-slate-700">{result.email}</b>
            {result.password
              ? " — your password was emailed to that address."
              : ". Sign in with the password you just chose."}
          </p>
          <Link to={`/login/${role}`}
                className={`mt-6 w-full ${pending ? "btn-outline" : "btn"}`}>
            {pending ? "Go to login" : "Login"}
          </Link>
          {pending && (
            <p className="mt-3 text-xs text-slate-400">
              Logging in before approval will be refused — that's expected.
            </p>
          )}
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell wide
      title={isInst ? "Register your institute" : isEnt ? "Register as an employer" : "Create your job seeker account"}
      subtitle={isInst ? "Onboard your students in bulk and connect them to employers."
                       : isEnt ? "Post jobs, search resumes and manage applications."
                       : "Build your resume, apply to jobs and track every application."}>
      <form onSubmit={submit} className="space-y-4">
        {/* Account type — all three registrations live on this one page. */}
        <div className="grid gap-2 sm:grid-cols-3">
          {REG_ROLES.map((r) => {
            const active = role === r.key;
            return (
              <button key={r.key} type="button" onClick={() => switchRole(r.key)}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all
                  ${active ? "border-navy bg-navy-50 shadow-sm"
                           : "border-slate-200 bg-white hover:border-navy-200 hover:bg-slate-50"}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
                  ${active ? "bg-navy text-white" : "bg-slate-100 text-slate-500"}`}>
                  <r.icon size={17} />
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-[13px] font-bold ${active ? "text-navy" : "text-slate-700"}`}>
                    {r.label}
                  </span>
                  <span className="block truncate text-[11px] text-slate-400">{r.tag}</span>
                </span>
              </button>
            );
          })}
        </div>

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
    </AuthShell>
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
      const r = await api.post("/api/auth/reset-with-otp",
        { email, code, new_password: pw, confirm_password: confirm }, { auth: false });
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
