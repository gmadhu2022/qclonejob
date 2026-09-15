import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui";
import { useDialog, useConfirm } from "../components/Dialog";
import { IconUser, IconBriefcase, IconBuilding } from "../components/icons";
import Logo from "../components/Logo";
import { IconCheck, IconEye, IconLock } from "../components/icons";
import { RegistrationFields, buildRegistrationPayload, validateRegistration } from "../components/RegistrationForm";

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
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);        // optional company details
  const [formKey, setFormKey] = useState(0);      // bumped on Clear to reset children
  /* Staged registration for recruiter and institute:
       1  contact details  ->  Register
       2  the two OTP boxes
       3  the rest of the form  ->  Submit                                */
  const [stage, setStage] = useState(1);
  const [otpSendTick, setOtpSendTick] = useState(0);
  const isEnt = role === "enterprise";
  const isInst = role === "institute";

  /* Stage 1 -> 2. Validates the three fields we actually have yet, then bumps
     otpSendTick, which makes BOTH OtpFields send at once — the user pressed one
     button, so they should not then have to press two more. */
  const startVerification = () => {
    const name = (form.name || "").trim();
    if (!name) return toast(`${isInst ? "Institute" : "Company"} Name is required.`, "error");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((form.email || "").trim())) {
      return toast("Enter a valid Official Mail address.", "error");
    }
    if (!form.phone) return toast("Enter your Contact Number.", "error");
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
      dialog({
        tone: "success",
        title: "Profile created successfully",
        message: res.status,
        details: [["User ID", res.user_id], ["Password", res.password]],
        note: res.email_status === "sent"
          ? `Your login details were emailed to ${res.email}.`
          : res.email_status === "console"
            ? "Email sending is switched off, so save these details now — they are also printed in the server console."
            : `We could not email these details (${res.email_error || "delivery failed"}). Please save them now.`,
        noteTone: res.email_status === "sent" ? "info" : "warn",
        confirmLabel: "Save & continue",
      });
    } catch (err) { toast(err.message, "error"); }
    finally { setBusy(false); }
  };

  if (result) {
    return (
      <AuthShell title="You're registered" subtitle="Your account is ready to use.">
        <div className="card text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brandgreen-50 text-brandgreen-600">
            <IconCheck size={26} />
          </div>
          <p className="mt-4 font-semibold text-slate-800">{result.status}</p>
          <p className="mt-2 text-sm text-slate-500">
            Login credentials have been sent to <b className="text-slate-700">{result.email}</b>.
            In development they also print to the backend console.
          </p>
          <Link to={`/login/${role}`} className="btn mt-6 w-full">Go to login</Link>
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
                            stage={isEnt || isInst ? stage : 3}
                            otpSendTick={otpSendTick}
                            onVerified={onOtpVerified} />

        {isEnt || isInst ? (
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


export function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post("/api/auth/forgot-password", { email }, { auth: false });
      setSent(true); toast(r.message);
    } catch (err) { toast(err.message, "error"); }
    finally { setBusy(false); }
  };

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="If that address is registered, a reset link is on its way.">
        <div className="card text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy-50 text-navy"><IconLock size={24} /></div>
          <p className="mt-4 text-sm text-slate-500">
            The link is valid for one hour. In development the email prints to the backend console.
          </p>
          <Link to="/login" className="btn mt-6 w-full">Back to login</Link>
        </div>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link.">
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} required placeholder="you@example.com"
                 onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button className="btn w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        <p className="text-center text-sm text-slate-500">
          Remembered it? <Link to="/login" className="font-semibold text-navy hover:underline">Log in</Link>
        </p>
      </form>
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
