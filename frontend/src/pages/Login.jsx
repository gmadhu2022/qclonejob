import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui";
import { useDialog } from "../components/Dialog";
import { Field } from "../components/fields";
import Logo from "../components/Logo";
import { IconCheck, IconEye, IconSparkle, IconUserPlus } from "../components/icons";

const ROLE_HOME = { admin: "/admin", enterprise: "/enterprise", institute: "/institute", jobseeker: "/jobseeker" };

const DEFAULT_COPY = {
  badge: "One account, every opportunity",
  title: "Welcome back",
  sub: "Sign in once — we'll take you to your workspace.",
  points: [
    "Apply to jobs with a resume built for you",
    "Track every application from applied to hired",
    "See which recruiters viewed your profile",
    "Employers and institutes: post roles and place students",
  ],
};

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const navigate = useNavigate();


  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  // One page for everyone, so one set of copy.
  const copy = DEFAULT_COPY;


  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      /* No expected_role. One sign-in box for everyone: the server
         authenticates the credentials and tells us which portal they belong
         to, and we route there. Asking people to pick their own account type
         before signing in only creates a way to get it wrong. */
      const data = await login(email.trim(), password);
      navigate(data.must_change_password ? "/change-password" : (ROLE_HOME[data.role] || "/"), { replace: true });
    } catch (err) {
      const m = err.message || "";
      if (/awaiting admin approval/i.test(m) === false && /credentials\. Please use the/i.test(m)) {
        // Can no longer happen now that no role is sent, but a stale server
        // build could still return it — say something useful rather than
        // pointing at a role picker that isn't there any more.
        dialog({ tone: "error", title: "Sign-in failed", message: m, confirmLabel: "Close" });
      } else if (/awaiting admin approval/i.test(m)) {
        dialog({ tone: "info", title: "Account pending approval", message: m,
                 confirmLabel: "Got it" });
      } else if (/not approved/i.test(m)) {
        dialog({ tone: "error", title: "Registration not approved", message: m,
                 confirmLabel: "Close" });
      } else if (/disabled/i.test(m)) {
        dialog({ tone: "error", title: "Account disabled", message: m });
      } else {
        dialog({
          tone: "error",
          title: /password/i.test(m) && !/email/i.test(m) ? "Incorrect password" : "Sign-in failed",
          message: m,
          note: "Check the email address is spelled correctly and that Caps Lock is off.",
          secondary: { label: "Forgot password?", onClick: () => navigate("/forgot-password") },
          confirmLabel: "Try again",
        });
      }
    }
    finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* ---------------- Brand panel ---------------- */}
      <div className="relative hidden overflow-hidden bg-navy-900 lg:flex lg:flex-col lg:justify-between lg:p-14">
        {/* aurora wash */}
        <div className="pointer-events-none absolute -left-1/4 -top-1/4 h-[560px] w-[560px] rounded-full bg-brandgreen/25 blur-3xl aurora-blob" />
        <div className="pointer-events-none absolute -bottom-1/4 -right-1/4 h-[600px] w-[600px] rounded-full bg-navy-600/50 blur-3xl aurora-blob-2" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
             style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

        <div className="relative animate-in">
          <Link to="/"><Logo className="h-12" variant="pill" /></Link>
        </div>

        <div className="relative">
          <span className="animate-in delay-1 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brandgreen-400 glass">
            <IconSparkle size={12} /> AI-powered hiring
          </span>
          <h2 className="animate-in delay-2 mt-5 max-w-lg text-[42px] font-extrabold leading-[1.1] tracking-tight text-white">
            {copy.title}
          </h2>
          <p className="animate-in delay-3 mt-3 max-w-md text-[15px] leading-relaxed text-navy-100">{copy.sub}</p>

          <ul className="animate-in delay-4 mt-8 space-y-3.5">
            {copy.points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[14px] text-white/85">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brandgreen text-white">
                  <IconCheck size={12} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex gap-10 border-t border-white/10 pt-7">
          <Metric value="6" label="Job categories" />
          <Metric value="4" label="Portals" />
          <Metric value="AI" label="Built in" />
        </div>
      </div>

      {/* ---------------- Form panel ---------------- */}
      <div className="flex items-center justify-center bg-white px-6 py-10">
        <div className="w-full max-w-[380px]">
          <Link to="/" className="mb-8 flex justify-center lg:hidden"><Logo className="h-10" /></Link>

          <div className="animate-in">
            <h1 className="text-[26px] font-extrabold tracking-tight text-navy">Login</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Enter your email and password — we'll take you to the right place.
            </p>
          </div>

          <form onSubmit={submit} className="animate-in delay-2 mt-6 space-y-3.5">
            <Field label="Email (User ID)" type="email" value={email} onChange={setEmail} required autoComplete="username" />
            <div>
              <Field label="Password" type={showPw ? "text" : "password"} value={password}
                     onChange={setPassword} required autoComplete="current-password" />
              <div className="mt-1.5 flex items-center justify-between">
                <button type="button" onClick={() => setShowPw((v) => !v)}
                        className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-navy">
                  <IconEye size={13} /> {showPw ? "Hide password" : "Show password"}
                </button>
                <Link to="/forgot-password" className="text-xs font-medium text-navy hover:underline">Forgot password?</Link>
              </div>
            </div>
            <button className="btn w-full !rounded-xl !py-3 !text-[15px] shadow-lg shadow-navy/20" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="animate-in delay-3 mt-5">
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200" /></div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">or</span>
              </div>
            </div>

            <Link to="/register"
                  className="flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl
                             border-2 border-navy bg-navy/[0.03] px-3 text-sm font-bold text-navy transition-all
                             hover:-translate-y-0.5 hover:bg-navy hover:text-white hover:shadow-cardhover">
              <IconUserPlus size={16} /> Register for free
            </Link>

            <p className="mt-3 text-center text-xs text-slate-400">
              New to QCloneJob? Registering takes about a minute — you'll choose whether
              you're a job seeker, an employer or an institute.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

function Metric({ value, label }) {
  return (
    <div>
      <div className="text-[26px] font-extrabold leading-none text-white">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-navy-200">{label}</div>
    </div>
  );
}
