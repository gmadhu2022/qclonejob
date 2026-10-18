import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, mediaUrl } from "../lib/api";
import Logo from "../components/Logo";
import logoFull from "../assets/logo.png";
import { IconUser, IconBriefcase, IconBuilding, IconSearch, IconUpload, IconChat, IconEye } from "../components/icons";

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

export default function Home() {
  const [partners, setPartners] = useState({ institutes: [], recruiters: [] });
  useEffect(() => {
    api.get("/api/public/partners", { auth: false })
       .then(setPartners)
       .catch(() => {});     // a missing strip must never break the home page
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header with login dropdown (no logins in the middle) */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Logo className="h-10" />
          <nav className="flex items-center gap-0.5 sm:gap-1">
            <Link to="/about" className="btn-ghost">About us</Link>

            {/* SERVICES and LOGIN are menus because each has three
                destinations. Flattening them would put seven links across the
                header and force the whole bar to wrap on a laptop. */}
            <NavMenu label="Services" items={[
              { to: "/services/promotions",  label: "Promotions" },
              { to: "/services/recruitment", label: "Recruitment Services" },
              { to: "/services/job-search",  label: "Job Search" },
            ]} />

            <NavMenu label="Login" items={[
              /* Each one opens the single login page with that portal
                 preselected, so the choice made here is the choice that
                 arrives — rather than asking the same question twice. */
              { to: "/login?as=institute",  label: "Institute" },
              { to: "/login?as=enterprise", label: "Recruiter" },
              { to: "/login?as=jobseeker",  label: "Job Seeker" },
            ]} />

            <Link to="/contact" className="btn-ghost">Contact us</Link>
            <Link to="/register" className="btn ml-1">Register</Link>
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

      <PartnerStrip title="Our Institutional Partners" rows={partners.institutes}
                    emptyNote="Institutes that register will appear here automatically." />
      <PartnerStrip title="Our Hiring Partners" rows={partners.recruiters}
                    emptyNote="Employers that register will appear here automatically." />

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
              cta={{ to: "/register/jobseeker", label: "Register free" }} login="/login" />
            <Audience icon={IconBriefcase} title="Recruiters"
              points={["Search & download resumes", "Post jobs and banners", "Manage applications & chat"]}
              cta={{ to: "/register/enterprise", label: "Register" }} login="/login" />
            <Audience icon={IconBuilding} title="Institutes"
              points={["Bulk-upload student data", "Auto-create student logins", "Search students & post jobs"]}
              login="/login" />
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

/* A header dropdown. Opens on hover for a mouse AND on click, because hover
   alone is unusable on a touch screen — the tap registers as a hover, the menu
   opens and the first tap is swallowed. Closes on Escape and on outside click. */
function NavMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative"
         onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="btn-ghost" aria-haspopup="menu" aria-expanded={open}
              onClick={() => setOpen((v) => !v)}>
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden
             className={`ml-0.5 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div role="menu"
             className="absolute right-0 top-full z-40 mt-1 min-w-[200px] overflow-hidden rounded-xl
                        border border-slate-200 bg-white py-1 shadow-cardhover">
          {items.map((it) => (
            <Link key={it.to} to={it.to} role="menuitem" onClick={() => setOpen(false)}
                  className="block px-4 py-2.5 text-sm font-medium text-slate-600
                             transition-colors hover:bg-navy-50 hover:text-navy">
              {it.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* The two partner strips.

   Names and logos come from the database, never from a hardcoded list: a strip
   of invented partners is a claim the product cannot back up, and it would
   still be showing the same fake names a year after real ones signed up.

   The strip hides itself entirely when there is nothing to show. An empty
   marquee animates a blank bar, which looks broken; a section that simply
   isn't there looks like a page that hasn't reached that stage yet. */
function PartnerStrip({ title, rows, emptyNote }) {
  if (!rows?.length) {
    return emptyNote ? (
      <div className="mx-auto max-w-6xl px-6 py-6">
        <h2 className="text-lg font-bold text-navy">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{emptyNote}</p>
      </div>
    ) : null;
  }

  /* The track holds the list twice so the loop has no visible gap at the wrap
     point. Duration scales with the count, so three partners don't race past
     and thirty don't crawl. */
  const loop = [...rows, ...rows];
  const seconds = Math.max(18, rows.length * 4.5);

  return (
    <section className="border-y border-slate-100 bg-slate-50/60 py-8">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-lg font-bold text-navy">{title}</h2>
      </div>
      <div className="marquee mt-4" style={{ "--marquee-duration": `${seconds}s` }}>
        <div className="marquee-track">
          {loop.map((p, i) => (
            <div key={`${p.id}-${i}`} aria-hidden={i >= rows.length}
                 className="mx-3 flex min-w-[210px] items-center gap-3 rounded-xl border
                            border-slate-200 bg-white px-4 py-3 shadow-card">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden
                               rounded-lg border border-slate-200 bg-white">
                {p.logo_url
                  ? <img src={mediaUrl(p.logo_url)} alt="" loading="lazy"
                         className="h-full w-full object-contain p-1" />
                  /* Most partners have not uploaded a logo. A lettered tile
                     distinguishes them and looks deliberate; a row of identical
                     grey placeholders looks like a loading failure. */
                  : <span className="text-base font-bold text-navy">
                      {(p.name || "?").trim().charAt(0).toUpperCase()}
                    </span>}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-700">{p.name}</span>
                {p.city && <span className="block truncate text-xs text-slate-400">{p.city}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-6xl px-6 text-xs text-slate-400">
        Hover to pause.
      </p>
    </section>
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
