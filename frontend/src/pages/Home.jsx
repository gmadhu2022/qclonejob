import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, mediaUrl } from "../lib/api";
import Logo from "../components/Logo";
import SiteHeader from "../components/SiteHeader";
// Same artwork as logo.png with the white background removed, so the
// animated network shows around it instead of behind a white box.
import logoFull from "../assets/logo-transparent.png";
import { HeroBackdrop, HeroNetwork, Reveal, ScrollProgress, ScrollCue } from "../components/HeroScene";
import ScrollStory from "../components/ScrollStory";
import PortalSummary from "../components/PortalSummary";

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
      <SiteHeader />
      <ScrollProgress />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <HeroBackdrop />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:pb-24">
          <div>
            <span className="badge animate-in bg-brandgreen-50 text-brandgreen-600">Advanced job searching platform</span>
            <h1 className="animate-in delay-1 mt-4 text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
              A to Z Jobs.<br />One Platform.<br /><span className="text-brandgreen-600">Unlimited Opportunities.</span>
            </h1>
            <p className="animate-in delay-2 mt-4 max-w-md text-lg text-slate-600">
              From daily-wage worker to post-graduate roles — one place for every job seeker,
              employer and institute across India.
            </p>
            <div className="animate-in delay-3 mt-7 flex flex-wrap gap-3">
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
          <div className="animate-in delay-2 flex justify-center">
            <HeroNetwork>
              <img src={logoFull} alt="QCloneJob" className="w-full drop-shadow-sm" />
            </HeroNetwork>
          </div>
        </div>
        <ScrollCue />
      </section>



      {/* How it works: replaces the static feature + audience sections,
          telling the same content as a scroll-driven story. */}
      <ScrollStory />

      <Reveal>
        <PartnerStrip title="Our Institutional Partners" rows={partners.institutes}
                      emptyNote="Institutes that register will appear here automatically." />
      </Reveal>
      <Reveal>
        <PartnerStrip title="Our Hiring Partners" rows={partners.recruiters}
                      emptyNote="Employers that register will appear here automatically." />
      </Reveal>

      {/* Register now */}
      <PortalSummary />

      <footer className="border-t border-slate-100 bg-white px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <Logo className="h-8" />
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} QCloneJob — Qualification Meets Job.</p>
        </div>
      </footer>
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
      <div className="mx-auto max-w-6xl px-6 py-6 text-center">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
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
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      </div>
      {/* Held in the centred page column, not edge to edge, with the ends
          faded so cards glide in and out instead of being cut off. */}
      <div className="marquee marquee-fade mx-auto mt-4 max-w-5xl px-6"
           style={{ "--marquee-duration": `${seconds}s` }}>
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
      <p className="mx-auto mt-3 max-w-6xl px-6 text-center text-xs text-slate-400">
        Hover to pause.
      </p>
    </section>
  );
}
