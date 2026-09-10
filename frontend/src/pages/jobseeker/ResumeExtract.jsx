import { useState } from "react";
import { extractResumeText, parseResumeText } from "../../lib/resumeText";
import { useToast } from "../../components/ui";
import { IconSparkle, IconCheck } from "../../components/icons";

/**
 * Read an uploaded resume into the profile sections.
 *
 * This is the link that makes an uploaded file useful: the resume templates
 * render from structured profile data, so until the file's contents are
 * extracted and parsed, changing template shows an empty design no matter what
 * the upload contains. Once applied, every template — current and future —
 * renders the real information, live.
 *
 * Nothing is saved silently. Everything found is shown for review first,
 * because an automated parse is a good first draft and a bad final answer.
 */
export default function ResumeExtract({ seeker, url, filename, onApply, aiCall, aiOn }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(null);
  const [picked, setPicked] = useState({});

  const ext = (filename || "").split("?")[0].split(".").pop()?.toLowerCase();
  const supported = ext === "docx" || ext === "pdf";

  const read = async () => {
    setBusy(true);
    try {
      const text = await extractResumeText(url, filename);
      if (!text || text.trim().length < 40) {
        toast("Couldn't read any text from that file. A scanned image PDF has no text layer.", "error");
        return;
      }
      /* AI first when it's switched on — it handles unusual layouts far better.
         The local parser is the fallback, and it matters: AI_ENABLED is false
         by default, so without it this button would do nothing on a fresh
         install. */
      let parsed = null;
      if (aiOn && aiCall) {
        parsed = await aiCall("/api/ai/resume/parse", { text });
      }
      if (!parsed) parsed = parseResumeText(text);

      const rows = buildRows(parsed, seeker);
      if (!rows.length) {
        toast("Read the file, but couldn't identify anything new to add.", "error");
        return;
      }
      setFound(rows);
      // Everything pre-selected: the common case is "yes, use all of this".
      setPicked(Object.fromEntries(rows.map((r) => [r.key, true])));
    } catch (err) {
      toast(err.message || "Couldn't read that file.", "error");
    } finally { setBusy(false); }
  };

  const apply = () => {
    const patch = {};
    found.filter((r) => picked[r.key]).forEach((r) => { patch[r.field] = r.value; });
    onApply(patch);
    setFound(null);
  };

  if (!supported) {
    return (
      <p className="text-xs text-slate-400">
        Reading text into your profile works for PDF and .docx files.
        {ext === "doc" && " Re-save this as .docx to use it."}
      </p>
    );
  }

  return (
    <div>
      {!found ? (
        <button className="btn-outline btn-sm" onClick={read} disabled={busy}>
          <IconSparkle size={14} />
          {busy ? "Reading your resume…" : "Read into my profile sections"}
        </button>
      ) : (
        <div className="rounded-xl border border-navy-200 bg-navy-50/40 p-4">
          <h4 className="text-[13px] font-bold text-navy">
            Found {found.length} item(s) in your resume
          </h4>
          <p className="mb-3 text-xs text-slate-500">
            Untick anything you'd rather keep as it is. Applying fills your profile sections,
            so every resume template shows this information.
          </p>

          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {found.map((r) => (
              <label key={r.key}
                     className="flex cursor-pointer items-start gap-2 rounded-lg bg-white px-3 py-2">
                <input type="checkbox" className="mt-0.5" checked={!!picked[r.key]}
                       onChange={(e) => setPicked({ ...picked, [r.key]: e.target.checked })} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {r.label}
                    {r.replaces && <span className="ml-1 normal-case text-amber-600">replaces existing</span>}
                  </span>
                  <span className="block break-words text-[13px] text-slate-700">{r.preview}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <button className="btn btn-sm" onClick={apply}
                    disabled={!Object.values(picked).some(Boolean)}>
              <IconCheck size={14} /> Apply to my profile
            </button>
            <button className="btn-outline btn-sm" onClick={() => setFound(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Turn a parsed result into reviewable rows. Only offers a field when there is
   something to offer, and flags when accepting would overwrite existing data
   so the seeker isn't surprised. */
function buildRows(p, seeker) {
  const rows = [];
  const push = (key, field, label, value, preview) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value) && !value.length) return;
    if (typeof value === "string" && !value.trim()) return;
    const existing = seeker?.[field];
    const hasExisting = Array.isArray(existing) ? existing.length > 0 : !!existing;
    rows.push({ key, field, label, value, preview, replaces: hasExisting });
  };

  push("first", "first_name", "First name", p.first_name, p.first_name);
  push("last", "last_name", "Last name", p.last_name, p.last_name);
  push("phone", "phone", "Phone", p.phone, p.phone);
  push("loc", "location", "Location", p.location, p.location);
  push("obj", "career_objective", "Career objective", p.career_objective,
       (p.career_objective || "").slice(0, 160));
  push("skills", "key_skills", "Key skills", p.key_skills, (p.key_skills || []).join(", "));
  push("certs", "certifications", "Certifications", p.certifications,
       (p.certifications || []).join(", "));
  push("langs", "languages", "Languages", p.languages, (p.languages || []).join(", "));

  /* Education and experience: the AI returns structured objects, the local
     parser returns lines. Map the lines into the shape the templates expect
     rather than dropping them — a line in the right field beats nothing. */
  if (p.education?.length) {
    push("edu", "education", "Education", p.education,
         p.education.map((e) => [e.degree, e.institute, e.year_of_passing].filter(Boolean).join(", ")).join(" · "));
  } else if (p.education_lines?.length) {
    push("edu", "education", "Education",
         p.education_lines.map((l) => ({ degree: l })), p.education_lines.join(" · "));
  }

  if (p.experience?.length) {
    push("exp", "experience", "Experience", p.experience,
         p.experience.map((e) => [e.role, e.company].filter(Boolean).join(" at ")).join(" · "));
  } else if (p.experience_lines?.length) {
    push("exp", "experience", "Experience",
         p.experience_lines.map((l) => ({ role: l })), p.experience_lines.join(" · "));
  }

  if (p.project_lines?.length) {
    push("proj", "projects", "Projects",
         p.project_lines.map((l) => ({ title: l })), p.project_lines.join(" · "));
  }

  return rows;
}
