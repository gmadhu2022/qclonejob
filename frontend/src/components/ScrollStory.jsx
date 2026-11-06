import { useEffect, useRef, useState } from "react";
import StoryBuddy from "./StoryBuddy";
import {
  IconUpload, IconCheck, IconSearch, IconEye, IconChat, IconUser, IconBriefcase, IconBuilding,
  IconChart, IconLayers, IconClipboard, IconSparkle, IconBlock, IconDoc,
} from "./icons";

/* "How QCloneJob works" — a pinned, scroll-driven story.

   The section is several screens tall; its stage stays pinned while you
   scroll through it, and scroll position drives every scene frame by frame.

   Every scene is a miniature of a REAL screen in the app — same menu, same
   page names, same flow, same status values (models.APPLICATION_STATUSES),
   same 20 resume templates (jobseeker.TEMPLATE_META). If one of those
   screens changes, the matching scene here should change with it.
   People and company names are illustrative. */

const STEPS = [
  {
    who: "Institutes", short: "Upload", tone: "navy", Icon: IconBuilding,
    url: () => "institute/upload",
    title: "Upload one sheet. Every student gets a login.",
    desc: "Drop in an Excel or CSV. QCloneJob checks for duplicates, creates every new student's profile and emails their login.",
    points: ["Excel or CSV", "Duplicates skipped", "Credentials emailed"],
  },
  {
    who: "Job Seekers", short: "Resume", tone: "green", Icon: IconLayers,
    url: () => "jobseeker/templates",
    title: "20 resume designs, filled in for you.",
    desc: "The profile becomes a resume instantly. Pick a design — ATS-safe, executive, or built for skilled trades.",
    points: ["20 templates", "ATS-friendly options", "Download as PDF"],
  },
  {
    who: "Recruiters", short: "Search", tone: "navy", Icon: IconSearch,
    url: () => "enterprise/resumes",
    title: "Search candidates by what matters.",
    desc: "Filter by skills, location, education and branch, then view or download the resumes that fit.",
    points: ["Skills & location", "Education & branch", "Download resumes"],
  },
  {
    who: "Job Seekers & Recruiters", short: "Connect", tone: "green", Icon: IconChat,
    url: (t) => (t < 0.45 ? "jobseeker/views" : "jobseeker/messages"),
    title: "See who viewed you. Message back.",
    desc: "Job seekers see which companies viewed their profile, and chat with recruiters in real time — with block controls.",
    points: ["Who Viewed Me", "Real-time messages", "Block controls"],
  },
  {
    who: "Job Seekers", short: "Track", tone: "navy", Icon: IconClipboard,
    url: () => "jobseeker/applied",
    title: "Every application, tracked live.",
    desc: "From Applied to Under Review, Shortlisted, interviews, Offered and Hired — every status change shows up as it happens.",
    points: ["Live status", "Interview rounds", "Offer & hire"],
  },
];

/* The student's phone. Notifications pile up across the whole story, so
   the phone tells the same journey from the job seeker's side.
   [step, local progress at which it arrives, app, title, body] */
const PHONE_NOTES = [
  [0, 0.92, "Gmail", "Your QCloneJob login", "User ID: ravi.kumar@gmail.com · Password inside"],
  [1, 0.88, "QCloneJob", "Your resume is ready", "Executive template · download as PDF"],
  [2, 0.86, "QCloneJob", "BuildRight Infra downloaded your resume", "Electrician · Hyderabad"],
  [3, 0.58, "QCloneJob", "New message · BuildRight Infra", "Great — 10 AM at our Hyderabad office."],
  [4, 0.5, "QCloneJob", "Application update", "Electrician · now Shortlisted"],
  [4, 0.86, "QCloneJob", "Congratulations, you're hired!", "Electrician · BuildRight Infra"],
];

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const span = (t, start, end) => clamp((t - start) / (end - start));
const ease = (t) => 1 - Math.pow(1 - t, 3);
const typed = (text, t, s, e) => text.slice(0, Math.round(span(t, s, e) * text.length));
const initials = (n) => n.split(" ").map((w) => w[0]).join("").slice(0, 2);

function useStoryProgress(ref) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      setP(total > 0 ? clamp(-r.top / total) : 0);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, [ref]);
  return p;
}

export default function ScrollStory() {
  const ref = useRef(null);
  const p = useStoryProgress(ref);
  const N = STEPS.length;
  // A little dwell at both ends so step 1 is fully visible on arrival and
  // step 5 finishes before the section un-pins.
  const pp = clamp((p - 0.04) / 0.92);
  const seg = pp * N;
  const idx = Math.min(N - 1, Math.floor(seg));
  const lp = idx === N - 1 ? clamp(seg - idx) : seg - idx;     // local progress 0..1
  const step = STEPS[idx];
  const url = step.url(lp);

  const goTo = (i) => {
    const el = ref.current;
    if (!el) return;
    const total = el.offsetHeight - window.innerHeight;
    // Page position, not offsetTop: the section sits inside a positioned wrapper.
    const top = el.getBoundingClientRect().top + window.scrollY;
    const target = top + total * (0.04 + 0.92 * ((i + 0.05) / N));
    window.scrollTo({ top: target, behavior: "smooth" });
  };

  const notes = PHONE_NOTES.filter(([s, at]) => s < idx || (s === idx && lp >= at)).reverse();

  return (
    <div className="showcase relative bg-white text-slate-900">
      {/* Intro — scrolls normally, before the stage pins */}
      <div className="relative mx-auto max-w-3xl px-6 pb-6 pt-20 text-center">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-brandgreen-600">How it works</span>
        <h3 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          See <span className="bg-gradient-to-r from-navy to-brandgreen-600 bg-clip-text text-transparent">QCloneJob</span> in action
        </h3>
        <p className="mx-auto mt-3 max-w-xl text-base text-slate-500">
          Five steps from a student list to a job offer — shown on the real institute, job seeker and recruiter screens.
        </p>
      </div>

      <section ref={ref} className="relative" style={{ height: `${N * 120 + 60}vh` }} aria-label="How QCloneJob works">
        <div className="sticky top-16 flex h-[calc(100vh-4rem)] items-center overflow-hidden">
          <div className="relative mx-auto grid w-full max-w-7xl items-center gap-6 px-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-10">
            {/* ---------- Left: step list, active one expanded ---------- */}
            <div className="relative">
              {/* Vertical progress line */}
              <div aria-hidden="true" className="absolute bottom-3 left-[19px] top-3 hidden w-0.5 rounded-full bg-slate-200 lg:block">
                <div className="w-full rounded-full bg-gradient-to-b from-brandgreen to-navy transition-[height] duration-150"
                     style={{ height: `${((idx + lp) / N) * 100}%` }} />
              </div>
              <ol className="space-y-1">
                {STEPS.map((s, i) => {
                  const on = i === idx;
                  const done = i < idx;
                  return (
                    <li key={s.title} className={on ? "" : "hidden lg:block"}>
                      <button type="button" onClick={() => goTo(i)}
                              className={`relative flex w-full items-start gap-3 rounded-2xl p-2 text-left transition-colors duration-300
                                          ${on ? "bg-slate-50 ring-1 ring-slate-200 shadow-sm" : "hover:bg-slate-50"}`}>
                        <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300
                                          ${on ? "bg-gradient-to-br from-brandgreen-400 to-indigo-500 text-white shadow-md"
                                               : done ? "bg-brandgreen-50 text-brandgreen-600" : "bg-white text-slate-400 ring-1 ring-slate-200"}`}>
                          {done ? <IconCheck size={15} /> : <s.Icon size={15} />}
                        </span>
                        <span className="min-w-0 flex-1 pt-1">
                          <span className="flex items-center gap-2">
                            <span className={`text-[11px] font-bold uppercase tracking-widest ${on ? "text-brandgreen-600" : "text-slate-400"}`}>
                              0{i + 1} · {s.short}
                            </span>
                            {on && <span className="text-[11px] font-medium text-slate-400">{s.who}</span>}
                          </span>
                          {on ? (
                            <span key={idx} className="showcase-expand block">
                              <span className="mt-1.5 block text-xl font-extrabold leading-snug text-slate-900 lg:text-2xl">{s.title}</span>
                              <span className="mt-1.5 hidden text-sm leading-relaxed text-slate-500 sm:block">{s.desc}</span>
                              <span className="mt-2.5 hidden flex-wrap gap-1.5 sm:flex">
                                {s.points.map((pt) => (
                                  <span key={pt} className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                    <IconCheck size={11} className="text-brandgreen-600" /> {pt}
                                  </span>
                                ))}
                              </span>
                            </span>
                          ) : (
                            <span className="mt-0.5 block truncate text-sm font-semibold text-slate-500">{s.title}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* ---------- Right: laptop + phone ---------- */}
            <div className="relative lg:pr-28 xl:pr-32">
              {/* Ravi, the job seeker, acting out each step in front of the laptop */}
              <div className="absolute -bottom-10 -left-2 z-30 hidden lg:block xl:-left-4">
                <StoryBuddy idx={idx} t={lp} />
              </div>
              <div className="story-tilt relative" style={{ "--tilt": `${(1 - ease(clamp(lp * 3))) * -8}deg` }}>
                {/* Laptop */}
                <div className="rounded-t-[1.4rem] bg-gradient-to-b from-slate-700 to-slate-900 p-2 pb-2.5 shadow-[0_30px_70px_-20px_rgba(15,23,42,0.45)] sm:p-2.5">
                  <div className="mx-auto mb-1.5 h-1.5 w-1.5 rounded-full bg-slate-500" />
                  <div className="overflow-hidden rounded-lg bg-white">
                    <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-300" />
                      <span className="h-2 w-2 rounded-full bg-amber-300" />
                      <span className="h-2 w-2 rounded-full bg-brandgreen-400" />
                      <span className="ml-2 flex flex-1 items-center gap-1 truncate rounded-md bg-white px-2.5 py-0.5 text-[10px] text-slate-400 ring-1 ring-slate-200">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                        qclonejob.com/<span key={url} className="story-url text-slate-600">{url}</span>
                      </span>
                    </div>
                    <div className="relative aspect-[4/5] sm:aspect-[16/10]">
                      {[UploadScene, ResumeScene, SearchScene, ConnectScene, TrackScene].map((Scene, i) => (
                        <div key={i}
                             className={`absolute inset-0 transition-all duration-500 ease-out
                               ${i === idx ? "scale-100 opacity-100" : i < idx ? "-translate-y-8 scale-95 opacity-0" : "translate-y-8 scale-95 opacity-0"}`}
                             aria-hidden="true">
                          <Scene t={i === idx ? lp : i < idx ? 1 : 0} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Laptop base */}
                <div className="relative mx-[-4%] h-3.5 rounded-b-2xl bg-gradient-to-b from-slate-300 to-slate-500 shadow-xl">
                  <div className="absolute left-1/2 top-0 h-1.5 w-20 -translate-x-1/2 rounded-b-lg bg-slate-400" />
                </div>
              </div>

              {/* Phone — the student's side of the story */}
              <div aria-hidden="true" className="showcase-phone absolute -bottom-6 right-0 hidden w-[150px] lg:block xl:w-[165px]">
                <div className="rounded-[1.9rem] bg-slate-900 p-1.5 shadow-[0_25px_50px_-12px_rgba(15,23,42,0.5)]">
                  <div className="relative h-[290px] overflow-hidden rounded-[1.5rem] bg-gradient-to-b from-indigo-900 via-[#1e1b4b] to-[#0f172a] px-2 pt-2">
                    <div className="mx-auto h-4 w-16 rounded-full bg-black" />
                    <div className="mt-3 text-center">
                      <span className="block text-[9px] font-medium text-white/60">Friday, 6 November</span>
                      <span className="block text-4xl font-light tracking-tight text-white">9:41</span>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {notes.slice(0, 3).map(([s, at, app, title, body], k) => (
                        <div key={`${s}-${at}`} className={`showcase-note rounded-xl bg-white/90 p-2 backdrop-blur ${k > 0 ? "opacity-80" : ""}`}>
                          <span className="flex items-center gap-1">
                            <span className={`flex h-3.5 w-3.5 items-center justify-center rounded text-[6px] font-black text-white ${app === "Gmail" ? "bg-red-500" : "bg-navy"}`}>
                              {app === "Gmail" ? "M" : "Q"}
                            </span>
                            <span className="text-[7px] font-semibold uppercase tracking-wide text-slate-500">{app}</span>
                            <span className="ml-auto text-[7px] text-slate-400">now</span>
                          </span>
                          <span className="mt-0.5 block text-[9px] font-bold leading-tight text-slate-900">{title}</span>
                          <span className="block truncate text-[8px] text-slate-600">{body}</span>
                        </div>
                      ))}
                      {notes.length === 0 && (
                        <span className="block pt-6 text-center text-[9px] text-white/40">No notifications yet</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ====================================================================
   App shell — the same sidebar the real dashboards use.
   ==================================================================== */

const MENUS = {
  institute: ["Dashboard", "Profile", "Data upload", "Post a Ad"],
  jobseeker: ["Dashboard", "My Profile", "Resume Design", "Find Jobs", "My Applications", "Who Viewed Me", "Messages"],
  enterprise: ["Dashboard", "Profile", "Search candidates", "Post a Job", "Manage Job Posting"],
};
const MENU_ICONS = {
  "Dashboard": IconChart, "Profile": IconBuilding, "My Profile": IconUser, "Data upload": IconUpload,
  "Post a Ad": IconSparkle, "Resume Design": IconLayers, "Find Jobs": IconSearch, "My Applications": IconClipboard,
  "Who Viewed Me": IconEye, "Messages": IconChat, "Search candidates": IconSearch, "Post a Job": IconBriefcase,
  "Manage Job Posting": IconLayers,
};
const ROLE_LABEL = { institute: "INSTITUTE", jobseeker: "JOB SEEKER", enterprise: "RECRUITER" };

/* A demo mouse pointer. Moves to (x%, y%) of the page area with a CSS
   transition, and shows a click ripple while `click` is true. */
function Cursor({ x, y, click, show = true }) {
  return (
    <span aria-hidden="true"
          className={`pointer-events-none absolute z-30 hidden transition-all duration-500 ease-out sm:block ${show ? "opacity-100" : "opacity-0"}`}
          style={{ left: `${x}%`, top: `${y}%` }}>
      {click && <span className="story-click absolute -left-3 -top-3 h-6 w-6 rounded-full border-2 border-navy" />}
      <svg width="18" height="20" viewBox="0 0 18 20" className={`drop-shadow-md transition-transform duration-150 ${click ? "scale-75" : ""}`}>
        <path d="M1 1l6.5 17 2.6-7.1L17 8.4z" fill="#0f172a" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function AppShell({ role, active, children, cursor }) {
  return (
    <div className="flex h-full">
      <aside className="hidden w-[27%] shrink-0 flex-col border-r border-slate-100 bg-white px-2 py-3 sm:flex">
        <div className="flex items-center gap-1 px-1.5">
          <span className="text-[13px] font-black leading-none text-navy">Q<span className="text-brandgreen-600">J</span></span>
          <span className="text-[9px] font-bold tracking-wide text-slate-700">QCLONEJOB</span>
        </div>
        <span className="mt-3 px-1.5 text-[8px] font-bold tracking-wider text-slate-400">{ROLE_LABEL[role]}</span>
        <nav className="mt-1.5 space-y-0.5">
          {MENUS[role].map((m) => {
            const Ic = MENU_ICONS[m] || IconDoc;
            const on = m === active;
            return (
              <span key={m} className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors duration-300
                                        ${on ? "bg-navy-50 text-navy" : "text-slate-500"}`}>
                <Ic size={11} /> <span className="truncate">{m}</span>
              </span>
            );
          })}
        </nav>
      </aside>
      <div className="relative min-w-0 flex-1 overflow-hidden bg-slate-50/60 p-3 sm:p-4">
        {children}
        {cursor && <Cursor {...cursor} />}
      </div>
    </div>
  );
}

function PageTitle({ children, right }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <h3 className="text-[13px] font-bold text-slate-800 sm:text-sm">{children}</h3>
      {right}
    </div>
  );
}

function Btn({ pressed, children, tone = "navy", className = "" }) {
  const base = tone === "green" ? "bg-brandgreen" : "bg-navy";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm transition-all duration-150
                      ${base} ${pressed ? "scale-90 brightness-90 ring-4 ring-navy-200" : ""} ${className}`}>
      {children}
    </span>
  );
}

/* ====================================================================
   Scene 1 — Institute › Data upload
   Same flow as the real page: choose file → Submit → duplicate preview →
   "Data upload is successful" → result table.
   ==================================================================== */

const UPLOAD_ROWS = [
  ["Ravi Kumar", "ravi.kumar@gmail.com", "kR7CWmVH", "created"],
  ["Priya Sharma", "priya.s@gmail.com", "Tq9LmZ2x", "created"],
  ["Arjun Mehta", "arjun.m@gmail.com", "Hb4NcW8p", "created"],
  ["Fatima Begum", "fatima.b@gmail.com", "Ze6RtY1k", "created"],
  ["Kiran Rao", "kiran.rao@gmail.com", "—", "already uploaded — ignored"],
];

function UploadScene({ t }) {
  const fileIn = ease(span(t, 0, 0.14));
  const hasFile = fileIn >= 1;
  const submitPressed = t > 0.17 && t < 0.23;
  const dialog = t > 0.25 && t < 0.52;
  const dialogK = ease(span(t, 0.25, 0.3));
  const confirmPressed = t > 0.45 && t < 0.52;
  const done = t >= 0.52;
  const cursor =
    t < 0.14 ? { x: 30 + (1 - fileIn) * 50, y: 22 - (1 - fileIn) * 12 }      // dragging the file in
    : t < 0.24 ? { x: 38, y: 25, click: submitPressed }                       // Submit
    : t < 0.52 ? { x: 63, y: 61, click: confirmPressed }                      // "Upload 4 new student(s)"
    : { x: 80, y: 88 };
  return (
    <AppShell role="institute" active="Data upload" cursor={cursor}>
      <PageTitle>Data upload</PageTitle>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="mb-1 block text-[9px] font-semibold text-slate-500">Upload box</span>
          <div className={`relative flex h-[58px] w-36 flex-col items-center justify-center rounded-lg border border-dashed text-center transition-colors duration-300
                           ${hasFile ? "border-brandgreen-400 bg-brandgreen-50/60" : "border-slate-300 bg-white"}`}>
            {hasFile ? (
              <>
                <IconCheck size={13} className="text-brandgreen-600" />
                <span className="text-[9px] font-semibold text-slate-800">students.xlsx</span>
                <span className="text-[8px] text-slate-500">18 KB · ready</span>
              </>
            ) : (
              <>
                <IconUpload size={13} className="text-slate-400" />
                <span className="text-[9px] font-medium text-slate-600">Choose file or drag here</span>
                <span className="text-[8px] text-slate-400">XLSX, XLS, XLSM or CSV</span>
              </>
            )}
            {/* The file being dragged in */}
            {!hasFile && t > 0 && (
              <span className="absolute flex items-center gap-1 rounded-md bg-white px-1.5 py-1 text-[8px] font-bold text-slate-700 shadow-lg ring-1 ring-slate-200"
                    style={{ transform: `translate(${(1 - fileIn) * 120}px, ${(1 - fileIn) * -50}px) rotate(${(1 - fileIn) * 12}deg)`, opacity: 0.4 + fileIn * 0.6 }}>
                <span className="rounded bg-[#1d6f42] px-0.5 text-white">X</span> students.xlsx
              </span>
            )}
          </div>
        </div>
        <Btn pressed={submitPressed}>{t > 0.2 && t < 0.25 ? "Checking…" : "Submit"}</Btn>
      </div>

      {/* Result */}
      <div className="mt-3 space-y-2" style={{ opacity: ease(span(t, 0.52, 0.58)) }}>
        <div className="rounded-lg border border-brandgreen-100 bg-brandgreen-50/60 px-2.5 py-1.5">
          <span className="block text-[10px] font-bold text-brandgreen-600">Data upload is successful</span>
          <span className="mt-1 flex flex-wrap gap-1">
            <span className="rounded-full bg-white px-1.5 py-0.5 text-[8px] font-semibold text-slate-600">5 rows read</span>
            <span className="rounded-full bg-brandgreen-100 px-1.5 py-0.5 text-[8px] font-semibold text-brandgreen-600">4 created</span>
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-semibold text-amber-700">1 duplicate ignored</span>
          </span>
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="grid grid-cols-[1.1fr_1.5fr_0.9fr_1.2fr] gap-1 bg-slate-50 px-2 py-1 text-[8px] font-bold uppercase tracking-wide text-slate-400">
            <span>Student</span><span>User ID</span><span>Password</span><span>Status</span>
          </div>
          {UPLOAD_ROWS.map(([n, id, pw, st], i) => {
            const k = ease(span(t, 0.58 + i * 0.07, 0.66 + i * 0.07));
            const dup = st !== "created";
            return (
              <div key={n} className="grid grid-cols-[1.1fr_1.5fr_0.9fr_1.2fr] gap-1 border-t border-slate-100 px-2 py-1 text-[9px]"
                   style={{ opacity: k, transform: `translateY(${(1 - k) * 8}px)` }}>
                <span className="truncate font-semibold text-slate-700">{n}</span>
                <span className="truncate text-slate-500">{id}</span>
                <span className="truncate font-mono text-slate-500">{pw}</span>
                <span className={`truncate font-semibold ${dup ? "text-amber-600" : "text-brandgreen-600"}`}>{st}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Duplicate preview dialog — exactly what the real page asks */}
      {dialog && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/25 p-3">
          <div className="w-[85%] max-w-[260px] rounded-xl bg-white p-3 text-center shadow-2xl"
               style={{ transform: `scale(${0.85 + 0.15 * dialogK})`, opacity: dialogK }}>
            <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-navy-50 text-navy"><IconUpload size={13} /></span>
            <span className="mt-1.5 block text-[11px] font-bold text-slate-800">4 new student(s) found</span>
            <span className="mt-1 block text-[9px] leading-snug text-slate-500">
              4 new student(s) will be registered.<br />1 student already uploaded — will be ignored.
            </span>
            <span className="mt-2 flex justify-center gap-1.5">
              <span className="rounded-md border border-slate-200 px-2 py-1 text-[9px] font-semibold text-slate-500">I'll correct the sheet</span>
              <Btn pressed={confirmPressed}>Upload 4 new student(s)</Btn>
            </span>
          </div>
        </div>
      )}

      <Toast show={done && t > 0.93} tone="green" Icon={IconCheck} text="4 students emailed their login" />
    </AppShell>
  );
}

/* ====================================================================
   Scene 2 — Job seeker › Resume Design
   Real template names, layouts and tiers from TEMPLATE_META (20 in all).
   ==================================================================== */

const TEMPLATES = [
  { name: "Classic", layout: "single", accent: "navy", tier: "ATS" },
  { name: "Modern", layout: "sidebar", accent: "navy", tier: "Popular" },
  { name: "Forest", layout: "sidebar", accent: "green", tier: "Popular" },
  { name: "Professional", layout: "band", accent: "navy", tier: "Executive" },
  { name: "Executive", layout: "monogram", accent: "green", tier: "Executive" },
  { name: "Minimal", layout: "minimal", accent: "slate", tier: "Minimal" },
  { name: "Timeline", layout: "timeline", accent: "navy", tier: "Modern" },
  { name: "Trades", layout: "trades", accent: "green", tier: "Skilled" },
];
const ACCENT = { navy: "#4f46e5", green: "#41922e", slate: "#334155" };

function ResumeScene({ t }) {
  const sel = Math.min(TEMPLATES.length - 1, Math.floor(span(t, 0.05, 0.9) * TEMPLATES.length));
  const T = TEMPLATES[sel];
  const phase = (span(t, 0.05, 0.9) * TEMPLATES.length) % 1;
  const cursor = { x: 6 + (sel % 2) * 22 + 14, y: 16 + Math.floor(sel / 2) * 19 + 10, click: phase < 0.25 && t > 0.05 && t < 0.92 };
  return (
    <AppShell role="jobseeker" active="Resume Design" cursor={cursor}>
      <PageTitle right={<span className="rounded-full bg-navy-50 px-2 py-0.5 text-[9px] font-bold text-navy">20 templates</span>}>
        Resume Design
      </PageTitle>
      <div className="flex h-[calc(100%-2rem)] gap-3">
        {/* Gallery */}
        <div className="grid w-[46%] grid-cols-2 content-start gap-1.5">
          {TEMPLATES.map((x, i) => (
            <div key={x.name} className={`rounded-md bg-white p-1 transition-all duration-300
                                          ${i === sel ? "scale-105 shadow-lg ring-2 ring-navy" : "ring-1 ring-slate-200"}`}>
              <div className="h-9 overflow-hidden rounded-sm border border-slate-100 sm:h-11">
                <MiniResume layout={x.layout} accent={ACCENT[x.accent]} tiny />
              </div>
              <span className="mt-0.5 flex items-center justify-between">
                <span className="truncate text-[8px] font-semibold text-slate-700">{x.name}</span>
                <span className="text-[7px] text-slate-400">{x.tier}</span>
              </span>
            </div>
          ))}
        </div>
        {/* Live preview */}
        <div className="relative flex-1 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
          <div key={sel} className="story-swap h-full">
            <MiniResume layout={T.layout} accent={ACCENT[T.accent]} />
          </div>
          <span key={`n${sel}`} className="story-swap absolute bottom-1.5 right-1.5 rounded-full bg-slate-900 px-2 py-0.5 text-[8px] font-bold text-white">
            {T.name}
          </span>
        </div>
      </div>
      <Toast show={t > 0.93} tone="green" Icon={IconCheck} text="Template saved · resume ready to download" />
    </AppShell>
  );
}

/* A miniature resume drawn in each real layout archetype. */
function MiniResume({ layout, accent, tiny }) {
  const Line = ({ w = "100%", c = "#e2e8f0" }) => <span className="block h-[3px] rounded" style={{ width: w, background: c }} />;
  const Name = ({ light }) => tiny ? null : (
    <span className={`block text-[10px] font-bold ${light ? "text-white" : "text-slate-800"}`}>Ravi Kumar
      <span className={`block text-[7px] font-medium ${light ? "text-white/80" : "text-slate-400"}`}>ITI Electrician · Hyderabad</span>
    </span>
  );
  const Section = ({ label, rows = 2 }) => (
    <span className="block space-y-[3px]">
      {!tiny && <span className="block text-[6px] font-bold uppercase tracking-wider" style={{ color: accent }}>{label}</span>}
      {Array.from({ length: rows }).map((_, i) => <Line key={i} w={`${92 - i * 18}%`} />)}
    </span>
  );
  const pad = tiny ? "p-1 space-y-1" : "p-2.5 space-y-2";

  if (layout === "sidebar") return (
    <div className="flex h-full">
      <div className={`w-[34%] ${tiny ? "p-1" : "p-2"} space-y-1.5`} style={{ background: accent }}>
        <span className={`block rounded-full bg-white/80 ${tiny ? "h-2.5 w-2.5" : "h-7 w-7"}`} />
        {Array.from({ length: tiny ? 2 : 4 }).map((_, i) => <Line key={i} w="80%" c="rgba(255,255,255,.55)" />)}
      </div>
      <div className={`flex-1 ${pad}`}><Name /><Section label="Experience" /><Section label="Education" /></div>
    </div>
  );
  if (layout === "band") return (
    <div className="h-full">
      <div className={tiny ? "h-2.5" : "px-2.5 py-2"} style={{ background: accent }}><Name light /></div>
      <div className={`grid grid-cols-2 gap-2 ${tiny ? "p-1" : "p-2.5"}`}>
        <span className="space-y-2"><Section label="Experience" rows={3} /></span>
        <span className="space-y-2"><Section label="Skills" /><Section label="Education" /></span>
      </div>
    </div>
  );
  if (layout === "monogram") return (
    <div className={`h-full ${pad}`}>
      <span className="flex items-center gap-1.5">
        <span className={`flex items-center justify-center rounded-full font-serif font-bold text-white ${tiny ? "h-2.5 w-2.5 text-[0px]" : "h-7 w-7 text-[9px]"}`}
              style={{ background: accent }}>RK</span>
        <Name />
      </span>
      <span className="block h-[2px]" style={{ background: accent }} />
      <Section label="Profile" /><Section label="Experience" rows={3} />
    </div>
  );
  if (layout === "minimal") return (
    <div className={`h-full ${pad}`}>
      <Name />
      {["Skills", "Work", "Study"].map((l) => (
        <span key={l} className="flex gap-1.5">
          {!tiny && <span className="w-8 shrink-0 text-[6px] font-semibold text-slate-400">{l}</span>}
          <span className="flex-1 space-y-[3px] border-t border-slate-200 pt-1"><Line w="90%" /><Line w="60%" /></span>
        </span>
      ))}
    </div>
  );
  if (layout === "timeline") return (
    <div className={`h-full ${pad}`}>
      <Name />
      <span className="relative block space-y-2 pl-2.5">
        <span className="absolute bottom-0 left-[3px] top-0 w-[2px]" style={{ background: accent, opacity: 0.4 }} />
        {Array.from({ length: tiny ? 2 : 3 }).map((_, i) => (
          <span key={i} className="relative block space-y-[3px]">
            <span className="absolute -left-[10px] top-0 h-[7px] w-[7px] rounded-full" style={{ background: accent }} />
            <Line w="70%" /><Line w="45%" />
          </span>
        ))}
      </span>
    </div>
  );
  if (layout === "trades") return (
    <div className="h-full">
      <div className={tiny ? "h-2.5" : "px-2.5 py-2"} style={{ background: accent }}><Name light /></div>
      <div className={pad}>
        {!tiny && <span className="block text-[6px] font-bold uppercase tracking-wider" style={{ color: accent }}>Trade skills</span>}
        <span className="flex flex-wrap gap-[3px]">
          {(tiny ? [1, 2, 3] : ["Wiring", "Panel fitting", "Safety", "Maintenance"]).map((s) => (
            <span key={s} className={`rounded-full ${tiny ? "h-[4px] w-3" : "px-1 py-[1px] text-[6px] font-semibold"}`}
                  style={{ background: `${accent}22`, color: accent }}>{tiny ? "" : s}</span>
          ))}
        </span>
        {!tiny && <span className="block text-[7px] font-semibold text-slate-600">Availability: Immediate</span>}
        <Section label="Work history" rows={3} />
      </div>
    </div>
  );
  // single
  return (
    <div className={`h-full ${pad} text-center`}>
      {!tiny && <span className="block font-serif text-[11px] font-bold text-slate-800">Ravi Kumar</span>}
      {!tiny && <span className="block text-[7px] text-slate-400">ITI Electrician · Hyderabad</span>}
      <span className="block h-[2px]" style={{ background: accent }} />
      <span className="block text-left"><Section label="Objective" /></span>
      <span className="block text-left"><Section label="Experience" rows={3} /></span>
    </div>
  );
}

/* ====================================================================
   Scene 3 — Recruiter › Search candidates
   The real filters: Skills, Location, Education, Branch.
   ==================================================================== */

const CANDIDATES = [
  ["Ravi Kumar", "ITI · Electrical", "Hyderabad", ["Wiring", "Panels"], "2 yrs"],
  ["Imran Shaikh", "ITI · Electrical", "Hyderabad", ["Maintenance"], "1 yr"],
  ["Suresh Naidu", "ITI · Electrical", "Secunderabad", ["Wiring", "Safety"], "4 yrs"],
];

function SearchScene({ t }) {
  const fields = [
    ["Skills", "Electrician", 0.0, 0.16],
    ["Location", "Hyderabad", 0.16, 0.3],
    ["Education", "ITI", 0.3, 0.36],
    ["Branch", "Electrical", 0.36, 0.46],
  ];
  const searchPressed = t > 0.48 && t < 0.54;
  const shown = t > 0.54;
  const downloadPressed = t > 0.8 && t < 0.86;
  const FIELD_POS = [[30, 18], [78, 18], [30, 27], [78, 27]];
  const fi = fields.findIndex(([, , s2, e2]) => t >= s2 && t < e2);
  const cursor =
    fi >= 0 ? { x: FIELD_POS[fi][0], y: FIELD_POS[fi][1], click: t - fields[fi][2] < 0.03 }
    : t < 0.55 ? { x: 88, y: 37, click: searchPressed }
    : t < 0.78 ? { x: 70, y: 52 }
    : { x: 90, y: 50, click: downloadPressed };
  return (
    <AppShell role="enterprise" active="Search candidates" cursor={cursor}>
      <PageTitle>Search candidates</PageTitle>
      <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-white p-2 ring-1 ring-slate-200">
        {fields.map(([label, val, s, e]) => {
          const v = typed(val, t, s, e);
          const typing = t >= s && t < e;
          return (
            <span key={label} className="block">
              <span className="block text-[8px] font-semibold text-slate-500">{label}</span>
              <span className={`mt-0.5 flex h-5 items-center rounded-md border px-1.5 text-[9px] font-medium transition-colors
                                ${typing ? "border-navy ring-2 ring-navy-100" : v ? "border-slate-300" : "border-slate-200"} text-slate-800`}>
                {v}{typing && <span className="story-caret ml-px inline-block h-2.5 w-px bg-navy" />}
              </span>
            </span>
          );
        })}
        <span className="col-span-2 mt-0.5 flex justify-end">
          <Btn pressed={searchPressed}><IconSearch size={10} /> Search</Btn>
        </span>
      </div>

      <div className="mt-2.5" style={{ opacity: shown ? 1 : 0, transition: "opacity .3s" }}>
        <span className="block text-[9px] font-semibold text-slate-500">3 candidates found</span>
        <div className="mt-1 space-y-1.5">
          {CANDIDATES.map(([n, edu, city, skills, exp], i) => {
            const k = ease(span(t, 0.55 + i * 0.06, 0.63 + i * 0.06));
            const top = i === 0;
            return (
              <div key={n} className={`flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 transition-shadow
                                       ${top && t > 0.72 ? "ring-2 ring-brandgreen" : "ring-1 ring-slate-200"}`}
                   style={{ opacity: k, transform: `translateY(${(1 - k) * 12}px)` }}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white ${i % 2 ? "bg-navy" : "bg-brandgreen"}`}>
                  {initials(n)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] font-bold text-slate-800">{n} <span className="font-normal text-slate-400">· {exp}</span></span>
                  <span className="block truncate text-[8px] text-slate-500">{edu} · {city}</span>
                </span>
                <span className="hidden gap-0.5 sm:flex">
                  {skills.map((s) => <span key={s} className="rounded-full bg-navy-50 px-1 py-[1px] text-[7px] font-semibold text-navy">{s}</span>)}
                </span>
                {top ? (
                  <Btn pressed={downloadPressed} tone="green">{t > 0.86 ? <><IconCheck size={9} /> Downloaded</> : "Download"}</Btn>
                ) : (
                  <span className="rounded-md border border-slate-200 px-1.5 py-1 text-[8px] font-semibold text-slate-500">View resume</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <Toast show={t > 0.88} tone="navy" Icon={IconDoc} text="Ravi_Kumar_resume.pdf downloaded" />
    </AppShell>
  );
}

/* ====================================================================
   Scene 4 — Job seeker › Who Viewed Me → Messages
   ==================================================================== */

const VIEWERS = [
  ["BuildRight Infra", "Construction · Hyderabad"],
  ["Sunrise Hospitals", "Healthcare · Chennai"],
  ["Metro Logistics", "Logistics · Pune"],
];
const CHAT = [
  ["r", "Hi Ravi, your profile fits our electrician role. Free for an interview?", 0.55],
  ["s", "Yes, I'm available tomorrow.", 0.66],
  ["r", "Great — 10 AM at our Hyderabad office.", 0.77],
  ["s", "Thank you, see you then!", 0.88],
];

function ConnectScene({ t }) {
  const onMessages = t >= 0.45;
  const msgPressed = t > 0.36 && t < 0.45;
  const typing = CHAT.find(([, , at]) => t > at - 0.06 && t < at);
  const cursor = !onMessages
    ? (t < 0.3 ? { x: 60, y: 30 } : { x: 90, y: 18, click: msgPressed })
    : { x: 70, y: 90, click: t > 0.64 && t < 0.67 || t > 0.86 && t < 0.89 };
  return (
    <AppShell role="jobseeker" active={onMessages ? "Messages" : "Who Viewed Me"} cursor={cursor}>
      {!onMessages ? (
        <div className="story-swap">
          <PageTitle right={<span className="rounded-full bg-brandgreen-50 px-2 py-0.5 text-[9px] font-bold text-brandgreen-600">3 this week</span>}>
            Who viewed me
          </PageTitle>
          <div className="space-y-1.5">
            {VIEWERS.map(([c, d], i) => {
              const k = ease(span(t, 0.02 + i * 0.08, 0.12 + i * 0.08));
              return (
                <div key={c} className="flex items-center gap-2 rounded-lg bg-white px-2 py-2 ring-1 ring-slate-200"
                     style={{ opacity: k, transform: `translateX(${(1 - k) * -20}px)` }}>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold text-white ${i === 1 ? "bg-brandgreen" : "bg-navy"}`}>
                    {initials(c)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10px] font-bold text-slate-800">{c}</span>
                    <span className="block truncate text-[8px] text-slate-500">{d} · viewed your profile today</span>
                  </span>
                  {i === 0 ? <Btn pressed={msgPressed}><IconChat size={9} /> Message</Btn>
                           : <span className="h-2 w-2 rounded-full bg-brandgreen" />}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="story-swap flex h-full gap-2">
          <div className="hidden w-[34%] space-y-1 sm:block">
            <PageTitle>Messages</PageTitle>
            {["BuildRight Infra", "Sunrise Hospitals"].map((c, i) => (
              <span key={c} className={`flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 ${i === 0 ? "bg-white ring-1 ring-navy-200" : ""}`}>
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[7px] font-bold text-white ${i ? "bg-brandgreen" : "bg-navy"}`}>{initials(c)}</span>
                <span className="truncate text-[9px] font-semibold text-slate-700">{c}</span>
              </span>
            ))}
          </div>
          <div className="flex flex-1 flex-col overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
            <div className="flex items-center gap-1.5 border-b border-slate-100 px-2 py-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[7px] font-bold text-white">BI</span>
              <span className="text-[10px] font-bold text-slate-800">BuildRight Infra</span>
              <span className="h-1.5 w-1.5 rounded-full bg-brandgreen" />
              <span className="ml-auto flex items-center gap-0.5 rounded border border-slate-200 px-1 py-0.5 text-[8px] font-semibold text-slate-500">
                <IconBlock size={8} /> Block
              </span>
            </div>
            <div className="flex-1 space-y-1.5 overflow-hidden p-2">
              {CHAT.map(([who, text, at]) => {
                const k = ease(span(t, at, at + 0.05));
                return (
                  <div key={text} className={`flex ${who === "s" ? "justify-end" : ""}`}
                       style={{ opacity: k, transform: `translateY(${(1 - k) * 10}px) scale(${0.92 + 0.08 * k})` }}>
                    <span className={`max-w-[80%] rounded-2xl px-2 py-1 text-[9px] leading-snug
                                      ${who === "s" ? "rounded-br-sm bg-brandgreen text-white" : "rounded-bl-sm bg-slate-100 text-slate-700"}`}>
                      {text}
                    </span>
                  </div>
                );
              })}
              {typing && (
                <div className={`flex ${typing[0] === "s" ? "justify-end" : ""}`}>
                  <span className="story-typing flex gap-0.5 rounded-2xl bg-slate-100 px-2 py-1.5"><i /><i /><i /></span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 border-t border-slate-100 px-2 py-1.5">
              <span className="flex-1 rounded-full bg-slate-100 px-2 py-1 text-[8px] text-slate-400">Type a message…</span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy text-white"><IconChat size={9} /></span>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

/* ====================================================================
   Scene 5 — Job seeker › My Applications
   Real status values, in pipeline order (models.APPLICATION_STATUSES).
   ==================================================================== */

const PIPELINE = ["Applied", "Under Review", "Shortlisted", "Interview - Phase 1", "Offered", "Hired"];
const OTHER_APPS = [
  ["Staff Nurse", "Sunrise Hospitals · Chennai", "Under Review", "bg-sky-100 text-sky-700"],
  ["Maintenance Technician", "Metro Logistics · Pune", "On Hold", "bg-slate-100 text-slate-600"],
];

function TrackScene({ t }) {
  const fill = ease(span(t, 0.04, 0.8));
  const reached = Math.min(PIPELINE.length - 1, Math.floor(fill * (PIPELINE.length - 1) + 0.001));
  const hired = t > 0.82;
  return (
    <AppShell role="jobseeker" active="My Applications">
      <PageTitle right={
        <span className="flex gap-1 text-[8px] font-semibold">
          <span className="rounded-full bg-navy px-1.5 py-0.5 text-white">All 3</span>
          <span className="rounded-full bg-white px-1.5 py-0.5 text-slate-500 ring-1 ring-slate-200">Active 2</span>
        </span>}>
        My Applications
      </PageTitle>

      <div className="rounded-lg bg-white p-2.5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy text-[9px] font-bold text-white">BI</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-bold text-slate-800">Electrician</span>
            <span className="block truncate text-[8px] text-slate-500">BuildRight Infra · Hyderabad · ELEC/001</span>
          </span>
          <span key={reached} className={`story-pop rounded-full px-2 py-0.5 text-[8px] font-bold
                            ${hired ? "bg-brandgreen text-white" : "bg-amber-100 text-amber-700"}`}>
            {PIPELINE[reached]}
          </span>
        </div>

        {/* Pipeline */}
        <div className="relative mt-3 px-1">
          <div className="absolute left-3 right-3 top-[9px] h-1 rounded-full bg-slate-200" />
          <div className="absolute left-3 top-[9px] h-1 rounded-full bg-gradient-to-r from-brandgreen to-navy"
               style={{ width: `calc((100% - 1.5rem) * ${fill})` }} />
          <div className="relative flex justify-between">
            {PIPELINE.map((s, i) => {
              const on = i <= reached;
              const cur = i === reached && !hired;
              return (
                <span key={s} className="flex w-10 flex-col items-center">
                  <span className={`relative flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 transition-all duration-300
                                    ${on ? "border-brandgreen bg-brandgreen text-white" : "border-slate-300 bg-white text-transparent"}`}>
                    {cur && <span className="absolute inset-0 animate-ping rounded-full bg-brandgreen/40" />}
                    <IconCheck size={10} />
                  </span>
                  <span className={`mt-1 text-center text-[7px] font-semibold leading-tight ${on ? "text-slate-800" : "text-slate-400"}`}>{s}</span>
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {OTHER_APPS.map(([title, co, st, cls]) => (
          <div key={title} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-slate-200">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] font-bold text-slate-700">{title}</span>
              <span className="block truncate text-[8px] text-slate-400">{co}</span>
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${cls}`}>{st}</span>
          </div>
        ))}
      </div>

      {hired && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <span className="story-win flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-2xl ring-1 ring-brandgreen-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brandgreen text-white"><IconCheck size={14} /></span>
              <span>
                <span className="block text-[11px] font-extrabold text-slate-900">You're hired!</span>
                <span className="block text-[8px] text-slate-500">Electrician · BuildRight Infra</span>
              </span>
            </span>
          </div>
          <Confetti />
        </>
      )}
    </AppShell>
  );
}

/* ---------- small pieces ---------- */

function Toast({ show, text, Icon, tone }) {
  return (
    <div className={`pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full
                     px-3 py-1.5 text-[10px] font-semibold text-white shadow-xl transition-all duration-500
                     ${tone === "green" ? "bg-brandgreen" : "bg-navy"}
                     ${show ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
      <Icon size={12} /> {text}
    </div>
  );
}

const CONFETTI_COLORS = ["#4faa38", "#4f46e5", "#f59e0b", "#ec4899", "#06b6d4"];
function Confetti() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 28 }).map((_, i) => {
        const angle = (i / 28) * Math.PI * 2;
        const dist = 110 + (i % 4) * 35;
        return (
          <span key={i} className="story-confetti absolute left-1/2 top-1/2 h-2.5 w-1.5 rounded-sm"
                style={{
                  background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  "--dx": `${Math.cos(angle) * dist}px`,
                  "--dy": `${Math.sin(angle) * dist * 0.75}px`,
                  "--rot": `${(i * 67) % 360}deg`,
                  animationDelay: `${(i % 5) * 0.03}s`,
                }} />
        );
      })}
    </div>
  );
}
