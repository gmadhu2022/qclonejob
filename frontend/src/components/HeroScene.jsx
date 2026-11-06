import { useEffect, useRef, useState } from "react";
import { IconUser, IconBriefcase, IconBuilding, IconSearch, IconCheck, IconEye, IconChat, IconUpload } from "./icons";

/* Animated hero for the home page — drawn in code, not a video file, so it
   is sharp at every screen size, weighs a few KB, and can react to scroll.

   Two pieces:
     <HeroBackdrop>  full-width layer behind the hero text: "A to Z" job
                     titles drifting upward, with a white fade on the text
                     side so the headline reads exactly as before.
     <HeroNetwork>   wraps the logo: Job Seekers, Recruiters, Institutes and
                     A–Z Jobs linked to it, with dots flowing along the links
                     and a notification card cycling through the features.

   Everything is decorative (aria-hidden) and stops for visitors who have
   "reduce motion" turned on — see the .hero-* rules in index.css. */

// "A to Z Jobs", literally — one role per letter, white- and blue-collar mixed
// because the platform covers both.
const A_TO_Z = [
  "Accountant", "Beautician", "Carpenter", "Delivery Partner", "Electrician",
  "Fitter", "Graphic Designer", "Hotel Staff", "IT Support", "Java Developer",
  "Kitchen Helper", "Lab Technician", "Mechanic", "Nurse", "Office Assistant",
  "Plumber", "Quality Inspector", "Retail Sales", "Security Guard", "Teacher",
  "UI Designer", "Video Editor", "Welder", "X-ray Technician", "Yoga Trainer",
  "Zoology Lecturer",
];

/** Writes window.scrollY into a CSS variable on `ref`, once per frame. */
function useScrollVar(ref) {
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      ref.current?.style.setProperty("--sy", String(window.scrollY));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [ref]);
}

export function HeroBackdrop() {
  const ref = useRef(null);
  useScrollVar(ref);

  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Colour fields, moving slowly */}
      <div className="hero-parallax-slow absolute inset-0">
        <div className="aurora-blob absolute -right-20 -top-28 h-[28rem] w-[28rem] rounded-full bg-navy-200/50 blur-3xl" />
        <div className="aurora-blob-2 absolute -bottom-20 right-[22%] h-96 w-96 rounded-full bg-brandgreen-200/50 blur-3xl" />
      </div>

      {/* A–Z job titles rising and swaying. Desktop only: on phones the text
          spans the full width, so there is no free side for them. */}
      <div className="hero-parallax-fast hero-drift-field absolute inset-0 hidden lg:block">
        {A_TO_Z.map((job, i) => {
          const duration = 22 + (i % 5) * 4;                  // 22–38 s: fewer on screen at once
          const green = i % 2 === 0;
          return (
            <span key={job}
                  className={`hero-drift absolute whitespace-nowrap rounded-full border px-3 py-1
                              text-xs font-semibold shadow-sm
                              ${green ? "border-brandgreen-200 bg-brandgreen-50 text-brandgreen-600"
                                      : "border-navy-200 bg-navy-50 text-navy"}`}
                  style={{
                    left: `${48 + ((i * 37) % 48)}%`,           // right side, beside the text
                    animationDuration: `${duration}s`,
                    animationDelay: `-${(i * 37) % duration}s`,
                  }}>
              <span className="text-sm font-extrabold">{job[0]}</span>{job.slice(1)}
            </span>
          );
        })}
      </div>

      {/* Moving perspective floor: the grid streams toward the viewer,
          which reads as depth. Sits low, under the logo network. */}
      <div className="hero-floor absolute inset-x-0 bottom-0 h-[55%] overflow-hidden"><div /></div>

      {/* Readability: solid white across the text column, then clear quickly,
          so the motion is vivid beside the headline but never under it. */}
      <div className="absolute inset-0 bg-white/90 lg:bg-transparent lg:bg-[linear-gradient(to_right,#fff_0%,#fff_44%,rgba(255,255,255,.55)_52%,rgba(255,255,255,0)_62%)]" />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-white" />
    </div>
  );
}

// Positions in a 600 x 500 box; the wrapper has the same 6:5 ratio, so the
// HTML chips and the SVG lines line up at every width.
const NODES = [
  { id: "seekers",    x: 70,  y: 70,  label: "Job Seekers", sub: "Apply & track live", Icon: IconUser,      tone: "green" },
  { id: "recruiters", x: 530, y: 70,  label: "Recruiters",  sub: "Search & hire",      Icon: IconBriefcase, tone: "navy" },
  { id: "institutes", x: 530, y: 430, label: "Institutes",  sub: "Bulk onboarding",    Icon: IconBuilding,  tone: "navy" },
  { id: "jobs",       x: 70,  y: 430, label: "A to Z Jobs", sub: "Every skill level",  Icon: IconSearch,    tone: "green" },
];
const HUB = { x: 300, y: 250 };
const GREEN = "#4faa38", INDIGO = "#4f46e5";

// What the dots on each link mean — matches the platform's actual flows.
const FLOWS = { seekers: "in", recruiters: "out", institutes: "in", jobs: "out" };

const TOASTS = [
  { Icon: IconUpload, text: "Students onboarded from one Excel sheet" },
  { Icon: IconCheck,  text: "Application sent · status tracked live" },
  { Icon: IconEye,    text: "A recruiter viewed your profile" },
  { Icon: IconChat,   text: "New message from a recruiter" },
];

function curve(n) {
  // Gentle bow toward the centre line, so the links read as flows, not a grid.
  const cx = (n.x + HUB.x) / 2 + (n.y < HUB.y ? 40 : -40);
  const cy = (n.y + HUB.y) / 2;
  return `M ${n.x} ${n.y} Q ${cx} ${cy} ${HUB.x} ${HUB.y}`;
}

export function HeroNetwork({ children }) {
  const ref = useRef(null);
  useScrollVar(ref);
  const [toast, setToast] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setToast((i) => (i + 1) % TOASTS.length), 3200);
    return () => clearInterval(t);
  }, []);
  const T = TOASTS[toast];

  // Tilt toward the cursor — a few degrees, enough to read as 3-D.
  const tiltRef = useRef(null);
  useEffect(() => {
    const onMove = (e) => {
      const el = tiltRef.current;
      if (!el) return;
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      el.style.setProperty("--ry", `${x * 14}deg`);
      el.style.setProperty("--rx", `${y * -10}deg`);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div ref={ref} className="hero-parallax-net relative mx-auto aspect-[6/5] w-full max-w-[560px]">
    <div ref={tiltRef} className="hero-tilt absolute inset-0">
      <svg aria-hidden="true" viewBox="0 0 600 500" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <radialGradient id="hero-hub-glow">
            <stop offset="0%" stopColor={GREEN} stopOpacity="0.35" />
            <stop offset="60%" stopColor={INDIGO} stopOpacity="0.10" />
            <stop offset="100%" stopColor={INDIGO} stopOpacity="0" />
          </radialGradient>
          {NODES.map((n) => <path key={n.id} id={`hero-link-${n.id}`} d={curve(n)} />)}
        </defs>

        <circle cx={HUB.x} cy={HUB.y} r="250" fill="url(#hero-hub-glow)" className="hero-pulse" />

        {/* Ripples spreading out from the hub */}
        {[0, 1, 2].map((k) => (
          <circle key={k} cx={HUB.x} cy={HUB.y} r="110" fill="none"
                  stroke={k === 1 ? INDIGO : GREEN} strokeWidth="2" vectorEffect="non-scaling-stroke"
                  className="hero-ripple" style={{ animationDelay: `${k * 1.2}s` }} />
        ))}

        {/* Two orbits turning in opposite directions, each carrying a dot */}
        <g className="hero-spin">
          <circle cx={HUB.x} cy={HUB.y} r="205" fill="none" stroke={INDIGO} strokeOpacity="0.35"
                  strokeWidth="1.5" strokeDasharray="3 9" />
          <circle cx={HUB.x + 205} cy={HUB.y} r="7" fill={INDIGO} />
        </g>
        <g className="hero-spin-rev">
          <circle cx={HUB.x} cy={HUB.y} r="165" fill="none" stroke={GREEN} strokeOpacity="0.4"
                  strokeWidth="1.5" strokeDasharray="2 7" />
          <circle cx={HUB.x - 165} cy={HUB.y} r="6" fill={GREEN} />
        </g>

        {NODES.map((n, i) => {
          const c = n.tone === "green" ? GREEN : INDIGO;
          return (
            <g key={n.id}>
              <use href={`#hero-link-${n.id}`} fill="none" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
              <use href={`#hero-link-${n.id}`} fill="none" stroke={c} strokeWidth="2.5"
                   strokeDasharray="8 10" strokeLinecap="round" className="hero-dash" />
              {/* Three glowing dots per link, travelling in the flow's direction */}
              {[0, 1, 2].map((k) => (
                <g key={k} className="hero-dot">
                  <circle r="12" fill={c} opacity="0.18" />
                  <circle r="6" fill={c} stroke="#fff" strokeWidth="2" />
                  <animateMotion dur="2.7s" repeatCount="indefinite" begin={`${i * 0.35 + k * 0.9}s`}
                                 keyPoints={FLOWS[n.id] === "in" ? "0;1" : "1;0"} keyTimes="0;1" calcMode="linear">
                    <mpath href={`#hero-link-${n.id}`} />
                  </animateMotion>
                </g>
              ))}
            </g>
          );
        })}
      </svg>

      {/* The logo is the hub, breathing gently */}
      <div className="absolute left-1/2 top-1/2 w-[50%] -translate-x-1/2 -translate-y-1/2">
        {/* Soft white halo: links and drifting titles fade out under the logo
            instead of showing through its transparent areas. */}
        <div aria-hidden="true" className="absolute -inset-[12%] rounded-full bg-white/95 blur-2xl" />
        <div className="hero-breathe relative">{children}</div>
      </div>

      {/* Node chips — hidden on small phones, where they would cover the logo */}
      {NODES.map((n, i) => {
        const green = n.tone === "green";
        return (
          <div key={n.id} aria-hidden="true"
               className="absolute hidden -translate-x-1/2 -translate-y-1/2 sm:block"
               style={{ left: `${(n.x / 600) * 100}%`, top: `${(n.y / 500) * 100}%` }}>
            <div className={`hero-float flex items-center gap-2.5 rounded-2xl border-2 bg-white px-3.5 py-2.5 shadow-lg
                             ${green ? "border-brandgreen-200 shadow-brandgreen-100" : "border-navy-200 shadow-navy-100"}`}
                 style={{ animationDelay: `-${i * 1.1}s` }}>
              <span className="relative flex h-9 w-9 items-center justify-center">
                <span className={`hero-ping absolute inset-0 rounded-xl ${green ? "bg-brandgreen-400" : "bg-navy-300"}`}
                      style={{ animationDelay: `${i * 0.6}s` }} />
                <span className={`relative flex h-9 w-9 items-center justify-center rounded-xl text-white
                                  ${green ? "bg-brandgreen" : "bg-navy"}`}>
                  <n.Icon size={18} />
                </span>
              </span>
              <span className="leading-tight">
                <span className="block text-[13px] font-bold text-slate-800">{n.label}</span>
                <span className="block text-[11px] text-slate-500">{n.sub}</span>
              </span>
            </div>
          </div>
        );
      })}

      {/* Cycling notification: the four things the platform does */}
      <div aria-hidden="true" className="absolute left-1/2 -top-[3%] hidden -translate-x-1/2 sm:block">
        <div key={toast}
             className="hero-toast flex items-center gap-2 whitespace-nowrap rounded-full border-2 border-brandgreen-200
                        bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brandgreen text-white">
            <T.Icon size={13} />
          </span>
          {T.text}
        </div>
      </div>
    </div>
    </div>
  );
}

/* "Scroll" cue at the bottom of the hero. */
export function ScrollCue() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-4 hidden flex-col items-center gap-1.5 lg:flex">
      <span className="flex h-9 w-6 justify-center rounded-full border-2 border-slate-300 pt-1.5">
        <span className="hero-cue-dot h-2 w-1 rounded-full bg-navy" />
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Scroll to see how it works</span>
    </div>
  );
}

/* Fades and lifts its children in the first time they scroll into view. */
export function Reveal({ delay = 0, className = "", children }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${shown ? "reveal-in" : ""} ${className}`}
         style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* Thin bar along the top of the page showing how far down you are. */
export function ScrollProgress() {
  const ref = useRef(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (ref.current) ref.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]">
      <div ref={ref} className="h-full origin-left bg-gradient-to-r from-brandgreen to-navy"
           style={{ transform: "scaleX(0)" }} />
    </div>
  );
}
