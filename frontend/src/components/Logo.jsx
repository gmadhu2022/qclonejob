import { useId } from "react";

/**
 * JobBay logo — animated mark + fixed wordmark (styles: .jb-* in index.css).
 *
 * The MARK loops its story every 10s:
 *   a small "j" draws itself with its dot above the stem → the dot slides
 *   down into the J's cup and settles → holds → J un-draws → repeat.
 * The WORDMARK "JobBay" (and the BETA badge) stay fixed — always visible,
 * never animated — so the brand name is readable at every moment.
 *
 * prefers-reduced-motion → the finished mark, still.
 *
 * Sizing: pass a Tailwind height class (h-8, h-9, h-10 …); the mark takes
 * that height and the wordmark scales with it.
 * variant: "plain" (light bg) | "pill" (dark bg — white pill) | "light" (dark bg, white "Job")
 * BETA badge: driven by VITE_APP_STAGE (set to "live" to hide); beta={false} hides it per instance.
 */
const STAGE = (import.meta.env.VITE_APP_STAGE ?? "beta").toLowerCase();

function heightPx(className) {
  const m = /(?:^|\s)h-(\d+(?:\.\d+)?)(?:\s|$)/.exec(className || "");
  return m ? Number(m[1]) * 4 : 36;
}

function AnimatedMark({ size }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const u = (n) => `${n}${id}`;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className="jb-mark shrink-0 overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={u("t")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#123f75" /><stop offset="0.55" stopColor="#0c3060" /><stop offset="1" stopColor="#0a5b6b" />
        </linearGradient>
        <linearGradient id={u("s")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".18" /><stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={u("j")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5ef2d6" /><stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
        <radialGradient id={u("d")} cx=".38" cy=".35" r=".7">
          <stop offset="0" stopColor="#ffd166" /><stop offset="1" stopColor="#ff9f1c" />
        </radialGradient>
        <filter id={u("g")} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <rect width="120" height="120" rx="28" fill={`url(#${u("t")})`} />
      <rect width="120" height="120" rx="28" fill={`url(#${u("s")})`} />
      <rect x=".75" y=".75" width="118.5" height="118.5" rx="27.3" fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth="1.5" />
      <circle className="jb-glow" cx="51" cy="67" r="13" fill="#ffb020" filter={`url(#${u("g")})`} />
      <path className="jb-j" pathLength="100" d="M75 25 V65 A24 24 0 0 1 27 65 V61" fill="none"
            stroke={`url(#${u("j")})`} strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="jb-dot" cx="51" cy="67" r="10" fill={`url(#${u("d")})`} />
    </svg>
  );
}

export default function Logo({ className = "h-9", variant = "plain", beta = true }) {
  const showBeta = beta && STAGE === "beta";
  const h = heightPx(className);
  const onDark = variant === "light";
  const jobColor = onDark ? "#ffffff" : "#0b2350";
  const bayStyle = {
    backgroundImage: onDark ? "linear-gradient(90deg,#2ee6c8,#34d399)" : "linear-gradient(90deg,#0ea5a0,#10b981)",
    WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
  };

  const mark = (
    <span className="jb-logo inline-flex select-none items-center" style={{ gap: Math.round(h * 0.22) }}
          role="img" aria-label="JobBay">
      <AnimatedMark size={h} />
      <span aria-hidden="true" className="font-heading font-bold leading-none"
            style={{ fontSize: Math.round(h * 0.66), letterSpacing: "-0.02em" }}>
        <span style={{ color: jobColor }}>Job</span><span style={bayStyle}>Bay</span>
      </span>
    </span>
  );

  const badge = showBeta ? (
    <span title="This product is in beta — features may change."
          className="beta-badge relative inline-flex select-none items-center gap-1.5 overflow-hidden rounded-full
                     bg-gradient-to-r from-[#0c3060] to-[#0ea5a0] py-[3px] pl-2 pr-2.5 text-[10px] font-extrabold
                     uppercase leading-none tracking-[0.14em] text-white
                     shadow-[0_4px_12px_-3px_rgba(18,150,138,.55)] ring-1 ring-white/40">
      <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ffb020]" />
      </span>
      Beta
    </span>
  ) : null;

  if (variant === "pill") {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-white/20">
        {mark}
        {badge}
      </span>
    );
  }
  if (!badge) return mark;
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      {mark}
      {badge}
    </span>
  );
}
