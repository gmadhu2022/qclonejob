import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui";
import { useDialog } from "../components/Dialog";
import Logo from "../components/Logo";
import { IconCheck, IconUserPlus, IconUser, IconBriefcase, IconBuilding, IconMail, IconLock } from "../components/icons";
import { RegInput, RegPassword } from "../components/RegField";

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

/* The panel speaks to whoever is actually signing in, and every line is a
   feature that exists in that portal. Numbers are counts from the code:
   20 = jobseeker.TEMPLATE_META, 57 = job_taxonomy.SECTORS (industries),
   11 = models.APPLICATION_STATUSES. Update them together. */
const COPY = {
  jobseeker: {
    badge: "Job Seeker portal",
    title: "Your next job starts here",
    sub: "Sign in to apply, track every application and talk to recruiters.",
    points: [
      "A resume built from your profile — 20 designs to choose from",
      "Recommended jobs matched to your skills",
      "Track every application, from Applied to Hired",
      "See which recruiters viewed you, and chat with them",
    ],
    activity: ["Application update", "Electrician · now Shortlisted"],
    metrics: [["20", "Resume designs"], ["57", "Industries"], ["AI", "Cover letters & interview prep"]],
  },
  enterprise: {
    badge: "Recruiter portal",
    title: "Hire faster, hire better",
    sub: "Sign in to post jobs, search candidates and manage applicants.",
    points: [
      "Post jobs — and draft the description with AI",
      "Search candidates by skills, location, education and branch",
      "Move applicants through every stage, interviews to offer",
      "Promote your openings with banner ads",
    ],
    activity: ["New applicant", "Ravi Kumar applied · Electrician"],
    metrics: [["57", "Industries"], ["11", "Hiring stages"], ["AI", "Candidate summaries"]],
  },
  institute: {
    badge: "Institute portal",
    title: "Place your students",
    sub: "Sign in to onboard students, manage courses and track placements.",
    points: [
      "Bulk-upload students from Excel or CSV — logins emailed automatically",
      "Duplicates caught before anything is imported",
      "Manage campuses, courses, seats and strength",
      "Post jobs and ads that reach job seekers",
    ],
    activity: ["Data upload is successful", "4 students created · logins emailed"],
    metrics: [["1 sheet", "Whole batch onboarded"], ["Auto", "Student logins"], ["Live", "Placement stats"]],
  },
};

/* Login video slideshows — real people at work, moving. Each clip is a
   6-second, soundless, ~250 KB loop in public/login-video/ (Mixkit free
   licence), with a .jpg poster of its first frame so the panel is never
   empty while a clip loads. Add a slide = add <name>.mp4 + <name>.jpg and a
   line below. Order: skilled roles first, then everyday work. */
const SLIDES = {
  jobseeker: [
    ["seeker-nurse", "Nurse"], ["seeker-developer", "Software Developer"],
    ["seeker-electrician", "Electrician"], ["seeker-construction", "Construction & Site Work"],
    ["seeker-welder", "Welder & Fabricator"], ["seeker-cook", "Cook & Kitchen Staff"],
    ["seeker-cleaning", "Housekeeping & Cleaning"], ["seeker-warehouse", "Warehouse & Delivery"],
    ["seeker-retail", "Shop & Billing Staff"],
  ],
  enterprise: [
    ["recruiter-interview", "Interview candidates"], ["recruiter-desk", "Review applicants"],
    ["recruiter-shortlist", "Shortlist with your team"], ["recruiter-meeting", "Plan your hiring"],
    ["recruiter-handshake", "Make the hire"],
  ],
  institute: [
    ["institute-university", "Universities & colleges"], ["institute-medical", "Medical & nursing colleges"],
    ["institute-coaching", "Coaching centres"], ["institute-tuition", "Tuition & skill classes"],
    ["institute-lab", "Science & engineering labs"], ["institute-library", "Library & exam prep"],
    ["institute-campus", "Campus life"], ["institute-graduation", "Graduation & placement"],
  ],
};
/* Bump CLIP_VERSION whenever clips are replaced, so browsers (and Render's
   cache) fetch the new files instead of reusing an old or failed copy. */
const CLIP_VERSION = "2";
const CLIP = (name, ext) => `/login-video/${name}.${ext}?v=${CLIP_VERSION}`;

function PhotoSlides({ role }) {
  const list = SLIDES[role] || SLIDES.jobseeker;
  const [i, setI] = useState(0);
  const [failed, setFailed] = useState({});
  const refs = useRef([]);
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => { setI(0); }, [role]);

  // Play only the current clip; the others stay paused (and unloaded until their turn).
  useEffect(() => {
    refs.current.forEach((v, k) => {
      if (!v) return;
      if (k === i && !reduce) { v.currentTime = 0; v.play().catch(() => {}); }
      else v.pause();
    });
    // Advance when the clip ends; the timer is a fallback if a clip can't play.
    const t = setTimeout(() => setI((n) => (n + 1) % list.length), 6200);
    return () => clearTimeout(t);
  }, [i, role, list.length, reduce]);

  const cur = list[i % list.length];
  return (
    <>
      {/* still image of the current clip underneath — visible instantly and
          if the video can't play */}
      <img src={CLIP(cur[0], "jpg")} alt="" aria-hidden="true" draggable="false"
           className="absolute inset-0 h-full w-full object-cover" />
      {list.map(([name], k) => failed[name] ? null : (
        <video key={`${role}-${name}`} ref={(el) => { refs.current[k] = el; }}
               className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-out
                           ${k === i ? "opacity-100" : "opacity-0"}`}
               poster={CLIP(name, "jpg")} muted playsInline preload={k === i || k === (i + 1) % list.length ? "auto" : "none"}
               onEnded={() => setI((n) => (n + 1) % list.length)} aria-hidden="true"
               onError={() => setFailed((f) => ({ ...f, [name]: true }))}>
          <source src={CLIP(name, "mp4")} type="video/mp4" onError={() => setFailed((f) => ({ ...f, [name]: true }))} />
        </video>
      ))}
      <div className="absolute right-6 top-24 z-10 flex flex-col items-end gap-2">
        <span key={`${role}-${i}`} className="login-chip inline-flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-[12.5px] font-semibold text-slate-800 shadow-lg backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brandgreen" />
          {role === "jobseeker" ? "Jobs for: " : ""}{cur[1]}
        </span>
        <span className="flex gap-1">
          {list.map((_, k) => (
            <button key={k} type="button" aria-label={`Show ${list[k][1]}`} onClick={() => setI(k)}
                    className={`h-1.5 rounded-full transition-all duration-500 ${k === i ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"}`} />
          ))}
        </span>
      </div>
    </>
  );
}

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

  const RoleIcon = { jobseeker: IconUser, enterprise: IconBriefcase, institute: IconBuilding };
  const roleIdx = Math.max(0, ROLES.findIndex((r) => r.key === role));
  const QUOTE = {
    jobseeker: ["Find work that fits you.", "From daily-wage to post-graduate roles, across India."],
    enterprise: ["Hire the right people, faster.", "Search resumes by skill and city, and manage every applicant."],
    institute: ["Put every student in front of employers.", "Upload one sheet — every student gets a profile and login."],
  }[role];

  return (
    <div className="grid min-h-screen bg-white lg:h-screen lg:grid-cols-[1.1fr_1fr] lg:overflow-hidden">
      {/* ---------------- Photo panel ---------------- */}
      <div className="relative hidden overflow-hidden lg:block">
        <PhotoSlides role={role} />
        {/* readability: dark brand gradient from the bottom, light tint on top */}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#0f0c3d] via-[#1e1b4b]/55 to-[#1e1b4b]/10" />

        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <div className="flex items-center justify-between">
            <Link to="/"><Logo className="h-9" variant="pill" /></Link>
            <Link to="/" className="rounded-full bg-black/25 px-3 py-1.5 text-[11px] font-semibold text-white/90 ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-black/40">
              ← Back to site
            </Link>
          </div>

          <div key={role}>
            <span className="animate-in inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-white ring-1 ring-white/25 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-brandgreen-400" /> {copy.badge}
            </span>
            <h2 className="animate-in delay-1 mt-4 max-w-lg font-heading text-[40px] font-bold leading-[1.08] tracking-tight drop-shadow-sm">
              {QUOTE[0]}
            </h2>
            <p className="animate-in delay-2 mt-3 max-w-md text-[15px] leading-relaxed text-white/80">{QUOTE[1]}</p>
            <div className="animate-in delay-3 mt-6 flex flex-wrap gap-2">
              {copy.metrics.map(([v, l]) => (
                <span key={l} className="rounded-xl bg-white/12 px-3 py-2 ring-1 ring-white/20 backdrop-blur-md">
                  <span className="block font-heading text-[18px] font-bold leading-none">{v}</span>
                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-white/70">{l}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- Form panel ---------------- */}
      <div className="relative flex min-w-0 items-center justify-center px-5 py-8 sm:px-12 lg:overflow-y-auto">
        <div className="w-full min-w-0 max-w-[380px]">
          <Link to="/" className="mb-6 flex justify-center lg:hidden"><Logo className="h-10" /></Link>

          <div className="animate-in">
            <h1 className="font-heading text-[30px] font-bold leading-tight tracking-tight text-slate-900">Sign in</h1>
            <p className="mt-1 text-sm text-slate-500">Welcome back — choose your portal to continue.</p>
          </div>

          <div role="radiogroup" aria-label="Account type"
               className="animate-in delay-1 relative mt-6 grid grid-cols-3 border-b border-slate-200">
            <span aria-hidden="true"
                  className="absolute -bottom-px h-[3px] rounded-full bg-navy transition-transform duration-300 ease-out"
                  style={{ left: 0, width: "calc(100% / 3)", transform: `translateX(${roleIdx * 100}%)` }} />
            {ROLES.map((r) => {
              const active = role === r.key;
              const Ic = RoleIcon[r.key];
              return (
                <button key={r.key} type="button" role="radio" aria-checked={active}
                        onClick={() => pickRole(r.key)}
                        className={`flex items-center justify-center gap-1.5 pb-3 pt-1 text-[13px] font-semibold transition-colors
                          ${active ? "text-navy" : "text-slate-400 hover:text-slate-600"}`}>
                  <Ic size={15} /> {r.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={submit} className="animate-in delay-2 mt-6 space-y-4">
            <RegInput label="Email (User ID)" icon={IconMail} type="email" value={email} onChange={setEmail}
                      required autoComplete="username" placeholder="name@company.com"
                      validate={(v) => (/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(v.trim()) ? null : "Invalid email format")} />
            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[13px] font-semibold text-slate-800">Password <span className="text-red-500">*</span></span>
                <Link to="/forgot-password" className="text-xs font-semibold text-navy hover:underline">Forgot password?</Link>
              </div>
              <RegPassword value={password} onChange={setPassword} required placeholder="Enter your password"
                           autoComplete="current-password" show={showPw} onToggle={() => setShowPw((v) => !v)} />
            </div>
            <button disabled={busy}
                    className="auth-btn group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-navy py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-indigo-700 disabled:opacity-70">
              {busy ? "Signing in…" : (
                <>Sign in
                  <svg className="transition-transform group-hover:translate-x-1" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </>
              )}
            </button>
          </form>

          <div className="animate-in delay-3 mt-6 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> New to QCloneJob? <span className="h-px flex-1 bg-slate-200" />
          </div>
          <Link to={`/register/${role}`}
                className="animate-in delay-3 mt-4 flex w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-navy py-3 text-[14px] font-semibold text-navy transition-colors hover:bg-navy hover:text-white">
            <IconUserPlus size={16} /> Join now — it's free
          </Link>

          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <IconLock size={11} /> Passwords are stored encrypted and never shared.
          </p>
        </div>
      </div>
    </div>
  );
}
