/**
 * Pull plain text out of an uploaded resume, then turn it into profile fields.
 *
 * Both halves are needed for the uploaded file to feed the resume templates:
 * a .docx or .pdf is opaque, and the templates render from structured profile
 * data, so nothing from an upload can reach them until it is extracted and
 * parsed.
 *
 * Both parsers are loaded on demand — mammoth is ~500 KB and pdf.js ~1 MB, and
 * most sessions never open a resume file, so neither belongs in the main bundle.
 */

/**
 * Text from a .docx.
 *
 * Goes through mammoth's HTML converter rather than extractRawText, because
 * raw text loses the structure the parser depends on. Real resumes are
 * frequently laid out in TABLES (two-column designs especially), and raw
 * extraction runs the cells together so section headings stop being on lines
 * of their own — which is why a two-column resume parsed to zero education
 * and zero experience.
 *
 * Every block element becomes its own line, and a heading is marked with a
 * form-feed sentinel so the parser can recognise it without guessing:
 * headings in Word resumes are usually bold paragraphs rather than real <h>
 * tags, and bold survives the HTML conversion where "looks like a heading"
 * does not.
 */
async function docxText(arrayBuffer) {
  const { default: mammoth } = await import("mammoth");
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
  return blocksFromHtml(html);
}

export const HEADING_MARK = "\u000c";   // form feed: never appears in a resume

function blocksFromHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out = [];
  const blocks = doc.body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,td,th");
  blocks.forEach((el) => {
    // Skip container cells; their child blocks are visited separately.
    if ((el.tagName === "TD" || el.tagName === "TH") &&
        el.querySelector("p,h1,h2,h3,h4,h5,h6,li")) return;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return;

    const isRealHeading = /^H[1-6]$/.test(el.tagName);
    // A paragraph that is entirely bold, and short, is a heading in practice.
    const bold = el.querySelector("strong, b");
    const allBold = bold && bold.textContent.replace(/\s+/g, " ").trim() === text;
    const shortAllCaps = text.length <= 40 && text === text.toUpperCase() && /[A-Z]/.test(text);

    out.push(((isRealHeading || (allBold && text.length <= 60) || shortAllCaps)
      ? HEADING_MARK : "") + text);
  });
  return out.join("\n");
}

/** Text from a PDF, page by page, via pdf.js. */
async function pdfText(arrayBuffer) {
  const pdfjs = await import("pdfjs-dist");
  // The worker is bundled by Vite rather than fetched from a CDN, so this keeps
  // working on a firewalled deployment.
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const doc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    // Insert a newline when the y-position drops, otherwise every line of the
    // PDF runs together into one paragraph and the parser can't find sections.
    let lastY = null;
    let line = "";
    const lines = [];
    for (const item of content.items) {
      const y = item.transform?.[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line.trim()); line = ""; }
      line += item.str;
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    pages.push(lines.join("\n"));
  }
  return pages.join("\n\n");
}

/** Extract text from a File object or a URL. Returns "" when unsupported. */
export async function extractResumeText(source, filename = "") {
  const name = (filename || source?.name || "").toLowerCase();
  const ext = name.split("?")[0].split(".").pop();
  if (ext !== "docx" && ext !== "pdf") return "";

  const buffer = source instanceof Blob
    ? await source.arrayBuffer()
    : await (await fetch(source)).arrayBuffer();

  return ext === "docx" ? docxText(buffer) : pdfText(buffer);
}

/* ---------------------------------------------------------------------
   Local parser.

   Used when AI is switched off — which is the DEFAULT (AI_ENABLED=false), so
   without this the whole feature would silently do nothing on a fresh install.
   It is heuristic and deliberately conservative: it only fills a field when it
   is reasonably sure, and everything it produces is shown for review before
   being saved.
   --------------------------------------------------------------------- */

const SECTION_ALIASES = {
  career_objective: ["objective", "career objective", "summary", "professional summary",
                     "profile summary", "about me", "professional profile"],
  key_skills: ["skills", "key skills", "technical skills", "core competencies",
               "areas of expertise", "technical expertise"],
  education: ["education", "academic", "academics", "qualification", "qualifications",
              "educational qualification", "academic details"],
  experience: ["experience", "work experience", "professional experience",
               "employment", "employment history", "work history"],
  certifications: ["certification", "certifications", "certificates", "courses",
                   "licenses", "training"],
  projects: ["project", "projects", "key projects", "academic projects"],
  languages: ["language", "languages", "languages known", "known languages"],
};

/* Aliases are matched loosely (see splitSections), so these cover the common
   wordings without needing an entry per variation. */
SECTION_ALIASES.experience.push("work history", "career history", "professional background",
                                "internship", "internships", "work profile");
SECTION_ALIASES.education.push("education details", "academic qualification",
                               "educational background", "academic background");
SECTION_ALIASES.key_skills.push("skill set", "skillset", "technical proficiency",
                                "technologies", "tools and technologies", "expertise");
SECTION_ALIASES.certifications.push("certification details", "achievements", "awards");

/** Split the text into { sectionKey: lines[] } using heading lines. */
function splitSections(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const out = {};
  let current = null;
  for (const raw of lines) {
    if (!raw) continue;
    const marked = raw.startsWith(HEADING_MARK);
    const line = marked ? raw.slice(1).trim() : raw;
    if (!line) continue;

    /* Match an alias anywhere in a heading line, not just as the whole line:
       real resumes write "WORK HISTORY", "Work History:", "Professional
       Experience (5 years)". Requiring an exact match is what made section
       detection so brittle. */
    const bare = line.replace(/[:\-–—•\t]+$/g, "").trim().toLowerCase();
    const looksLikeHeading = marked || (line.length <= 45 && !/[.;]/.test(line));
    const key = looksLikeHeading
      ? Object.keys(SECTION_ALIASES).find((k) =>
          SECTION_ALIASES[k].some((a) => bare === a || bare.startsWith(a + " ") ||
                                          bare.endsWith(" " + a) || bare === a + "s"))
      : null;

    if (key) { current = key; out[key] = out[key] || []; continue; }
    // An unrecognised heading ends the current section rather than absorbing
    // everything that follows it into the wrong bucket.
    if (marked && current) { current = null; continue; }
    if (current) out[current].push(line);
  }
  return out;
}

const clean = (s) => (s || "").replace(/^[•\-–—*\u2022]\s*/, "").trim();

export function parseResumeText(text) {
  const flat = text.replace(/\s+/g, " ");
  const sections = splitSections(text);
  const firstLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6);

  const email = (flat.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/) || [])[0] || null;
  // Indian mobile or a general 8–14 digit run, tolerating spaces and dashes.
  const phone = (flat.match(/(?:\+91[\s-]?)?\b\d{5}[\s-]?\d{5}\b/) ||
                 flat.match(/\+?\d[\d\s-]{7,13}\d/) || [])[0] || null;

  /* The name is the first line that looks like a name: two or three words,
     letters only, not a heading and not the contact line. Anything else is
     left blank rather than guessed — a wrong name on a resume is worse than
     an empty one. */
  const name = firstLines.find((l) =>
    /^[A-Za-z][A-Za-z.'\- ]{2,40}$/.test(l) &&
    l.split(/\s+/).length >= 2 && l.split(/\s+/).length <= 4 &&
    !/resume|curriculum|vitae|cv/i.test(l)) || null;
  const parts = name ? name.split(/\s+/) : [];

  /* Skill sections in real resumes mix bare tokens ("Python, SQL, Azure") with
     prose ("Machine Learning – Experience in building classification models").
     Splitting on commas alone turned that sentence into two fake "skills". So:
     take only the part before a dash-description, then keep tokens that
     actually look like skill names — short, few words, no sentence
     punctuation. A missed skill is recoverable; a garbage one has to be
     hunted down and deleted. */
  const SKILLY = (x) =>
    x && x.length <= 35 && x.split(/\s+/).length <= 4 &&
    !/[.;:]/.test(x) && !/\b(experience|experienced|working|knowledge|familiar|using|such as)\b/i.test(x);

  const listFrom = (key, strict = false) => {
    const raw = (sections[key] || []).flatMap((line) => {
      // "Machine Learning – Experience in ..." -> "Machine Learning"
      const head = line.split(/\s+[–—-]\s+/)[0];
      const source = strict ? head : line;
      // Resumes separate skills with commas, pipes, slashes or bullets —
      // "ML|DL|NLP|Azure" is as common as a comma list.
      return source.length < 300 ? source.split(/[,|•·]|\s\/\s/) : [source];
    }).map(clean);
    return strict ? raw.filter(SKILLY) : raw.filter((x) => x && x.length <= 60);
  };

  return {
    first_name: parts[0] || null,
    last_name: parts.slice(1).join(" ") || null,
    email,
    phone: phone ? phone.replace(/\s+/g, " ").trim() : null,
    career_objective: (sections.career_objective || []).join(" ").trim() || null,
    key_skills: [...new Set(listFrom("key_skills", true))].slice(0, 40),
    certifications: [...new Set(listFrom("certifications"))].slice(0, 20),
    languages: [...new Set(listFrom("languages"))].slice(0, 12),
    // Education and experience stay as free-text lines: guessing which token is
    // a degree, an institute or a year produces confident nonsense, and these
    // are shown for the seeker to correct.
    education_lines: (sections.education || []).map(clean).filter(Boolean).slice(0, 12),
    experience_lines: (sections.experience || []).map(clean).filter(Boolean).slice(0, 20),
    project_lines: (sections.projects || []).map(clean).filter(Boolean).slice(0, 12),
  };
}
