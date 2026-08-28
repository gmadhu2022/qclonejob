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

const TONES = {
  success: { ring: "bg-brandgreen-50 text-brandgreen-600", btn: "btn-green", Icon: IconCheck },
  error:   { ring: "bg-red-50 text-red-600",               btn: "btn",       Icon: IconBlock },
  info:    { ring: "bg-navy-50 text-navy",                 btn: "btn",       Icon: IconSparkle },
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
            <div className="p-6 text-center">
              <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${t.ring}`}>
                <Icon size={26} />
              </div>
              <h3 className="mt-4 text-lg font-extrabold text-slate-900">{dlg.title}</h3>
              {dlg.message && (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{dlg.message}</p>
              )}

              {dlg.details?.length > 0 && (
                <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3 text-left">
                  {dlg.details.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 text-[13px]">
                      <span className="text-slate-500">{k}</span>
                      <span className="break-all text-right font-semibold text-slate-800">{v}</span>
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
