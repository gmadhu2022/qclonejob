import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../lib/api";

/**
 * A single promotional banner placed *in the content flow*.
 *
 * Deliberately not fixed/absolute/overlay — it occupies its own space in the
 * page, so it can never cover text, buttons or form fields. It's dismissible,
 * and the space collapses entirely when there's nothing to show.
 *
 * One banner per page: the slot (route path) decides which one, so a user
 * moving around the app sees different advertisers rather than the same ad.
 */
const THEMES = {
  navy:   { grad: "from-navy via-navy-600 to-navy", ring: "ring-navy/15", btn: "text-navy" },
  green:  { grad: "from-brandgreen-600 via-brandgreen to-brandgreen-600", ring: "ring-brandgreen/20", btn: "text-brandgreen-600" },
  slate:  { grad: "from-slate-800 via-slate-700 to-slate-800", ring: "ring-slate-900/15", btn: "text-slate-800" },
  cobalt: { grad: "from-blue-800 via-blue-700 to-blue-800", ring: "ring-blue-900/15", btn: "text-blue-800" },
};

export default function BannerSlot({ audience = "jobseekers", slot, compact = false, className = "" }) {
  const location = useLocation();
  const key = slot || location.pathname;
  const [banner, setBanner] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setBanner(null); setDismissed(false); setPlaying(false);
    api.get(`/api/public/banners?audience=${audience}&slot=${encodeURIComponent(key)}`, { auth: false })
      .then((d) => alive && setBanner(d.banner || null))
      .catch(() => {});
    return () => { alive = false; };
  }, [key, audience]);

  if (!banner || dismissed) return null;
  const t = THEMES[banner.theme] || THEMES.navy;

  const click = () => {
    api.post(`/api/public/banners/${banner.id}/click?slot=${encodeURIComponent(key)}`, {}, { auth: false })
      .catch(() => {});
    if (banner.cta_link) window.open(banner.cta_link, "_blank", "noopener");
  };

  const toggleAudio = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) { el.play(); setPlaying(true); } else { el.pause(); setPlaying(false); }
  };

  const hasVisual = banner.media_url && banner.media_type !== "audio";

  return (
    <section
      aria-label="Sponsored"
      className={`no-print relative isolate overflow-hidden rounded-2xl bg-gradient-to-br ${t.grad}
                  text-white shadow-card ring-1 ${t.ring} ${compact ? "mb-4" : "mb-5"} ${className}`}
    >
      {/* soft light wash — purely decorative, sits behind content */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-40"
           style={{ backgroundImage: "radial-gradient(circle at 85% 15%, rgba(255,255,255,.28) 0, transparent 55%)" }} />

      <div className={`flex flex-col gap-4 ${compact ? "p-4" : "p-5"} sm:flex-row sm:items-center`}>
        {hasVisual && (
          <div className={`shrink-0 overflow-hidden rounded-xl ring-1 ring-white/20 ${compact ? "sm:w-40" : "sm:w-52"}`}>
            {banner.media_type === "video" ? (
              <video src={banner.media_url} poster={banner.poster_url || undefined}
                     autoPlay={banner.autoplay} muted={banner.muted} loop playsInline
                     className={`w-full object-cover ${compact ? "h-24" : "h-28"}`} />
            ) : (
              <img src={banner.media_url} alt="" loading="lazy"
                   className={`w-full object-cover ${compact ? "h-24" : "h-28"}`} />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90">
              Sponsored
            </span>
            {banner.company_name && (
              <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-white/70">
                {banner.company_name}
              </span>
            )}
          </div>

          <h3 className={`mt-1.5 font-extrabold leading-snug ${compact ? "text-base" : "text-lg"}`}>
            {banner.title}
          </h3>
          {banner.text_content && (
            <p className={`mt-1 text-white/85 ${compact ? "text-[13px]" : "text-sm"}`}>{banner.text_content}</p>
          )}

          {(banner.cta_label || banner.media_type === "audio") && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {banner.cta_label && (
                <button onClick={click}
                        className={`rounded-lg bg-white px-4 py-2 text-sm font-bold ${t.btn}
                                    shadow-sm transition-transform hover:scale-[1.03] active:scale-95`}>
                  {banner.cta_label}
                </button>
              )}
              {banner.media_type === "audio" && banner.media_url && (
                <>
                  <button onClick={toggleAudio}
                          className="rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold hover:bg-white/10">
                    {playing ? "❚❚ Pause" : "▶ Listen"}
                  </button>
                  <audio ref={audioRef} src={banner.media_url} onEnded={() => setPlaying(false)} />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* dismiss sits inside the banner's own box — never over page content */}
      <button onClick={() => setDismissed(true)} aria-label="Dismiss this ad"
              className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs text-white/60
                         transition-colors hover:bg-white/15 hover:text-white">
        ×
      </button>
    </section>
  );
}
