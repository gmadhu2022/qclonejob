import { mediaUrl } from "../lib/api";
import { IconBuilding, IconBookmark } from "./icons";

/**
 * One job, laid out the way every major portal lays one out.
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * The old card was a bold title, then every attribute crushed into a single
 * line joined by "·" — location · category · experience · salary — then the
 * buttons. Scanning twenty of those is genuinely hard: there is no fixed place
 * for salary, so the eye has to re-read each line to find it, and no company
 * identity at all, which is the first thing a seeker judges a listing by.
 *
 * This follows the shape Naukri and LinkedIn both settled on, because it is
 * the one that scans:
 *
 *   logo | title                                   [save]
 *        | company
 *        | experience · salary · location      <- fixed order, fixed place
 *        | one line of the description
 *        | skill chips                    posted date
 *
 * Each attribute keeps the same slot on every card, so after the first card
 * the eye knows where to look and reading the next twenty is nearly free.
 *
 * Deliberately NOT changed: the colour palette, the fonts and the button
 * styles. This is a layout and hierarchy change on the existing theme.
 */
export default function JobCard({
  job,
  onOpen,                    // open the full description
  onSave, onApply,           // optional actions; omitted on public pages
  saveLabel,
  children,                  // extra content (AI panels, match chips)
  right,                     // extra buttons beside Save/Apply
  compact = false,
}) {
  const j = job || {};
  const location = j.location || j.company_location;

  /* "3 days ago" beats a date: a seeker cares how stale a posting is, not
     what the calendar said when it went up. */
  const posted = relativeDate(j.created_at);

  /* Fixed order, every card: experience, then salary, then location. Blank
     ones drop out rather than leaving a stray separator. */
  const facts = [
    j.experience && { key: "exp", text: j.experience },
    j.salary && { key: "pay", text: j.salary },
    location && { key: "loc", text: location },
  ].filter(Boolean);

  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-5 transition-all
                    duration-200 hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-cardhover">
      <div className="flex items-start gap-4">
        <CompanyLogo name={j.company_name} url={j.company_logo_url} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <button type="button" onClick={() => onOpen?.(j)}
                      className="block text-left text-[15px] font-bold leading-snug text-slate-800
                                 transition-colors group-hover:text-navy hover:underline">
                {j.title || "Untitled role"}
              </button>
              {j.company_name && (
                <p className="mt-0.5 truncate text-sm text-slate-600">{j.company_name}</p>
              )}
            </div>

            {onSave && (
              /* Top-right, where every portal puts it, so it is reachable
                 without reading the card first. */
              <button type="button" onClick={() => onSave(j.id)}
                      title={saveLabel || "Save this job"}
                      aria-label={saveLabel || "Save this job"}
                      className={`shrink-0 rounded-lg p-2 transition-colors hover:bg-slate-100
                        ${j.saved ? "text-navy" : "text-slate-400 hover:text-navy"}`}>
                <IconBookmark size={17} />
              </button>
            )}
          </div>

          {facts.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-600">
              {facts.map((f, i) => (
                <span key={f.key} className="flex items-center gap-3">
                  {i > 0 && <span className="text-slate-300" aria-hidden>|</span>}
                  <span className="truncate">{f.text}</span>
                </span>
              ))}
            </div>
          )}

          {!compact && j.description && (
            /* One line only. A card is an index entry, not the document —
               the full description is one click away. */
            <p className="mt-2 line-clamp-1 text-[13px] text-slate-500">
              {stripMarkup(j.description)}
            </p>
          )}

          {/* Attribute chips — the row competing portals use to let someone
              rule a job in or out without opening it. Only what is actually
              set appears; an empty row collapses rather than printing blanks. */}
          {(j.job_type || j.shift || j.no_of_positions > 0 || j.education_level
            || j.is_urgent || j.accommodation || j.food_provided) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {j.is_urgent && (
                <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-bold
                                 uppercase tracking-wide text-red-600">
                  Urgent hiring
                </span>
              )}
              {j.job_type && <Chip>{j.job_type}</Chip>}
              {j.shift && <Chip>{j.shift} shift</Chip>}
              {j.no_of_positions > 0 && (
                <Chip>{j.no_of_positions} opening{j.no_of_positions === 1 ? "" : "s"}</Chip>
              )}
              {j.education_level && <Chip>{j.education_level}</Chip>}
              {/* These two decide whether a job is viable for a migrant
                  worker, which is a large part of who this platform is for. */}
              {j.accommodation && <Chip tone="green">Accommodation</Chip>}
              {j.food_provided && <Chip tone="green">Food provided</Chip>}
            </div>
          )}

          {j.key_skills?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {j.key_skills.slice(0, 5).map((k) => (
                <span key={k} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px]
                                         font-medium capitalize text-slate-600">
                  {k}
                </span>
              ))}
              {j.key_skills.length > 5 && (
                <span className="px-1 py-0.5 text-[11px] text-slate-400">
                  +{j.key_skills.length - 5} more
                </span>
              )}
            </div>
          )}

          {children}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2
                          border-t border-slate-100 pt-3">
            <span className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
              {posted}
              {j.applicants != null && (
                <>
                  <span aria-hidden>·</span>
                  <span>{j.applicants} applicant{j.applicants === 1 ? "" : "s"}</span>
                </>
              )}
              {/* Worth saying out loud: a seeker who applies early is seen
                  before the recruiter has a hundred CVs to wade through. */}
              {j.early_applicant && (j.applicants ?? 0) < 10 && (
                <span className="rounded bg-brandgreen-50 px-1.5 py-0.5 font-semibold
                                 text-brandgreen-600">
                  Be an early applicant
                </span>
              )}
              {j.status && j.status !== "active" && (
                <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 font-semibold text-red-600">
                  Closed
                </span>
              )}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {right}
              {onOpen && (
                <button type="button" onClick={() => onOpen(j)}
                        className="text-xs font-semibold text-navy hover:underline">
                  View details
                </button>
              )}
              {onApply && (
                <button className={`btn-sm ${j.applied ? "btn-outline !opacity-60" : "btn-green"}`}
                        disabled={j.applied || j.status === "closed"}
                        onClick={() => onApply(j.id)}>
                  {j.applied ? "Applied" : "Apply"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The company mark.
 *
 * Falls back to the initial on a tinted square rather than a generic grey
 * placeholder: most employers on this platform have not uploaded a logo yet,
 * and a page of identical grey boxes looks broken, while a page of lettered
 * tiles looks deliberate and still distinguishes one company from the next.
 */
export function CompanyLogo({ name, url, size = 48 }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg
                    border border-slate-200 bg-white"
         style={{ width: size, height: size }}>
      {url ? (
        <img src={mediaUrl(url)} alt={name ? `${name} logo` : ""} loading="lazy"
             className="h-full w-full object-contain p-1" />
      ) : name ? (
        <span className="text-base font-bold text-navy-600">{initial}</span>
      ) : (
        <IconBuilding size={18} className="text-slate-300" />
      )}
    </div>
  );
}

function Chip({ children, tone }) {
  return (
    <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium capitalize
      ${tone === "green" ? "bg-brandgreen-50 text-brandgreen-600" : "bg-navy-50 text-navy-700"}`}>
      {children}
    </span>
  );
}

/* "Today" / "3 days ago" / "2 weeks ago". Returns "" for a missing date so the
   row collapses instead of printing "Invalid Date". */
export function relativeDate(value) {
  if (!value) return "";
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return "";
  const days = Math.floor((Date.now() - then.getTime()) / 86400000);
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted yesterday";
  if (days < 7) return `Posted ${days} days ago`;
  if (days < 14) return "Posted 1 week ago";
  if (days < 30) return `Posted ${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "Posted 1 month ago";
  return `Posted ${Math.floor(days / 30)} months ago`;
}

/* Descriptions are stored as light markdown. The preview line is one line of
   plain text, so the markers would otherwise show up as literal #s and **s. */
function stripMarkup(text) {
  return String(text || "")
    .replace(/[#*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
