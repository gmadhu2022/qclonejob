import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "./ui";
import { IconCheck } from "./icons";

/**
 * Verify a mobile number or email with a one-time code.
 *
 * Shows the delivery channel honestly: when Twilio/SMTP aren't configured the
 * code prints to the server console and the UI says so, rather than implying a
 * text message was sent.
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
                                      trigger both the mobile and email codes. A
                                      counter rather than a boolean so "send again"
                                      works without the parent having to reset it. */
                                   autoSend = 0 }) {
  const toast = useToast();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [delivery, setDelivery] = useState(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // changing the number/email invalidates a previous verification
  useEffect(() => { setVerified(false); setSent(false); setCode(""); }, [value]);

  // Parent-triggered send. Skipped when already verified so re-rendering the
  // step can't fire a pointless second code at someone who is already done.
  useEffect(() => {
    if (autoSend > 0 && value && !verified) sendCode();
  }, [autoSend]);

  const sendCode = async () => {
    if (!value?.trim()) return toast(`Enter your ${channel === "sms" ? "mobile number" : "email"} first.`, "error");
    setBusy(true);
    try {
      const r = await api.post("/api/auth/otp/send", { target: value, channel }, { auth: false });
      setSent(true); setDelivery(r.delivery); setCooldown(30);
      toast(r.delivery === "console"
        ? "Code generated — check the server console (sending isn't configured yet)."
        : `Code sent to ${r.target}.`);
    } catch (err) { toast(err.message, "error"); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await api.post("/api/auth/otp/verify", { target: value, channel, code }, { auth: false });
      setVerified(true); onVerified?.(true);
      toast(`${channel === "sms" ? "Mobile number" : "Email"} verified.`);
    } catch (err) { toast(err.message, "error"); }
    finally { setBusy(false); }
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
              {value || `Enter your ${channel === "sms" ? "contact number" : "email"} above first`}
            </span>
          </div>
        ) : (
          <input
            className={`input ${verified ? "!border-brandgreen !bg-brandgreen-50/40" : ""}`}
            value={value || ""} placeholder={placeholder}
            inputMode={channel === "sms" ? "numeric" : "email"}
            onChange={(e) => onChange(channel === "sms"
              ? e.target.value.replace(/[^0-9+]/g, "").slice(0, 15)
              : e.target.value)}
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
          <input className="input tracking-[0.4em]" maxLength={6} placeholder="000000"
                 inputMode="numeric" value={code}
                 onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))} />
          <button type="button" className="btn shrink-0" onClick={verify}
                  disabled={busy || code.length < 6}>Verify</button>
        </div>
      )}

      <p className="mt-1 text-xs text-slate-400">
        {verified ? "Thanks — this is confirmed."
          : sent && delivery === "console"
            ? "Sending isn't configured yet, so the code is printed in the server console."
            : hint || `We'll send a 6-digit code to confirm this ${channel === "sms" ? "number" : "address"}.`}
      </p>
    </div>
  );
}
