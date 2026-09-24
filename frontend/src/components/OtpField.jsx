import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "./ui";
import { IconCheck } from "./icons";

/**
 * Verify a mobile number or email with a one-time code.
 *
 * Errors are shown INLINE, under the code box, not only as a toast: a toast
 * auto-dismisses and sits in a corner, so "Incorrect OTP" was being missed by
 * people staring at the field they had just typed into. The toast stays as
 * well, for anyone whose eyes are elsewhere on the page.
 *
 * Email codes do not expire, so none of the copy here promises an expiry for
 * them. SMS codes still do, and say so.
 */
export default function OtpField({ label, channel = "sms", value, onChange,
                                   onVerified, placeholder, hint,
                                   /* hideInput: the value is entered elsewhere on the
                                      form (so the OTP block can sit at the bottom,
                                      after all the fields) and this renders only the
                                      send/verify controls for it. */
                                   hideInput = false,
                                   /* autoSend: a counter the parent bumps to fire a
                                      send from OUTSIDE this component — the staged
                                      registration has one Register button that must
                                      trigger the code. A counter rather than a
                                      boolean so "send again" works without the parent
                                      having to reset it. */
                                   autoSend = 0 }) {
  const toast = useToast();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [delivery, setDelivery] = useState(null);
  const [devCode, setDevCode] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState(null);

  const isEmail = channel !== "sms";

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // changing the number/email invalidates a previous verification
  useEffect(() => {
    setVerified(false); setSent(false); setCode(""); setError(null); setDevCode(null);
  }, [value]);

  // Parent-triggered send. Skipped when already verified so re-rendering the
  // step can't fire a pointless second code at someone who is already done.
  useEffect(() => {
    if (autoSend > 0 && value && !verified) sendCode();
  }, [autoSend]);

  const sendCode = async () => {
    if (!value?.trim()) {
      const msg = `Enter your ${isEmail ? "email" : "mobile number"} first.`;
      setError(msg);
      return toast(msg, "error");
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.post("/api/auth/otp/send", { target: value, channel }, { auth: false });
      setSent(true); setDelivery(r.delivery); setCooldown(30);
      setDevCode(r.dev_code || null);
      toast(r.delivery === "console"
        ? "Code generated — check the server console (email sending isn't configured yet)."
        : `OTP sent to ${r.target}.`);
    } catch (err) {
      setError(err.message);
      toast(err.message, "error");
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/otp/verify", { target: value, channel, code }, { auth: false });
      setVerified(true); onVerified?.(true);
      toast("Verified");
    } catch (err) {
      /* Requirement 6 — a wrong code has to say so, next to the box. The
         server's message already counts down the remaining attempts. */
      setError(err.message);
      setCode("");
      toast(err.message, "error");
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="label !mb-0">{label}</label>
        {verified && (
          <span className="mb-1.5 flex items-center gap-1 rounded-full bg-brandgreen-50 px-2 py-0.5
                           text-[11px] font-bold text-brandgreen-600">
            <IconCheck size={12} /> Verified
          </span>
        )}
      </div>
      <div className="mt-1.5 flex gap-2">
        {hideInput ? (
          <div className={`input flex items-center !bg-slate-50 ${verified ? "!border-brandgreen !bg-brandgreen-50/40" : ""}`}>
            <span className={value ? "text-slate-700" : "text-slate-400"}>
              {value || `Enter your ${isEmail ? "email" : "contact number"} above first`}
            </span>
          </div>
        ) : (
          <input
            className={`input ${verified ? "!border-brandgreen !bg-brandgreen-50/40" : ""}`}
            value={value || ""} placeholder={placeholder}
            inputMode={isEmail ? "email" : "numeric"}
            onChange={(e) => onChange(isEmail
              ? e.target.value
              : e.target.value.replace(/[^0-9+]/g, "").slice(0, 15))}
            disabled={verified}
          />
        )}
        {!verified && (
          <button type="button" className="btn-outline shrink-0 whitespace-nowrap"
                  onClick={sendCode} disabled={busy || cooldown > 0 || !value}>
            {cooldown > 0 ? `${cooldown}s` : sent ? "Resend" : "Send OTP"}
          </button>
        )}
      </div>

      {sent && !verified && (
        <div className="mt-2 flex gap-2">
          <input className={`input tracking-[0.4em] ${error ? "!border-red-400 !bg-red-50/40" : ""}`}
                 maxLength={6} placeholder="000000"
                 inputMode="numeric" value={code}
                 onChange={(e) => { setCode(e.target.value.replace(/[^0-9]/g, "")); setError(null); }} />
          <button type="button" className="btn shrink-0" onClick={verify}
                  disabled={busy || code.length < 6}>Verify</button>
        </div>
      )}

      {/* Requirement 6: the wrong-OTP message, inline and persistent. */}
      {error && !verified && (
        <p className="mt-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      {/* Requirement 8: a plain "Verified", not just a badge in the corner. */}
      {verified && (
        <p className="mt-1.5 rounded-lg bg-brandgreen-50 px-3 py-2 text-xs font-bold text-brandgreen-600">
          Verified
        </p>
      )}

      {devCode && !verified && (
        <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Development mode — your code is <b className="font-mono tracking-widest">{devCode}</b>.
          This is shown because no email provider is configured.
        </p>
      )}

      {!error && !verified && (
        <p className="mt-1 text-xs text-slate-400">
          {sent && delivery === "console"
            ? "Email sending isn't configured on the server yet, so the code was printed to the server console."
            : hint || (isEmail
                ? "We'll email you a 6-digit code. It doesn't expire — enter it whenever you're ready."
                : "We'll send a 6-digit code to confirm this number.")}
        </p>
      )}
    </div>
  );
}
