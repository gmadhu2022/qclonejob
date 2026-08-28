import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui";
import { useDialog } from "../components/Dialog";
import { Field } from "../components/fields";
import Logo from "../components/Logo";
import {
  IconUser, IconBriefcase, IconBuilding, IconShield, IconCheck, IconEye, IconSparkle,
} from "../components/icons";

const ROLE_HOME = { admin: "/admin", enterprise: "/enterprise", institute: "/institute", jobseeker: "/jobseeker" };

const ROLES = [
  { key: "jobseeker", label: "Job Seeker", icon: IconUser, tag: "Find work" },
  { key: "enterprise", label: "Recruiter", icon: IconBriefcase, tag: "Hire talent" },
  { key: "institute", label: "Institute", icon: IconBuilding, tag: "Place students" },
  { key: "admin", label: "Admin", icon: IconShield, tag: "Manage platform" },
];

const ROLE_COPY = {
  jobseeker: {
    title: "Welcome back",
    sub: "Pick up where you left off — your matches are waiting.",
    points: ["AI-built resume in six templates", "See every recruiter who viewed you", "Match scores on every job"],
  },
  enterprise: {
    title: "Hire faster",
    sub: "Your pipeline, candidates and messages in one place.",
    points: ["AI-drafted job postings", "Search resumes by skill and location", "Screen with AI candidate briefs"],
  },
  institute: {
    title: "Place your students",
    sub: "Bulk-onboard a batch in a single upload.",
    points: ["Excel upload builds resumes automatically", "Credentials emailed to every student", "Track student placement"],
  },
  admin: {
    title: "Platform control",
    sub: "Institutes, employers, seekers and reports.",
    points: ["Manage every account", "Platform-wide reporting", "Email diagnostics"],
  },
};

const DEFAULT_COPY = {
  title: "Welcome to QCloneJob",
  sub: "Qualification meets job — for every level of work in India.",
  points: ["Every job level, from daily wage to postgraduate", "AI that works for seekers and recruiters", "One account for web and mobile"],
};

export default function Login() {
  const { role } = useParams();
  const { login } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const copy = ROLE_COPY[role] || DEFAULT_COPY;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await login(email.trim(), password);
      navigate(data.must_change_password ? "/change-password" : (ROLE_HOME[data.role] || "/"), { replace: true });
    } catch (err) {
      const m = err.message || "";
      if (/awaiting admin approval/i.test(m)) {
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
            <h1 className="text-[26px] font-extrabold tracking-tight text-navy">
              {role ? `${ROLES.find((r) => r.key === role)?.label} sign in` : "Sign in"}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">Use your registered email as your User ID.</p>
          </div>

          {/* Role selector cards */}
          <div className="animate-in delay-1 mt-6 grid grid-cols-2 gap-2">
            {ROLES.map((r) => {
              const active = role === r.key;
              return (
                <Link key={r.key} to={`/login/${r.key}`}
                  className={`group flex items-center gap-2.5 rounded-xl border p-2.5 transition-all duration-150
                    ${active ? "border-navy bg-navy-50 shadow-sm"
                             : "border-slate-200 hover:border-navy-200 hover:bg-slate-50"}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors
                    ${active ? "bg-navy text-white" : "bg-slate-100 text-slate-500 group-hover:bg-navy-100 group-hover:text-navy"}`}>
                    <r.icon size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className={`block truncate text-[12.5px] font-semibold ${active ? "text-navy" : "text-slate-700"}`}>{r.label}</span>
                    <span className="block truncate text-[10.5px] text-slate-400">{r.tag}</span>
                  </span>
                </Link>
              );
            })}
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

          {(role === "jobseeker" || role === "enterprise" || role === "institute") && (
            <p className="animate-in delay-3 mt-6 text-center text-sm text-slate-500">
              New to Hire?{" "}
              <Link to={`/register/${role}`} className="font-semibold text-navy hover:underline">Create an account</Link>
            </p>
          )}

          <p className="mt-8 border-t border-slate-100 pt-5 text-center">
            <Link to="/" className="text-xs font-medium text-slate-400 hover:text-navy">← Back to home</Link>
          </p>
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
