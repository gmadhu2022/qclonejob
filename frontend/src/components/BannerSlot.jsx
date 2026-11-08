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
 *
 * The drawing lives in <AdView>, which the Post-an-ad screens also use for
 * their live preview — so what an advertiser previews is exactly what is
 * shown, not an approximation of it.
 */
export const AD_THEMES = {
  navy:   { grad: "from-navy via-navy-600 to-navy", ring: "ring-navy/15", btn: "text-navy" },
  green:  { grad: "from-brandgreen-600 via-brandgreen to-brandgreen-600", ring: "ring-brandgreen/20", btn: "text-brandgreen-600" },
  slate:  { grad: "from-slate-800 via-slate-700 to-slate-800", ring: "ring-slate-900/15", btn: "text-slate-800" },
  cobalt: { grad: "from-blue-800 via-blue-700 to-blue-800", ring: "ring-blue-900/15", btn: "text-blue-800" },
};

/** YouTube / Vimeo / direct video link -> something we can play. */
export function toEmbedUrl(url) {
  const u = (url || "").trim();
  if (!u) return null;
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { src: `https://www.youtube.com/embed/${yt[1]}`, direct: false, id: yt[1], kind: "youtube" };
  const vim = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vim) return { src: `https://player.vimeo.com/video/${vim[1]}`, direct: false, id: vim[1], kind: "vimeo" };
  if (/^https?:\/\/\S+\.(mp4|webm|mov)(\?\S*)?$/i.test(u)) return { src: u, direct: true, kind: "file" };
  return null;
}

/**
 * The ad's visual, filling whatever box it is put in (object-cover), so every
 * format — still, GIF, uploaded video, linked video — lines up with the slot
 * instead of letterboxing or overflowing it.
 */
export function AdMedia({ banner, className = "", interactive = false }) {
  const type = banner.media_type;
  const embed = toEmbedUrl(banner.video_url);
  const fill = `h-full w-full object-cover ${className}`;
  if (embed) {
    if (embed.direct) {
      return <video src={embed.src} poster={banner.poster_url || undefined} className={fill}
                    autoPlay={banner.autoplay !== false} muted={banner.muted !== false} loop playsInline />;
    }
    const q = embed.kind === "youtube"
      ? `?autoplay=1&mute=1&loop=1&playlist=${embed.id}&controls=0&modestbranding=1&playsinline=1&rel=0`
      : "?autoplay=1&muted=1&loop=1&background=1";
    return (
      <iframe src={`${embed.src}${q}`} title={banner.title || "Video ad"} allow="autoplay; encrypted-media; picture-in-picture"
              className={`h-full w-full ${interactive ? "" : "pointer-events-none"} ${className}`}
              style={{ border: 0 }} loading="lazy" />
    );
  }
  if (!banner.media_url) return null;
  if (type === "video") {
    return <video src={mediaUrl(banner.media_url)} poster={banner.poster_url || undefined} className={fill}
                  autoPlay={banner.autoplay !== false} muted={banner.muted !== false} loop playsInline />;
  }
  return <img src={mediaUrl(banner.media_url)} alt={banner.title || ""} loading="lazy" className={fill} />;
}

export const adHasVisual = (b) =>
  !!(toEmbedUrl(b.video_url) || (b.media_url && b.media_type !== "audio" && b.media_type !== "none"));

/** Pure renderer for one ad. `onClick` / `onDismiss` are optional (preview). */
export function AdView({ banner, compact = false, className = "", onClick, onDismiss, mobile = false }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);
  const t = AD_THEMES[banner.theme] || AD_THEMES.navy;
  const format = banner.ad_format || "flyer";
  const hasVisual = adHasVisual(banner);
  const gap = className.includes("mb-") ? "" : compact ? "mb-4" : "mb-5";

  const toggleAudio = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) { el.play(); setPlaying(true); } else { el.pause(); setPlaying(false); }
  };

  /* SCROLLER: a single line that moves. Marquee CSS lives in index.css and
     honours prefers-reduced-motion by standing still. */
  if (format === "scroller") {
    const text = banner.text_content || banner.title || "Your scroller text appears here";
    return (
      <section aria-label="Sponsored"
        className={`no-print relative isolate overflow-hidden rounded-xl bg-gradient-to-br ${t.grad}
                    text-white shadow-card ring-1 ${t.ring} ${gap} ${className}`}>
        <div className="flex items-center gap-3 py-2.5 pl-3 pr-2">
          <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90">Ad</span>
          <button onClick={onClick}
                  className="marquee min-w-0 flex-1 cursor-pointer text-left text-sm font-semibold"
                  style={{ "--marquee-duration": `${Math.max(8, text.length / 7)}s` }}>
            <span className="marquee-track">
              <span className="px-6">{text}</span>
              <span className="px-6" aria-hidden>{text}</span>
            </span>
          </button>
          {onDismiss && (
            <button onClick={onDismiss} aria-label="Dismiss ad"
                    className="shrink-0 rounded-full px-1.5 text-white/60 hover:text-white">×</button>
          )}
        </div>
      </section>
    );
  }

  /* FLYER / MEDIA: the visual IS the ad, in the slot's fixed 3:1 shape
     (16:9 on a phone, where a 3:1 strip is too thin to read). Images,
     GIFs and videos all fill the frame the same way. */
  if (hasVisual) {
    const showCopy = banner.cta_label || banner.text_content;
    return (
      <section aria-label="Sponsored"
        className={`no-print group relative isolate overflow-hidden rounded-2xl bg-slate-900 shadow-card ring-1 ring-black/5 ${gap} ${className}`}>
        <div onClick={onClick} role={onClick ? "button" : undefined}
             className={`relative block w-full overflow-hidden ${onClick ? "cursor-pointer" : ""}`}
             style={{ aspectRatio: mobile ? "16 / 9" : "3 / 1" }}>
          <AdMedia banner={banner} className="transition-transform duration-500 group-hover:scale-[1.02]" />
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
            Sponsored{banner.media_type === "video" || toEmbedUrl(banner.video_url) ? " · Video" : banner.media_type === "gif" ? " · GIF" : ""}
          </span>
          {showCopy && (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pb-3 pt-10 text-white">
              <span className="min-w-0">
                {banner.cta_label && banner.title && (
                  <span className={`block truncate font-bold ${mobile ? "text-[13px]" : "text-[15px]"}`}>{banner.title}</span>
                )}
                {banner.text_content && (
                  <span className={`line-clamp-1 block font-medium text-white/85 ${mobile ? "text-[11px]" : "text-[13px]"}`}>{banner.text_content}</span>
                )}
              </span>
              {banner.cta_label && (
                <span className={`pointer-events-auto shrink-0 rounded-full bg-white font-bold shadow ${t.btn} ${mobile ? "px-2.5 py-1 text-[10.5px]" : "px-3.5 py-1.5 text-[12.5px]"}`}>
                  {banner.cta_label}
                </span>
              )}
            </span>
          )}
        </div>
        {onDismiss && (
          <button onClick={onDismiss} aria-label="Dismiss ad"
                  className="absolute right-2 top-2 rounded-full bg-black/35 px-2 py-0.5 text-xs text-white/90 backdrop-blur-sm hover:bg-black/55">×</button>
        )}
      </section>
    );
  }

  /* TEXT CARD: no visual — a branded gradient card with title, message, CTA. */
  return (
    <section aria-label="Sponsored"
      className={`no-print relative isolate overflow-hidden rounded-2xl bg-gradient-to-br ${t.grad}
                  text-white shadow-card ring-1 ${t.ring} ${gap} ${className}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-40"
           style={{ backgroundImage: "radial-gradient(circle at 85% 15%, rgba(255,255,255,.28) 0, transparent 55%)" }} />
      <div className={compact || mobile ? "p-4" : "p-5"}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/90">Sponsored</span>
          {banner.company_name && (
            <span className="truncate text-[11px] font-semibold uppercase tracking-wider text-white/70">{banner.company_name}</span>
          )}
        </div>
        <h3 className={`mt-1.5 font-extrabold leading-snug ${compact || mobile ? "text-base" : "text-lg"}`}>
          {banner.title || "Your headline"}
        </h3>
        {banner.text_content && (
          <p className={`mt-1 text-white/85 ${compact || mobile ? "text-[13px]" : "text-sm"}`}>{banner.text_content}</p>
        )}
        {(banner.cta_label || banner.media_type === "audio") && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {banner.cta_label && (
              <button onClick={onClick}
                      className={`rounded-lg bg-white px-4 py-2 text-sm font-bold ${t.btn} shadow-sm transition-transform hover:scale-[1.03] active:scale-95`}>
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
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss this ad"
                className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs text-white/60 transition-colors hover:bg-white/15 hover:text-white">×</button>
      )}
    </section>
  );
}

export default function BannerSlot({ audience = "jobseekers", slot, compact = false, className = "" }) {
  const location = useLocation();
  const key = slot || location.pathname;
  const [banner, setBanner] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    setBanner(null); setDismissed(false);
    api.get(`/api/public/banners?audience=${audience}&slot=${encodeURIComponent(key)}`, { auth: false })
      .then((d) => alive && setBanner(d.banner || null))
      .catch(() => {});
    return () => { alive = false; };
  }, [key, audience]);

  if (!banner || dismissed) return null;

  const click = () => {
    api.post(`/api/public/banners/${banner.id}/click?slot=${encodeURIComponent(key)}`, {}, { auth: false })
      .catch(() => {});
    if (banner.cta_link) window.open(banner.cta_link, "_blank", "noopener");
  };

  return <AdView banner={banner} compact={compact} className={className}
                 onClick={click} onDismiss={() => setDismissed(true)} />;
}
