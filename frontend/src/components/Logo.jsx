import logoMark from "../assets/logo-mark.png";

/**
 * Crisp logo. The source PNG has a white background, so on dark surfaces we sit it
 * inside a white "pill" rather than CSS-inverting it (inverting an anti-aliased raster
 * is what caused the fuzzy halo).
 *
 * variant: "plain" (light backgrounds) | "pill" (dark backgrounds)
 */
export default function Logo({ className = "h-9", variant = "plain" }) {
  const img = (
    <img
      src={logoMark}
      alt="QCloneJob — Qualification Meets Job"
      className={`${className} w-auto select-none`}
      draggable="false"
      style={{ imageRendering: "auto" }}
    />
  );

  if (variant === "pill") {
    return (
      <span className="inline-flex items-center rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-white/20">
        {img}
      </span>
    );
  }
  return img;
}
