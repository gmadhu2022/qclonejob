import { useEffect, useRef, useState } from "react";
import { mediaUrl } from "../../lib/api";
import { Markdown } from "../../components/RichText";
import { IconDoc, IconDownload } from "../../components/icons";

/**
 * Shows the uploaded resume in its ORIGINAL layout.
 *
 * .docx — rendered by docx-preview, which reads the document's own styles,
 *         fonts, tables and page geometry out of the OOXML and reproduces
 *         them. This replaced mammoth for DISPLAY: mammoth deliberately
 *         throws styling away and returns bare semantic HTML, which is why
 *         the preview looked like plain text with empty table rows. Mammoth
 *         is still used for TEXT EXTRACTION (lib/resumeText.js), which is a
 *         different job and where discarding styling is the right behaviour.
 *
 * .pdf  — shown in the browser's own PDF viewer, which is the original by
 *         definition.
 *
 * .doc  — old binary Word format; no browser-side renderer exists for it.
 *
 * The file is never modified. "Additions" render after it.
 */
export default function UploadedResumeView({ seeker, onMissing }) {
  const raw = seeker.uploaded_resume_url;
  const url = raw ? mediaUrl(raw) : null;
  const name = seeker.uploaded_resume_name || raw || "resume";
  const ext = (name.split("?")[0].split(".").pop() || "").toLowerCase();
  const additions = (seeker.resume_additions || []).filter((a) => a?.title || a?.content);

  const hostRef = useRef(null);
  const [state, setState] = useState("idle");   // idle | loading | ready | failed | missing

  const [fileOk, setFileOk] = useState(null);   // null = still checking

  /* Check the file is actually there before framing it.
     An <iframe> pointed at a missing file renders the API's 404 body — which
     is how a recruiter ended up looking at {"detail":"Not Found"} instead of a
     resume. A HEAD request first means we can say what happened instead. */
  useEffect(() => {
    // Every type, not just PDF: a .docx that has been wiped fails the same way.
    if (!url) return;
    let dead = false;
    setFileOk(null);
    fetch(url, { method: "HEAD" })
      .then((r) => { if (!dead) { setFileOk(r.ok); if (!r.ok) onMissing?.(); } })
      .catch(() => { if (!dead) { setFileOk(false); onMissing?.(); } });
    return () => { dead = true; };
  }, [url]);

  useEffect(() => {
    if (!url || ext !== "docx" || fileOk === false) return;
    let dead = false;
    setState("loading");
    (async () => {
      try {
        // ~700 KB, and most sessions never open a Word resume.
        const docx = await import("docx-preview");
        const res = await fetch(url);
        if (res.status === 404) { if (!dead) setState("missing"); return; }
        if (!res.ok) throw new Error(`Could not fetch the file (${res.status})`);
        const blob = await res.blob();
        if (dead || !hostRef.current) return;
        hostRef.current.innerHTML = "";
        await docx.renderAsync(blob, hostRef.current, null, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,        // keep the document's real page width
          ignoreHeight: true,        // but let it grow instead of paging
          ignoreFonts: false,        // the document's own fonts
          breakPages: true,
          useBase64URL: true,        // inline images rather than blob URLs
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
        });
        if (!dead) setState("ready");
      } catch (err) {
        if (!dead) setState("failed");
      }
    })();
    return () => { dead = true; };
  }, [url, ext]);

  if (!url) return null;

  if (fileOk === false) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-semibold text-amber-800">
          This uploaded file is no longer on the server
        </p>
        <p className="mt-1 text-xs text-amber-700">
          {name} was uploaded but the stored copy can't be found. Uploaded files live on the
          server's local disk, which is cleared on each deployment — the candidate will need to
          upload it again. Their generated resume is shown instead.
        </p>
      </div>
    );
  }

  const FileCard = ({ note }) => (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-5">
      <IconDoc size={28} className="shrink-0 text-navy" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-800">{name}</p>
        <p className="text-xs text-slate-400">{note}</p>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
        <IconDownload size={14} /> Open
      </a>
    </div>
  );

  const MissingCard = () => (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <p className="font-semibold text-amber-800">This resume file is no longer on the server</p>
      <p className="mt-1 text-[13px] text-amber-700">
        The record still points at <b>{name}</b>, but the file itself is gone. Uploaded files are
        stored on the server's local disk, which is wiped on every deployment — so anything
        uploaded before the last deploy has been lost.
      </p>
      <p className="mt-2 text-[13px] text-amber-700">
        The candidate can re-upload it from their profile. Their generated resume is unaffected
        and is shown instead below.
      </p>
    </div>
  );

  const Header = () => (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
      <span className="truncate text-[12px] font-semibold text-slate-500">{name}</span>
      <a href={url} target="_blank" rel="noopener noreferrer"
         className="shrink-0 text-[12px] font-semibold text-navy hover:underline">Open original</a>
    </div>
  );

  return (
    <div className="space-y-4">
      
      {ext === "pdf" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Header />
          {fileOk === null ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-slate-400">Loading resume…</p>
            </div>
          ) : (
            <iframe src={`${url}#view=FitH`} title={name} className="h-[820px] w-full border-0" />
          )}
        </div>
      )}

      {ext === "docx" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Header />
          {state === "loading" && (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-slate-400">Rendering your document…</p>
            </div>
          )}
          
          {state === "failed" && (
            <div className="p-4">
              <FileCard note="This Word file couldn't be rendered here — it may be password protected or corrupt. You can still open and download it." />
            </div>
          )}
          {/* Kept mounted in all states: docx-preview writes straight into this
              node, so unmounting it while loading would leave nowhere to
              render into. */}
          <div ref={hostRef}
               className={`docx-host overflow-x-auto ${state === "ready" ? "" : "hidden"}`} />
        </div>
      )}

      {ext !== "pdf" && ext !== "docx" && (
        <FileCard note={ext === "doc"
          ? "This is the older .doc format, which browsers can't render. Re-save it as .docx or PDF to see it here."
          : "This file type can't be previewed in the browser. Recruiters can still open and download it."} />
      )}

      {additions.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="mb-4 border-b border-slate-100 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Additional information
          </p>
          <div className="space-y-5">
            {additions.map((a, i) => (
              <div key={i}>
                {a.title && <h4 className="mb-1 font-bold text-slate-800">{a.title}</h4>}
                {a.content && <Markdown text={a.content} className="text-sm" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
