import { useState } from "react";
import RichText from "./RichText";
import ImageUpload from "./ImageUpload";
import OtpField from "./OtpField";
import PhoneField from "./PhoneField";
import { Field as FField, Combobox, TagInput } from "./fields";
import SkillPicker from "./SkillPicker";
import { IconCheck, IconEye } from "./icons";
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
                    placeholder="e.g. Madhu" />
            <FField label="Last name" value={form.last_name} onChange={setV("last_name")}
                    placeholder="e.g. Gundu" />
            <div className="sm:col-span-2">
              <FField label="Email (becomes your User ID)" type="email" required value={form.email}
                      onChange={setV("email")} placeholder="e.g. you@gmail.com" />
            </div>
            <div className="sm:col-span-2">
              <PhoneField label="Phone" value={form.phone} onChange={setV("phone")} />
            </div>
            <Combobox label="Location" value={form.location} options={CITIES} onChange={setV("location")}
                      placeholder="e.g. Hyderabad" />
            <div className="sm:col-span-2">
              {/* SkillPicker, not a 29-item local array: job posting already
                  searched the full 1,147-skill library from the server, so a
                  seeker could only tag themselves with skills recruiters
                  mostly weren't asking for. One source, both sides. */}
              <SkillPicker label="Key skills" values={form.skillList || []}
                           onChange={(v) => setForm((f) => ({ ...f, skillList: v }))}
                           placeholder="Type a skill — e.g. Python, Excel, Welding" />
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
                  <FField label={isInst ? "Institute Name" : "Company Name"} required
                          value={form.name} onChange={setV("name")}
                          placeholder={isInst ? "e.g. Coco Soft Institute" : "e.g. Campus Connect Limited"} />
                  <div className="mt-4">
                    <FField label={isInst ? "Official Mail" : "Official Mail"} required type="email"
                            value={form.email} onChange={setV("email")}
                            placeholder="e.g. hr@yourcompany.com" />
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
                <FField label="Contact Person" value={form.authorised_person_name}
                        onChange={setV("authorised_person_name")}
                        placeholder={isInst ? "e.g. Priya Sharma, Placement Officer" : "e.g. Priya Sharma, HR Manager"} />
              </div>

              <div className="sm:col-span-2">
                <PhoneField label="Contact Number" required value={form.phone} onChange={setV("phone")}
                            hint="Pick your country, then type the number — digits only." />
              </div>

              <FField label="Website" value={form.website} onChange={setV("website")}
                      placeholder="e.g. www.yourcompany.com" />
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
            {!admin && stage >= 2 && (
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
                <FField label="Address line 1" value={form.address1} onChange={setV("address1")}
                        placeholder="e.g. Plot 42, Kukatpally Industrial Area" />
              </div>
              <div className="sm:col-span-2">
                <FField label="Address line 2" value={form.address2} onChange={setV("address2")}
                        placeholder="e.g. Near Metro Pillar 1129 (optional)" />
              </div>
              <Combobox label="City" value={form.city} options={CITIES} onChange={setV("city")}
                        placeholder="e.g. Hyderabad" />
              <FField label="District" value={form.district} onChange={setV("district")}
                      placeholder="e.g. Medchal-Malkajgiri" />
              <Combobox label="State" value={form.state} options={STATES} onChange={setV("state")}
                        placeholder="e.g. Telangana" />
              <FField label="Pincode" value={form.pincode}
                      onChange={(v) => setV("pincode")(String(v).replace(/\D/g, "").slice(0, 6))}
                      placeholder="e.g. 500072" />
              <FField label="Country" value={form.country ?? "INDIA"} onChange={setV("country")}
                      placeholder="e.g. INDIA" />
            </RegSection>

            <RegSection title="Contact person">
              <FField label="Designation" value={form.designation} onChange={setV("designation")}
                      placeholder="e.g. HR Manager" />
              <FField label="Promoter's name" value={form.promoter_name} onChange={setV("promoter_name")}
                      placeholder="e.g. Ramesh Kumar" />
              {isInst ? (
                <>
                  <div className="sm:col-span-2">
                    <PhoneField label="Authorised person phone" value={form.authorised_person_phone}
                                onChange={setV("authorised_person_phone")} />
                  </div>
                  <div className="sm:col-span-2">
                    <FField label="Authorised person email" type="email"
                            value={form.authorised_person_email} onChange={setV("authorised_person_email")}
                            placeholder="e.g. priya@institute.edu" />
                  </div>
                </>
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
                            placeholder="e.g. B.Tech, Diploma, MBA"
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
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pw = form.password || "";
  const confirm = form.confirm_password || "";
  const tooShort = pw.length > 0 && pw.length < 6;
  const mismatch = confirm.length > 0 && pw !== confirm;
  const matched = pw.length >= 6 && pw === confirm;

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Create your password
        </h3>
        <button type="button" onClick={() => setShow((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-navy">
          <IconEye size={13} /> {show ? "Hide" : "Show"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">
            Password <span className="font-semibold text-red-400">*</span>
          </label>
          <input className={`input ${tooShort ? "!border-red-400 !bg-red-50/40" : ""}`}
                 type={show ? "text" : "password"} value={pw}
                 autoComplete="new-password"
                 placeholder="At least 6 characters"
                 onChange={set("password")} />
        </div>
        <div>
          <label className="label">
            Confirm password <span className="font-semibold text-red-400">*</span>
          </label>
          <input className={`input ${mismatch ? "!border-red-400 !bg-red-50/40" : ""}
                             ${matched ? "!border-brandgreen !bg-brandgreen-50/40" : ""}`}
                 type={show ? "text" : "password"} value={confirm}
                 autoComplete="new-password"
                 placeholder="Type it again"
                 onChange={set("confirm_password")} />
        </div>
      </div>

      {tooShort && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          Password must be at least 6 characters.
        </p>
      )}
      {mismatch && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          Passwords are not matching
        </p>
      )}
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
      authorised_person_phone: clean(form.authorised_person_phone),
      authorised_person_email: clean(form.authorised_person_email),
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
    return role === "institute" ? "Institute Name is required." : "Company Name is required.";
  }
  if (!email) return "Email is required — login details are sent there.";
  if (!EMAIL_PATTERN.test(email)) return "That email address doesn't look right.";

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
