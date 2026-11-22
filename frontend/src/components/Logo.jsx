import jobbayMark from "../assets/brand/jobbay-mark.svg";

/**
 * JobBay logo — vector mark (assets/brand/jobbay-mark.svg) + live-text
 * wordmark ("Job" navy, "Bay" teal, Poppins Bold), so it is sharp at every
 * size and on every screen density.
 *
 * Sizing: pass a Tailwind height class as before (h-8, h-9, h-10, h-11 …);
 * the mark takes that height and the wordmark scales with it.
 *
 * variant: "plain" (light backgrounds) | "pill" (dark backgrounds — white pill)
 *          | "light" (dark backgrounds — white "Job", no pill)
 *
 * BETA BADGE — driven by VITE_APP_STAGE; set VITE_APP_STAGE=live to hide it.
 * Pass beta={false} to hide it on a specific instance.
 */
const STAGE = (import.meta.env.VITE_APP_STAGE ?? "beta").toLowerCase();

function heightPx(className) {
  const m = /(?:^|\s)h-(\d+(?:\.\d+)?)(?:\s|$)/.exec(className || "");
  return m ? Number(m[1]) * 4 : 36;
}

export default function Logo({ className = "h-9", variant = "plain", beta = true }) {
  const showBeta = beta && STAGE === "beta";
  const h = heightPx(className);
  const onDark = variant === "light";
  const jobColor = onDark ? "#ffffff" : "#0b2350";
  // "Bay" in a teal → green gradient (brighter on dark backgrounds).
  const bayStyle = {
    backgroundImage: onDark ? "linear-gradient(90deg,#2ee6c8,#34d399)" : "linear-gradient(90deg,#0ea5a0,#10b981)",
    WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
  };

  const mark = (
    <span className="inline-flex select-none items-center" style={{ gap: Math.round(h * 0.22) }}
          role="img" aria-label="JobBay">
      <img src={jobbayMark} alt="" draggable="false" style={{ height: h, width: h }} className="shrink-0" />
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
