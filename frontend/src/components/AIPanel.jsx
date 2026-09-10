import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { useToast } from "./ui";
import { IconSparkle } from "./icons";

/* Global "is AI configured?" flag so buttons hide when it isn't. */
const AICtx = createContext({ enabled: false });
export function AIProvider({ children }) {
  const [state, setState] = useState({ enabled: false });
  useEffect(() => { api.get("/api/ai/status", { auth: false }).then(setState).catch(() => {}); }, []);
  return <AICtx.Provider value={state}>{children}</AICtx.Provider>;
}
export const useAI = () => useContext(AICtx);

/** Button that calls an AI endpoint and hands the result back. */
export function AIButton({ path, body, onResult, children, className = "btn-outline btn-sm", title }) {
  const { enabled } = useAI();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!enabled) return null;

  const run = async () => {
    setBusy(true);
    try { onResult(await api.post(path, body || {})); }
    catch (err) { toast(err.message, "error"); }
    finally { setBusy(false); }
  };
  return (
    <button type="button" title={title} className={className} onClick={run} disabled={busy}>
      <IconSparkle size={14} /> {busy ? "Thinking…" : children}
    </button>
  );
}

/** Card that shows AI output with a dismiss action. */
export function AIResult({ title, onClose, children }) {
  return (
    <div className="mt-3 rounded-xl border border-brandgreen-100 bg-brandgreen-50/50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brandgreen-600">
          <IconSparkle size={13} /> {title}
        </span>
        <button onClick={onClose} className="text-xs font-medium text-slate-400 hover:text-slate-700">Dismiss</button>
      </div>
      <div className="text-sm text-slate-700">{children}</div>
    </div>
  );
}

/** Small helper for list output. */
export function AIList({ label, items, tone = "slate" }) {
  if (!items?.length) return null;
  const tones = { slate: "text-slate-600", green: "text-brandgreen-600", amber: "text-amber-600" };
  return (
    <div className="mt-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <ul className="mt-1 space-y-1">
        {items.map((x, i) => (
          <li key={i} className={`flex gap-2 text-[13px] ${tones[tone]}`}>
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />{x}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Hook for one-shot AI calls inside a component. */
export function useAICall() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const call = useCallback(async (path, body) => {
    setBusy(true);
    try { return await api.post(path, body || {}); }
    catch (err) { toast(err.message, "error"); return null; }
    finally { setBusy(false); }
  }, [toast]);
  return { call, busy };
}
