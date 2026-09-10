import { useRef, useState } from "react";

/**
 * Lightweight markdown editor + renderer.
 *
 * Renders to React elements rather than injecting HTML, so user content can
 * never execute script — important when recruiters publish company profiles
 * that job seekers read.
 *
 * Supports: # ## ### headings, **bold**, *italic*, `code`, - bullets,
 * 1. numbered lists, > quotes, [links](url), --- rules.
 */

/* ---------------- inline parsing ---------------- */
function inline(text, keyPrefix = "i") {
  const nodes = [];
  // ordered so ** is matched before *
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m, k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${k++}`;
    if (tok.startsWith("**")) nodes.push(<strong key={key} className="font-bold text-slate-900">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) nodes.push(<code key={key} className="rounded bg-slate-100 px-1 py-0.5 text-[0.9em] text-navy">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok);
      const href = mm[2].startsWith("http") ? mm[2] : `https://${mm[2]}`;
      nodes.push(<a key={key} href={href} target="_blank" rel="noopener noreferrer"
                    className="font-medium text-navy underline hover:text-brandgreen-600">{mm[1]}</a>);
    } else nodes.push(<em key={key} className="italic">{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Markdown({ text, className = "" }) {
  if (!text || !String(text).trim()) {
    return <p className={`text-sm italic text-slate-300 ${className}`}>Nothing added yet.</p>;
  }
  const lines = String(text).split("\n");
  const out = [];
  let list = null, listType = null;

  const flush = () => {
    if (!list) return;
    const Tag = listType === "ol" ? "ol" : "ul";
    out.push(
      <Tag key={`l${out.length}`} className={`my-2 space-y-1 pl-5 ${listType === "ol" ? "list-decimal" : "list-disc"}`}>
        {list.map((li, i) => <li key={i} className="text-[14px] leading-relaxed text-slate-600">{inline(li, `l${out.length}-${i}`)}</li>)}
      </Tag>
    );
    list = null; listType = null;
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      if (listType !== "ul") { flush(); listType = "ul"; list = []; }
      list.push(line.replace(/^\s*[-*]\s+/, "")); return;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      if (listType !== "ol") { flush(); listType = "ol"; list = []; }
      list.push(line.replace(/^\s*\d+[.)]\s+/, "")); return;
    }
    flush();
    if (!line.trim()) return;
    if (/^---+$/.test(line.trim())) { out.push(<hr key={idx} className="my-3 border-slate-200" />); return; }
    if (line.startsWith("### ")) { out.push(<h4 key={idx} className="mt-3 text-[14px] font-bold text-slate-800">{inline(line.slice(4), idx)}</h4>); return; }
    if (line.startsWith("## ")) { out.push(<h3 key={idx} className="mt-4 text-[15.5px] font-bold text-navy">{inline(line.slice(3), idx)}</h3>); return; }
    if (line.startsWith("# ")) { out.push(<h2 key={idx} className="mt-4 text-[17px] font-extrabold text-navy">{inline(line.slice(2), idx)}</h2>); return; }
    if (line.startsWith("> ")) {
      out.push(<blockquote key={idx} className="my-2 border-l-3 border-brandgreen bg-brandgreen-50/50 py-1.5 pl-3 text-[14px] italic text-slate-600">{inline(line.slice(2), idx)}</blockquote>);
      return;
    }
    out.push(<p key={idx} className="my-1.5 text-[14px] leading-relaxed text-slate-600">{inline(line, idx)}</p>);
  });
  flush();
  return <div className={className}>{out}</div>;
}

/* ---------------- editor ---------------- */
const TOOLS = [
  { label: "B", title: "Bold", wrap: ["**", "**"], cls: "font-bold" },
  { label: "I", title: "Italic", wrap: ["*", "*"], cls: "italic" },
  { label: "H", title: "Heading", prefix: "## ", cls: "font-bold" },
  { label: "•", title: "Bullet list", prefix: "- " },
  { label: "1.", title: "Numbered list", prefix: "1. " },
  { label: "❝", title: "Quote", prefix: "> " },
  { label: "🔗", title: "Link", wrap: ["[", "](https://)"] },
  { label: "—", title: "Divider", prefix: "\n---\n" },
];

export default function RichText({ label, value = "", onChange, rows = 8, hint }) {
  const [tab, setTab] = useState("write");
  const ref = useRef(null);

  const apply = (tool) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const sel = value.slice(start, end);
    let next, caret;
    if (tool.wrap) {
      next = value.slice(0, start) + tool.wrap[0] + (sel || tool.title.toLowerCase()) + tool.wrap[1] + value.slice(end);
      caret = start + tool.wrap[0].length + (sel || tool.title).length;
    } else {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      next = value.slice(0, lineStart) + tool.prefix + value.slice(lineStart);
      caret = start + tool.prefix.length;
    }
    onChange?.(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(caret, caret); });
  };

  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="overflow-hidden rounded-xl border border-slate-300 focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/15">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
          {TOOLS.map((t) => (
            <button key={t.title} type="button" title={t.title} onClick={() => apply(t)}
              className={`h-7 min-w-7 rounded-md px-2 text-[12px] text-slate-600 transition-colors
                          hover:bg-navy hover:text-white ${t.cls || ""}`}>
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex gap-1">
            {["write", "preview"].map((k) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors ${
                  tab === k ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
                {k}
              </button>
            ))}
          </div>
        </div>

        {tab === "write" ? (
          <textarea ref={ref} rows={rows} value={value || ""}
                    onChange={(e) => onChange?.(e.target.value)}
                    placeholder="Write about your organisation. **Bold**, *italic*, ## headings and - bullet lists all work."
                    className="w-full resize-y border-0 px-3.5 py-3 text-sm text-slate-800 outline-none placeholder-slate-400" />
        ) : (
          <div className="min-h-[120px] px-3.5 py-3"><Markdown text={value} /></div>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {hint || "Formatting: **bold**, *italic*, ## heading, - list, > quote, [link](url)"}
      </p>
    </div>
  );
}
