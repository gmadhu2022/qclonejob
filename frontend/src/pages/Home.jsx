import { useState } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import logoFull from "../assets/logo.png";
import { IconUser, IconBriefcase, IconBuilding, IconShield, IconSearch, IconUpload, IconChat, IconEye } from "../components/icons";

// The five pillars shown under the hero.
// "Unskilled" labels a person by what they lack, so the default avoids it.
// Swap the second line for whichever fits your market:
//   "Skilled & Entry-Level Workers"   (default — respectful, clear)
//   "Skilled & General Workers"
//   "Trades & Daily-Wage Workers"
//   "Blue-Collar Jobs"                (industry-standard shorthand)
//   "Workers & Tradespeople"
//   "Skilled & Semi-Skilled Workers"
// const PILLARS = [
//   { name: "Educated Professionals", color: "text-navy" },
//   { name: "Skilled & Entry-Level Workers", color: "text-brandgreen-600" },
//   { name: "Find Jobs Easily", color: "text-navy" },
//   { name: "A to Z Jobs", color: "text-navy" },
//   { name: "Connect. Grow. Succeed.", color: "text-brandgreen-600" },
// ];

const LOGIN_LINKS = [
  { to: "/login/jobseeker", label: "Job Seeker", icon: IconUser },
  { to: "/login/enterprise", label: "Recruiter", icon: IconBriefcase },
  { to: "/login/institute", label: "Institute", icon: IconBuilding },
  { to: "/login/admin", label: "Admin", icon: IconShield },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-white">
      {/* Header with login dropdown (no logins in the middle) */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Logo className="h-10" />
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link to="/about" className="btn-ghost">About</Link>
            <Link to="/contact" className="btn-ghost">Contact</Link>
            <div className="relative">
              <button className="btn" onClick={() => setMenuOpen((o) => !o)}>Log in</button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-cardhover">
                    {LOGIN_LINKS.map((l) => (
                      <Link key={l.to} to={l.to} className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-navy-50 hover:text-navy">
                        <l.icon size={17} /> {l.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-navy-50/60 to-white" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2">
          <div>
            <span className="badge bg-brandgreen-50 text-brandgreen-600">Advanced job searching platform</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-navy sm:text-5xl">
              A to Z Jobs.<br />One Platform.<br /><span className="text-brandgreen-600">Unlimited Opportunities.</span>
            </h1>
            <p className="mt-4 max-w-md text-lg text-slate-600">
              From daily-wage worker to post-graduate roles — one place for every job seeker,
              employer and institute across India.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/register/jobseeker" className="btn-green">Find a job</Link>
              <Link to="/register/enterprise" className="btn-outline">Hire talent</Link>
            </div>
            <div className="mt-8 flex items-center gap-x-2 gap-y-1 overflow-x-auto whitespace-nowrap pb-1
                            text-[12px] font-semibold sm:gap-x-3 sm:text-[13px]">
              {/* {PILLARS.map((c, i) => (
                <span key={c.name} className="flex shrink-0 items-center gap-2">
                  {i > 0 && <span className="h-1 w-1 rounded-full bg-slate-300" />}
                  <span className={c.color}>{c.name}</span>
                </span>
              ))} */}
            </div>
          </div>
          <div className="flex justify-center">
            <img src={logoFull} alt="QCloneJob" className="w-full max-w-md drop-shadow-sm" />
          </div>
        </div>
      </section>

      {/* Feature strip */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-center text-2xl font-bold text-navy">Everything you need, in one platform</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon={IconUpload} title="Bulk onboarding"
            desc="Institutes upload a spreadsheet and resumes are built and credentialed automatically." />
          <Feature icon={IconSearch} title="Smart search"
            desc="Recruiters search resumes by skills, location and education; seekers find matching jobs." />
          <Feature icon={IconEye} title="Know who's watching"
            desc="See exactly which companies viewed your profile and track every application's status live." />
          <Feature icon={IconChat} title="Chat directly"
            desc="Seekers and recruiters message each other in real time — with block controls for safety." />
        </div>
      </section>

      {/* Audience cards (informational, not login) */}
      <section className="bg-slate-50 py-14">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-5 md:grid-cols-3">
            <Audience icon={IconUser} title="Job Seekers"
              points={["Auto-built resume, 3 templates", "Apply & track status live", "See recruiter views & chat"]}
              cta={{ to: "/register/jobseeker", label: "Register free" }} login="/login/jobseeker" />
            <Audience icon={IconBriefcase} title="Recruiters"
              points={["Search & download resumes", "Post jobs and banners", "Manage applications & chat"]}
              cta={{ to: "/register/enterprise", label: "Register" }} login="/login/enterprise" />
            <Audience icon={IconBuilding} title="Institutes"
              points={["Bulk-upload student data", "Auto-create student logins", "Search students & post jobs"]}
              login="/login/institute" />
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 bg-white px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <Logo className="h-8" />
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} QCloneJob — Qualification Meets Job.</p>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }) {
  return (
    <div className="card-hover">
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-navy-50 text-navy"><Icon size={22} /></div>
      <h3 className="mt-4 font-bold text-slate-800">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-500">{desc}</p>
    </div>
  );
}

function Audience({ icon: Icon, title, points, cta, login }) {
  return (
    <div className="card-hover flex flex-col">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brandgreen-50 text-brandgreen-600"><Icon size={22} /></div>
        <h3 className="text-lg font-bold text-navy">{title}</h3>
      </div>
      <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brandgreen" />{p}</li>
        ))}
      </ul>
      <div className="mt-5 flex gap-2">
        {cta && <Link to={cta.to} className="btn-green flex-1">{cta.label}</Link>}
        <Link to={login} className={cta ? "btn-outline flex-1" : "btn flex-1"}>Log in</Link>
      </div>
    </div>
  );
}
