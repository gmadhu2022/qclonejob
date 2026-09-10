import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { IconCheck, IconBlock, IconSparkle } from "./icons";

/**
 * Modal dialog for outcomes that deserve more than a toast — successful
 * registration, a posted job, a failed login, a credential handover.
 *
 * A toast disappears; a dialog waits to be acknowledged. That matters when the
 * message contains something the user must act on or write down.
 */
const DialogCtx = createContext(() => {});
export const useDialog = () => useContext(DialogCtx);

/**
 * Standard success confirmation. Every write the user commits — posting a job,
 * saving a profile, moving a candidate, changing a logo — ends in the same
 * acknowledged popup, so "did that save?" is never a question.
 *
 *   const confirm = useConfirm();
 *   confirm("Job posted successfully");
 *   confirm("Company profile updated successfully", { message: "…" });
 *
 * Use a toast instead for things the user didn't submit: text copied, a form
 * cleared, filters applied. A modal for those is noise, not reassurance.
 */
export function useConfirm() {
  const dialog = useContext(DialogCtx);
  return useCallback(
    (title, opts = {}) => dialog({ tone: "success", confirmLabel: "Done", title, ...opts }),
    [dialog],
  );
}

const TONES = {
  success: { ring: "bg-brandgreen-50 text-brandgreen-600", halo: "bg-brandgreen-100", btn: "btn-green", Icon: IconCheck },
  error:   { ring: "bg-red-50 text-red-600",               halo: "bg-red-100",        btn: "btn",       Icon: IconBlock },
  info:    { ring: "bg-navy-50 text-navy",                 halo: "bg-navy-100",       btn: "btn",       Icon: IconSparkle },
};

export function DialogProvider({ children }) {
  const [dlg, setDlg] = useState(null);

  const show = useCallback((opts) => {
    setDlg(typeof opts === "string" ? { title: opts, tone: "info" } : { tone: "info", ...opts });
  }, []);
  const close = useCallback(() => setDlg(null), []);

  useEffect(() => {
    if (!dlg) return;
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dlg, close]);

  const t = TONES[dlg?.tone] || TONES.info;
  const Icon = t.Icon;

  return (
    <DialogCtx.Provider value={show}>
      {children}
      {dlg && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
             role="dialog" aria-modal="true" aria-label={dlg.title}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-[fadeIn_.15s_ease]"
               onClick={close} />
          <div className="animate-in relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-cardhover">
            <div className="p-6 pt-7 text-center">
              {/* Layered halo reads as a deliberate confirmation rather than a
                  flat status chip, and gives the success tone real presence. */}
              <div className="relative mx-auto h-16 w-16">
                <span className={`absolute inset-0 rounded-full opacity-30 ${t.halo}`} />
                <span className={`absolute inset-2 rounded-full opacity-50 ${t.halo}`} />
                <div className={`absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full ${t.ring}`}>
                  <Icon size={26} />
                </div>
              </div>
              <h3 className="mt-4 text-lg font-extrabold tracking-tight text-slate-900">{dlg.title}</h3>
              {dlg.message && (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{dlg.message}</p>
              )}

              {dlg.details?.length > 0 && (
                <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3 text-left">
                  {/* Index key, not the label: the same label legitimately
                      repeats (two faults on one spreadsheet row), and a
                      duplicate React key drops one of them from the list. */}
                  {dlg.details.map(([k, v], i) => (
                    <div key={`${k}-${i}`} className="flex justify-between gap-3 text-[13px]">
                      <span className="shrink-0 text-slate-500">{k}</span>
                      <span className="break-words text-right font-semibold text-slate-800">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {dlg.note && (
                <p className={`mt-3 rounded-lg px-3 py-2 text-[12.5px] ${
                  dlg.noteTone === "warn" ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500"}`}>
                  {dlg.note}
                </p>
              )}
            </div>

            <div className="flex gap-2 border-t border-slate-100 p-4">
              {dlg.secondary && (
                <button className="btn-outline flex-1"
                        onClick={() => { dlg.secondary.onClick?.(); close(); }}>
                  {dlg.secondary.label}
                </button>
              )}
              <button className={`${t.btn} flex-1`}
                      onClick={() => { dlg.onConfirm?.(); close(); }} autoFocus>
                {dlg.confirmLabel || "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogCtx.Provider>
  );
}
