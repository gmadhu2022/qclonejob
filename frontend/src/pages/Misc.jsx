import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui";
import { useDialog } from "../components/Dialog";
import Logo from "../components/Logo";
import { IconCheck, IconEye, IconLock } from "../components/icons";
import { Field as FField, Combobox, TagInput } from "../components/fields";
import { CITIES, STATES, SKILLS, COURSES } from "../lib/options";

/* Simple centred shell used by the auth-adjacent pages */
function AuthShell({ title, subtitle, children, wide }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-100 bg-white px-6 py-3">
        <div className="mx-auto max-w-6xl"><Link to="/"><Logo className="h-9" /></Link></div>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className={wide ? "w-full max-w-2xl" : "w-full max-w-md"}>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function ChangePassword() {
  const { auth, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [show, setShow] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/auth/change-password", { old_password: oldPw || null, new_password: newPw });
      toast("Password changed. Please log in again.");
      logout(); navigate("/login");
    } catch (err) { toast(err.message, "error"); }
  };

  return (
    <AuthShell title="Change password" subtitle={`Set a new password for ${auth?.email || "your account"}.`}>
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="label">Current password <span className="font-normal text-slate-400">(leave blank on first login)</span></label>
          <input className="input" type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label !mb-0">New password</label>
            <button type="button" onClick={() => setShow((v) => !v)} className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-navy">
              <IconEye size={13} /> {show ? "Hide" : "Show"}
            </button>
          </div>
          <input className="input" type={show ? "text" : "password"} value={newPw} required minLength={6}
                 onChange={(e) => setNewPw(e.target.value)} />
          <p className="mt-1.5 text-xs text-slate-400">At least 6 characters.</p>
        </div>
        <button className="btn w-full">Change password</button>
      </form>
    </AuthShell>
  );
}

export function Register() {
  const { role } = useParams(); // jobseeker | enterprise | institute
  const toast = useToast();
  const dialog = useDialog();
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setV = (k) => (v) => setForm({ ...form, [k]: v });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const path = role === "enterprise" ? "/api/public/register/enterprise"
                 : role === "institute" ? "/api/public/register/institute"
                 : "/api/public/register/jobseeker";
      const body = role === "institute"
        ? { name: form.name, email: form.email, phone: form.phone, city: form.city, state: form.state,
            promoter_name: form.promoter_name, authorised_person_name: form.authorised_person_name,
            designation: form.designation, website: form.website,
            present_strength: form.present_strength ? Number(form.present_strength) : null,
            courses: form.courseList || [] }
        : role === "enterprise"
        ? { name: form.name, email: form.email, phone: form.phone, city: form.city, state: form.state,
            promoter_name: form.promoter_name, authorised_person_name: form.authorised_person_name,
            gst_no: form.gst_no, pan_no: form.pan_no }
        : { email: form.email, first_name: form.first_name, last_name: form.last_name, phone: form.phone,
            location: form.location,
            key_skills: form.skillList || [] };
      const res = await api.post(path, body, { auth: false });
      setResult(res);
      dialog({
        tone: "success",
        title: "Profile created successfully",
        message: res.status,
        details: [["User ID", res.user_id], ["Password", res.password]],
        note: res.email_status === "sent"
          ? `Your login details were emailed to ${res.email}.`
          : res.email_status === "console"
            ? "Email sending is switched off, so save these details now — they are also printed in the server console."
            : `We could not email these details (${res.email_error || "delivery failed"}). Please save them now.`,
        noteTone: res.email_status === "sent" ? "info" : "warn",
        confirmLabel: "Save & continue",
      });
    } catch (err) { toast(err.message, "error"); }
    finally { setBusy(false); }
  };

  if (result) {
    return (
      <AuthShell title="You're registered" subtitle="Your account is ready to use.">
        <div className="card text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brandgreen-50 text-brandgreen-600">
            <IconCheck size={26} />
          </div>
          <p className="mt-4 font-semibold text-slate-800">{result.status}</p>
          <p className="mt-2 text-sm text-slate-500">
            Login credentials have been sent to <b className="text-slate-700">{result.email}</b>.
            In development they also print to the backend console.
          </p>
          <Link to={`/login/${role}`} className="btn mt-6 w-full">Go to login</Link>
        </div>
      </AuthShell>
    );
  }

  const isEnt = role === "enterprise";
  const isInst = role === "institute";
  return (
    <AuthShell wide
      title={isInst ? "Register your institute" : isEnt ? "Register as an employer" : "Create your job seeker account"}
      subtitle={isInst ? "Onboard your students in bulk and connect them to employers."
                       : isEnt ? "Post jobs, search resumes and manage applications."
                       : "Build your resume, apply to jobs and track every application."}>
      <form onSubmit={submit} className="card grid gap-4 sm:grid-cols-2">
        {isInst ? (
          <>
            <div className="sm:col-span-2"><FField label="Institute name" required value={form.name} onChange={setV("name")} /></div>
            <div className="sm:col-span-2"><FField label="Email (becomes your User ID)" type="email" required value={form.email} onChange={setV("email")} /></div>
            <FField label="Phone" value={form.phone} onChange={setV("phone")} />
            <Combobox label="City" value={form.city} options={CITIES} onChange={setV("city")} />
            <Combobox label="State" value={form.state} options={STATES} onChange={setV("state")} />
            <FField label="Website" value={form.website} onChange={setV("website")} />
            <FField label="Promoter's name" value={form.promoter_name} onChange={setV("promoter_name")} />
            <FField label="Authorised person" value={form.authorised_person_name} onChange={setV("authorised_person_name")} />
            <FField label="Designation" value={form.designation} onChange={setV("designation")} />
            <FField label="Present strength" value={form.present_strength} onChange={setV("present_strength")} />
            <div className="sm:col-span-2">
              <TagInput label="Courses offered" values={form.courseList || []} options={COURSES}
                        onChange={(v) => setForm({ ...form, courseList: v })}
                        hint="Add every course your institute runs." />
            </div>
          </>
        ) : isEnt ? (
          <>
            <div className="sm:col-span-2"><FField label="Company name" required value={form.name} onChange={setV("name")} /></div>
            <div className="sm:col-span-2"><FField label="Email (becomes your User ID)" type="email" required value={form.email} onChange={setV("email")} /></div>
            <FField label="Phone" value={form.phone} onChange={setV("phone")} />
            <Combobox label="City" value={form.city} options={CITIES} onChange={setV("city")} />
            <Combobox label="State" value={form.state} options={STATES} onChange={setV("state")} />
            <FField label="Promoter's name" value={form.promoter_name} onChange={setV("promoter_name")} />
            <div className="sm:col-span-2"><FField label="Authorised person" value={form.authorised_person_name} onChange={setV("authorised_person_name")} /></div>
            <FField label="GST No." value={form.gst_no} onChange={setV("gst_no")} hint="Used to verify your business" />
            <FField label="PAN No." value={form.pan_no} onChange={setV("pan_no")} />
          </>
        ) : (
          <>
            <FField label="First name" required value={form.first_name} onChange={setV("first_name")} />
            <FField label="Last name" value={form.last_name} onChange={setV("last_name")} />
            <div className="sm:col-span-2"><FField label="Email (becomes your User ID)" type="email" required value={form.email} onChange={setV("email")} /></div>
            <FField label="Phone" value={form.phone} onChange={setV("phone")} />
            <Combobox label="Location" value={form.location} options={CITIES} onChange={setV("location")} />
            <div className="sm:col-span-2">
              <TagInput label="Key skills" values={form.skillList || []} options={SKILLS}
                        onChange={(v) => setForm({ ...form, skillList: v })}
                        hint="Add the skills you want employers to find you by." />
            </div>
          </>
        )}
        <div className="sm:col-span-2">
          <button className="btn w-full !py-3" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
          <p className="mt-3 text-center text-sm text-slate-500">
            Already registered? <Link to={`/login/${role}`} className="font-semibold text-navy hover:underline">Log in</Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}


export function StaticPage({ title, children }) {
  return (
    <AuthShell title={title}>
      <div className="card text-[15px] leading-relaxed text-slate-600">{children}</div>
      <Link to="/" className="btn-outline mt-5 inline-block">← Back to home</Link>
    </AuthShell>
  );
}


export function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post("/api/auth/forgot-password", { email }, { auth: false });
      setSent(true); toast(r.message);
    } catch (err) { toast(err.message, "error"); }
    finally { setBusy(false); }
  };

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="If that address is registered, a reset link is on its way.">
        <div className="card text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy-50 text-navy"><IconLock size={24} /></div>
          <p className="mt-4 text-sm text-slate-500">
            The link is valid for one hour. In development the email prints to the backend console.
          </p>
          <Link to="/login" className="btn mt-6 w-full">Back to login</Link>
        </div>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link.">
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} required placeholder="you@example.com"
                 onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button className="btn w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        <p className="text-center text-sm text-slate-500">
          Remembered it? <Link to="/login" className="font-semibold text-navy hover:underline">Log in</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function ResetPassword() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post("/api/auth/reset-password", { token, new_password: pw }, { auth: false });
      toast(r.message);
      navigate("/login");
    } catch (err) { toast(err.message, "error"); }
    finally { setBusy(false); }
  };

  if (!token) {
    return (
      <AuthShell title="Invalid reset link" subtitle="This link is missing its token.">
        <div className="card">
          <p className="text-sm text-slate-500">Request a fresh link and try again.</p>
          <Link to="/forgot-password" className="btn mt-4 w-full">Request a new link</Link>
        </div>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you haven't used before.">
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <label className="label !mb-0">New password</label>
            <button type="button" onClick={() => setShow((v) => !v)}
                    className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-navy">
              <IconEye size={13} /> {show ? "Hide" : "Show"}
            </button>
          </div>
          <input className="input" type={show ? "text" : "password"} value={pw} required minLength={6}
                 onChange={(e) => setPw(e.target.value)} />
          <p className="mt-1.5 text-xs text-slate-400">At least 6 characters.</p>
        </div>
        <button className="btn w-full" disabled={busy}>{busy ? "Updating…" : "Reset password"}</button>
      </form>
    </AuthShell>
  );
}
