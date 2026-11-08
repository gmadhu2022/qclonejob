import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import RichText from "./RichText";
import ImageUpload from "./ImageUpload";
import OtpField from "./OtpField";
import BasePhoneField from "./PhoneField";
import { Combobox as BaseCombobox, TagInput } from "./fields";
import { RegInput, RegPassword } from "./RegField";
import SkillPicker from "./SkillPicker";
import { IconCheck, IconRefresh, IconUser, IconMail, IconBuilding, IconGlobe, IconMapPin,
         IconHash, IconUsers, IconPhone, IconBriefcase, IconShield, IconDoc } from "./icons";
import { CITIES, STATES, COURSES, SKILLS } from "../lib/options";

/* =====================================================================
   Registration fields — shared by the PUBLIC registration pages and the
   admin "Add accounts" tab.

   Admin previously had its own stripped-down forms (a bare <F> helper, 6-9
   fields, no logo, no taxonomy, no phone country codes), which is why they
   looked nothing like the pages the same people register through. Both now
   render from here, so they cannot diverge again.

   `admin` mode differs in exactly two ways, both deliberate:
     - no OTP panel. An admin creating an account on someone else's behalf
       can't receive their codes, and the admin endpoints don't check them.
     - no "Already registered? Log in" footer.
   ===================================================================== */

/* ---------------------------------------------------------------------
   Every registration field goes through FField, so the whole form shares
   one look (RegField) and one set of inline checks. The icon and the
   format check are picked from the field's label.
   --------------------------------------------------------------------- */
const WEBSITE_RE = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i;
const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/i;

export function iconFor(label = "") {
  const l = label.toLowerCase();
  if (/mail/.test(l)) return IconMail;
  if (/land line|phone|mobile/.test(l)) return IconPhone;
  if (/website/.test(l)) return IconGlobe;
  if (/institute name|campus/.test(l)) return IconBuilding;
  if (/organisation/.test(l)) return IconBriefcase;
  // Numbers first: "capacity" contains "city".
  if (/pincode|capacity|strength|seats/.test(l)) return IconHash;
  if (/address|district|city|state|country/.test(l)) return IconMapPin;
  if (/gst|pan/.test(l)) return IconShield;
  if (/designation/.test(l)) return IconBriefcase;
  if (/promoter|contact person/.test(l)) return IconUsers;
  if (/name/.test(l)) return IconUser;
  return IconDoc;
}

function validatorFor(label = "") {
  const l = label.toLowerCase();
  if (/mail/.test(l)) return (v) => (EMAIL_PATTERN.test(v.trim()) ? null : "Invalid email format");
  if (/website/.test(l)) return (v) => (WEBSITE_RE.test(v.trim()) ? null : "Enter a valid website, e.g. www.yourcompany.com");
  if (/pincode/.test(l)) return (v) => (/^\d{6}$/.test(v) ? null : "Pincode must be 6 digits");
  if (/gst/.test(l)) return (v) => (GST_RE.test(v.trim()) ? null : "GST No. must be 15 characters, e.g. 36AABCU9603R1ZM");
  if (/pan/.test(l)) return (v) => (PAN_RE.test(v.trim()) ? null : "PAN must be 10 characters, e.g. AABCU9603R");
  if (/land line/.test(l)) return (v) => (/^[\d\s-]{6,15}$/.test(v) ? null : "Enter a valid landline with STD code");
  if (/name|person/.test(l)) return (v) => (v.trim().length >= 2 ? null : "Must contain at least 2 letters");
  return null;
}

export function FField({ label, validate, ...rest }) {
  return <RegInput label={label} icon={iconFor(label)} validate={validate || validatorFor(label)} {...rest} />;
}
const Combobox = (p) => <BaseCombobox variant="reg" icon={IconMapPin} {...p} />;
const PhoneField = (p) => <BasePhoneField variant="reg" {...p} />;

export function RegistrationFields({
  role, form, setForm, formKey = 0, admin = false,
  /* --- staged self-registration ---------------------------------------
     stage 1  contact details + Register button
     stage 2  the two OTP boxes
     stage 3  everything else + Submit button
     `admin` skips staging entirely: an admin creating an account on someone
     else's behalf can't receive their codes, so gating the form behind a
     verification they can't complete would lock them out of their own tool.
     ------------------------------------------------------------------- */
  stage = 3,
  otpSendTick = 0,
  onVerified,
}) {
  const isEnt = role === "enterprise";
  const isInst = role === "institute";
  const setV = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  if (!isEnt && !isInst) {
    return (
      <div className="card grid gap-4 sm:grid-cols-2">
            <FField label="First name" required value={form.first_name} onChange={setV("first_name")}
                    placeholder="e.g. Emily" />
            <FField label="Last name" value={form.last_name} onChange={setV("last_name")}
                    placeholder="e.g. Johnson" />
            <div className="sm:col-span-2">
              <FField label="Email (becomes your User ID)" type="email" required value={form.email}
                      onChange={setV("email")} placeholder="e.g. emily.johnson@gmail.com" />
            </div>
            <div className="sm:col-span-2">
              <PhoneField label="Phone" value={form.phone} onChange={setV("phone")} />
            </div>
            <Combobox label="Location" value={form.location} options={CITIES} onChange={setV("location")}
                      placeholder="e.g. Austin, Texas" />
            <div className="sm:col-span-2">
              {/* SkillPicker, not a 29-item local array: job posting already
                  searched the full 1,147-skill library from the server, so a
                  seeker could only tag themselves with skills recruiters
                  mostly weren't asking for. One source, both sides. */}
              <SkillPicker variant="reg" label="Key skills" values={form.skillList || []}
                           onChange={(v) => setForm((f) => ({ ...f, skillList: v }))}
                           placeholder="Type a skill — e.g. Customer Service, Excel, Welding" />
            </div>
      </div>
    );
  }

  return (
    <>

            <RegSection title={isInst ? "Institute details" : "Company details"}>
              {/* minmax(0,1fr) is the fix for the squashed name field: the logo
                  card's help text gave it a wide intrinsic size, and an `auto`
                  column plus a plain `1fr` let it win. A fixed right pane and
                  an explicitly shrinkable left column keeps the name wide. */}
              <div className="grid items-start gap-4 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-w-0">
                  <FField label={isInst ? "Institute Name" : "Organisation Name"} required
                          value={form.name} onChange={setV("name")}
                          placeholder={isInst ? "e.g. Lincoln Valley Technical College" : "e.g. Summit Ridge Technologies Inc."} />
                  <div className="mt-4">
                    <FField label="Official Mail" required type="email"
                            value={form.email} onChange={setV("email")}
                            placeholder={isInst ? "e.g. admissions@lincolnvalley.edu" : "e.g. hr@summitridgetech.com"} />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <label className="label">Add Logo</label>
                  <ImageUpload key={`logo-${formKey}`} kind="logo" round={false} publicUpload
                               currentUrl={form.logo_url}
                               doneText="Uploaded — it will be saved with your registration."
                               onUploaded={(u) => setV("logo_url")(u)} />
                </div>
              </div>

              <div className="sm:col-span-2">
                {/* Contact person sits with the contact NUMBER, because they
                    describe the same thing: who to call and on what number.
                    It was previously three sections apart. */}
                <FField label="Contact Person" required value={form.authorised_person_name}
                        onChange={setV("authorised_person_name")}
                        placeholder={isInst ? "e.g. Sarah Thompson, Placement Officer" : "e.g. Michael Carter, HR Manager"} />
              </div>

              <div className="sm:col-span-2">
                <PhoneField label="Contact Number" required value={form.phone} onChange={setV("phone")}
                            hint="Pick your country, then type the number — digits only." />
              </div>

              {!isInst && (
                <div className="sm:col-span-2">
                  {/* Optional by design: plenty of firms answer a landline and
                      nothing else, but requiring one would block every company
                      that has only mobiles. */}
                  <FField label="Land line (if any)" value={form.landline}
                          onChange={setV("landline")}
                          placeholder="e.g. 512-555-0147"
                          hint="Optional — include the area code." />
                </div>
              )}

              <FField label="Website" value={form.website} onChange={setV("website")}
                      placeholder={isInst ? "e.g. www.lincolnvalley.edu" : "e.g. www.summitridgetech.com"} />
              {isInst && (
                <>
                  {/* Two separate numbers, not one "strength": capacity is what
                      the institute could take, strength is who is actually on
                      the rolls. The dashboard reports both, and bulk uploads
                      are checked against capacity. */}
                  <FField label="Total Capacity" required value={form.total_capacity}
                          onChange={(v) => setV("total_capacity")(String(v).replace(/\D/g, ""))}
                          placeholder="e.g. 1200"
                          hint="Maximum students across all courses" />
                  <FField label="Current Strength" required value={form.current_strength}
                          validate={(v) => (form.total_capacity && Number(v) > Number(form.total_capacity)
                            ? "Can't be more than Total Capacity" : null)}
                          onChange={(v) => setV("current_strength")(String(v).replace(/\D/g, ""))}
                          placeholder="e.g. 840"
                          hint="Students on the rolls today" />
                </>
              )}
            </RegSection>

            {/* ---- Verification. Sits directly under the contact details it
                 confirms, and ABOVE everything that unlocks once it passes.
                 It used to render last, so after verifying you were looking
                 at a "Verify your email" card sitting below the password
                 boxes it was supposed to have unlocked. ---- */}
            {!admin && isInst && stage >= 2 && (
              <div className="card !bg-slate-50/70">
                <h4 className="text-sm font-bold text-slate-700">Verify your email address</h4>
                <p className="mb-3 text-xs text-slate-400">
                  We've sent a 6-digit code to <b className="text-slate-600">{form.email || "your email"}</b>.
                  Enter it below to continue. The resend button counts down the seconds until you can
                  request another.
                </p>

                {/* Email only. SMS verification is deliberately not used here: an OTP
                    that depends on an SMS gateway fails silently when the gateway is
                    down or a number is mistyped, and email is where the account's
                    login credentials are sent anyway — so it is the address that
                    actually has to be correct. The phone number is still collected,
                    just not verified by code. */}
                <div className="max-w-md">
                  <OtpField key={`mail-${formKey}`} label="Email OTP" channel="email" hideInput
                      autoSend={otpSendTick}
                      value={form.email} onChange={setV("email")}
                      onVerified={() => { setV("email_verified")(true); onVerified?.("email"); }} />
                </div>

                {form.email_verified && (
                  <p className="mt-3 rounded-lg bg-brandgreen-50 px-3 py-2 text-xs font-medium text-brandgreen-600">
                    Email verified — the rest of the form is below.
                  </p>
                )}

                <p className="mt-3 text-xs text-slate-400">
                  Not arrived? Check your spam folder, or press Resend. If the address is wrong, edit it
                  above and a new code is sent.
                </p>
              </div>
            )}

            {/* Everything below is revealed only after verification. */}
            {stage >= 3 && (
            <>
            {/* ---- Create your password (requirements 9-10) ----
                 Only rendered once the email is verified, so nobody sets a
                 password on an address they can't receive mail at. The
                 recruiter form still gets a generated password emailed to it;
                 flip `password` on below to give recruiters the same flow. */}
            {isInst && <PasswordSection form={form} setForm={setForm} />}

            <RegSection title="Address">
              <div className="sm:col-span-2">
                <FField label="Address line 1" required={!isInst} value={form.address1}
                        onChange={setV("address1")}
                        placeholder={isInst ? "e.g. 450 Maple Street" : "e.g. 1200 Congress Avenue, Suite 400"} />
              </div>
              <div className="sm:col-span-2">
                <FField label="Address line 2" value={form.address2} onChange={setV("address2")}
                        placeholder={isInst ? "e.g. Near Riverside Park (optional)" : "e.g. Downtown Business District (optional)"} />
              </div>
              <Combobox label="City" value={form.city} options={CITIES} onChange={setV("city")}
                        placeholder={isInst ? "e.g. Springfield" : "e.g. Austin"} />
              <FField label="District" value={form.district} onChange={setV("district")}
                      placeholder={isInst ? "e.g. Sangamon County" : "e.g. Travis County"} />
              <Combobox label="State" value={form.state} options={STATES} onChange={setV("state")}
                        placeholder={isInst ? "e.g. Illinois" : "e.g. Texas"} />
              <FField label="Pincode" required={!isInst} value={form.pincode}
                      onChange={(v) => setV("pincode")(String(v).replace(/\D/g, "").slice(0, 6))}
                      placeholder="e.g. 500072" />
              <FField label="Country" value={form.country ?? "INDIA"} onChange={setV("country")}
                      placeholder="e.g. USA" />
            </RegSection>

            {/* Was a SECOND "Contact person" section. The person's name, phone
                and email are already collected in the first section, so this
                asked for the same three things again under the same heading —
                which reads as a form bug and makes people wonder which one
                counts. What is left here is genuinely different information,
                so the heading now says what it actually holds. */}
            <RegSection title={isInst ? "Additional details" : "Business details"}>
              <FField label="Designation" value={form.designation} onChange={setV("designation")}
                      placeholder={isInst ? "e.g. Director of Career Services" : "e.g. Talent Acquisition Manager"} />
              <FField label="Promoter's name" value={form.promoter_name} onChange={setV("promoter_name")}
                      placeholder={isInst ? "e.g. David Anderson" : "e.g. Robert Mitchell"} />
              {isInst ? (
                /* The authorised person's phone and email used to be asked for
                   here. They are the Contact Number and Official Mail already
                   entered above, so they are now carried across automatically
                   on submit — the institute profile and the main campus still
                   get their contact details, nobody types them twice. */
                null
              ) : (
                <>
                  <FField label="GST No." value={form.gst_no} onChange={setV("gst_no")}
                          placeholder="e.g. 36AABCU9603R1ZM" hint="Used to verify your business" />
                  <FField label="PAN No." value={form.pan_no} onChange={setV("pan_no")}
                          placeholder="e.g. AABCU9603R" />
                </>
              )}
            </RegSection>

            <RegSection title={isInst ? "Courses and about" : "About us"}>
              {isInst && (
                <div className="sm:col-span-2">
                  <TagInput label="Courses offered" values={form.courseList || []} options={COURSES}
                            onChange={(v) => setForm((f) => ({ ...f, courseList: v }))}
                            placeholder="e.g. Computer Science, Nursing, MBA"
                            hint="Add every course your institute runs — recruiters filter by course." />
                </div>
              )}
              <div className="sm:col-span-2">
                <RichText label={isInst ? "About the institute" : "About us"}
                          value={form.about} onChange={setV("about")} rows={6}
                          hint={isInst
                            ? "Facilities, placement record, accreditations. **bold**, ## heading, - lists work."
                            : "Tell candidates about your organisation. **bold**, ## heading and - lists work."} />
              </div>
            </RegSection>

            </>
            )}

            {/* Recruiter bot check. Outside the stage-3 block on purpose: the
                recruiter form is a single page, and this used to be reachable
                only after an email OTP that never arrives when mail isn't
                configured. */}
            {!isInst && !admin && (
              <div className="card">
                <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold uppercase
                               tracking-wide text-slate-500">
                  Verify your email
                </h3>
                <OtpField label="Official Mail" channel="email" hideInput
                          value={form.email}
                          onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                          onVerified={(ok) => setForm((f) => ({ ...f, email_verified: ok }))}
                          hint="We'll email a 6-digit code to the address above. It doesn't expire." />
              </div>
            )}

            {!isInst && !admin && <CaptchaField form={form} setForm={setForm} />}

    </>
  );
}

/* Card wrapper for a group of registration fields. */
export function RegSection({ title, children }) {
  return (
    <div className="card">
      <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

/**
 * Password + Confirm password, with the match state shown as you type.
 *
 * The mismatch message appears only once the confirm box has something in it —
 * flagging "passwords are not matching" against an empty second field while
 * someone is still typing the first one is noise, not help.
 */
export function PasswordSection({ form, setForm }) {
  const [show, setShow] = useState(false);

  const pw = form.password || "";
  const confirm = form.confirm_password || "";
  const tooShort = pw.length > 0 && pw.length < 6;
  const mismatch = confirm.length > 0 && pw !== confirm;
  const matched = pw.length >= 6 && pw === confirm;

  return (
    <div className="card">
      <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
        Create your password
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <RegPassword label="Password" required value={pw} placeholder="At least 6 characters"
                     show={show} onToggle={() => setShow((v) => !v)}
                     error={tooShort ? "Password must contain at least 6 characters" : null}
                     onChange={(v) => setForm((f) => ({ ...f, password: v }))} />
        <RegPassword label="Confirm password" required value={confirm} placeholder="Type it again"
                     show={show} onToggle={() => setShow((v) => !v)} ok={matched}
                     error={mismatch ? "Passwords are not matching" : null}
                     onChange={(v) => setForm((f) => ({ ...f, confirm_password: v }))} />
      </div>

      {matched && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-brandgreen-50 px-3 py-2
                      text-xs font-bold text-brandgreen-600">
          <IconCheck size={13} /> Passwords match — press Submit to finish registering.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-400">
        Your User ID is your official email address. Use this password to log in on both the
        website and the mobile app.
      </p>
    </div>
  );
}

/* Empty strings -> null, so the DB stores NULL rather than "". */
const clean = (v) => {
  const s = typeof v === "string" ? v.trim() : v;
  return s === "" || s === undefined ? null : s;
};

/* Deliberately the same shape as EMAIL_RE in backend/app/routers/auth.py.
   A form that accepts what the API rejects leaves the user stuck with a
   button that does nothing and no explanation. Requires a real TLD, so
   "priya@institute" is caught here rather than at send time. */
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;

/**
 * One payload builder for both the public and admin paths, so an admin-created
 * account carries exactly the same fields as a self-registered one. Previously
 * admin sent a smaller object and the extra fields were simply never captured.
 */
export function buildRegistrationPayload(role, form) {
  const email = (form.email || "").trim();
  if (role === "institute") {
    return {
      name: clean(form.name), email, phone: clean(form.phone),
      address1: clean(form.address1), address2: clean(form.address2),
      city: clean(form.city), district: clean(form.district), state: clean(form.state),
      pincode: clean(form.pincode),
      country: clean(form.country) || "INDIA",
      promoter_name: clean(form.promoter_name),
      authorised_person_name: clean(form.authorised_person_name),
      // Carried over from the contact details entered once, above. The
      // institute profile and the seeded main campus both read these, so
      // dropping the duplicate FIELDS must not drop the DATA.
      authorised_person_phone: clean(form.authorised_person_phone || form.phone),
      authorised_person_email: clean(form.authorised_person_email || form.email),
      designation: clean(form.designation), website: clean(form.website),
      logo_url: clean(form.logo_url), about: clean(form.about),
      total_capacity: form.total_capacity ? Number(form.total_capacity) : null,
      current_strength: form.current_strength ? Number(form.current_strength) : null,
      // Legacy alias the bulk-upload capacity check reads. Sent in step with
      // current_strength so an upload is never measured against a stale number.
      present_strength: form.current_strength ? Number(form.current_strength) : null,
      courses: form.courseList || [],
      // confirm_password is a form-only field and is deliberately NOT sent —
      // the server re-checks length, and shipping the same secret twice just
      // widens what a log could leak.
      password: (form.password || "").trim() || null,
    };
  }
  if (role === "enterprise") {
    return {
      name: clean(form.name), email, phone: clean(form.phone),
      address1: clean(form.address1), address2: clean(form.address2),
      city: clean(form.city), district: clean(form.district), state: clean(form.state),
      country: clean(form.country) || "INDIA",
      promoter_name: clean(form.promoter_name),
      authorised_person_name: clean(form.authorised_person_name),
      designation: clean(form.designation),
      gst_no: clean(form.gst_no), pan_no: clean(form.pan_no),
      about: clean(form.about), website: clean(form.website),
      logo_url: clean(form.logo_url),
      pincode: clean(form.pincode), landline: clean(form.landline),
      // The bot check travels with the registration itself, so it is validated
      // in the same request that creates the account.
      captcha_token: form.captcha_token || null,
      captcha_answer: clean(form.captcha_answer),
      // email_verified is form-only state; the server re-checks verification
      // itself rather than trusting a flag the browser sent.
    };
  }
  return {
    email, first_name: clean(form.first_name), last_name: clean(form.last_name),
    phone: clean(form.phone), location: clean(form.location),
    key_skills: form.skillList || [],
  };
}

/** Shared required-field check. Returns an error string, or null when valid. */
export function validateRegistration(role, form) {
  const email = (form.email || "").trim();
  if (role === "jobseeker") {
    if (!(form.first_name || "").trim()) return "First name is required.";
  } else if (!(form.name || "").trim()) {
    return role === "institute" ? "Institute Name is required." : "Organisation Name is required.";
  }
  if (!email) return "Email is required — login details are sent there.";
  if (!EMAIL_PATTERN.test(email)) return "That email address doesn't look right.";

  if (role === "enterprise") {
    if (!(form.authorised_person_name || "").trim()) return "Contact Person is required.";
    if (!(form.phone || "").trim()) return "Mobile Number is required.";
    if (!(form.address1 || "").trim()) return "Address is required.";
    if (!/^\d{6}$/.test(form.pincode || "")) return "Enter a valid 6-digit Pincode.";
    if (!form.email_verified) return "Please verify your email with the OTP before registering.";
    if (!(form.captcha_answer || "").trim()) return "Please answer the security check.";
  }

  if (role === "institute") {
    if (!(form.authorised_person_name || "").trim()) return "Contact Person is required.";
    if (!(form.phone || "").trim()) return "Mobile No is required.";
    if (!String(form.total_capacity || "").trim()) return "Total Capacity is required.";
    if (!String(form.current_strength || "").trim()) return "Current Strength is required.";
    if (Number(form.current_strength) > Number(form.total_capacity)) {
      return "Current Strength can't be more than Total Capacity.";
    }
    // Requirement 9 — the exact wording the institute is told to expect.
    const pw = form.password || "";
    const confirm = form.confirm_password || "";
    if (!pw) return "Please set a password.";
    if (pw.length < 6) return "Password must be at least 6 characters.";
    if (pw !== confirm) return "Passwords are not matching";
  }
  return null;
}

/**
 * The security check on the public registration forms.
 *
 * Self-hosted rather than reCAPTCHA: no site key to provision, no third-party
 * script on the page, no outbound call from the backend. The sum is trivial
 * for a person and still forces a real round trip, which is all this needs to
 * be — bulk signups are really stopped by email verification and the admin
 * approval queue, not by this.
 */
export function CaptchaField({ form, setForm }) {
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(false);
  const [spin, setSpin] = useState(0);
  const [touched, setTouched] = useState(false);
  const rootRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setSpin((n) => n + 1);
    try {
      const c = await api.get("/api/auth/captcha", { auth: false });
      setChallenge(c);
      setTouched(false);
      setForm((f) => ({ ...f, captcha_token: c.token, captcha_answer: "" }));
    } catch {
      setChallenge({ question: "Couldn't load the security check.", token: "" });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Like the other fields: show "required" once Submit is pressed.
  useEffect(() => {
    const f = rootRef.current?.closest("form");
    if (!f) return;
    const on = () => setTouched(true);
    f.addEventListener("submit", on, true);
    return () => f.removeEventListener("submit", on, true);
  }, []);

  const answer = form.captcha_answer || "";
  const missing = touched && !answer;
  // Older servers send only `question`; parse it so the tiles still work.
  const parts = challenge?.op ? challenge
    : (() => { const m = /(\d+)\s*([+−-])\s*(\d+)/.exec(challenge?.question || "");
               return m ? { a: m[1], op: m[2] === "-" ? "−" : m[2], b: m[3] } : null; })();

  const Tile = ({ children, tone = "num" }) => (
    <span key={`${spin}-${children}`}
          className={`captcha-pop flex h-12 w-12 items-center justify-center rounded-2xl text-2xl font-extrabold tabular-nums sm:h-14 sm:w-14
            ${tone === "op" ? "bg-transparent text-slate-400 !w-7"
              : "bg-white text-navy shadow-[0_6px_16px_-6px_rgba(79,70,229,.45)] ring-1 ring-indigo-100"}`}>
      {children}
    </span>
  );

  return (
    <div ref={rootRef} className="card reg-keep overflow-hidden !p-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brandgreen to-navy text-white shadow-md">
          <IconShield size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-800">Security check</h3>
          <p className="text-xs text-slate-500">Solve this quick sum to show you're a person.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} aria-label="New question"
                className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-indigo-100 bg-white px-3 py-2 text-xs font-semibold text-navy transition-colors hover:bg-navy-50 disabled:opacity-60">
          <IconRefresh size={13} className={loading ? "animate-spin" : ""} /> New question
        </button>
      </div>

      {/* The sum */}
      <div className="captcha-bg flex flex-wrap items-center justify-center gap-2 px-6 py-6 sm:gap-3">
        {loading && !parts ? (
          <span className="h-14 w-56 animate-pulse rounded-2xl bg-white/70" />
        ) : parts ? (
          <>
            <Tile>{parts.a}</Tile>
            <Tile tone="op">{parts.op}</Tile>
            <Tile>{parts.b}</Tile>
            <Tile tone="op">=</Tile>
            <span className={`flex h-12 w-20 items-center rounded-2xl border-2 bg-white transition-all sm:h-14 sm:w-24
                              ${missing ? "border-red-400 ring-4 ring-red-100"
                                : answer ? "border-brandgreen-400 ring-4 ring-brandgreen-100"
                                : "border-dashed border-indigo-300 focus-within:border-solid focus-within:border-navy focus-within:ring-4 focus-within:ring-navy/10"}`}>
              <input inputMode="numeric" maxLength={2} aria-label={challenge?.question || "Your answer"}
                     value={answer} placeholder="?"
                     onBlur={() => setTouched(true)}
                     onChange={(e) => setForm((f) => ({ ...f, captcha_answer: e.target.value.replace(/\D/g, "").slice(0, 2) }))}
                     className="w-full bg-transparent text-center text-2xl font-extrabold tabular-nums text-slate-900 outline-none placeholder:text-indigo-300" />
            </span>
          </>
        ) : (
          <span className="text-sm text-red-500">{challenge?.question || "…"}</span>
        )}
      </div>

      <p className={`border-t border-slate-100 px-6 py-3 text-xs ${missing ? "font-medium text-red-500" : "text-slate-400"}`}>
        {missing ? "Please answer the sum above."
                 : "Only adding or taking away single numbers. Can't read it? Press New question."}
      </p>
    </div>
  );
}
