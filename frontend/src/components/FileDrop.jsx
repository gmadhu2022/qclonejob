import { useId, useState } from "react";
import { IconUpload, IconCheck, IconClose } from "./icons";

/**
 * One drop target, used by every "give us a file" box in the portal.
 *
 * It exists because the same screen had two different upload experiences: a
 * designed drop zone on Data upload and the browser's raw "Choose File | No
 * file chosen" on Post a Ad. Equivalent controls have to look and behave
 * alike, so both now run through this.
 *
 * The component only reports the chosen file — validation and uploading stay
 * with the caller, because "what counts as a valid file" differs per box
 * (spreadsheets here, images there) and the error wording is part of the
 * requirements.
 */
export default function FileDrop({
  onPick,                 // (File | null) => void
  accept,                 // input accept string, e.g. ".xlsx,.csv"
  file,                   // the currently chosen File, if any
  onClear,                // optional: show a Remove control
  title = "Drop your file here, or click to browse",
  hint,
  busy = false,
  busyLabel = "Uploading…",
  preview,                // optional node rendered instead of the file chip
  compact = false,
}) {
  const [dragging, setDragging] = useState(false);
  const inputId = useId();

  const open = () => !busy && document.getElementById(inputId)?.click();

  const state = busy ? "busy" : file ? "filled" : dragging ? "dragging" : "idle";
  const ring = {
    busy: "border-slate-300 bg-slate-50",
    filled: "border-brandgreen bg-brandgreen-50/40",
    dragging: "border-navy bg-navy-50 scale-[1.01]",
    idle: "border-slate-300 bg-slate-50/60 hover:border-navy-300 hover:bg-navy-50/30",
  }[state];

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          if (!busy) onPick(e.dataTransfer.files?.[0] || null);
        }}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
        }}
        role="button"
        tabIndex={0}
        aria-busy={busy}
        aria-label={title}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2
          border-dashed text-center transition-all duration-150
          ${compact ? "px-5 py-7" : "px-6 py-10"} ${ring}
          ${busy ? "cursor-wait" : ""}`}>

        <span className={`flex items-center justify-center rounded-full shadow-sm
          ${compact ? "h-10 w-10" : "h-12 w-12"}
          ${file ? "bg-white text-brandgreen-600" : "bg-white text-navy"}`}>
          {busy ? <Spinner /> : file ? <IconCheck size={compact ? 18 : 20} />
                                     : <IconUpload size={compact ? 18 : 20} />}
        </span>

        {busy ? (
          <p className="mt-3 text-sm font-semibold text-slate-600">{busyLabel}</p>
        ) : file ? (
          <>
            <p className="mt-3 max-w-full truncate px-4 text-sm font-bold text-slate-700">
              {file.name}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {(file.size / 1024).toFixed(0)} KB · ready
            </p>
          </>
        ) : (
          <>
            <p className={`mt-3 font-bold text-slate-700 ${compact ? "text-sm" : ""}`}>{title}</p>
            {hint && <p className="mt-1 max-w-md text-xs text-slate-500">{hint}</p>}
          </>
        )}

        <input id={inputId} type="file" className="hidden" accept={accept}
               onChange={(e) => { onPick(e.target.files[0] || null); e.target.value = ""; }} />
      </div>

      {preview}

      {file && onClear && !busy && (
        <button type="button" onClick={onClear}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400
                           transition-colors hover:text-red-500">
          <IconClose size={12} /> Remove file
        </button>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-navy" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
