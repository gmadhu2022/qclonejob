import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { api, mediaUrl } from "../lib/api";

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

  /* ---------------- Institute ad formats ----------------
     A flyer and a scroller are different products, not styling variants, so
     they get their own renderers rather than being squeezed through the
     generic card below.

     FLYER   The artwork is cover-cropped server-side to the ad slot's 3:1
             shape. The generic card put it in a ~200px thumbnail beside a
             title and a button, which threw away the sizing entirely and
             showed a sliver of a designed image. Here the image IS the ad.

     SCROLLER A single line that moves. The generic card rendered it as static
             body text, so the one thing that defines the format never
             happened. Marquee CSS lives in index.css and honours
             prefers-reduced-motion by standing still. */
  const format = banner.ad_format || "flyer";

  if (format === "flyer" && hasVisual) {
    return (
      <section aria-label="Sponsored"
        className={`no-print group relative isolate overflow-hidden rounded-2xl shadow-card
                    ring-1 ring-black/5 ${compact ? "mb-4" : "mb-5"} ${className}`}>
        <button onClick={click} className="block w-full text-left"
                aria-label={banner.title || "Sponsored"}>
          <div className="overflow-hidden" style={{ aspectRatio: "3 / 1" }}>
            <img src={mediaUrl(banner.media_url)} alt={banner.title || ""} loading="lazy"
                 className="h-full w-full object-cover transition-transform duration-500
                            group-hover:scale-[1.02]" />
          </div>
          <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2 py-0.5
                           text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
            Sponsored
          </span>
          {banner.text_content && (
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent
                             px-4 pb-3 pt-8 text-sm font-semibold text-white">
              <span className="line-clamp-1 block">{banner.text_content}</span>
            </span>
          )}
        </button>
        <button onClick={() => setDismissed(true)} aria-label="Dismiss ad"
                className="absolute right-2 top-2 rounded-full bg-black/35 px-2 py-0.5 text-xs
                           text-white/90 backdrop-blur-sm hover:bg-black/55">×</button>
      </section>
    );
  }

  if (format === "scroller") {
    const text = banner.text_content || banner.title || "";
    return (
      <section aria-label="Sponsored"
        className={`no-print relative isolate overflow-hidden rounded-xl bg-gradient-to-br ${t.grad}
                    text-white shadow-card ring-1 ${t.ring} ${compact ? "mb-4" : "mb-5"} ${className}`}>
        <div className="flex items-center gap-3 py-2.5 pl-3 pr-2">
          <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold
                           uppercase tracking-wider text-white/90">
            Ad
          </span>
          {/* Duration scales with length so a long message doesn't race past
              and a short one doesn't crawl. Hover pauses, so a reader who
              wants the phone number can actually get it. */}
          <button onClick={click}
                  className="marquee min-w-0 flex-1 cursor-pointer text-left text-sm font-semibold"
                  style={{ "--marquee-duration": `${Math.max(8, text.length / 7)}s` }}>
            <span className="marquee-track">
              <span className="px-6">{text}</span>
              <span className="px-6" aria-hidden>{text}</span>
            </span>
          </button>
          <button onClick={() => setDismissed(true)} aria-label="Dismiss ad"
                  className="shrink-0 rounded-full px-1.5 text-white/60 hover:text-white">×</button>
        </div>
      </section>
    );
  }

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
              <video src={mediaUrl(banner.media_url)} poster={banner.poster_url || undefined}
                     autoPlay={banner.autoplay} muted={banner.muted} loop playsInline
                     className={`w-full object-cover ${compact ? "h-24" : "h-28"}`} />
            ) : (
              <img src={mediaUrl(banner.media_url)} alt="" loading="lazy"
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
                  <audio ref={audioRef} src={mediaUrl(banner.media_url)} onEnded={() => setPlaying(false)} />
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
