import logoMark from "../assets/logo-mark.png";

/**
 * Crisp logo. The source PNG has a white background, so on dark surfaces we sit it
 * inside a white "pill" rather than CSS-inverting it (inverting an anti-aliased raster
 * is what caused the fuzzy halo).
 *
 * variant: "plain" (light backgrounds) | "pill" (dark backgrounds)
 *
 * BETA BADGE
 * ----------
 * Added here rather than in each header because the logo is the one thing
 * every screen already shows — public pages, all four portals and both login
 * screens. One change, no layout touched, nothing to miss.
 *
 * Driven by VITE_APP_STAGE so dropping the badge at launch is an environment
 * change, not a code change and a redeploy of a component. Set
 * VITE_APP_STAGE=live (or anything other than "beta") and it disappears.
 * Pass beta={false} to hide it on a specific instance.
 */
const STAGE = (import.meta.env.VITE_APP_STAGE ?? "beta").toLowerCase();

export default function Logo({ className = "h-9", variant = "plain", beta = true }) {
  const showBeta = beta && STAGE === "beta";
  const img = (
    <img
      src={logoMark}
      alt="QCloneJob — Qualification Meets Job"
      className={`${className} w-auto select-none`}
      draggable="false"
      style={{ imageRendering: "auto" }}
    />
  );

  /* aria-hidden on the text: the logo's alt text already names the product,
     and a screen reader announcing "QCloneJob … BETA" twice per page is
     noise. The title attribute carries the meaning for anyone who hovers. */
  const badge = showBeta ? (
    <span title="This product is in beta — features may change."
          className="beta-badge relative inline-flex select-none items-center gap-1.5 overflow-hidden rounded-full
                     bg-gradient-to-r from-navy to-brandgreen-600 py-[3px] pl-2 pr-2.5 text-[10px] font-extrabold
                     uppercase leading-none tracking-[0.14em] text-white
                     shadow-[0_4px_12px_-3px_rgba(79,70,229,.55)] ring-1 ring-white/40">
      <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
      </span>
      Beta
    </span>
  ) : null;

  if (variant === "pill") {
    return (
      <span className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-white/20">
        {img}
        {badge}
      </span>
    );
  }

  /* No badge: return the bare <img> exactly as before, so nothing that
     positions or sizes the logo today can shift. */
  if (!badge) return img;

  return (
    <span className="inline-flex items-center gap-2 align-middle">
      {img}
      {badge}
    </span>
  );
}
