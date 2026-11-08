import { useState } from "react";
import { AdView, adHasVisual } from "./BannerSlot";

/* =====================================================================
   Shared pieces for the two "Post an ad" screens (recruiter + institute):
     AdTypePicker  – big cards: Image / GIF / Video / Video link / Text
     AdPreview     – the ad drawn by the SAME renderer the live slot uses,
                     in a desktop frame and a phone frame
     AdStep        – numbered section card
   ===================================================================== */

const TYPE_ICONS = {
  image: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-9 9" />
    </svg>
  ),
  gif: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="M10 9.5H8a1.5 1.5 0 0 0-1.5 1.5v2A1.5 1.5 0 0 0 8 14.5h2V12H8.8M13 9.5v5M16 14.5v-5h2.2M16 12h1.8" />
    </svg>
  ),
  video: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5" width="14" height="14" rx="2.5" /><path d="m16.5 10 5-3v10l-5-3" />
    </svg>
  ),
  link: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  ),
  text: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7V5h16v2M12 5v14M9 19h6" />
    </svg>
  ),
};

const TYPE_TONES = {
  image: "bg-blue-50 text-blue-600",
  gif: "bg-fuchsia-50 text-fuchsia-600",
  video: "bg-rose-50 text-rose-600",
  link: "bg-amber-50 text-amber-600",
  text: "bg-emerald-50 text-emerald-600",
};

/** types: [[key, label, hint], ...] — compact tiles; the selected one's hint
    is shown once, underneath, instead of five squeezed paragraphs. */
export function AdTypePicker({ types, value, onChange }) {
  const cur = types.find(([k]) => k === value);
  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
        {types.map(([k, label]) => {
          const on = value === k;
          return (
            <button key={k} type="button" onClick={() => onChange(k)} aria-pressed={on}
                    className={`group relative flex flex-col items-center gap-2 rounded-2xl px-2 pb-3 pt-4 text-center transition-all duration-200
                      focus:outline-none focus-visible:ring-4 focus-visible:ring-navy/15
                      ${on ? "bg-gradient-to-b from-navy-50 to-white ring-2 ring-navy shadow-[0_14px_30px_-16px_rgba(79,70,229,.7)]"
                           : "bg-white ring-1 ring-slate-200 hover:-translate-y-0.5 hover:ring-navy-200 hover:shadow-card"}`}>
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105
                ${on ? "bg-navy text-white shadow-md" : TYPE_TONES[k] || TYPE_TONES.image}`}>
                {TYPE_ICONS[k] || TYPE_ICONS.image}
              </span>
              <span className={`text-[12.5px] font-semibold leading-tight ${on ? "text-navy" : "text-slate-700"}`}>{label}</span>
              {on && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-navy text-white ring-2 ring-white">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
      {cur && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2 text-[12.5px] text-slate-600">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-navy" />
          <b className="font-semibold text-slate-800">{cur[1]}:</b> {cur[2]}
        </p>
      )}
    </div>
  );
}

export function AdStep({ n, title, sub, action, children, plain = false }) {
  if (plain) {
    return (
      <section className="relative rounded-2xl border border-slate-200 bg-white p-6 focus-within:z-20">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-50 text-[12.5px] font-bold text-navy">{n}</span>
            <div>
              <h3 className="font-heading text-[15.5px] font-bold leading-tight text-slate-900">{title}</h3>
              {sub && <p className="mt-0.5 text-[12.5px] text-slate-500">{sub}</p>}
            </div>
          </div>
          {action}
        </div>
        {children}
      </section>
    );
  }
  return (
    <section className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,.04)] focus-within:z-20">
      <span aria-hidden="true" className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b from-navy to-violet-400 opacity-80" />
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-navy to-violet-500 font-heading text-[14px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(79,70,229,.8)]">{n}</span>
          <div>
            <h3 className="font-heading text-[16.5px] font-bold leading-tight text-slate-900">{title}</h3>
            {sub && <p className="mt-0.5 text-[12.5px] text-slate-500">{sub}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/* Placeholder slot shown until there is something real to preview — a fake
   "Your headline" ad made an empty form look like a finished one. */
function EmptySlot({ mobile, scroller }) {
  if (scroller) {
    return (
      <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-3 py-2.5 text-[12px] text-slate-400">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9.5px] font-bold uppercase text-slate-400">Ad</span>
        Your scrolling message appears here
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 bg-[repeating-linear-gradient(135deg,#f8fafc_0_10px,#f1f5f9_10px_20px)] text-center"
         style={{ aspectRatio: mobile ? "16 / 9" : "3 / 1" }}>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
        {TYPE_ICONS.image}
      </span>
      <span className="text-[11.5px] font-semibold text-slate-500">Your ad appears here</span>
      <span className="text-[10px] text-slate-400">{mobile ? "16:9 on phones" : "3:1 · 1080 × 360"}</span>
    </div>
  );
}

const isEmptyAd = (b) => {
  if ((b.ad_format || "flyer") === "scroller") return !String(b.text_content || "").trim();
  if (b.media_type === "none") return !String(b.title || b.text_content || "").trim();
  return !adHasVisual(b);
};

/** Live preview: the real renderer, in a desktop frame and a phone frame. */
export function AdPreview({ banner, note, where = ["Job seeker pages", "Mobile app"] }) {
  const [device, setDevice] = useState("desktop");
  const empty = isEmptyAd(banner);
  const scroller = (banner.ad_format || "flyer") === "scroller";
  const slot = (mobile) => (empty
    ? <EmptySlot mobile={mobile} scroller={scroller} />
    : <AdView banner={banner} compact mobile={mobile} className="!mb-0" />);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_-28px_rgba(15,23,42,.35)]">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-navy-50/70 to-white px-5 py-4">
        <div>
          <p className="flex items-center gap-2 font-heading text-[15px] font-bold text-slate-900">
            <span className={`h-2 w-2 rounded-full ${empty ? "bg-slate-300" : "animate-pulse bg-brandgreen"}`} /> Live preview
          </p>
          <p className="text-[11.5px] text-slate-500">{empty ? "Fill in the steps to see your ad" : "Exactly how it appears on the portal"}</p>
        </div>
        <div className="inline-flex rounded-full bg-white p-0.5 text-[11.5px] font-semibold ring-1 ring-slate-200">
          {[["desktop", "Website"], ["mobile", "Mobile"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setDevice(k)}
                    className={`rounded-full px-3 py-1 transition-all focus:outline-none ${device === k ? "bg-navy text-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[radial-gradient(circle_at_1px_1px,#e2e8f0_1px,transparent_0)] p-5 [background-size:16px_16px]">
        {device === "desktop" ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-red-300" /><span className="h-2 w-2 rounded-full bg-amber-300" /><span className="h-2 w-2 rounded-full bg-emerald-300" />
              <span className="ml-2 flex h-4 flex-1 items-center rounded-full bg-white px-2 text-[8px] text-slate-400 ring-1 ring-slate-200">qclonejob.com/jobseeker</span>
            </div>
            <div className="flex">
              <div className="w-12 shrink-0 space-y-1.5 border-r border-slate-100 bg-slate-50/70 p-2">
                {[0, 1, 2, 3].map((i) => <div key={i} className={`h-1.5 rounded ${i === 0 ? "bg-navy/40" : "bg-slate-200"}`} />)}
              </div>
              <div className="min-w-0 flex-1 space-y-2 p-3">
                <div className="h-2 w-1/3 rounded bg-slate-200" />
                {slot(false)}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[0, 1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-white ring-1 ring-slate-200" />)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-[230px] rounded-[32px] bg-slate-900 p-2 shadow-2xl ring-1 ring-slate-700">
              <div className="overflow-hidden rounded-[25px] bg-slate-50">
                <div className="flex items-center justify-between bg-white px-4 py-1.5 text-[8px] font-semibold text-slate-500">
                  <span>9:41</span><span className="h-1.5 w-12 rounded-full bg-slate-900" /><span>5G</span>
                </div>
                <div className="space-y-2 p-2.5">
                  <div className="h-2 w-1/2 rounded bg-slate-200" />
                  {slot(true)}
                  {[0, 1, 2].map((i) => <div key={i} className="h-9 rounded-lg bg-white ring-1 ring-slate-200" />)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-4">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Where it shows</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {where.map((w) => (
            <span key={w} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{w}</span>
          ))}
        </div>
        {note && <p className="mt-3 text-[11.5px] leading-snug text-slate-400">{note}</p>}
      </div>
    </div>
  );
}
