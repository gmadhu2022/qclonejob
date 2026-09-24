import { Fragment, useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { api, getToken, mediaUrl } from "../../lib/api";
import { DashboardLayout, useToast } from "../../components/ui";
import { useDialog, useConfirm } from "../../components/Dialog";
import { IconBuilding, IconUpload, IconChart, IconSparkle, IconEdit, IconClose,
         IconCheck, IconDownload, IconLayers, IconUser, IconTrend } from "../../components/icons";
import Chat from "../../components/Chat";
import ImageUpload from "../../components/ImageUpload";
import FileDrop from "../../components/FileDrop";
import RichText, { Markdown } from "../../components/RichText";
import PhoneField from "../../components/PhoneField";
import PostJobForm from "../../components/PostJobForm";
import { SwitchableChart, NoData } from "../../components/charts";
import { Combobox } from "../../components/fields";
import { CITIES, STATES, COURSES } from "../../lib/options";

/* =====================================================================
   Institute portal.

   The left-hand menu is exactly the four items the institute asked for:
   Dashboard, Profile, Data upload, Post a Ad. "Messages" has been removed
   from the menu — but NOT from the router. Institutes can still be messaged
   by recruiters, and a "new message" notification links straight to
   /institute/messages; deleting the route would turn every one of those
   notifications into a dead link. Same reasoning for post-job, which was
   already off the menu before this change.
   ===================================================================== */
const MENU = [
  { to: "/institute", label: "Dashboard", icon: IconChart },
  { to: "/institute/profile", label: "Profile", icon: IconBuilding },
  { to: "/institute/upload", label: "Data upload", icon: IconUpload },
  { to: "/institute/post-ad", label: "Post a Ad", icon: IconSparkle },
];

export default function Institute() {
  return (
    <DashboardLayout title="Institute" menu={MENU}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="upload" element={<DataUpload />} />
        <Route path="post-ad" element={<PostAd />} />
        {/* Off-menu but still routable — see the note above. */}
        <Route path="post-job" element={<PostJob />} />
        <Route path="messages" element={<Chat canBlock />} />
        <Route path="*" element={<Navigate to="/institute" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

/* =====================================================================
   Dashboard — course-wise capacity and strength, placements, and the
   year / course / gender split of the students actually uploaded.
   ===================================================================== */
function Dashboard() {
  const [d, setD] = useState(null);
  const [openCourse, setOpenCourse] = useState(null);

  useEffect(() => { api.get("/api/institute/summary").then(setD).catch(() => {}); }, []);
  if (!d) return <DashboardSkeleton />;

  const i = d.institute;
  const courses = d.courses || [];
  const vacant = Math.max(0, (d.seats_total || 0) - (d.strength_total || 0));

  const capacitySplit = [
    { label: "Seats filled", value: d.strength_total || 0, color: "bg-brandgreen" },
    { label: "Seats vacant", value: vacant },
  ];
  const placementSplit = [
    { label: "Placed", value: d.placed, color: "bg-brandgreen" },
    { label: "Applied, not placed", value: Math.max(0, d.applications - d.placed) },
    { label: "Yet to apply", value: Math.max(0, d.students_total - d.applications) },
  ];

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Dashboard
          </p>
          <h2 className="mt-0.5 truncate text-2xl font-extrabold text-navy">{i.name}</h2>
          <p className="text-sm text-slate-500">
            {[i.city, i.state, i.pincode].filter(Boolean).join(", ") || "Location not set"}
          </p>
        </div>
        {/* Only render the status chip when there IS a status. It used to fall
            through to the red style with empty text, painting a stray pink
            dash in the corner of every admin-created institute's dashboard. */}
        {i.approval_status && (
          <span className={`badge capitalize ${
            i.approval_status === "approved" ? "bg-brandgreen-50 text-brandgreen-600"
            : i.approval_status === "pending" ? "bg-amber-100 text-amber-700"
            : "bg-red-100 text-red-700"}`}>
            {i.approval_status}
          </span>
        )}
      </div>

      {/* Requirement 43 surfaced where the wrong number is actually read.
          A blank strength makes the totals below quietly too low, so say so
          here rather than leaving the institute to work it out. */}
      {(d.courses_incomplete || []).length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200
                        bg-amber-50/60 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                           bg-amber-100 text-sm font-extrabold text-amber-700">
            !
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-amber-900">
              {d.courses_incomplete.length} course(s) have no student strength yet
            </h3>
            <p className="mt-0.5 text-sm text-amber-700">
              {d.courses_incomplete.slice(0, 3).map((c) => `${c.course} (${c.location})`).join(", ")}
              {d.courses_incomplete.length > 3 && ` and ${d.courses_incomplete.length - 3} more`}.
              Current strength below is lower than your real figure until these are filled in.
            </p>
          </div>
          <Link to="/institute/profile" className="btn-outline btn-sm shrink-0">Fill them in</Link>
        </div>
      )}

      {/* Requirements 21-24 as headline numbers. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Courses" value={d.courses_count} icon={IconLayers} />
        <Kpi label="Seats capacity" value={d.seats_total} icon={IconChart} />
        <Kpi label="Current strength" value={d.strength_total} icon={IconUser}
             sub={d.seats_total ? `${Math.round(100 * d.strength_total / d.seats_total)}% of capacity` : null} />
        <Kpi label="Students uploaded" value={d.students_total} icon={IconUpload} />
        <Kpi label="Students placed" value={d.placed} icon={IconCheck} tone="green" />
        <Kpi label="Placement rate" value={`${d.placement_rate}%`} icon={IconTrend} tone="green" />
      </div>

      {/* Requirements 21-23 — course wise seats capacity and current strength. */}
      <div className="card">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-bold text-slate-700">Courses — seats and strength</h3>
          <span className="text-xs text-slate-400">
            Click a course to see it split by campus
          </span>
        </div>
        {courses.length === 0 ? (
          <EmptyState
            icon={IconLayers}
            title="No courses yet"
            body="Add your courses with their seat counts, and this table fills in with capacity and strength for each one."
            action={{ to: "/institute/profile", label: "Add courses" }} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th className="w-28 whitespace-nowrap text-right">Seats</th>
                  <th className="w-28 whitespace-nowrap text-right">Strength</th>
                  <th className="w-24 whitespace-nowrap text-right">Vacant</th>
                  <th className="w-44">Filled</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  /* Fragment needs the key: the course row and its per-campus
                     rows are siblings in one list, so React has to be told
                     which pair belongs to which course. */
                  <Fragment key={c.label}>
                    <tr className="cursor-pointer hover:bg-slate-50"
                        onClick={() => setOpenCourse(openCourse === c.label ? null : c.label)}>
                      <td className="font-semibold text-slate-700">{c.label}</td>
                      <td className="text-right">{c.seats}</td>
                      <td className="text-right text-navy">{c.strength}</td>
                      <td className="text-right text-amber-600">{c.vacant}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-brandgreen"
                                 style={{ width: `${Math.min(100, c.fill_rate)}%` }} />
                          </div>
                          <span className="w-11 text-right text-[11px] font-semibold text-slate-500">
                            {c.fill_rate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                    {openCourse === c.label && (c.locations || []).map((l, n) => (
                      <tr key={`${c.label}-${n}`} className="bg-slate-50/70 text-[13px]">
                        <td className="pl-8 text-slate-500">
                          {l.location}{l.pincode ? ` · ${l.pincode}` : ""}
                        </td>
                        <td className="text-right text-slate-500">{l.seats}</td>
                        <td className="text-right text-slate-500">{l.strength}</td>
                        <td className="text-right text-slate-400">
                          {Math.max(0, l.seats - l.strength)}
                        </td>
                        <td />
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-bold text-navy">
                  <td>Total</td>
                  <td className="text-right">{d.seats_total}</td>
                  <td className="text-right">{d.strength_total}</td>
                  <td className="text-right">{vacant}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SwitchableChart title="Seat utilisation"
                         subtitle="Across every course and campus"
                         data={capacitySplit} />
        <SwitchableChart title="Placement breakdown"
                         subtitle="Where your students are in the process"
                         data={placementSplit} />
      </div>

      {/* Requirement 25 — students on the platform, by year, course and gender. */}
      <div className="card">
        <h3 className="font-bold text-slate-700">Students online</h3>
        <p className="mt-1 text-sm text-slate-500">
          The {d.students_total} student record(s) uploaded from your sheets, grouped three
          ways. Blank cells in a sheet show as “Not given”.
        </p>
      </div>

      {d.students_total === 0 ? (
        <div className="card">
          <EmptyState
            icon={IconUpload}
            title="No student data yet"
            body="Upload a sheet of your students and these charts break them down by year of passing, course and gender."
            action={{ to: "/institute/upload", label: "Go to Data upload" }} />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <SwitchableChart title="Year wise" subtitle="By year of passing"
                           data={d.by_year || []}
                           types={["bar", "hbar", "stacked", "pie", "donut"]} />
          <SwitchableChart title="Course wise" subtitle="From the uploaded records"
                           data={d.by_course || []}
                           types={["hbar", "bar", "pie", "donut"]} />
          <SwitchableChart title="Gender wise" subtitle="From the uploaded records"
                           data={d.by_gender || []}
                           types={["donut", "pie", "bar", "radial"]} />
        </div>
      )}

      {d.last_upload && (
        <div className="card">
          <h3 className="font-semibold text-slate-700">Last data upload</h3>
          <p className="mt-1 text-sm text-slate-600">
            <b>{d.last_upload.filename}</b> · {d.last_upload.created} student(s) created ·{" "}
            {new Date(d.last_upload.uploaded_at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

/* Skeletons, not a "Loading…" line.

   The dashboard makes five calls' worth of layout decisions; a single line of
   text collapses the page to nothing and then snaps it back to full height,
   which reads as a glitch. Blocks of roughly the right shape keep the page
   still while the data lands. */
const Shimmer = ({ className = "" }) => (
  <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />
);

function DashboardSkeleton() {
  return (
    <div className="max-w-6xl space-y-5" aria-busy="true" aria-label="Loading dashboard">
      <Shimmer className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Shimmer key={i} className="h-20" />)}
      </div>
      <Shimmer className="h-64" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Shimmer className="h-56" /><Shimmer className="h-56" />
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-5xl space-y-5" aria-busy="true" aria-label="Loading profile">
      <Shimmer className="h-32 rounded-2xl" />
      <Shimmer className="h-40" />
      <Shimmer className="h-56" />
      <Shimmer className="h-48" />
    </div>
  );
}

/* An empty state that tells you what the panel is FOR and how to fill it.

   A bare "No courses added yet." inside a tall grey box is a dead end: it
   names the absence but not the next move, and on a brand-new account every
   panel says it at once. Icon, one line of value, one button. */
function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed
                    border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
      {Icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white
                         text-slate-300 shadow-sm">
          <Icon size={20} />
        </span>
      )}
      <p className="mt-3 text-sm font-bold text-slate-600">{title}</p>
      {body && <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-400">{body}</p>}
      {action && (
        <Link to={action.to} className="btn-outline btn-sm mt-4">{action.label}</Link>
      )}
    </div>
  );
}

function Kpi({ label, value, tone, icon: Icon, sub }) {
  /* Left-aligned with the icon in the corner, not centred text in a box.
     Six identical centred numbers gave the eye nothing to anchor on and no
     way to tell a count from a percentage at a glance. */
  const green = tone === "green";
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4
                    transition-all hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-md">
      <span className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg
        transition-colors ${green ? "bg-brandgreen-50 text-brandgreen-600"
                                  : "bg-slate-100 text-slate-400 group-hover:bg-navy-50 group-hover:text-navy"}`}>
        {Icon && <Icon size={14} />}
      </span>
      <div className={`text-[26px] font-extrabold leading-none tracking-tight
        ${green ? "text-brandgreen-600" : "text-navy"}`}>
        {value ?? 0}
      </div>
      <div className="mt-2 text-[11px] font-semibold uppercase leading-tight tracking-wide text-slate-400">
        {label}
      </div>
      {sub && <div className="mt-1 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

/* =====================================================================
   Profile.

   Every block has its own Edit button (requirement 44) instead of one
   page-wide edit mode. Editing an address should not put the course seat
   numbers into a draft state as well — and a single Save that covers
   twelve unrelated fields is how a stray keystroke in one section gets
   saved along with a deliberate change in another.
   ===================================================================== */
function Profile() {
  const toast = useToast();
  const confirm = useConfirm();
  const [p, setP] = useState(null);
  const [locations, setLocations] = useState([]);

  const loadProfile = () => api.get("/api/institute/profile").then(setP).catch(() => {});
  const loadLocations = () => api.get("/api/institute/locations").then(setLocations).catch(() => {});

  useEffect(() => { loadProfile(); loadLocations(); }, []);

  const save = async (patch, successMessage) => {
    const body = { ...p, ...patch };
    const saved = await api.put("/api/institute/profile", {
      ...body,
      total_capacity: body.total_capacity ? Number(body.total_capacity) : null,
      current_strength: body.current_strength ? Number(body.current_strength) : null,
      courses: body.courses || [],
    });
    setP(saved);
    loadLocations();          // the primary campus mirrors the institute address
    if (successMessage) toast(successMessage);
    return saved;
  };

  if (!p) return <ProfileSkeleton />;

  const location = [p.city, p.state, p.pincode].filter(Boolean).join(", ");

  return (
    <div className="max-w-5xl space-y-5">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-navy to-navy-600 p-6 text-white">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 ring-2 ring-white/25">
            {p.logo_url
              ? <img src={mediaUrl(p.logo_url)} alt="" className="h-full w-full object-contain" />
              : <span className="text-2xl font-extrabold text-navy">{(p.name || "?")[0]}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-extrabold">{p.name}</h2>
            {location && <p className="text-sm text-navy-100">{location}</p>}
            {p.authorised_person_name && (
              <p className="text-xs text-white/60">
                {[p.authorised_person_name, p.designation].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* --- Logo (requirement 27) --- */}
      <div className="card">
        <SectionHead title="Logo" />
        {/* The uploader was boxed into a 220px column, which squeezed its own
            help text into an eight-line ribbon down the side while the panel
            next to it sat empty. The control gets the room now, and the
            explanation sits above it as one readable line. */}
        <p className="mb-4 max-w-2xl text-sm text-slate-500">
          Shown on your dashboard, on every job you post and on any ad you run. Square works
          best — you'll be able to crop it after choosing. It saves as soon as it finishes
          uploading, so there's no separate Save here.
        </p>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5">
          <ImageUpload kind="logo" round={false} currentUrl={p.logo_url}
                       doneText="Logo saved."
                       onUploaded={(u) => setP((old) => ({ ...old, logo_url: u }))} />
        </div>
      </div>

      {/* --- Identity and contact (requirements 28-32) --- */}
      <EditableSection
        title="Institute details"
        fields={p}
        onSave={(draft) => save(draft, "Institute details updated.")}
        validate={(d) => {
          if (!(d.name || "").trim()) return "Name of the Institute is required.";
          if (!(d.authorised_person_name || "").trim()) return "Contact Person Name is required.";
          if (!(d.phone || "").trim()) return "Mobile No is required.";
          if (d.total_capacity && d.current_strength
              && Number(d.current_strength) > Number(d.total_capacity)) {
            return "Current strength can't be more than total capacity.";
          }
          return null;
        }}
        render={(draft, set, editing) => (
          <>
            <Item label="Name of the Institute" required value={draft.name}
                  editing={editing} onChange={set("name")} placeholder="e.g. Coco Soft Institute" />
            <Item label="Contact Person Name" required value={draft.authorised_person_name}
                  editing={editing} onChange={set("authorised_person_name")}
                  placeholder="e.g. Priya Sharma" />
            {editing ? (
              <div className="sm:col-span-2">
                <PhoneField label="Mobile No" required value={draft.phone} onChange={set("phone")} />
              </div>
            ) : (
              <Item label="Mobile No" required value={draft.phone} editing={false} />
            )}
            {/* The email is the User ID, so it is deliberately read-only here —
                changing it would change the login and silently lock the
                institute out of its own account. */}
            <Item label="Email (User ID)" required value={draft.email} editing={false}
                  note="This is your login. Contact support to change it." />
            <Item label="Website" value={draft.website} editing={editing}
                  onChange={set("website")} placeholder="www.yourinstitute.edu" link />
            <Item label="Designation" value={draft.designation} editing={editing}
                  onChange={set("designation")} placeholder="e.g. Placement Officer" />
            <Item label="Total capacity" value={draft.total_capacity} editing={editing}
                  onChange={set("total_capacity")} numeric placeholder="e.g. 1200" />
            <Item label="Current strength" value={draft.current_strength} editing={editing}
                  onChange={set("current_strength")} numeric placeholder="e.g. 840" />
          </>
        )}
      />

      {/* --- Address (requirements 33-35) --- */}
      <EditableSection
        title="Address"
        fields={p}
        onSave={(draft) => save(draft, "Address updated.")}
        validate={(d) => (d.pincode && !/^\d{6}$/.test(d.pincode)
          ? "Pincode must be 6 digits." : null)}
        render={(draft, set, editing) => (
          <>
            <Item label="Address line 1" value={draft.address1} editing={editing}
                  onChange={set("address1")} span placeholder="e.g. Plot 42, Kukatpally" />
            <Item label="Address line 2" value={draft.address2} editing={editing}
                  onChange={set("address2")} span placeholder="Optional" />
            {editing ? (
              <div>
                <label className="label">City</label>
                <Combobox value={draft.city} options={CITIES} onChange={set("city")}
                          placeholder="e.g. Hyderabad" />
              </div>
            ) : <Item label="City" value={draft.city} editing={false} />}
            <Item label="Pincode" value={draft.pincode} editing={editing}
                  onChange={set("pincode")} numeric maxLength={6} placeholder="e.g. 500072" />
            <Item label="District" value={draft.district} editing={editing}
                  onChange={set("district")} placeholder="e.g. Medchal-Malkajgiri" />
            {editing ? (
              <div>
                <label className="label">State</label>
                <Combobox value={draft.state} options={STATES} onChange={set("state")}
                          placeholder="e.g. Telangana" />
              </div>
            ) : <Item label="State" value={draft.state} editing={false} />}
            <Item label="Country" value={draft.country} editing={editing}
                  onChange={set("country")} placeholder="e.g. INDIA" />
          </>
        )}
      />

      {/* --- About (requirement 36) --- */}
      <AboutSection value={p.about} onSave={(about) => save({ about }, "About updated.")} />

      {/* --- Courses and max seats (requirements 37-38) --- */}
      <CoursesSection locations={locations} reload={loadLocations} />

      {/* --- Locations (requirements 39-43) --- */}
      <LocationsSection locations={locations} reload={loadLocations} confirm={confirm} />
    </div>
  );
}

function SectionHead({ title, action }) {
  return (
    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-2">
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      {action}
    </div>
  );
}

/** A profile block that flips between read and edit in place. */
function EditableSection({ title, fields, render, onSave, validate }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fields);
  const [saving, setSaving] = useState(false);

  const start = () => { setDraft({ ...fields }); setEditing(true); };
  const cancel = () => { setDraft(fields); setEditing(false); };
  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));

  const commit = async () => {
    const err = validate?.(draft);
    if (err) return toast(err, "error");
    setSaving(true);
    try { await onSave(draft); setEditing(false); }
    catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="card">
      <SectionHead title={title} action={
        editing ? (
          <div className="flex gap-2">
            <button className="btn btn-sm" onClick={commit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn-outline btn-sm" onClick={cancel} disabled={saving}>Cancel</button>
          </div>
        ) : (
          <button className="btn-outline btn-sm flex items-center gap-1.5" onClick={start}>
            <IconEdit size={13} /> Edit
          </button>
        )
      } />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {render(editing ? draft : fields, set, editing)}
      </div>
    </div>
  );
}

/** One field: an input while editing, a labelled value when not. */
function Item({ label, value, editing, onChange, placeholder, span, numeric,
                maxLength, required, note, link }) {
  const cls = span ? "sm:col-span-2 xl:col-span-3" : "";
  if (editing && onChange) {
    return (
      <div className={cls}>
        <label className="label">
          {label} {required && <span className="font-semibold text-red-400">*</span>}
        </label>
        <input className="input" value={value ?? ""} placeholder={placeholder}
               inputMode={numeric ? "numeric" : undefined} maxLength={maxLength}
               onChange={(e) => onChange(numeric
                 ? e.target.value.replace(/\D/g, "").slice(0, maxLength || 12)
                 : e.target.value)} />
      </div>
    );
  }
  return (
    <div className={`min-w-0 border-b border-slate-100 pb-2 last:border-0 ${cls}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label} {required && <span className="text-red-400">*</span>}
      </dt>
      <dd className="mt-0.5 truncate text-sm text-slate-700" title={value || undefined}>
        {value
          ? (link
              ? <a href={/^https?:/.test(value) ? value : `https://${value}`} target="_blank"
                   rel="noopener noreferrer" className="text-navy hover:underline">{value}</a>
              : value)
          : <span className="text-slate-300">—</span>}
      </dd>
      {note && <p className="mt-0.5 text-[11px] text-slate-400">{note}</p>}
    </div>
  );
}

function AboutSection({ value, onSave }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(value || ""); }, [value]);

  const commit = async () => {
    setSaving(true);
    try { await onSave(draft); setEditing(false); }
    catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="card">
      <SectionHead title="About the institute" action={
        editing ? (
          <div className="flex gap-2">
            <button className="btn btn-sm" onClick={commit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn-outline btn-sm"
                    onClick={() => { setDraft(value || ""); setEditing(false); }}>Cancel</button>
          </div>
        ) : (
          <button className="btn-outline btn-sm flex items-center gap-1.5"
                  onClick={() => setEditing(true)}>
            <IconEdit size={13} /> Edit
          </button>
        )
      } />
      {editing ? (
        <RichText value={draft} onChange={setDraft} rows={10}
                  hint="Facilities, placement record, accreditations. **bold**, ## heading, - lists work." />
      ) : (
        value ? <Markdown text={value} />
              : <p className="text-sm text-slate-400">Nothing written yet.</p>
      )}
    </div>
  );
}

/* --- Courses and max seats (requirements 37-38, 43) ------------------- */
function CoursesSection({ locations, reload }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [locationId, setLocationId] = useState(null);
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("");
  const [strength, setStrength] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  const active = useMemo(
    () => locations.find((l) => l.id === locationId) || locations[0],
    [locations, locationId]);

  const add = async () => {
    if (!name.trim()) return toast("Enter the Course Name.", "error");
    if (seats === "") return toast("Enter the No of Seats.", "error");
    setBusy(true);
    try {
      await api.post("/api/institute/courses", {
        name: name.trim(), seats: Number(seats),
        current_strength: Number(strength || 0),
        location_id: active?.id,
      });
      setName(""); setSeats(""); setStrength("");
      reload();
      toast("Course added.");
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  };

  const saveRow = async (id) => {
    try {
      await api.put(`/api/institute/courses/${id}`, {
        name: editDraft.name,
        seats: Number(editDraft.seats || 0),
        current_strength: Number(editDraft.current_strength || 0),
      });
      setEditingId(null);
      reload();
      toast("Course updated.");
    } catch (e) { toast(e.message, "error"); }
  };

  const remove = (row) => confirm(`Remove "${row.name}"?`, {
    message: "Students already uploaded against this course are not affected.",
    confirmLabel: "Remove",
    tone: "error",
    onConfirm: async () => {
      try { await api.del(`/api/institute/courses/${row.id}`); reload(); toast("Course removed."); }
      catch (e) { toast(e.message, "error"); }
    },
  });

  const rows = active?.courses || [];

  return (
    <div className="card">
      <SectionHead title="Courses and max seats" />

      {locations.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {locations.map((l) => (
            <button key={l.id} type="button"
                    onClick={() => setLocationId(l.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors
                      ${active?.id === l.id ? "border-navy bg-navy-50 text-navy"
                                            : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              {l.name}{l.is_primary ? " (main)" : ""}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Course name</th>
              <th className="w-28 whitespace-nowrap text-right">No of seats</th>
              <th className="w-32 whitespace-nowrap text-right">Current strength</th>
              <th className="w-28 whitespace-nowrap text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                {editingId === c.id ? (
                  <>
                    <td>
                      <input className="input !py-1.5" value={editDraft.name}
                             onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))} />
                    </td>
                    <td>
                      <input className="input !py-1.5 text-right" inputMode="numeric"
                             value={editDraft.seats}
                             onChange={(e) => setEditDraft((d) => ({
                               ...d, seats: e.target.value.replace(/\D/g, "") }))} />
                    </td>
                    <td>
                      <input className="input !py-1.5 text-right" inputMode="numeric"
                             value={editDraft.current_strength}
                             onChange={(e) => setEditDraft((d) => ({
                               ...d, current_strength: e.target.value.replace(/\D/g, "") }))} />
                    </td>
                    <td className="text-right">
                      <button className="btn btn-sm" onClick={() => saveRow(c.id)}>Save</button>
                      <button className="btn-outline btn-sm ml-1" title="Cancel"
                              aria-label="Cancel editing" onClick={() => setEditingId(null)}>
                        <IconClose size={13} />
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="font-semibold text-slate-700">{c.name}</td>
                    <td className="text-right">{c.seats}</td>
                    <td className={`text-right ${c.current_strength == null ? "text-red-500" : ""}`}>
                      {c.current_strength == null ? "Not set" : c.current_strength}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <button className="btn-outline btn-sm" title={`Edit ${c.name}`}
                              aria-label={`Edit ${c.name}`}
                              onClick={() => { setEditingId(c.id); setEditDraft({ ...c }); }}>
                        <IconEdit size={13} />
                      </button>
                      <button className="btn-outline btn-sm ml-1 !text-red-500"
                              title={`Remove ${c.name}`} aria-label={`Remove ${c.name}`}
                              onClick={() => remove(c)}>
                        <IconClose size={13} />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="!py-8 text-center text-sm text-slate-400">
                  No courses at this campus yet — add the first one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Add course</p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px_150px_auto]">
          <div>
            <label className="label">Course name</label>
            <Combobox value={name} options={COURSES} onChange={setName}
                      placeholder="e.g. B.Tech Mechanical" />
          </div>
          <div>
            <label className="label">No of seats</label>
            <input className="input" inputMode="numeric" value={seats} placeholder="60"
                   onChange={(e) => setSeats(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className="label">Current strength</label>
            <input className="input" inputMode="numeric" value={strength} placeholder="48"
                   onChange={(e) => setStrength(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="flex items-end">
            <button className="btn w-full" onClick={add} disabled={busy}>
              {busy ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Seats is the maximum the course can take. Bulk uploads are checked against the
          total across every course.
        </p>
      </div>
    </div>
  );
}

/* --- Locations (requirements 39-43) ---------------------------------- */
function LocationsSection({ locations, reload, confirm }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const add = async () => {
    if (!/^\d{6}$/.test(form.pincode || "")) return toast("Enter a 6-digit pincode.", "error");
    if (!(form.contact_person || "").trim()) return toast("Enter the Contact Person.", "error");
    if (!(form.contact_phone || "").trim()) return toast("Enter the Mobile No.", "error");
    if (form.contact_email && !/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(form.contact_email)) {
      return toast("That email address doesn't look right.", "error");
    }
    setBusy(true);
    try {
      const created = await api.post("/api/institute/locations", form);
      setForm({}); setAdding(false);
      reload();
      setOpenId(created.id);
      toast("Location added — now fill in the student strength for each course.");
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  };

  const remove = (loc) => confirm(`Remove "${loc.name}"?`, {
    message: "Its courses and seat numbers are removed with it.",
    confirmLabel: "Remove", tone: "error",
    onConfirm: async () => {
      try { await api.del(`/api/institute/locations/${loc.id}`); reload(); toast("Location removed."); }
      catch (e) { toast(e.message, "error"); }
    },
  });

  return (
    <div className="card">
      <SectionHead title="Locations" action={
        <button className="btn-outline btn-sm" onClick={() => setAdding((v) => !v)}>
          {adding ? "Cancel" : "Add new location"}
        </button>
      } />

      {adding && (
        <div className="mb-5 rounded-xl border border-navy-200 bg-navy-50/40 p-4">
          <p className="mb-3 text-xs text-slate-500">
            The new campus starts with the same course list as your main campus, seats
            included. You then set the student strength for each course there —
            that is required before the location counts towards your dashboard.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Campus name</label>
              <input className="input" value={form.name || ""} onChange={set("name")}
                     placeholder="e.g. Secunderabad campus" />
            </div>
            <div>
              <label className="label">Pincode <span className="text-red-400">*</span></label>
              <input className="input" inputMode="numeric" maxLength={6} value={form.pincode || ""}
                     onChange={(e) => set("pincode")(e.target.value.replace(/\D/g, "").slice(0, 6))}
                     placeholder="e.g. 500003" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <input className="input" value={form.address1 || ""} onChange={set("address1")}
                     placeholder="e.g. 5-9-22, SP Road" />
            </div>
            <div>
              <label className="label">City</label>
              <Combobox value={form.city} options={CITIES} onChange={set("city")}
                        placeholder="e.g. Hyderabad" />
            </div>
            <div>
              <label className="label">State</label>
              <Combobox value={form.state} options={STATES} onChange={set("state")}
                        placeholder="e.g. Telangana" />
            </div>
            {/* Requirement 41 — a new location gets its OWN contact person. */}
            <div>
              <label className="label">Contact Person <span className="text-red-400">*</span></label>
              <input className="input" value={form.contact_person || ""} onChange={set("contact_person")}
                     placeholder="e.g. Anil Reddy" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.contact_email || ""}
                     onChange={set("contact_email")} placeholder="e.g. anil@institute.edu" />
            </div>
            <div className="sm:col-span-2">
              <PhoneField label="Mobile No" required value={form.contact_phone}
                          onChange={set("contact_phone")} />
            </div>
          </div>
          <button className="btn mt-4" onClick={add} disabled={busy}>
            {busy ? "Adding…" : "Add location"}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {locations.map((l) => (
          <LocationCard key={l.id} loc={l} open={openId === l.id}
                        onToggle={() => setOpenId(openId === l.id ? null : l.id)}
                        reload={reload} onRemove={() => remove(l)} />
        ))}
        {locations.length === 0 && <NoData label="No locations yet." />}
      </div>
    </div>
  );
}

function LocationCard({ loc, open, onToggle, reload, onRemove }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(loc);
  const [pending, setPending] = useState({});   // course id -> edited strength
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(loc); }, [loc]);

  /* Requirement 43 — a course with no strength entered is incomplete, and the
     card says so rather than quietly contributing a zero to the dashboard. */
  const missing = (loc.courses || []).filter((c) => c.current_strength == null);

  const saveDetails = async () => {
    setSaving(true);
    try {
      await api.put(`/api/institute/locations/${loc.id}`, draft);
      setEditing(false); reload(); toast("Location updated.");
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  };

  const saveStrengths = async () => {
    /* One call, not one per course. The loop this replaces sent N requests and
       stopped at the first failure — leaving some courses saved and some not,
       which is exactly the half-filled state requirement 43 forbids. The
       server validates every course up front and writes all or nothing. */
    const strengths = {};
    for (const c of loc.courses || []) {
      strengths[c.id] = String(pending[c.id] ?? c.current_strength ?? "");
    }
    const blank = (loc.courses || []).filter((c) => !String(strengths[c.id] || "").trim());
    if (blank.length) {
      return toast(`Student strength is required for every course. Still blank: `
                   + blank.map((c) => c.name).join(", "), "error");
    }
    setSaving(true);
    try {
      await api.put(`/api/institute/locations/${loc.id}/strengths`, { strengths });
      setPending({}); reload(); toast("Student strength saved.");
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className={`rounded-xl border p-4 ${missing.length && !loc.is_primary
      ? "border-amber-200 bg-amber-50/40" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-bold text-slate-700">
            {loc.name}
            {/* The badge only earns its place when it says something the title
                doesn't. A campus literally named "Main campus" was rendering
                the words twice, side by side, which reads as a glitch. */}
            {loc.is_primary && loc.name?.trim().toLowerCase() !== "main campus" && (
              <span className="badge bg-navy-50 text-navy">Main campus</span>
            )}
            {missing.length > 0 && (
              <span className="badge bg-amber-100 text-amber-700">
                {missing.length} course(s) need a strength
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500">
            {[loc.address1, loc.city, loc.state, loc.pincode].filter(Boolean).join(", ") || "—"}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {[loc.contact_person, loc.contact_phone, loc.contact_email].filter(Boolean).join(" · ") || "No contact set"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button className="btn-outline btn-sm" onClick={onToggle}>
            {open ? "Hide courses" : `Courses (${(loc.courses || []).length})`}
          </button>
          <button className="btn-outline btn-sm" onClick={() => setEditing((v) => !v)}
                  title={`Edit ${loc.name}`} aria-label={`Edit ${loc.name}`}>
            <IconEdit size={13} />
          </button>
          {!loc.is_primary && (
            <button className="btn-outline btn-sm !text-red-500" onClick={onRemove}
                    title={`Remove ${loc.name}`} aria-label={`Remove ${loc.name}`}>
              <IconClose size={13} />
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <div>
            <label className="label">Campus name</label>
            <input className="input" value={draft.name || ""}
                   onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Pincode</label>
            <input className="input" inputMode="numeric" maxLength={6} value={draft.pincode || ""}
                   onChange={(e) => setDraft((d) => ({
                     ...d, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <input className="input" value={draft.address1 || ""}
                   onChange={(e) => setDraft((d) => ({ ...d, address1: e.target.value }))} />
          </div>
          <div>
            <label className="label">Contact Person</label>
            <input className="input" value={draft.contact_person || ""}
                   onChange={(e) => setDraft((d) => ({ ...d, contact_person: e.target.value }))} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" value={draft.contact_email || ""}
                   onChange={(e) => setDraft((d) => ({ ...d, contact_email: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
            <PhoneField label="Mobile No" value={draft.contact_phone}
                        onChange={(v) => setDraft((d) => ({ ...d, contact_phone: v }))} />
          </div>
          <div className="sm:col-span-2 flex gap-2">
            <button className="btn btn-sm" onClick={saveDetails} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn-outline btn-sm" onClick={() => { setDraft(loc); setEditing(false); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <table className="table">
            <thead>
              <tr>
                <th>Course</th>
                <th className="w-28 text-right">Seats</th>
                <th className="w-36 text-right">Students strength</th>
              </tr>
            </thead>
            <tbody>
              {(loc.courses || []).map((c) => (
                <tr key={c.id}>
                  <td className="font-semibold text-slate-700">{c.name}</td>
                  <td className="text-right">{c.seats}</td>
                  <td>
                    <input
                      className={`input !py-1.5 text-right
                        ${c.current_strength == null && !pending[c.id]
                          ? "!border-amber-300 !bg-amber-50/50" : ""}`}
                      inputMode="numeric"
                      value={pending[c.id] ?? (c.current_strength ?? "")}
                      placeholder="Required"
                      aria-label={`Student strength for ${c.name}`}
                      onChange={(e) => setPending((s) => ({
                        ...s, [c.id]: e.target.value.replace(/\D/g, "") }))} />
                  </td>
                </tr>
              ))}
              {(loc.courses || []).length === 0 && (
                <tr><td colSpan={3} className="text-slate-400">
                  No courses at this campus yet — add them under Courses and max seats.
                </td></tr>
              )}
            </tbody>
          </table>
          {(loc.courses || []).length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button className="btn btn-sm" onClick={saveStrengths} disabled={saving}>
                {saving ? "Saving…" : "Save strengths"}
              </button>
              {missing.length > 0 && (
                <span className="text-xs font-medium text-amber-700">
                  Every course needs a student strength before this campus counts
                  towards your dashboard.
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   Data upload (requirements 45-51).
   ===================================================================== */
const ACCEPTED = [".xlsx", ".xls", ".xlsm", ".csv"];

function DataUpload() {
  const toast = useToast();
  const confirm = useConfirm();
  const dialog = useDialog();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [batch, setBatch] = useState(null);
  const [history, setHistory] = useState([]);
  const [downloads, setDownloads] = useState([]);
  const [uploadErrors, setUploadErrors] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState("uploads");

  const loadHistory = () => api.get("/api/institute/upload-history").then(setHistory).catch(() => {});
  const loadDownloads = () => api.get("/api/institute/download-history").then(setDownloads).catch(() => {});
  useEffect(() => { loadHistory(); loadDownloads(); }, []);

  /**
   * Download an authenticated file.
   *
   * Three things matter here and all three were wrong before:
   *  - check res.ok, or a 401 gets saved AS the .xlsx and Excel refuses to open it
   *  - append the anchor to the DOM before clicking (Firefox ignores detached ones)
   *  - revoke the object URL on a delay, or the download is cut short
   */
  const download = async (path, filename, type) => {
    try {
      const res = await fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) {
        let msg = `Download failed (${res.status})`;
        try { msg = (await res.json()).detail || msg; } catch { /* not JSON */ }
        throw new Error(msg);
      }
      const blob = new Blob([await res.arrayBuffer()], { type });
      if (blob.size < 200) throw new Error("The downloaded file looks empty. Please try again.");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(`Downloaded ${filename}.`);
      loadDownloads();              // requirement 51 — it appears in the history
    } catch (err) { toast(err.message, "error"); }
  };

  const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  /* Requirement 46/48 — the picker filters by extension, but a file can still
     arrive renamed or dropped in, so check it here too and say exactly what
     the institute was told they would see. */
  const pickFile = (f) => {
    if (!f) return setFile(null);
    const ok = ACCEPTED.some((ext) => f.name.toLowerCase().endsWith(ext));
    if (!ok) {
      setFile(null);
      return dialog({
        tone: "error",
        title: "Wrong File Format",
        message: `"${f.name}" isn't a spreadsheet. Add only Excel/CSV files `
               + "(.xlsx, .xls, .xlsm or .csv).",
        confirmLabel: "Choose another file",
        note: "Download the template below if you're not sure what the sheet should look like.",
        noteTone: "warn",
      });
    }
    setFile(f);
  };

  const submit = async () => {
    if (!file) return toast("Choose an Excel or CSV file first.", "error");
    setBusy(true);
    try {
      setUploadErrors(null);
      const res = await api.upload("/api/institute/upload", file);
      setResults(res.results);
      setBatch(res.batch);
      loadHistory();
      /* Requirement 49 — the fixed success message. */
      confirm("Data upload is successful", { message: res.message });
    } catch (err) {
      const msg = err.message || "Upload failed.";
      const wrongFormat = /wrong file format/i.test(msg);
      const malformed = /problem\(s\) found in this sheet|malformed student data/i.test(msg);
      const noCapacity = /no student capacity set/i.test(msg);
      const overCapacity = /room for|capacity is/i.test(msg);

      if (wrongFormat) {
        dialog({ tone: "error", title: "Wrong File Format", message: msg,
                 confirmLabel: "Choose another file" });
      } else if (malformed) {
        /* A popup, not a toast: the server lists every bad cell, and a toast
           truncates it, auto-dismisses, and collapses the line breaks — losing
           the one thing the institute needs, which row and what to type. */
        const parsed = msg.split("\n").slice(1).filter(Boolean).map((line) => {
          const p2 = line.replace(/^•\s*/, "").split("|").map((x) => x.trim());
          return p2.length >= 4
            ? { where: p2[0], field: p2[1], value: p2[2], fix: p2.slice(3).join(" | ") }
            : { where: "", field: "", value: "", fix: line };
        });
        setUploadErrors(parsed);
        dialog({
          tone: "error",
          title: "This sheet has records that can't be imported",
          message: `${parsed.length} problem(s) found. Nothing was imported, so your existing `
                 + "students are untouched.\n\nFix the rows listed below the form, then upload again.",
          confirmLabel: "Show me the rows",
          note: "Row numbers match your spreadsheet — the header is row 1, so the first "
              + "student is row 2.",
          noteTone: "warn",
        });
      } else if (noCapacity || overCapacity) {
        dialog({
          tone: "error",
          title: noCapacity ? "Set your student capacity first"
                            : "That's more students than your capacity allows",
          message: msg.split("\n").filter(Boolean).join("\n"),
          confirmLabel: noCapacity ? "Go to profile" : "Got it",
          ...(noCapacity ? { onConfirm: () => navigate("/institute/profile") } : {}),
          note: "Nothing was imported.",
          noteTone: "warn",
        });
      } else {
        toast(msg, "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const errorTable = uploadErrors && uploadErrors.length > 0 && (
    <div className="card mb-5 !border-red-200 !bg-red-50/40">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-red-700">{uploadErrors.length} record(s) need fixing</h3>
        <span className="badge bg-white text-red-600">Nothing was imported</span>
        <div className="flex-1" />
        <button className="btn-outline btn-sm" onClick={() => setUploadErrors(null)}>Dismiss</button>
      </div>
      <div className="overflow-x-auto rounded-xl bg-white">
        <table className="table">
          <thead><tr><th>Where</th><th>Column</th><th>What you entered</th><th>What it should be</th></tr></thead>
          <tbody>
            {uploadErrors.map((e, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap font-semibold text-slate-700">{e.where}</td>
                <td className="whitespace-nowrap text-slate-500">{e.field}</td>
                <td className="break-all font-mono text-[12px] text-red-600">{e.value}</td>
                <td className="text-slate-600">{e.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Row numbers match your spreadsheet: the header is row 1, so the first student is row 2.
        Correct these cells and upload the same file again.
      </p>
    </div>
  );

  return (
    <div className="max-w-5xl">
      <h1 className="mb-2 text-xl font-semibold">Data upload</h1>
      <p className="mb-4 text-sm text-gray-600">
        Upload an Excel or CSV of one or many students. A resume is auto-created from the
        available columns, stored in the database, and each student is emailed their login
        credentials.
      </p>

      {errorTable}

      {/* --- Upload box + Submit (requirements 46-47) --- */}
      <div className="card">
        <label className="label">Upload box</label>
        <FileDrop
          accept=".xlsx,.xls,.xlsm,.csv"
          file={file}
          onPick={pickFile}
          onClear={() => setFile(null)}
          hint="Excel (.xlsx, .xls, .xlsm) and CSV only — anything else is rejected" />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button className="btn !px-8" onClick={submit} disabled={busy || !file}>
            {busy ? "Uploading…" : "Submit"}
          </button>
          {!file && (
            <span className="text-xs text-slate-400">
              Submit becomes available once a file is chosen.
            </span>
          )}
        </div>
      </div>

      {/* --- Downloads (requirement 50) --- */}
      <div className="card mt-4">
        <SectionHead title="Downloads" />
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-outline flex items-center gap-1.5"
                  onClick={() => download("/api/institute/upload-template",
                                          "qclonejob_student_upload_template.xlsx", XLSX_TYPE)}>
            <IconDownload size={14} /> Template (Excel)
          </button>
          <button className="btn-outline btn-sm"
                  onClick={() => download("/api/institute/upload-template.csv",
                                          "qclonejob_student_upload_template.csv",
                                          "text/csv;charset=utf-8")}>
            Template (CSV)
          </button>
          <button className="btn-outline btn-sm"
                  onClick={() => download("/api/institute/students-export",
                                          "qclonejob_students.xlsx", XLSX_TYPE)}>
            My students (Excel)
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Every download is listed under Download history below, with the date and time.
          Excel may open these in "Protected View" — click <b>Enable Editing</b>.
        </p>
      </div>

      {batch && (
        <div className="card mt-4 border-brandgreen-100 bg-brandgreen-50/40">
          <h3 className="font-semibold text-brandgreen-600">Data upload is successful</h3>
          <p className="mt-1 text-sm text-slate-700">
            <b>{batch.filename}</b> · uploaded {new Date(batch.uploaded_at).toLocaleString()}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="badge bg-white text-slate-600">{batch.total_rows} rows read</span>
            <span className="badge bg-brandgreen-50 text-brandgreen-600">{batch.created} created</span>
            {batch.duplicates > 0 && <span className="badge bg-amber-100 text-amber-700">{batch.duplicates} duplicates ignored</span>}
            {batch.skipped > 0 && <span className="badge bg-slate-100 text-slate-600">{batch.skipped} skipped</span>}
          </div>
        </div>
      )}

      {results && (
        <div className="card mt-4">
          <h2 className="mb-2 font-semibold">Result</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Student</th><th>User ID</th><th>Password</th><th>Status</th></tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td>{r.row}</td>
                    <td>{r.user_id || "—"}</td>
                    <td>{r.password || "—"}</td>
                    <td>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Passwords are shown once here for your reference; students also receive them by email.
          </p>
        </div>
      )}

      {/* --- History (requirement 51) --- */}
      <div className="card mt-4">
        <div className="mb-3 flex gap-2">
          {[["uploads", `Upload history (${history.length})`],
            ["downloads", `Download history (${downloads.length})`]].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors
                      ${tab === key ? "border-navy bg-navy-50 text-navy"
                                    : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "uploads" ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>File</th><th>Uploaded on</th><th className="text-right">Rows</th>
                <th className="text-right">Created</th><th className="text-right">Duplicates</th></tr></thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="font-medium text-slate-700">{h.filename}</td>
                    <td>{new Date(h.uploaded_at).toLocaleString()}</td>
                    <td className="text-right">{h.total_rows}</td>
                    <td className="text-right text-brandgreen-600">{h.created}</td>
                    <td className="text-right text-amber-600">{h.duplicates}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td colSpan={5} className="text-slate-400">Nothing uploaded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>File</th><th>Type</th><th>Format</th><th>Downloaded on</th></tr></thead>
              <tbody>
                {downloads.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium text-slate-700">{d.filename}</td>
                    <td className="capitalize text-slate-500">{d.kind}</td>
                    <td className="uppercase text-slate-500">{d.file_format}</td>
                    <td>{new Date(d.downloaded_at).toLocaleString()}</td>
                  </tr>
                ))}
                {downloads.length === 0 && (
                  <tr><td colSpan={4} className="text-slate-400">Nothing downloaded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* =====================================================================
   Post a Ad (requirements 52-56).
   ===================================================================== */
function PostAd() {
  const toast = useToast();
  const confirm = useConfirm();
  const [format, setFormat] = useState("flyer");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [flyerFile, setFlyerFile] = useState(null);
  const [ctaLink, setCtaLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ads, setAds] = useState([]);
  const [maxChars, setMaxChars] = useState(120);

  const load = () => api.get("/api/institute/ads").then((r) => {
    setAds(r.ads || []);
    if (r.scroller_max_chars) setMaxChars(r.scroller_max_chars);
  }).catch(() => {});
  useEffect(() => { load(); }, []);

  const reset = () => {
    setTitle(""); setText(""); setImageUrl(""); setCtaLink("");
    setUploadNote(null); setFlyerFile(null);
  };

  /* Requirement 55 — JPG in, mobile ad slot out. The shrinking happens on the
     server, so the institute can upload whatever their designer sent and the
     ad still fits the app's slot exactly. */
  const pickFlyer = async (f) => {
    if (!f) return;
    if (!/\.(jpe?g|jfif|png|webp)$/i.test(f.name)) {
      setFlyerFile(null);
      return toast("Wrong File Format — upload a JPG image for the flyer.", "error");
    }
    setFlyerFile(f);
    setUploading(true);
    setUploadNote(null);
    try {
      const r = await api.uploadFile("/api/uploads/flyer", f);
      setImageUrl(r.url);
      setUploadNote(r.message);
      toast("Flyer uploaded and resized.");
    } catch (e) {
      setFlyerFile(null);
      toast(e.message, "error");
    } finally { setUploading(false); }
  };

  const post = async () => {
    setBusy(true);
    try {
      const r = await api.post("/api/institute/ads", {
        ad_format: format, title, text_content: text,
        image_url: imageUrl, cta_link: ctaLink,
      });
      reset(); load();
      confirm("Your ad is live", { message: r.message });
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  };

  const setStatus = async (ad, status) => {
    try {
      await api.put(`/api/institute/ads/${ad.id}`, { status });
      load();
      toast(status === "active" ? "Ad resumed." : "Ad paused.");
    } catch (e) { toast(e.message, "error"); }
  };

  const remove = (ad) => confirm(`Remove "${ad.title}"?`, {
    message: "It stops showing immediately and its view counts are deleted.",
    confirmLabel: "Remove", tone: "error",
    onConfirm: async () => {
      try { await api.del(`/api/institute/ads/${ad.id}`); load(); toast("Ad removed."); }
      catch (e) { toast(e.message, "error"); }
    },
  });


  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Post a Ad</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your ad runs in the mobile app's ad slot, shown to job seekers.
        </p>
      </div>

      {/* Requirements 53-54 — the two formats, as buttons. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { key: "flyer", label: "Flyer ads", tag: "A JPG image, resized to the app\u2019s ad slot" },
          { key: "scroller", label: "Scroller ads", tag: "A short line of text that scrolls" },
        ].map((f) => {
          const active = format === f.key;
          return (
            <button key={f.key} type="button" onClick={() => { setFormat(f.key); reset(); }}
              className={`rounded-xl border p-4 text-left transition-all
                ${active ? "border-navy bg-navy-50 shadow-sm"
                         : "border-slate-200 bg-white hover:border-navy-200 hover:bg-slate-50"}`}>
              <span className={`block text-base font-extrabold ${active ? "text-navy" : "text-slate-700"}`}>
                {f.label}
              </span>
              <span className="mt-0.5 block text-xs text-slate-400">{f.tag}</span>
            </button>
          );
        })}
      </div>

      <div className="card space-y-4">
        <div>
          <label className="label">Ad title <span className="text-red-400">*</span></label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)}
                 placeholder="e.g. Admissions open — 2027 batch" />
          <p className="mt-1 text-xs text-slate-400">
            For your own reference in the list below. It isn't shown in the ad.
          </p>
        </div>

        {format === "flyer" ? (
          <>
            <div>
              <label className="label">
                Flyer image (JPG) <span className="text-red-400">*</span>
              </label>
              {/* Same drop zone as Data upload. This was the browser's raw
                  "Choose File | No file chosen" — the one unstyled control in
                  the whole portal, sitting two clicks from a designed one. */}
              <FileDrop
                compact
                accept=".jpg,.jpeg,.jfif,.png,.webp"
                file={flyerFile}
                busy={uploading}
                busyLabel="Uploading and resizing…"
                onPick={pickFlyer}
                onClear={() => { setFlyerFile(null); setImageUrl(""); setUploadNote(null); }}
                title="Drop your flyer here, or click to browse"
                hint="Any size — we shrink it to the mobile ad space automatically. JPG, PNG or WEBP, up to 5 MB."
                preview={imageUrl && (
                  <div className="mt-4">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brandgreen-600">
                      <IconCheck size={13} /> {uploadNote}
                    </p>
                    <p className="label">Preview — actual size in the app's ad slot</p>
                    {/* Framed like a phone slot so the institute judges the
                        crop against what a job seeker will see, rather than
                        against a bare rectangle. */}
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900
                                    p-2 shadow-inner">
                      <div className="overflow-hidden rounded-lg" style={{ aspectRatio: "3 / 1" }}>
                        <img src={mediaUrl(imageUrl)} alt="Flyer preview"
                             className="h-full w-full object-cover" />
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-400">
                      Anything outside this 3:1 frame was trimmed evenly from the edges.
                    </p>
                  </div>
                )} />
            </div>
            <div>
              <label className="label">Caption (optional)</label>
              <input className="input" value={text} maxLength={200}
                     onChange={(e) => setText(e.target.value)}
                     placeholder="e.g. Diploma and B.Tech seats available" />
            </div>
          </>
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <label className="label !mb-0">
                Scroller text <span className="text-red-400">*</span>
              </label>
              {/* Requirement 56 — the limit is visible while typing, not a
                  surprise at submit. maxLength stops the overflow; the counter
                  turns amber then red as it closes in. */}
              <span className={`mb-1.5 text-xs font-bold tabular-nums
                ${text.length >= maxChars ? "text-red-500"
                  : text.length > maxChars - 20 ? "text-amber-600" : "text-slate-400"}`}>
                {text.length} / {maxChars}
              </span>
            </div>
            <textarea className="input !h-auto resize-none" rows={3} value={text}
                      maxLength={maxChars}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="e.g. Admissions open for the 2027 batch — call 040-1234 5678" />
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-400">
                Kept short so the whole message scrolls past before someone moves on.
              </p>
              {text.length >= maxChars && (
                <p className="text-xs font-semibold text-red-500">
                  You've hit the {maxChars}-character limit.
                </p>
              )}
            </div>

            <div className="mt-4">
              <p className="label">Preview — as it scrolls in the app</p>
              {/* A scroller ad IS the movement. The old preview truncated the
                  text with an ellipsis, which showed the institute neither how
                  it reads nor how long it takes. Hover to pause. */}
              <div className="rounded-xl border border-slate-200 bg-slate-900 p-2 shadow-inner">
                <div className="marquee flex items-center rounded-lg bg-navy py-3 text-sm
                                font-semibold text-white"
                     style={{ "--marquee-duration": `${Math.max(8, (text.length || 20) / 7)}s` }}>
                  <div className="marquee-track">
                    <span className="px-8">{text || "Your scroller text appears here"}</span>
                    <span className="px-8" aria-hidden>{text || "Your scroller text appears here"}</span>
                  </div>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Hover to pause. Longer text scrolls for longer, so it stays readable.
              </p>
            </div>
          </div>
        )}

        <div>
          <label className="label">Link (optional)</label>
          <input className="input" value={ctaLink} onChange={(e) => setCtaLink(e.target.value)}
                 placeholder="e.g. www.yourinstitute.edu/admissions" />
        </div>

        <div className="flex gap-2">
          <button className="btn" onClick={post}
                  disabled={busy || uploading || !title.trim()
                            || (format === "flyer" ? !imageUrl : !text.trim())}>
            {busy ? "Posting…" : "Post ad"}
          </button>
          <button className="btn-outline" onClick={reset} disabled={busy}>Clear</button>
        </div>
      </div>

      <div className="card">
        <SectionHead title={`Your ads (${ads.length})`} />
        <div className="space-y-3">
          {ads.map((ad) => (
            <div key={ad.id}
                 className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200
                            p-3 transition-colors hover:border-navy-200 hover:bg-slate-50/60">
              {/* The thumbnail shows the ad in its real 3:1 shape, so a flyer
                  reads as a flyer and a scroller as a bar of text. They used
                  to share one squat tile that flattered neither. */}
              <div className="w-36 shrink-0 overflow-hidden rounded-lg bg-slate-100 shadow-sm"
                   style={{ aspectRatio: "3 / 1" }}>
                {ad.ad_format === "flyer" && ad.image_url ? (
                  <img src={mediaUrl(ad.image_url)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center bg-navy px-2">
                    <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-white">
                      {ad.text_content || ad.title}
                    </span>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-slate-700">{ad.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold capitalize
                                   text-slate-500">
                    {ad.ad_format}
                  </span>
                  <span>{ad.impressions} views</span>
                  <span aria-hidden>·</span>
                  <span>{ad.clicks} clicks</span>
                  <span aria-hidden>·</span>
                  <span>{new Date(ad.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className={`badge ${ad.status === "active"
                  ? "bg-brandgreen-50 text-brandgreen-600" : "bg-slate-100 text-slate-500"}`}>
                  {ad.status}
                </span>
                <button className="btn-outline btn-sm"
                        onClick={() => setStatus(ad, ad.status === "active" ? "paused" : "active")}>
                  {ad.status === "active" ? "Pause" : "Resume"}
                </button>
                <button className="btn-outline btn-sm !text-red-500" onClick={() => remove(ad)}
                        title={`Remove ${ad.title}`} aria-label={`Remove ${ad.title}`}>
                  <IconClose size={13} />
                </button>
              </div>
            </div>
          ))}
          {ads.length === 0 && (
            <EmptyState
              icon={IconSparkle}
              title="No ads running"
              body="Post a flyer or a scroller above and it starts showing to job seekers straight away." />
          )}
        </div>
      </div>
    </div>
  );
}

/* Shared with the recruiter portal — off the menu, still routable. */
function PostJob() {
  return <PostJobForm endpoint="/api/institute/jobs"
                      postedNote="Your students and matching job seekers will be alerted automatically." />;
}
