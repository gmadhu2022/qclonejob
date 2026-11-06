import { useEffect, useRef, useState } from "react";
import { IconClose, IconEye, IconEyeOff, IconLock } from "./icons";

/* =====================================================================
   Registration field style.

   Label above, a soft-tinted rounded box with the field's icon in a small
   tile on the left, and a clear (×) button on the right. Once the visitor
   leaves a field — or presses Submit — it validates itself: red border,
   red icon tile, red × and the reason underneath.

   Errors appear only after a field has been touched, so an untouched form
   is never shown as a wall of red.
   ===================================================================== */

/** Shared box classes, so PhoneField / Combobox / password match exactly. */
export function regBox({ error, focus, ok }) {
  return `flex items-center gap-2 rounded-2xl border-[1.5px] px-1.5 transition-colors duration-150
    ${error ? "border-red-400 bg-red-50/50"
      : focus ? "border-navy bg-white ring-4 ring-navy/10"
      : ok ? "border-brandgreen-400 bg-white"
      : "border-indigo-100 bg-[#f6f7ff] hover:border-indigo-200"}`;
}

export function RegIcon({ Icon, error, focus }) {
  if (!Icon) return null;
  return (
    <span className={`my-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-[1.5px] transition-colors
      ${error ? "border-red-300 bg-white text-red-500"
        : focus ? "border-navy-200 bg-navy-50 text-navy"
        : "border-indigo-100 bg-white text-navy"}`}>
      <Icon size={15} />
    </span>
  );
}

export function RegLabel({ label, required }) {
  if (!label) return null;
  return (
    <label className="mb-1.5 block text-[13px] font-semibold text-slate-800">
      {label}{required && <span className="text-red-500"> *</span>}
    </label>
  );
}

export function RegError({ error, hint }) {
  if (error) return <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>;
  if (hint) return <p className="mt-1.5 text-xs text-slate-400">{hint}</p>;
  return null;
}

/** Marks a field touched when its form is submitted (or the field blurs). */
function useTouched(ref) {
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    const form = ref.current?.form || ref.current?.closest?.("form");
    if (!form) return;
    const on = () => setTouched(true);
    form.addEventListener("submit", on, true);
    return () => form.removeEventListener("submit", on, true);
  }, [ref]);
  return [touched, setTouched];
}

/**
 * Text input in the registration style.
 * `validate(value)` returns an error string or null; `required` adds
 * "<label> is required" automatically.
 */
export function RegInput({
  label, icon, value, onChange, required, validate, hint, error: forced,
  type = "text", placeholder, clearable = true, ...rest
}) {
  const ref = useRef(null);
  const [focus, setFocus] = useState(false);
  const [touched, setTouched] = useTouched(ref);
  const v = value ?? "";
  const empty = String(v).trim() === "";

  const computed = empty
    ? (required ? `${String(label || "This field").replace(/\s*\(.*\)$/, "")} is required` : null)
    : (validate ? validate(String(v)) : null);
  const error = forced || (touched ? computed : null);
  const ok = touched && !empty && !computed;

  return (
    <div>
      <RegLabel label={label} required={required} />
      <div className={regBox({ error, focus, ok })}>
        <RegIcon Icon={icon} error={error} focus={focus} />
        <input
          ref={ref}
          {...rest}
          type={type}
          value={v}
          required={required}
          placeholder={placeholder}
          aria-invalid={!!error}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => { setFocus(false); setTouched(true); }}
          className={`min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-400
                      ${icon ? "" : "pl-2"} ${error ? "text-red-600" : "text-slate-800"}`}
        />
        {clearable && !empty && (
          <button type="button" tabIndex={-1} aria-label={`Clear ${label || "field"}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onChange?.(""); ref.current?.focus(); }}
                  className={`mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white transition-colors
                              ${error ? "bg-red-500 hover:bg-red-600" : "bg-slate-300 hover:bg-slate-400"}`}>
            <IconClose size={11} strokeWidth={3} />
          </button>
        )}
      </div>
      <RegError error={error} hint={hint} />
    </div>
  );
}

/** Password in the same style, with the show/hide toggle inside the box. */
export function RegPassword({ label, value, onChange, required, error, hint, placeholder, ok,
                              show, onToggle, autoComplete = "new-password" }) {
  const [focus, setFocus] = useState(false);
  return (
    <div>
      <RegLabel label={label} required={required} />
      <div className={regBox({ error, focus, ok })}>
        <RegIcon Icon={IconLock} error={error} focus={focus} />
        <input type={show ? "text" : "password"} value={value || ""} placeholder={placeholder}
               autoComplete={autoComplete} aria-invalid={!!error}
               onChange={(e) => onChange?.(e.target.value)}
               onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
               className={`min-w-0 flex-1 bg-transparent py-2.5 text-sm tracking-wide outline-none placeholder:tracking-normal placeholder:text-slate-400
                           ${error ? "text-red-600" : "text-slate-800"}`} />
        <button type="button" onClick={onToggle} aria-label={show ? "Hide password" : "Show password"}
                className={`mr-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-[1.5px] bg-white transition-colors
                            ${error ? "border-red-300 text-red-500" : "border-indigo-100 text-navy hover:bg-navy-50"}`}>
          {show ? <IconEyeOff size={15} /> : <IconEye size={15} />}
        </button>
      </div>
      <RegError error={error} hint={hint} />
    </div>
  );
}
