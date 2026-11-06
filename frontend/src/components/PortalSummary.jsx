import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { IconUser, IconBriefcase, IconBuilding, IconCheck, IconSearch } from "./icons";

/* Closing section of the home page: a Register-now card per kind of user.

   Deliberately short. The hero and the "How it works" story already explain
   the features, so nothing here repeats them — this section's only job is to
   turn interest into a registration. */

const ROLES = [
  {
    key: "jobseeker", label: "Job Seekers", Icon: IconUser, badge: "Free",
    pitch: "Find work — daily-wage to post-graduate.",
    perks: ["Resume built for you", "Apply & track live", "Chat with recruiters"],
    cta: "Register free",
    // literal class strings so Tailwind keeps them
    art: "from-brandgreen-400 to-emerald-600", ring: "group-hover:ring-brandgreen-400",
    btn: "from-brandgreen to-emerald-600", Art: SeekerArt,
  },
  {
    key: "enterprise", label: "Recruiters", Icon: IconBriefcase,
    pitch: "Hire the right people, faster.",
    perks: ["Search & download resumes", "Post jobs and banners", "Manage applications"],
    cta: "Register as recruiter",
    art: "from-indigo-500 to-navy", ring: "group-hover:ring-navy-300",
    btn: "from-indigo-500 to-navy", Art: RecruiterArt,
  },
  {
    key: "institute", label: "Institutes", Icon: IconBuilding,
    pitch: "Put every student in front of employers.",
    perks: ["Bulk-upload students", "Auto-create logins", "Post jobs & ads"],
    cta: "Register institute",
    art: "from-cyan-500 to-sky-700", ring: "group-hover:ring-sky-300",
    btn: "from-cyan-500 to-sky-700", Art: InstituteArt,
  },
];

function useInView(ref) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } },
                                        { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return seen;
}

/* Tilt a card a few degrees toward the cursor while hovered. */
function tilt(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  el.style.setProperty("--rx", `${y * -6}deg`);
  el.style.setProperty("--ry", `${x * 8}deg`);
}
function untilt(e) {
  e.currentTarget.style.setProperty("--rx", "0deg");
  e.currentTarget.style.setProperty("--ry", "0deg");
}

export default function PortalSummary() {
  const ref = useRef(null);
  const seen = useInView(ref);

  return (
    <section ref={ref} className={`join bg-white px-6 py-20 ${seen ? "join-in" : ""}`} aria-labelledby="join-title">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 id="join-title" className="join-item text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Register now on <span className="bg-gradient-to-r from-brandgreen-600 to-navy bg-clip-text text-transparent">QCloneJob</span>
          </h2>
          <span aria-hidden="true" className="join-item mx-auto mt-4 block h-1 w-16 rounded-full bg-gradient-to-r from-brandgreen to-navy"
                style={{ "--d": "100ms" }} />
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {ROLES.map((r, i) => (
            <div key={r.key} className="join-item" style={{ "--d": `${180 + i * 120}ms` }}>
              <div onMouseMove={tilt} onMouseLeave={untilt}
                   className={`join-card group relative flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-[0_10px_40px_-12px_rgba(15,23,42,0.18)]
                               ring-1 ring-slate-200 transition-shadow duration-300 hover:shadow-[0_30px_60px_-15px_rgba(15,23,42,0.3)] ${r.ring}`}>
                {/* Illustration */}
                <div className={`relative h-44 overflow-hidden bg-gradient-to-br ${r.art}`}>
                  <div aria-hidden="true" className="join-dots absolute inset-0 opacity-30" />
                  <r.Art />
                  {r.badge && (
                    <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-brandgreen-600 shadow">
                      {r.badge}
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-center gap-3">
                    <span className={`-mt-12 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${r.art} text-white shadow-lg ring-4 ring-white`}>
                      <r.Icon size={24} />
                    </span>
                    <h3 className="text-lg font-extrabold text-slate-900">{r.label}</h3>
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-700">{r.pitch}</p>
                  <ul className="mt-3 flex-1 space-y-2">
                    {r.perks.map((p) => (
                      <li key={p} className="flex items-center gap-2 text-sm text-slate-500">
                        <IconCheck size={15} className="shrink-0 text-brandgreen-600" /> {p}
                      </li>
                    ))}
                  </ul>
                  <Link to={`/register/${r.key}`}
                        className={`join-cta mt-6 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${r.btn}
                                    px-4 py-3 text-sm font-bold text-white shadow-md transition-transform hover:-translate-y-0.5`}>
                    {r.cta}
                    <svg className="transition-transform duration-300 group-hover:translate-x-1" width="16" height="16" viewBox="0 0 24 24"
                         fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                  <p className="mt-3 text-center text-xs text-slate-500">
                    Already registered?{" "}
                    <Link to={`/login?as=${r.key}`} className="font-semibold text-navy hover:underline">Log in</Link>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Card illustrations: sample screens for each login ----------
   Names and companies are illustrative. Each one cycles through a few
   examples so the card keeps changing while it is on screen. */

function useCycle(n, ms) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % n), ms);
    return () => clearInterval(t);
  }, [n, ms]);
  return i;
}

const SEEKER_JOBS = [
  { title: "Electrician", co: "BuildRight Infra", city: "Hyderabad" },
  { title: "Staff Nurse", co: "Sunrise Hospitals", city: "Chennai" },
  { title: "Java Developer", co: "Nimbus Soft", city: "Bengaluru" },
];

function SeekerArt() {
  const i = useCycle(SEEKER_JOBS.length, 3500);
  const j = SEEKER_JOBS[i];
  return (
    <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
      <div className="join-float relative mt-2 w-52 rounded-xl bg-white p-2.5 text-left shadow-xl">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brandgreen text-[10px] font-bold text-white">RK</span>
          <span className="min-w-0">
            <span className="block text-[11px] font-bold text-slate-800">Ravi Kumar</span>
            <span className="block text-[9px] text-slate-400">ITI Electrician · Hyderabad</span>
          </span>
        </div>
        <div key={i} className="join-swap mt-2.5 rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
          <span className="block text-[9px] font-semibold uppercase tracking-wide text-slate-400">Recommended job</span>
          <span className="block text-[11px] font-bold text-slate-800">{j.title}</span>
          <span className="block text-[9px] text-slate-500">{j.co} · {j.city}</span>
        </div>
        <span key={`a${i}`} className="join-pop absolute -bottom-3 -right-5 flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-brandgreen-600 shadow-lg">
          <IconCheck size={11} /> Applied
        </span>
      </div>
    </div>
  );
}

const SEARCHES = [
  { q: "Electrician in Hyderabad", people: [["Ravi Kumar", "ITI · 2 yrs"], ["Imran Shaikh", "Diploma · 1 yr"]] },
  { q: "Nurse in Chennai", people: [["Anjali Nair", "B.Sc Nursing · 3 yrs"], ["Divya R", "GNM · 1 yr"]] },
  { q: "Java developer, Bengaluru", people: [["Priya Sharma", "B.Tech CSE · 2 yrs"], ["Rahul Jain", "MCA · Fresher"]] },
];

function RecruiterArt() {
  const i = useCycle(SEARCHES.length, 3600);
  const s = SEARCHES[i];
  return (
    <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
      <div className="flex w-56 items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-xl">
        <IconSearch size={12} className="join-scan shrink-0 text-navy" />
        <span key={i} className="join-typing overflow-hidden whitespace-nowrap text-[10px] font-semibold text-slate-700"
              style={{ "--chars": s.q.length }}>{s.q}</span>
      </div>
      <div key={`r${i}`} className="w-56 space-y-1">
        {s.people.map(([n, d], k) => (
          <div key={n} className="join-result flex items-center gap-2 rounded-lg bg-white/95 px-2 py-1 shadow-lg"
               style={{ animationDelay: `${0.9 + k * 0.2}s` }}>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white ${k ? "bg-indigo-400" : "bg-navy"}`}>
              {n.split(" ").map((w) => w[0]).join("")}
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[10px] font-bold text-slate-800">{n}</span>
              <span className="block truncate text-[8px] text-slate-400">{d}</span>
            </span>
            {k === 0 && <span className="rounded-full bg-brandgreen px-1.5 py-0.5 text-[8px] font-bold text-white">Top match</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

const SHEET = [["Ravi Kumar", "ITI"], ["Priya Sharma", "B.Tech"], ["Arjun Mehta", "Diploma"], ["Sneha Patil", "MBA"]];

function InstituteArt() {
  return (
    <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center gap-3 px-4">
      <div className="w-32 overflow-hidden rounded-lg bg-white text-left shadow-xl">
        <span className="block bg-[#1d6f42] px-2 py-1 text-[8px] font-bold text-white">students.xlsx</span>
        {SHEET.map(([n, c], i) => (
          <span key={n} className="join-row flex justify-between gap-1 border-b border-slate-100 px-2 py-[3px] text-[8px]"
                style={{ animationDelay: `${i * 0.35}s` }}>
            <span className="truncate font-semibold text-slate-700">{n}</span>
            <span className="text-slate-400">{c}</span>
          </span>
        ))}
      </div>
      <svg className="join-arrow shrink-0 text-white" width="22" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M1 7h22M17 1l6 6-6 6" />
      </svg>
      <div className="w-28 space-y-1">
        {SHEET.slice(0, 3).map(([n], i) => (
          <span key={n} className="join-avatar flex items-center gap-1.5 rounded-lg bg-white px-1.5 py-1 text-left shadow-lg"
                style={{ animationDelay: `${0.2 + i * 0.35}s` }}>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[7px] font-bold text-white">
              {n.split(" ").map((w) => w[0]).join("")}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[8px] font-bold text-slate-800">{n}</span>
              <span className="flex items-center gap-0.5 text-[7px] font-semibold text-brandgreen-600"><IconCheck size={8} /> Login sent</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
