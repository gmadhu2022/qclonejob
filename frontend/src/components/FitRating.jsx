import { IconStar } from "./icons";

/* =====================================================================
   Fit rating — how well a candidate's skills line up with a job.

   Shared so the recruiter and the job seeker see the SAME score presented the
   same way. A candidate told they are a "60% match" and a recruiter shown
   three stars for the same pairing would be looking at the same number
   through different lenses, which is how expectations get mismatched.

   It is a FIT rating, not a quality rating: it measures skill overlap with
   one job description and says nothing about the person otherwise.
   ===================================================================== */

const FIT_BANDS = [
  { min: 85, label: "Excellent fit", text: "text-emerald-600", bg: "bg-emerald-50", bar: "#059669" },
  { min: 70, label: "Strong fit",    text: "text-brandgreen-600", bg: "bg-brandgreen-50", bar: "#4faa38" },
  { min: 50, label: "Good fit",      text: "text-lime-600",    bg: "bg-lime-50",    bar: "#84cc16" },
  { min: 30, label: "Partial fit",   text: "text-amber-600",   bg: "bg-amber-50",   bar: "#f59e0b" },
  { min: 0,  label: "Weak fit",      text: "text-red-500",     bg: "bg-red-50",     bar: "#ef4444" },
];

export function fitBand(score) {
  const v = Math.max(0, Math.min(100, score || 0));
  return FIT_BANDS.find((b) => v >= b.min) || FIT_BANDS[FIT_BANDS.length - 1];
}

export default function FitRating({ score, showLabel, size = 12 }) {
  const v = Math.max(0, Math.min(100, score || 0));
  const stars = Math.round((v / 100) * 5 * 2) / 2;          // nearest half
  const band = fitBand(v);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${band.bg}`}
          title={`${v}% match with this job description — ${band.label}`}>
      <span className={`flex items-center ${band.text}`} aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <IconStar key={i} size={size}
                    className={i <= stars ? "" : i - 0.5 === stars ? "opacity-50" : "opacity-25"} />
        ))}
      </span>
      <span className={`text-[11px] font-bold tabular-nums ${band.text}`}>{v}%</span>
      {showLabel && <span className={`text-[11px] font-semibold ${band.text}`}>{band.label}</span>}
      <span className="sr-only">{stars} out of 5 fit — {band.label}</span>
    </span>
  );
}
