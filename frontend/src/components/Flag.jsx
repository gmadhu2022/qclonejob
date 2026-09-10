import { useState } from "react";

/**
 * Country flag.
 *
 * Flag EMOJI don't work here. Windows ships no flag glyphs at all, so Chrome
 * on Windows renders the regional-indicator pair for 🇱🇦 as the literal text
 * "LA" — which is exactly what showed up in the phone field. macOS, iOS and
 * Android render them fine, which is what makes it easy to miss.
 *
 * So this renders a real image and keeps the emoji only as a last resort:
 *
 *   1. <img> from flagcdn (tiny PNG, ~400 bytes, cached by the browser)
 *   2. if that fails to load (offline, blocked, unknown code) -> emoji
 *   3. if the emoji has no glyph either, the ISO code is at least legible
 *      because it sits in a bordered box that looks deliberate
 *
 * Falling back rather than depending on the CDN matters: an air-gapped or
 * firewalled deployment still gets a usable picker instead of 198 broken
 * image icons.
 */
export default function Flag({ iso, emoji, size = 20, className = "" }) {
  const [failed, setFailed] = useState(false);
  const code = String(iso || "").toLowerCase();

  if (failed || !code) {
    return (
      <span className={`inline-flex items-center justify-center rounded-sm bg-slate-100
                        text-[9px] font-bold leading-none text-slate-500 ${className}`}
            style={{ width: size, height: Math.round(size * 0.75) }}
            title={iso}>
        {emoji || iso}
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      width={size}
      height={Math.round(size * 0.75)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-sm object-cover ring-1 ring-black/5 ${className}`}
      style={{ width: size, height: Math.round(size * 0.75) }}
    />
  );
}
