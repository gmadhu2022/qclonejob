import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui";
import { useDialog } from "../components/Dialog";
import { Field } from "../components/fields";
import Logo from "../components/Logo";
import { IconCheck, IconEye, IconSparkle, IconUserPlus } from "../components/icons";

const ROLE_HOME = { admin: "/admin", enterprise: "/enterprise", institute: "/institute", jobseeker: "/jobseeker" };

/* Three portals, and only three. Admin is deliberately NOT here: an admin
   signs in through whichever of these they like and the server lets them
   through, so there is no fourth button advertising that an admin portal
   exists to anyone who happens to look at the login page. */
const ROLES = [
  { key: "jobseeker",  label: "Job Seeker" },
  { key: "enterprise", label: "Recruiter" },
  { key: "institute",  label: "Institute" },
];

/* The panel speaks to whoever is actually signing in. One generic blurb for
   three different audiences says nothing useful to any of them. */
const COPY = {
  jobseeker: {
    title: "Your next job starts here",
    sub: "Sign in to apply, track every application and see who viewed you.",
    points: [
      "Apply with a resume built for you",
      "Track every application from applied to hired",
      "See which recruiters viewed your profile",
      "Get matched to jobs that fit your skills",
    ],
  },
  enterprise: {
    title: "Hire faster, hire better",
    sub: "Sign in to post roles and search candidates.",
    points: [
      "Post a job and reach matching candidates instantly",
      "Search resumes by skill, location and education",
      "Manage every applicant in one inbox",
      "Advertise openings across the platform",
    ],
  },
  institute: {
    title: "Place your students",
    sub: "Sign in to manage courses, students and placements.",
    points: [
      "Upload your students in one spreadsheet",
      "Track course-wise seats, strength and placements",
      "Advertise admissions to job seekers",
      "Keep every campus and course in one place",
    ],
  },
};

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const dialog = useDialog();
  const navigate = useNavigate();


  /* Remembered, because almost nobody changes which portal they belong to.
     An institute that has to re-pick "Institute" on every visit will
     eventually mis-click and be told their credentials are wrong. */
  /* ?as= wins over the remembered choice: the header menu's "Login → Institute"
     is an explicit instruction for THIS visit, and silently overriding it with
     last time's selection would mean the link they clicked did nothing. */
  const [role, setRole] = useState(() => {
    const asked = new URLSearchParams(window.location.search).get("as");
    const valid = ["jobseeker", "enterprise", "institute"];
    if (asked && valid.includes(asked)) return asked;
    return localStorage.getItem("hire_login_role") || "jobseeker";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const copy = COPY[role] || COPY.jobseeker;

  const pickRole = (key) => {
    setRole(key);
    localStorage.setItem("hire_login_role", key);
  };


  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      /* The chosen portal is sent as expected_role. The server refuses
         credentials belonging to a different portal — and lets ADMIN through
         whichever one is selected, so an admin never has to hunt for a
         special sign-in page. */
      const data = await login(email.trim(), password, role);
      navigate(data.must_change_password ? "/change-password" : (ROLE_HOME[data.role] || "/"), { replace: true });
    } catch (err) {
      const m = err.message || "";
      if (/awaiting admin approval/i.test(m) === false && /credentials\. Please use the/i.test(m)) {
        // Can no longer happen now that no role is sent, but a stale server
        // build could still return it — say something useful rather than
        // pointing at a role picker that isn't there any more.
        dialog({ tone: "error", title: "Sign-in failed", message: m, confirmLabel: "Close" });
      } else if (/You selected the .* login, but these credentials belong to/i.test(m)) {
        /* The single most common sign-in mistake once there are three portals.
           It is NOT a credentials problem, so it must not look like one —
           otherwise people "fix" it by resetting a perfectly good password.
           The dialog offers the switch as an action rather than asking them
           to find the right button themselves. */
        /* Read the ACTUAL account type out of the message rather than
           searching it for any known label. A plain `find` matches whichever
           label appears first in the sentence — and the first one is the
           portal they already chose, so "selected Job Seeker, actually
           Institute" would have offered to switch them to Job Seeker, the
           very thing that just failed. */
        const actual = m.match(/belong to an? (.+?) account/i)?.[1]?.trim();
        const target = ROLES.find((r) => r.label.toLowerCase() === (actual || "").toLowerCase());
        dialog({
          tone: "error",
          title: "Wrong login selected",
          message: m,
          note: "Your email and password are fine — only the account type above is wrong.",
          noteTone: "info",
          ...(target
            ? { confirmLabel: `Switch to ${target.label}`,
                onConfirm: () => pickRole(target.key) }
            : { confirmLabel: "Close" }),
        });
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

          {/* Portal picker. Segmented rather than a dropdown so all three are
              visible at once — a closed <select> hides the fact that you are
              about to sign in as the wrong one. */}
          <div className="animate-in delay-1 mt-6">
            <span className="label">I'm signing in as</span>
            <div role="radiogroup" aria-label="Account type"
                 className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
              {ROLES.map((r) => {
                const active = role === r.key;
                return (
                  <button key={r.key} type="button" role="radio" aria-checked={active}
                          onClick={() => pickRole(r.key)}
                          className={`rounded-lg px-2 py-2 text-[12.5px] font-semibold transition-all
                            ${active ? "bg-white text-navy shadow-card"
                                     : "text-slate-500 hover:text-navy"}`}>
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={submit} className="animate-in delay-2 mt-4 space-y-3.5">
            <Field label="Email (User ID)" type="email" value={email} onChange={setEmail} required autoComplete="username"
                   placeholder="e.g. admin@institute.edu"
                   hint="Your official email address is your User ID on every portal." />
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
