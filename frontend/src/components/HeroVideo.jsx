import { useEffect, useRef, useState } from "react";
import { useTaxonomy } from "./SectorPicker";

/* =====================================================================
   Full-bleed background film for the home hero.

   The footage (Mixkit free licence) is cut into one ~61 s story in four
   chapters — slow push-in on every shot, one colour grade — and fades
   in/out of black so the loop point is invisible:
     1 jobs         developer, nurse, civil engineers, the site through their
                    binoculars, electrician, ship at port, divers underwater at
                    the ship's hull, fitting the bolts, cook, warehouse, retail
     2 job search   laptop search, applying on a phone, the interview call
     3 recruiters   reviewing, shortlisting, online + panel interviews
     4 institutes   classroom, computer lab, degree holders — ending on the
                    close-up handshake
   Captions open with the mission and close with the vision.

   Performance:
   - The poster is a plain <img> so it paints immediately and is the LCP
     element; the <video> sits on top with opacity 0 until it is playing.
   - Video sources are attached only after the page has loaded and the
     browser is idle, and `preload="metadata"` keeps the first request tiny.
   - Phones get the 480p file; others the 720p WebM / MP4.
   - Nothing is downloaded when the user prefers reduced motion or has
     Data Saver on — the poster stays.
   - Playback pauses when the hero scrolls out of view or the tab is hidden.
   ===================================================================== */
const BASE = "/hero-video";
const V = "9";

/* The film's four acts, with the second each one starts. A small caption
   in sync with the picture says what each act shows. Claims stay factual:
   the role / industry counts come live from the job taxonomy. */
const ACTS = [
  { at: 0,    chip: "Jobs",       tag: "Plenty of jobs",
    title: (t) => (typeof t?.role_count === "number" && Array.isArray(t?.sectors))
      ? `${t.role_count.toLocaleString("en-IN")}+ roles across ${t.sectors.length} industries`
      : "Jobs across every industry",
    line: "" },
  { at: 30,   chip: "Job search", tag: "Advanced job search",
    title: () => "Smart matching. Instant alerts.",
    line: "Search by skill and city, apply in a tap, track every application." },
  { at: 37.5, chip: "Recruiters", tag: "For recruiters",
    title: () => "Find the right talent, fast",
    line: "Search resumes, shortlist, chat and interview — in one place." },
  { at: 47.5, chip: "Institutes", tag: "For institutes",
    title: () => "From classroom to career",
    line: "Every graduate gets a profile, resume and login — ready for employers." },
];
const TOTAL = 63.1;

/* Mission over the opening shot, vision over the closing handshake. */
const MISSION = { tag: "Our mission", title: "The right job for every skill",
                  line: "Connect every skill to the right opportunity." };
const VISION  = { tag: "Our vision",  title: "A world where everyone finds work that fits",
                  line: "" };
const MISSION_END = 3.2;
const VISION_START = 57.5;

export default function HeroVideo() {
  const ref = useRef(null);
  const [sources, setSources] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [act, setAct] = useState(0);
  const [pct, setPct] = useState(0);
  const tax = useTaxonomy();

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const saveData = navigator.connection?.saveData;
    if (reduce || saveData) return undefined;

    const w = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2);
    const small = window.matchMedia?.("(max-width: 767px)").matches;
    const attach = () => setSources(small
      ? [{ src: `${BASE}/hero-480.mp4?v=${V}`, type: "video/mp4" }]
      : w >= 1600
        ? [{ src: `${BASE}/hero-1080.mp4?v=${V}`, type: "video/mp4" }]
        : [{ src: `${BASE}/hero-720.webm?v=${V}`, type: "video/webm" },
           { src: `${BASE}/hero-720.mp4?v=${V}`, type: "video/mp4" }]);

    let idleId; let timer;
    const schedule = () => {
      if ("requestIdleCallback" in window) idleId = window.requestIdleCallback(attach, { timeout: 1500 });
      else timer = setTimeout(attach, 600);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (idleId) window.cancelIdleCallback?.(idleId);
      clearTimeout(timer);
    };
  }, []);

  // Start once sources are in; pause off-screen / in background tabs.
  useEffect(() => {
    const v = ref.current;
    if (!v || !sources) return undefined;
    v.load();
    const tryPlay = () => v.play().catch(() => {});   // autoplay refused → poster stays
    tryPlay();
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? tryPlay() : v.pause()), { threshold: 0.1 });
    io.observe(v);
    const vis = () => (document.hidden ? v.pause() : tryPlay());
    document.addEventListener("visibilitychange", vis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", vis); };
  }, [sources]);

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-slate-900" aria-hidden="true">
      <img src={`${BASE}/hero-poster.jpg?v=${V}`} alt="" fetchpriority="high" decoding="async"
           className="absolute inset-0 h-full w-full object-cover" />
      {sources && (
        <video ref={ref} muted loop playsInline autoPlay preload="metadata" disablePictureInPicture
               poster={`${BASE}/hero-poster.jpg?v=${V}`}
               onPlaying={() => setPlaying(true)}
               onTimeUpdate={(e) => {
                 const t = e.currentTarget.currentTime;
                 let a = 0;
                 ACTS.forEach((x, i) => { if (t >= x.at) a = i; });
                 setAct((cur) => (cur === a ? cur : a));
                 setPct(Math.min(100, (t / TOTAL) * 100));
               }}
               className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${playing ? "opacity-100" : "opacity-0"}`}>
          {sources.map((s) => <source key={s.src} src={s.src} type={s.type} />)}
        </video>
      )}
      {/* readability: deep navy wash + stronger centre vignette behind the text */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b1026]/75 via-[#0b1026]/55 to-[#0b1026]/80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(11,16,38,.55)_0%,rgba(11,16,38,0)_70%)]" />

      {/* ---- story caption + chapter bar, in sync with the film ---- */}
      {playing && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b1026]/90 via-[#0b1026]/45 to-transparent px-4 pb-5 pt-16 sm:pb-7">
          <div className="mx-auto max-w-4xl">
            {/* what this part of the film means */}
            {(() => {
              const now = (pct / 100) * TOTAL;
              const beat = now < MISSION_END ? MISSION : now >= VISION_START ? VISION : null;
              const tag = beat ? beat.tag : `${String(act + 1).padStart(2, "0")} · ${ACTS[act].tag}`;
              const title = beat ? beat.title : ACTS[act].title(tax);
              const line = beat ? beat.line : ACTS[act].line;
              return (
                <div key={beat ? beat.tag : act} className="hero-cap mx-auto mb-4 max-w-xl text-center">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8bd86d]">{tag}</p>
                  <p className={`mt-1 font-heading font-semibold leading-snug text-white ${beat ? "text-[20px] sm:text-[26px]" : "text-[18px] sm:text-[22px]"}`}>{title}</p>
                  {line && <p className="mt-0.5 text-[12.5px] text-white/75 sm:text-[14px]">{line}</p>}
                </div>
              );
            })()}
            {/* the whole story at a glance: one segment per chapter */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
              {ACTS.map((x, i) => {
                const end = i < ACTS.length - 1 ? ACTS[i + 1].at : TOTAL;
                const t = (pct / 100) * TOTAL;
                const fill = t >= end ? 100 : t <= x.at ? 0 : ((t - x.at) / (end - x.at)) * 100;
                const on = i === act;
                return (
                  <div key={x.chip} className="min-w-0">
                    <span className="block h-[3px] overflow-hidden rounded-full bg-white/20">
                      <span className="block h-full rounded-full bg-[#8bd86d]" style={{ width: `${fill}%` }} />
                    </span>
                    <span className={`mt-1.5 hidden truncate text-[11.5px] font-semibold transition-colors sm:block
                      ${on ? "text-white" : i < act ? "text-white/60" : "text-white/40"}`}>
                      {x.chip}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
