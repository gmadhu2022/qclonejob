import { Fragment, useEffect, useMemo, useState } from "react";
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { api, apiUrl, getToken, mediaUrl } from "../../lib/api";
import { DashboardLayout, useToast } from "../../components/ui";
import { useDialog, useConfirm } from "../../components/Dialog";
import { useAuth } from "../../context/AuthContext";
import { IconBuilding, IconUpload, IconChart, IconSparkle, IconEdit, IconClose,
         IconCheck, IconDownload, IconLayers, IconUser, IconTrend, IconMapPin, IconGlobe,
         IconUsers, IconMail, IconPhone, IconDoc, IconChat } from "../../components/icons";
import { AdTypePicker, AdStep, AdPreview } from "../../components/AdKit";
import { AdMedia, adHasVisual, toEmbedUrl } from "../../components/BannerSlot";
import { GreetingHero, CustomiseMenu, useDashPrefs, StatTile, TONES, ProfHead,
         ProfileStrength, ProfileCover } from "../../components/DashboardKit";
import Chat from "../../components/Chat";
import ImageUpload from "../../components/ImageUpload";
import FileDrop from "../../components/FileDrop";
import RichText, { Markdown } from "../../components/RichText";
import PhoneField from "../../components/PhoneField";
import { FField, iconFor } from "../../components/RegistrationForm";
import PostJobForm from "../../components/PostJobForm";
import { SwitchableChart, NoData, AnalyticsPanel } from "../../components/charts";
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
const INST_WIDGETS = [
  ["kpis", "Key numbers"],
  ["courses", "Courses — seats and strength"],
  ["utilisation", "Seat utilisation & placements"],
  ["students", "Students online charts"],
  ["upload", "Last data upload"],
];

function Dashboard() {
  const [d, setD] = useState(null);
  const [openCourse, setOpenCourse] = useState(null);
  const [prefs, toggle, resetPrefs] = useDashPrefs("qcj.institute.dashboard.v1", INST_WIDGETS);

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

  const show = (k) => prefs[k] !== false;
  const pendingCourses = (d.courses_incomplete || []).length;
  const line = pendingCourses
    ? `${pendingCourses} course${pendingCourses === 1 ? " needs" : "s need"} a student strength — fill it in to keep totals right.`
    : d.students_total
      ? `${d.students_total} student${d.students_total === 1 ? " is" : "s are"} online · ${d.placement_rate}% placed so far.`
      : "Upload your student sheet to put every student in front of employers.";

  return (
    <div className="max-w-6xl space-y-6">
      {/* ---- greeting hero ---- */}
      <GreetingHero
        name={i.name}
        line={line}
        badge={i.approval_status && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            i.approval_status === "approved" ? "bg-brandgreen-50 text-brandgreen-600"
            : i.approval_status === "pending" ? "bg-amber-50 text-amber-700"
            : "bg-red-50 text-red-700"}`}>
            {i.approval_status}
          </span>
        )}
        actions={<>
          <Link to="/institute/profile" className="btn-outline !rounded-full !px-4">
            <IconBuilding size={15} /> Profile
          </Link>
          <Link to="/institute/upload" className="btn !rounded-full !px-5 shadow-[0_8px_20px_-8px_rgba(79,70,229,.7)]">
            <IconUpload size={15} /> Upload students
          </Link>
          <CustomiseMenu widgets={INST_WIDGETS} prefs={prefs} toggle={toggle} reset={resetPrefs} />
        </>}
        strip={[
          ["Courses", d.courses_count ?? 0, "bg-navy"],
          ["Students online", d.students_total ?? 0, "bg-blue-500"],
          ["Placed", d.placed ?? 0, "bg-brandgreen"],
          ["Location", [i.city, i.state].filter(Boolean).join(", ") || "Not set", "bg-violet-500"],
        ]}
      />

      {/* ---- quick links ---- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[["/institute/profile", IconBuilding, "Institute profile", "Logo, address, courses and campuses.", "navy"],
          ["/institute/upload", IconUpload, "Data upload", "Add students from one sheet — each gets a login.", "green"],
          ["/institute/post-ad", IconSparkle, "Post a Ad", "Promote admissions or a placement drive.", "amber"],
          ["/institute/messages", IconChat, "Messages", "Conversations with recruiters.", "violet"]].map(([to, Ic, t, b, tone]) => (
          <Link key={to} to={to}
                className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-card">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONES[tone].ring}`}><Ic size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-800 group-hover:text-navy">{t}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{b}</span>
            </span>
            <span className="mt-1 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-navy">→</span>
          </Link>
        ))}
      </div>

      {/* Requirement 43 surfaced where the wrong number is actually read.
          A blank strength makes the totals below quietly too low, so say so
          here rather than leaving the institute to work it out. */}
      {pendingCourses > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 font-heading text-base font-bold text-amber-700">!</span>
          <div className="min-w-0 flex-1">
            <h3 className="font-heading text-[14px] font-bold text-amber-900">
              {pendingCourses} course(s) have no student strength yet
            </h3>
            <p className="mt-0.5 text-[13px] text-amber-700">
              {d.courses_incomplete.slice(0, 3).map((c) => `${c.course} (${c.location})`).join(", ")}
              {pendingCourses > 3 && ` and ${pendingCourses - 3} more`}.
              Current strength below is lower than your real figure until these are filled in.
            </p>
          </div>
          <Link to="/institute/profile" className="btn btn-sm !rounded-full !px-4 shrink-0">Fill them in</Link>
        </div>
      )}

      {/* Requirements 21-24 as headline numbers. */}
      {show("kpis") && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Courses" value={d.courses_count} icon={IconLayers} tone="navy" />
          <StatTile label="Seats capacity" value={d.seats_total} icon={IconChart} tone="blue" />
          <StatTile label="Current strength" value={d.strength_total} icon={IconUser} tone="violet"
                    hint={d.seats_total ? `${Math.round(100 * d.strength_total / d.seats_total)}% of capacity` : null} />
          <StatTile label="Students uploaded" value={d.students_total} icon={IconUpload} tone="amber" />
          <StatTile label="Students placed" value={d.placed} icon={IconCheck} tone="green" />
          <StatTile label="Placement rate" value={`${d.placement_rate}%`} icon={IconTrend} tone="green" />
        </div>
      )}

      {/* Requirements 21-23 — course wise seats capacity and current strength. */}
      {show("courses") && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <ProfHead icon={IconLayers} title="Courses — seats and strength"
                    action={<span className="text-[12px] text-slate-400">Click a course to see it split by campus</span>} />
          <div className="mt-4">
            {courses.length === 0 ? (
              <EmptyState
                icon={IconLayers}
                title="No courses yet"
                body="Add your courses with their seat counts, and this table fills in with capacity and strength for each one."
                action={{ to: "/institute/profile", label: "Add courses" }} />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
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
                         rows are siblings in one list. */
                      <Fragment key={c.label}>
                        <tr className="cursor-pointer hover:bg-navy-50/40"
                            onClick={() => setOpenCourse(openCourse === c.label ? null : c.label)}>
                          <td className="font-semibold text-slate-800">
                            <span className={`mr-1.5 inline-block text-[10px] text-slate-400 transition-transform ${openCourse === c.label ? "rotate-90" : ""}`}>▶</span>
                            {c.label}
                          </td>
                          <td className="text-right tabular-nums">{c.seats}</td>
                          <td className="text-right font-semibold tabular-nums text-navy">{c.strength}</td>
                          <td className="text-right tabular-nums text-amber-600">{c.vacant}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-gradient-to-r from-brandgreen to-emerald-400"
                                     style={{ width: `${Math.min(100, c.fill_rate)}%` }} />
                              </div>
                              <span className="w-11 text-right text-[11px] font-semibold text-slate-500">{c.fill_rate}%</span>
                            </div>
                          </td>
                        </tr>
                        {openCourse === c.label && (c.locations || []).map((l, n) => (
                          <tr key={`${c.label}-${n}`} className="bg-slate-50/70 text-[13px]">
                            <td className="pl-9 text-slate-500">{l.location}{l.pincode ? ` · ${l.pincode}` : ""}</td>
                            <td className="text-right text-slate-500">{l.seats}</td>
                            <td className="text-right text-slate-500">{l.strength}</td>
                            <td className="text-right text-slate-400">{Math.max(0, l.seats - l.strength)}</td>
                            <td />
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-bold text-slate-900">
                      <td>Total</td>
                      <td className="text-right tabular-nums">{d.seats_total}</td>
                      <td className="text-right tabular-nums text-navy">{d.strength_total}</td>
                      <td className="text-right tabular-nums">{vacant}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {(show("utilisation") || show("students")) && (
      <AnalyticsPanel>
      {show("utilisation") && (
        <div className="grid gap-5 lg:grid-cols-2">
          <SwitchableChart title="Seat utilisation" subtitle="Across every course and campus" data={capacitySplit}
                           types={["donut", "stacked", "bar"]} />
          <SwitchableChart title="Placement breakdown" subtitle="Where your students are in the process" data={placementSplit}
                           types={["semi", "funnel", "donut"]} />
        </div>
      )}

      {/* Requirement 25 — students on the platform, by year, course and gender. */}
      {show("students") && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy via-indigo-500 to-violet-500 p-5 text-white shadow-[0_18px_40px_-24px_rgba(79,70,229,.8)]">
            <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-6 flex items-end gap-1.5 opacity-25">
              {[22, 38, 30, 52, 44, 64].map((h, i) => <span key={i} className="w-2.5 rounded-t bg-white" style={{ height: h }} />)}
            </div>
            <div className="relative flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25"><IconUser size={16} /></span>
              <h3 className="font-heading text-[16px] font-bold">Students online</h3>
            </div>
            <p className="relative mt-2 max-w-2xl text-[13px] text-white/80">
              The {d.students_total} student record(s) uploaded from your sheets, grouped three
              ways. Blank cells in a sheet show as “Not given”.
            </p>
          </div>
          {d.students_total === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <EmptyState
                icon={IconUpload}
                title="No student data yet"
                body="Upload a sheet of your students and these charts break them down by year of passing, course and gender."
                action={{ to: "/institute/upload", label: "Go to Data upload" }} />
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-3">
              <SwitchableChart title="Year wise" subtitle="By year of passing" data={d.by_year || []}
                               types={["bar", "area", "line"]} />
              <SwitchableChart title="Course wise" subtitle="From the uploaded records" data={d.by_course || []}
                               types={["hbar", "treemap", "donut"]} />
              <SwitchableChart title="Gender wise" subtitle="From the uploaded records" data={d.by_gender || []}
                               types={["donut", "waffle", "pie"]} />
            </div>
          )}
        </div>
      )}
      </AnalyticsPanel>
      )}

      {show("upload") && d.last_upload && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brandgreen-50 text-brandgreen-600"><IconUpload size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-heading text-[14px] font-bold text-slate-900">Last data upload</p>
            <p className="mt-0.5 truncate text-[13px] text-slate-600">
              <b>{d.last_upload.filename}</b> · {d.last_upload.created} student(s) created ·{" "}
              {new Date(d.last_upload.uploaded_at).toLocaleString()}
            </p>
          </div>
          <Link to="/institute/upload" className="btn-outline btn-sm !rounded-full">Upload again</Link>
        </div>
      )}

      {!Object.values(prefs).some(Boolean) && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-[13px] text-slate-500">
          Every section is hidden. Use <b>Customise</b> to bring them back.
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
  const goTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const SECTION_OF = { Logo: "sec-logo", About: "sec-about", Website: "sec-details", "Mobile No": "sec-details",
                       Designation: "sec-details", Address: "sec-address", Pincode: "sec-address",
                       Courses: "sec-courses" };

  return (
    <div className="max-w-6xl space-y-5">
      {/* ---------------- header: cover, logo, name ---------------- */}
      <ProfileCover logo={p.logo_url ? mediaUrl(p.logo_url) : null} initial={p.name}
                    actions={<button className="btn-outline !rounded-full" onClick={() => goTo("sec-logo")}>
                      <IconEdit size={14} /> Change logo
                    </button>}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate font-heading text-[24px] font-bold leading-tight text-slate-900">{p.name}</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-brandgreen-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-brandgreen-600">
            <IconBuilding size={11} /> Institute
          </span>
          {p.approval_status && (
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${
              p.approval_status === "approved" ? "bg-navy-50 text-navy"
              : p.approval_status === "pending" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
              {p.approval_status}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate-500">
          {location && <span className="inline-flex items-center gap-1.5"><IconMapPin size={13} className="text-navy" />{location}</span>}
          {p.website && (
            <a href={/^https?:/.test(p.website) ? p.website : `https://${p.website}`} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1.5 text-navy hover:underline">
              <IconGlobe size={13} />{p.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          {p.authorised_person_name && (
            <span className="inline-flex items-center gap-1.5"><IconUsers size={13} className="text-navy" />
              {[p.authorised_person_name, p.designation].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      </ProfileCover>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          {/* --- Identity and contact (requirements 28-32) --- */}
          <div id="sec-details" className="scroll-mt-4">
            <EditableSection
              title="Institute details" icon={IconBuilding}
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
          </div>

          {/* --- Address (requirements 33-35) --- */}
          <div id="sec-address" className="scroll-mt-4">
            <EditableSection
              title="Address" icon={IconMapPin}
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
                    <Combobox label="City" icon={iconFor("City")} value={draft.city} options={CITIES}
                              onChange={set("city")} placeholder="e.g. Hyderabad" />
                  ) : <Item label="City" value={draft.city} editing={false} />}
                  <Item label="Pincode" value={draft.pincode} editing={editing}
                        onChange={set("pincode")} numeric maxLength={6} placeholder="e.g. 500072" />
                  <Item label="District" value={draft.district} editing={editing}
                        onChange={set("district")} placeholder="e.g. Medchal-Malkajgiri" />
                  {editing ? (
                    <Combobox label="State" icon={iconFor("State")} value={draft.state} options={STATES}
                              onChange={set("state")} placeholder="e.g. Telangana" />
                  ) : <Item label="State" value={draft.state} editing={false} />}
                  <Item label="Country" value={draft.country} editing={editing}
                        onChange={set("country")} placeholder="e.g. INDIA" />
                </>
              )}
            />
          </div>

          {/* --- About (requirement 36) --- */}
          <div id="sec-about" className="scroll-mt-4">
            <AboutSection value={p.about} onSave={(about) => save({ about }, "About updated.")} />
          </div>
        </div>

        {/* ---- side column ---- */}
        <aside className="space-y-5 lg:sticky lg:top-4">
          <ProfileStrength
            checks={[["Logo", p.logo_url], ["About", p.about], ["Website", p.website], ["Mobile No", p.phone],
                     ["Designation", p.designation], ["Address", p.address1], ["Pincode", p.pincode],
                     ["Courses", locations.some((l) => (l.courses || []).length) ? "yes" : ""]]}
            onAdd={(k) => goTo(SECTION_OF[k] || "sec-details")} />

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="font-heading text-[15px] font-bold text-slate-900">Contact</p>
            <ul className="mt-3 space-y-3">
              {[[IconMail, "Email", p.email, p.email && `mailto:${p.email}`],
                [IconPhone, "Mobile", p.phone, p.phone && `tel:${String(p.phone).replace(/\s/g, "")}`],
                [IconGlobe, "Website", p.website, p.website && (/^https?:/.test(p.website) ? p.website : `https://${p.website}`)]].map(([Ic, k, v, href]) => (
                <li key={k} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy"><Ic size={15} /></span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-400">{k}</p>
                    {v
                      ? <a href={href} target={k === "Website" ? "_blank" : undefined} rel="noopener noreferrer"
                           className="block truncate text-[13px] font-semibold text-slate-800 hover:text-navy">{v}</a>
                      : <button type="button" onClick={() => goTo("sec-details")} className="text-[13px] font-semibold text-navy hover:underline">+ Add</button>}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* --- Logo (requirement 27) --- */}
          <div id="sec-logo" className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-5">
            <ProfHead icon={IconSparkle} title="Logo" />
            <p className="mb-3 mt-2 text-[12px] leading-snug text-slate-500">
              Shown on your dashboard, every job you post and any ad you run. Square works best — you can
              crop it after choosing. It saves as soon as it uploads.
            </p>
            <ImageUpload kind="logo" round={false} currentUrl={p.logo_url}
                         doneText="Logo saved."
                         onUploaded={(u) => setP((old) => ({ ...old, logo_url: u }))} />
          </div>
        </aside>
      </div>

      {/* --- Courses and max seats (requirements 37-38) --- */}
      <div id="sec-courses" className="scroll-mt-4">
        <CoursesSection locations={locations} reload={loadLocations} />
      </div>

      {/* --- Locations (requirements 39-43) --- */}
      <LocationsSection locations={locations} reload={loadLocations} confirm={confirm} />
    </div>
  );
}

function SectionHead({ title, action, icon }) {
  return (
    <div className="mb-5">
      <ProfHead icon={icon || IconLayers} title={title} action={action} />
    </div>
  );
}

/** A profile block that flips between read and edit in place. */
function EditableSection({ title, icon, fields, render, onSave, validate }) {
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <SectionHead title={title} icon={icon} action={
        editing ? (
          <div className="flex gap-2">
            <button className="btn-outline btn-sm !rounded-full" onClick={cancel} disabled={saving}>Cancel</button>
            <button className="btn btn-sm !rounded-full !px-4" onClick={commit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <button className="btn-outline btn-sm !rounded-full flex items-center gap-1.5" onClick={start}>
            <IconEdit size={13} /> Edit
          </button>
        )
      } />
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {render(editing ? draft : fields, set, editing)}
      </div>
    </div>
  );
}

/** One field: an input while editing, a labelled value when not. */
function Item({ label, value, editing, onChange, placeholder, span, numeric,
                maxLength, required, note, link }) {
  const cls = span ? "sm:col-span-2" : "";
  if (editing && onChange) {
    return (
      <div className={cls}>
        {/* Same field as the registration page: icon tile, clear (×), validation. */}
        <FField label={label} required={required} value={value ?? ""} placeholder={placeholder}
                inputMode={numeric ? "numeric" : undefined} maxLength={maxLength}
                onChange={(v) => onChange(numeric ? v.replace(/\D/g, "").slice(0, maxLength || 12) : v)} />
      </div>
    );
  }
  return (
    <div className={`min-w-0 ${cls}`}>
      <dt className="text-[11.5px] font-medium text-slate-400">
        {label} {required && <span className="text-red-400">*</span>}
      </dt>
      <dd className="mt-0.5 truncate text-[14px] font-semibold text-slate-800" title={value || undefined}>
        {value
          ? (link
              ? <a href={/^https?:/.test(value) ? value : `https://${value}`} target="_blank"
                   rel="noopener noreferrer" className="text-navy hover:underline">{value}</a>
              : value)
          : <span className="font-normal text-slate-300">Not added</span>}
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <SectionHead title="About the institute" icon={IconDoc} action={
        editing ? (
          <div className="flex gap-2">
            <button className="btn-outline btn-sm !rounded-full"
                    onClick={() => { setDraft(value || ""); setEditing(false); }}>Cancel</button>
            <button className="btn btn-sm !rounded-full !px-4" onClick={commit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        ) : (
          <button className="btn-outline btn-sm !rounded-full flex items-center gap-1.5"
                  onClick={() => setEditing(true)}>
            <IconEdit size={13} /> Edit
          </button>
        )
      } />
      {editing ? (
        <RichText value={draft} onChange={setDraft} rows={10}
                  hint="Facilities, placement record, accreditations. **bold**, ## heading, - lists work." />
      ) : (
        value ? <div className="text-[14px] leading-relaxed text-slate-700"><Markdown text={value} /></div>
              : <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3">
                  <p className="text-[13px] text-slate-500">Facilities, placement record, accreditations — tell employers about your institute.</p>
                  <button type="button" onClick={() => setEditing(true)} className="text-[12.5px] font-semibold text-navy hover:underline">+ Add</button>
                </div>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
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
          <Combobox label="Course name" icon={iconFor("Course name")} value={name} options={COURSES}
                    onChange={setName} placeholder="e.g. B.Tech Mechanical" />
          <div>
            <FField label="No of seats" clearable={false} inputMode="numeric" value={seats} placeholder="60" onChange={(v) => setSeats(v.replace(/\D/g, ""))} />
          </div>
          <div>
            <FField label="Current strength" clearable={false} inputMode="numeric" value={strength} placeholder="48" onChange={(v) => setStrength(v.replace(/\D/g, ""))} />
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <SectionHead title="Locations" icon={IconMapPin} action={
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
              <FField label="Campus name" value={form.name || ""} onChange={set("name")} placeholder="e.g. Secunderabad campus" />
            </div>
            <div>
              <FField label="Pincode" required inputMode="numeric" maxLength={6} value={form.pincode || ""} onChange={(v) => set("pincode")(v.replace(/\D/g, "").slice(0, 6))} placeholder="e.g. 500003" />
            </div>
            <div className="sm:col-span-2">
              <FField label="Address" value={form.address1 || ""} onChange={set("address1")} placeholder="e.g. 5-9-22, SP Road" />
            </div>
            <Combobox label="City" icon={iconFor("City")} value={form.city} options={CITIES}
                      onChange={set("city")} placeholder="e.g. Hyderabad" />
            <Combobox label="State" icon={iconFor("State")} value={form.state} options={STATES}
                      onChange={set("state")} placeholder="e.g. Telangana" />
            {/* Requirement 41 — a new location gets its OWN contact person. */}
            <div>
              <FField label="Contact Person" required value={form.contact_person || ""} onChange={set("contact_person")} placeholder="e.g. Anil Reddy" />
            </div>
            <div>
              <FField label="Email" type="email" value={form.contact_email || ""} onChange={set("contact_email")} placeholder="e.g. anil@institute.edu" />
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
            <FField label="Campus name" value={draft.name || ""} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} />
          </div>
          <div>
            <FField label="Pincode" inputMode="numeric" maxLength={6} value={draft.pincode || ""} onChange={(v) => setDraft((d) => ({ ...d, pincode: v.replace(/\D/g, "").slice(0, 6) }))} />
          </div>
          <div className="sm:col-span-2">
            <FField label="Address" value={draft.address1 || ""} onChange={(v) => setDraft((d) => ({ ...d, address1: v }))} />
          </div>
          <div>
            <FField label="Contact Person" value={draft.contact_person || ""} onChange={(v) => setDraft((d) => ({ ...d, contact_person: v }))} />
          </div>
          <div>
            <FField label="Email" value={draft.contact_email || ""} onChange={(v) => setDraft((d) => ({ ...d, contact_email: v }))} />
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
  const { logout } = useAuth();

  /* 401/403 on an upload means this tab's login is no longer the institute's.
     The token lives in localStorage, which every tab shares — signing in as
     one of the uploaded students in another tab (to try their credentials)
     replaces it, and from then on every institute call here is refused.
     The raw "You don't have access to this resource" says nothing useful;
     explain what happened and offer the way back instead. */
  const sessionLost = (msg) =>
    /don't have access|could not validate credentials|not authenticated/i.test(msg || "");
  const showSessionLost = () => dialog({
    tone: "warn",
    title: "Please sign in again as the institute",
    message: "This browser is now signed in to a different account, so the upload "
           + "was not sent. This usually happens after signing in as a student in "
           + "another tab.\n\nNothing was imported.",
    confirmLabel: "Sign in as institute",
    onConfirm: () => { logout(); navigate("/login?as=institute"); },
  });
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

  /* Clearing removes the LOG entries only — students already registered from
     those uploads stay registered. Said in the dialog so nobody hesitates. */
  const clearHistory = (kind) => {
    const isUploads = kind === "uploads";
    dialog({
      tone: "warn",
      title: isUploads ? "Clear upload history?" : "Clear download history?",
      message: isUploads
        ? "All entries in Upload history will be removed."
        : "All entries in Download history will be removed.",
      note: isUploads
        ? "Students already registered are NOT deleted — only this list is cleared."
        : "Only this list is cleared. Files you downloaded are not affected.",
      noteTone: "info",
      confirmLabel: "Clear history",
      onConfirm: async () => {
        try {
          await api.del(isUploads ? "/api/institute/upload-history"
                                  : "/api/institute/download-history");
          if (isUploads) { setHistory([]); } else { setDownloads([]); }
          toast(isUploads ? "Upload history cleared." : "Download history cleared.");
        } catch (err) {
          toast(err.message || "Could not clear history.", "error");
        }
      },
      secondary: { label: "Cancel", onClick: () => {} },
    });
  };

  // The result of the last upload lives only on this screen; clearing it
  // just hides it (passwords included) — nothing on the server changes.
  const clearResult = () => { setResults(null); setBatch(null); setUploadErrors(null); };

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
      // apiUrl, not a bare path: in production the API is a different host.
      const res = await fetch(apiUrl(path), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) {
        let msg = `Download failed (${res.status})`;
        try { msg = (await res.json()).detail || msg; } catch { /* not JSON */ }
        throw new Error(msg);
      }
      /* A 200 is not proof the body is a spreadsheet. A static host answers
         an unknown path with index.html and a 200, and that HTML would be
         saved as .xlsx — which is exactly what Excel reports as a corrupt
         file. Check what actually came back before writing it to disk. */
      const got = (res.headers.get("content-type") || "").toLowerCase();
      if (got.includes("text/html")) {
        throw new Error("The server returned a web page instead of a file. "
                      + "VITE_API_BASE is probably not set on the frontend build.");
      }
      const buf = await res.arrayBuffer();
      const head = new Uint8Array(buf.slice(0, 4));
      const isZip = head[0] === 0x50 && head[1] === 0x4b;      // "PK" — every .xlsx is a zip
      if (filename.endsWith(".xlsx") && !isZip) {
        throw new Error("That download was not a valid Excel file, so it wasn't saved. "
                      + "Please try again or contact support.");
      }
      const blob = new Blob([buf], { type });
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

    /* Ask BEFORE importing, not after.
       The sheet is inspected first — nothing is written — so if any student is
       already registered the institute gets to decide. Importing and then
       reporting gives them no choice: the accounts already exist by the time
       they read the summary. */
    setBusy(true);
    let preview = null;
    try {
      preview = await api.upload("/api/institute/upload/preview", file);
    } catch (err) {
      setBusy(false);
      const msg = err.message || "";
      if (sessionLost(msg)) return showSessionLost();
      if (/student upload/i.test(msg)) {
        // Wrong file entirely — the message already names the missing columns.
        return dialog({ tone: "error", title: "That doesn't look like a student sheet",
                        message: msg, confirmLabel: "Choose another file" });
      }
      if (/wrong file format/i.test(msg)) {
        return dialog({ tone: "error", title: "Wrong File Format", message: msg,
                        confirmLabel: "Choose another file" });
      }

      /* ANYTHING ELSE AND WE UPLOAD ANYWAY.
         The preview is a COURTESY — it exists to ask about duplicates before
         importing. It is not permission to import.

         This branch used to `return`, which made the whole feature depend on
         a brand-new endpoint existing. Deploy the frontend before the backend
         and /upload/preview 404s, this returned, and uploading silently
         stopped working: the institute pressed Submit and no profiles were
         ever created. A convenience must never be able to break the thing it
         was added to improve.

         The real upload validates headers and duplicates server-side too, so
         skipping the preview loses the duplicate PROMPT, nothing else. */
      console.warn("Upload preview unavailable, importing directly:", msg);
      return runUpload(true);
    }
    setBusy(false);

    /* Duplicates come in two kinds, and the institute needs them apart:
         existing — this exact student was uploaded before. Nothing to do;
                    they are simply ignored.
         conflict — a DIFFERENT person whose email or mobile is already taken,
                    usually a copied row whose email wasn't changed. These are
                    the rows to fix, so they are listed with the reason and
                    the spreadsheet row number. */
    if (preview?.duplicate_count > 0) {
      const dupes = preview.duplicates || [];
      const conflicts = dupes.filter((d) => d.kind === "conflict");
      const existing = dupes.length - conflicts.length;
      const newCount = preview.will_create || 0;

      const conflictLines = conflicts.slice(0, 5)
        .map((d) => `• ${d.row_no ? `Row ${d.row_no}: ` : ""}${d.row} — ${d.reason}`);
      if (conflicts.length > 5) conflictLines.push(`…and ${conflicts.length - 5} more`);

      const parts = [];
      if (newCount) parts.push(`${newCount} new student(s) will be registered.`);
      if (existing) parts.push(`${existing} student(s) already uploaded — they will be ignored.`);
      if (conflicts.length) {
        parts.push(`${conflicts.length} row(s) can't be registered — the email or mobile `
                 + `belongs to someone else:\n${conflictLines.join("\n")}`);
      }
      const message = parts.join("\n\n");

      // Nothing new at all: just inform, there is nothing to confirm.
      if (newCount === 0) {
        setFile(null);
        return dialog({
          tone: conflicts.length ? "warn" : "info",
          title: conflicts.length ? "No new students to upload" : "Already uploaded",
          message,
          note: conflicts.length
            ? "Each student needs their own email and mobile number. Fix the rows "
              + "above and upload the sheet again — the students already uploaded "
              + "will be ignored."
            : "Nothing was imported and no existing account was changed.",
          noteTone: conflicts.length ? "warn" : "info",
          confirmLabel: "OK",
        });
      }

      return dialog({
        tone: conflicts.length ? "warn" : "info",
        title: `${newCount} new student(s) found`,
        message,
        note: "Only the new students are registered. Existing accounts are not changed."
            + (conflicts.length ? " The rows listed can be fixed and uploaded later." : ""),
        noteTone: "info",
        /* Dialog supports `secondary`, not `cancelLabel` — the second option
           has to be a real button, otherwise "correct the sheet" would only
           be reachable by dismissing the dialog and guessing. */
        confirmLabel: `Upload ${newCount} new student(s)`,
        onConfirm: () => runUpload(true),
        secondary: {
          label: "I'll correct the sheet",
          onClick: () => {
            setFile(null);
            toast("Nothing was imported. Fix the sheet and upload again.");
          },
        },
      });
    }
    runUpload(true);
  };

  const runUpload = async (skipDuplicates) => {
    setBusy(true);
    try {
      setUploadErrors(null);
      const res = await api.upload(
        `/api/institute/upload?skip_duplicates=${skipDuplicates ? "true" : "false"}`, file);
      setResults(res.results);
      setBatch(res.batch);
      loadHistory();
      /* Requirement 49 — the fixed success message. */
      /* The popup has to answer three questions, not one: how many profiles
         exist now, what was skipped, and WHY. The old version showed only the
         server's one-line count — an institute saw "3 row(s) skipped" and had
         no idea which students were missing or what to fix. */
      const rows = res.results || [];
      const made = rows.filter((x) => x.outcome === "created");
      const dupes = rows.filter((x) => x.outcome === "duplicate");
      const bad = rows.filter((x) => x.outcome === "skipped");

      /* List only the NEW students by name — that is what the institute
         wants to confirm. Rows already registered are just a count; naming
         110 students who were ignored buries the 2 that were added. The full
         per-row list stays in the results table below the form. */
      const lines = [`${made.length} new student(s) registered`
                     + (made.length ? ":" : ".")];
      const names = made.slice(0, 8).map((x) => `• ${x.row || x.email} — ${x.email}`);
      if (made.length > names.length) names.push(`…and ${made.length - names.length} more`);

      const counts = [];
      if (dupes.length) counts.push(`${dupes.length} record(s) already registered — ignored.`);
      if (bad.length) counts.push(`${bad.length} row(s) incomplete — skipped (see the table below).`);

      confirm("Data upload is successful", {
        message: lines.join("\n")
               + (names.length ? `\n${names.join("\n")}` : "")
               + (counts.length ? `\n\n${counts.join("\n")}` : ""),
        note: made.length
          ? "Each new student has been emailed their user ID and password, and "
          + "can sign in from the Job Seeker login straight away."
          : "No new profiles were created from this sheet.",
        noteTone: made.length ? "info" : "warn",
      });
    } catch (err) {
      const msg = err.message || "Upload failed.";
      if (sessionLost(msg)) return showSessionLost();
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

  const histCount = tab === "uploads" ? history.length : downloads.length;
  const totalCreated = history.reduce((a, h) => a + (h.created || 0), 0);
  const totalDup = history.reduce((a, h) => a + (h.duplicates || 0), 0);
  const dlTemplateXlsx = () => download("/api/institute/upload-template", "qclonejob_student_upload_template.xlsx", XLSX_TYPE);
  const dlTemplateCsv = () => download("/api/institute/upload-template.csv", "qclonejob_student_upload_template.csv", "text/csv;charset=utf-8");
  const dlStudents = () => download("/api/institute/students-export", "qclonejob_students.xlsx", XLSX_TYPE);
  const pill = "focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/40";

  return (
    <div className="max-w-6xl space-y-6">
      {/* ---- page title ---- */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-navy">Students</p>
        <h1 className="mt-1 font-heading text-[26px] font-bold leading-tight text-slate-900">Data upload</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-slate-500">
          Upload an Excel or CSV of one or many students. A resume is auto-created from the
          available columns, stored in the database, and each student is emailed their login
          credentials.
        </p>
      </div>

      {errorTable}

      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ================= hero upload card (requirements 46-47) ================= */}
        <div className="rounded-3xl bg-gradient-to-br from-navy via-violet-400 to-brandgreen p-[1.5px] shadow-[0_24px_50px_-28px_rgba(79,70,229,.55)]">
          <div className="relative h-full overflow-hidden rounded-[22px] bg-white p-6 sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-100/60 blur-3xl" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-emerald-100/50 blur-3xl" />

            <div className="relative grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              {/* left: message */}
              <div>
                <UploadArt />
                <h2 className="mt-5 font-heading text-[22px] font-bold leading-tight text-slate-900">
                  Import your students in one go
                </h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">
                  Drop your filled sheet — every new student gets a profile, a ready resume and a
                  login sent to their email.
                </p>
                <ul className="mt-4 space-y-2 text-[13px] text-slate-700">
                  {["One row per student, using the template columns",
                    "Students already registered are skipped automatically",
                    "Passwords are emailed — and shown to you once"].map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-brandgreen-50 text-brandgreen-600">
                        <IconCheck size={11} strokeWidth={3} />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* right: drop zone + submit */}
              <div>
                <FileDrop
                  title="Drag & drop your sheet here"
                  accept=".xlsx,.xls,.xlsm,.csv"
                  file={file}
                  busy={busy}
                  busyLabel="Uploading and creating accounts…"
                  onPick={pickFile}
                  onClear={() => setFile(null)}
                  hint="or click to browse · XLSX, XLS, XLSM or CSV" />
                <button className={`btn mt-4 w-full !rounded-full !py-3 text-[14.5px] shadow-[0_10px_24px_-10px_rgba(79,70,229,.8)] disabled:shadow-none ${pill}`}
                        onClick={submit} disabled={busy || !file}>
                  <IconUpload size={16} /> {busy ? "Uploading…" : file ? "Submit and create students" : "Submit"}
                </button>
                <p className="mt-2 text-center text-[11.5px] text-slate-400">
                  {file ? `${file.name} is ready to upload.` : "Submit becomes available once a file is chosen."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ================= side guide + downloads (requirement 50) ================= */}
        <aside className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">How it works</p>
          <ol className="relative mt-4 space-y-5">
            <span aria-hidden="true" className="absolute bottom-3 left-[13px] top-3 w-px bg-slate-200" />
            <li className="relative flex gap-3">
              <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[12px] font-bold text-white ring-4 ring-white">1</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-slate-800">Download the template</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" onClick={dlTemplateXlsx}
                          className={`inline-flex items-center gap-1.5 rounded-full bg-brandgreen-50 px-3 py-1.5 text-[12px] font-semibold text-brandgreen-600 transition-colors hover:bg-brandgreen hover:text-white ${pill}`}>
                    <IconDownload size={12} /> Excel
                  </button>
                  <button type="button" onClick={dlTemplateCsv}
                          className={`inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[12px] font-semibold text-blue-600 transition-colors hover:bg-blue-600 hover:text-white ${pill}`}>
                    <IconDownload size={12} /> CSV
                  </button>
                </div>
              </div>
            </li>
            <li className="relative flex gap-3">
              <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500 text-[12px] font-bold text-white ring-4 ring-white">2</span>
              <div>
                <p className="text-[13.5px] font-semibold text-slate-800">Fill in your students</p>
                <p className="mt-0.5 text-[12px] leading-snug text-slate-500">Name, email and mobile number are required — one student per row.</p>
              </div>
            </li>
            <li className="relative flex gap-3">
              <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brandgreen text-[12px] font-bold text-white ring-4 ring-white">3</span>
              <div>
                <p className="text-[13.5px] font-semibold text-slate-800">Upload and submit</p>
                <p className="mt-0.5 text-[12px] leading-snug text-slate-500">Accounts are created and logins emailed straight away.</p>
              </div>
            </li>
          </ol>

          <div className="mt-auto pt-6">
            <button type="button" onClick={dlStudents}
                    className={`group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 text-left transition-all hover:border-navy-200 hover:bg-white hover:shadow-card ${pill}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-[10px] font-extrabold uppercase text-violet-600">xlsx</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-slate-800">Export my students</span>
                <span className="block text-[11.5px] text-slate-500">Everyone uploaded so far</span>
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200 transition-colors group-hover:bg-navy group-hover:text-white group-hover:ring-navy">
                <IconDownload size={14} />
              </span>
            </button>
            <p className="mt-3 text-[11px] leading-snug text-slate-400">
              Downloads are listed under History. Excel may open them in "Protected View" — click <b>Enable Editing</b>.
            </p>
          </div>
        </aside>
      </div>

      {/* ---- totals strip ---- */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Sheets uploaded", history.length, IconUpload, "bg-navy-50 text-navy"],
          ["Students created", totalCreated, IconUser, "bg-brandgreen-50 text-brandgreen-600"],
          ["Duplicates skipped", totalDup, IconLayers, "bg-amber-50 text-amber-600"],
          ["Files downloaded", downloads.length, IconDownload, "bg-violet-50 text-violet-600"]].map(([l, v, Ic, tone]) => (
          <div key={l} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Ic size={18} /></span>
            <div>
              <p className="font-heading text-[22px] font-bold leading-none text-slate-900 tabular-nums">{v}</p>
              <p className="mt-1 text-[11.5px] font-medium text-slate-500">{l}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ---- latest upload result ---- */}
      {batch && (
        <div className="overflow-hidden rounded-2xl border border-brandgreen-100 bg-white">
          <div className="flex flex-wrap items-center gap-3 bg-gradient-to-r from-brandgreen-50 to-white px-6 py-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brandgreen text-white shadow-sm">
              <IconCheck size={18} strokeWidth={3} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading text-[15px] font-bold text-slate-900">Data upload is successful</h3>
              <p className="truncate text-[12.5px] text-slate-500">
                <b className="text-slate-700">{batch.filename}</b> · uploaded {new Date(batch.uploaded_at).toLocaleString()}
              </p>
            </div>
            <button type="button" className={`btn-outline btn-sm !rounded-full ${pill}`} onClick={clearResult}>Clear result</button>
          </div>
          <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
            {[["Rows read", batch.total_rows, "text-slate-900"],
              ["Created", batch.created, "text-brandgreen-600"],
              ["Duplicates ignored", batch.duplicates || 0, "text-amber-600"],
              ["Skipped", batch.skipped || 0, "text-slate-500"]].map(([l, v, c]) => (
              <div key={l} className="bg-white px-6 py-3">
                <p className="text-[11.5px] font-medium text-slate-500">{l}</p>
                <p className={`font-heading text-[22px] font-bold leading-tight tabular-nums ${c}`}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {results && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <ProfHead icon={IconUser} title="Result" action={!batch && (
            <button type="button" className={`btn-outline btn-sm !rounded-full ${pill}`} onClick={clearResult}>Clear result</button>
          )} />
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
            <table className="table">
              <thead><tr><th>Student</th><th>User ID</th><th>Password</th><th>Status</th></tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td className="font-medium text-slate-800">{r.row}</td>
                    <td>{r.user_id || "—"}</td>
                    <td className="font-mono text-[12.5px]">{r.password || "—"}</td>
                    <td><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-semibold text-slate-600">{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11.5px] text-slate-400">
            Passwords are shown once here for your reference; students also receive them by email.
          </p>
        </div>
      )}

      {/* ---- History (requirement 51) ---- */}
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
          <h3 className="font-heading text-[16px] font-bold text-slate-900">History</h3>
          <div className="flex gap-1">
            {[["uploads", "Uploads", history.length], ["downloads", "Downloads", downloads.length]].map(([key, label, n]) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                      className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${pill}
                        ${tab === key ? "bg-navy-50 text-navy" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`}>
                {label}
                <span className={`rounded-full px-1.5 text-[11px] font-bold tabular-nums ${tab === key ? "bg-navy text-white" : "bg-slate-100 text-slate-500"}`}>{n}</span>
              </button>
            ))}
          </div>
          <div className="flex-1" />
          {histCount > 0 && (
            <button type="button" onClick={() => clearHistory(tab)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 ${pill}`}>
              <IconClose size={12} /> Clear {tab === "uploads" ? "upload" : "download"} history
            </button>
          )}
        </div>

        {histCount === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
              {tab === "uploads" ? <IconUpload size={22} /> : <IconDownload size={22} />}
            </span>
            <p className="mt-3 text-[13.5px] font-semibold text-slate-700">
              {tab === "uploads" ? "Nothing uploaded yet." : "Nothing downloaded yet."}
            </p>
            <p className="mt-0.5 text-[12px] text-slate-400">
              {tab === "uploads" ? "Your uploaded sheets will be listed here." : "Templates and exports you download appear here."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {tab === "uploads" ? history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-4 px-6 py-3.5 transition-colors hover:bg-slate-50/60">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brandgreen-50 text-[9.5px] font-extrabold uppercase text-brandgreen-600">
                  {(h.filename || "").split(".").pop().slice(0, 4)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-slate-800">{h.filename}</p>
                  <p className="text-[12px] text-slate-400">{new Date(h.uploaded_at).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 tabular-nums">{h.total_rows} rows</span>
                  <span className="rounded-full bg-brandgreen-50 px-2.5 py-1 text-brandgreen-600 tabular-nums">{h.created} created</span>
                  <span className={`rounded-full px-2.5 py-1 tabular-nums ${h.duplicates ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400"}`}>{h.duplicates} duplicates</span>
                </div>
              </li>
            )) : downloads.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-4 px-6 py-3.5 transition-colors hover:bg-slate-50/60">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[9.5px] font-extrabold uppercase text-blue-600">
                  {d.file_format}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-slate-800">{d.filename}</p>
                  <p className="text-[12px] text-slate-400">{new Date(d.downloaded_at).toLocaleString()}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold capitalize text-slate-600">{d.kind}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* Small illustration for the upload hero: a sheet turning into profiles. */
function UploadArt() {
  return (
    <svg width="132" height="64" viewBox="0 0 132 64" fill="none" aria-hidden="true">
      <rect x="1" y="6" width="44" height="54" rx="8" fill="#ecfdf3" stroke="#4faa38" strokeWidth="1.5" />
      <path d="M9 20h28M9 29h28M9 38h28M9 47h18" stroke="#4faa38" strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
      <path d="M23 14v40" stroke="#4faa38" strokeWidth="1" opacity=".35" />
      <path d="M54 33h18m0 0-5-5m5 5-5 5" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {[[94, 14], [118, 22], [100, 44]].map(([x, y], n) => (
        <g key={n}>
          <circle cx={x} cy={y} r="11" fill={["#eef2ff", "#f5f3ff", "#eef2ff"][n]} stroke="#4f46e5" strokeWidth="1.3" />
          <circle cx={x} cy={y - 3} r="3.2" fill="#4f46e5" />
          <path d={`M${x - 5.5} ${y + 6}a5.5 5 0 0 1 11 0`} fill="#4f46e5" />
        </g>
      ))}
    </svg>
  );
}

/* =====================================================================
   Post a Ad (requirements 52-56).
   ===================================================================== */
function PostAd() {
  const toast = useToast();
  const confirm = useConfirm();
  const [kind, setKind] = useState("image");       // image | gif | video | link | text
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [mediaUrl_, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [videoLink, setVideoLink] = useState("");
  const [file, setFile] = useState(null);
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

  const clearMedia = () => { setFile(null); setMediaUrl(""); setUploadNote(null); setVideoLink(""); };
  const reset = () => { setTitle(""); setText(""); setCtaLink(""); clearMedia(); };
  const pickKind = (k) => { setKind(k); clearMedia(); if (k === "text") setText(""); };

  const ACCEPT = {
    image: ".jpg,.jpeg,.jfif,.png,.webp",
    gif: ".gif",
    video: ".mp4,.webm,.mov",
  };

  /* Stills go through /uploads/flyer, which cover-crops them to the ad slot
     on the server. GIFs and videos go through /uploads/media untouched —
     re-encoding would kill the animation — and the slot crops them visually
     with object-cover, so they still fill it edge to edge. */
  const pickFile = async (f) => {
    if (!f) return;
    const ok = {
      image: /\.(jpe?g|jfif|png|webp)$/i, gif: /\.gif$/i, video: /\.(mp4|webm|mov)$/i,
    }[kind];
    if (ok && !ok.test(f.name)) {
      setFile(null);
      return toast(kind === "image" ? "Wrong File Format — upload a JPG, PNG or WEBP image."
        : kind === "gif" ? "Wrong File Format — upload an animated .gif file."
        : "Wrong File Format — upload an MP4, WEBM or MOV video.", "error");
    }
    setFile(f); setUploading(true); setUploadNote(null);
    try {
      const r = await api.uploadFile(kind === "image" ? "/api/uploads/flyer" : "/api/uploads/media", f);
      setMediaUrl(r.url);
      setMediaType(kind === "image" ? "image" : (r.media_type || kind));
      setUploadNote(r.message);
      toast(kind === "image" ? "Flyer uploaded and resized." : "Uploaded.");
    } catch (e) {
      setFile(null);
      toast(e.message, "error");
    } finally { setUploading(false); }
  };

  const linkOk = !!toEmbedUrl(videoLink);
  const ready = kind === "text" ? !!text.trim()
    : kind === "link" ? linkOk : !!mediaUrl_;

  const post = async () => {
    setBusy(true);
    try {
      const r = await api.post("/api/institute/ads", {
        ad_format: kind === "text" ? "scroller" : "flyer",
        title, text_content: text,
        image_url: kind === "link" ? "" : mediaUrl_,
        media_type: kind === "link" ? "video" : mediaType,
        video_url: kind === "link" ? videoLink.trim() : "",
        cta_link: ctaLink,
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

  const previewBanner = {
    ad_format: kind === "text" ? "scroller" : "flyer",
    title, text_content: text,
    media_type: kind === "link" ? "video" : mediaType,
    media_url: kind === "link" ? "" : mediaUrl_,
    video_url: kind === "link" && linkOk ? videoLink : "",
    theme: "navy", autoplay: true, muted: true,
  };
  const live = ads.filter((a) => a.status === "active").length;
  const totalViews = ads.reduce((a, x) => a + (x.impressions || 0), 0);
  const totalClicks = ads.reduce((a, x) => a + (x.clicks || 0), 0);

  return (
    <div className="max-w-6xl space-y-6">
      {/* ---- header ---- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-navy">Promote</p>
          <h1 className="mt-1 font-heading text-[26px] font-bold leading-tight text-slate-900">Post a Ad</h1>
          <p className="mt-1 text-[13.5px] text-slate-500">
            Your ad runs in the portal's ad slot on the website and in the mobile app, shown to job seekers.
          </p>
        </div>
        <div className="flex gap-2">
          {[["Live ads", live, "bg-brandgreen"], ["Views", totalViews, "bg-navy"], ["Clicks", totalClicks, "bg-violet-500"]].map(([l, v, dot]) => (
            <div key={l} className="rounded-xl border border-slate-200 bg-white px-4 py-2">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500"><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{l}</p>
              <p className="font-heading text-[18px] font-bold leading-tight text-slate-900 tabular-nums">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          {/* ---- 1. format (requirements 53-54) ---- */}
          <AdStep n={1} title="Choose your ad type" sub="Every type fits the ad slot perfectly on desktop and mobile.">
            <AdTypePicker value={kind} onChange={pickKind} types={[
              ["image", "Image flyer", "JPG, PNG or WEBP — auto-fitted"],
              ["gif", "GIF / animation", "Animated .gif, up to 12 MB"],
              ["video", "Video", "MP4, WEBM or MOV, up to 50 MB"],
              ["link", "Video link", "YouTube, Vimeo or .mp4 URL"],
              ["text", "Scroller text", "A short line that scrolls"],
            ]} />
          </AdStep>

          {/* ---- 2. content ---- */}
          <AdStep n={2} title={kind === "text" ? "Write your message" : kind === "link" ? "Paste your video link" : "Upload your creative"}
                  sub={kind === "text" ? "Kept short so the whole message scrolls past before someone moves on."
                    : kind === "link" ? "Nothing is uploaded — the ad plays the video from where it already lives."
                    : "Any size works — it is fitted to the ad slot automatically."}>
            {kind === "text" ? (
              <div>
                <div className="flex items-center justify-between">
                  <label className="label !mb-0">Scroller text <span className="text-red-400">*</span></label>
                  {/* Requirement 56 — the limit is visible while typing. */}
                  <span className={`mb-1.5 text-xs font-bold tabular-nums
                    ${text.length >= maxChars ? "text-red-500" : text.length > maxChars - 20 ? "text-amber-600" : "text-slate-400"}`}>
                    {text.length} / {maxChars}
                  </span>
                </div>
                <textarea className="input !h-auto resize-none" rows={3} value={text} maxLength={maxChars}
                          onChange={(e) => setText(e.target.value)}
                          placeholder="e.g. Admissions open for the 2027 batch — call 040-1234 5678" />
                {text.length >= maxChars && (
                  <p className="mt-1 text-xs font-semibold text-red-500">You've hit the {maxChars}-character limit.</p>
                )}
              </div>
            ) : kind === "link" ? (
              <div>
                <FField label="Video link" value={videoLink} onChange={setVideoLink} placeholder="https://youtube.com/watch?v=…"
                        validate={(v) => (toEmbedUrl(v) ? null : "Paste a YouTube, Vimeo or direct .mp4 link")} />
                {linkOk && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brandgreen-600">
                    <IconCheck size={13} /> Link recognised — it plays muted and loops in the ad slot.
                  </p>
                )}
              </div>
            ) : (
              <div>
                <FileDrop
                  compact
                  accept={ACCEPT[kind]}
                  file={file}
                  busy={uploading}
                  busyLabel={kind === "image" ? "Uploading and resizing…" : "Uploading…"}
                  onPick={pickFile}
                  onClear={clearMedia}
                  title={kind === "image" ? "Drop your flyer here, or click to browse"
                    : kind === "gif" ? "Drop your GIF here, or click to browse"
                    : "Drop your video here, or click to browse"}
                  hint={kind === "image" ? "JPG, PNG or WEBP, up to 5 MB — cropped to the 3:1 ad slot."
                    : kind === "gif" ? "Animated .gif up to 12 MB — the animation is kept as-is."
                    : "MP4, WEBM or MOV up to 50 MB — plays muted on loop."} />
                {uploadNote && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brandgreen-600">
                    <IconCheck size={13} /> {uploadNote}
                  </p>
                )}
              </div>
            )}
          </AdStep>

          {/* ---- 3. details ---- */}
          <AdStep n={3} title="Details" sub="The title is for your own list; the caption and link appear on the ad.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FField label="Ad title" required value={title} onChange={setTitle} placeholder="e.g. Admissions open — 2027 batch"
                        hint="For your own reference in the list below. It isn't shown in the ad." />
              </div>
              {kind !== "text" && (
                <FField label="Caption (optional)" value={text} maxLength={200} onChange={setText}
                        placeholder="e.g. Diploma and B.Tech seats available" />
              )}
              <div className={kind === "text" ? "sm:col-span-2" : ""}>
                <FField label="Link (optional)" value={ctaLink} onChange={setCtaLink}
                        placeholder="e.g. www.yourinstitute.edu/admissions" />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
              <button className="btn !rounded-full !px-7 shadow-[0_8px_20px_-8px_rgba(79,70,229,.7)] disabled:shadow-none"
                      onClick={post} disabled={busy || uploading || !title.trim() || !ready}>
                <IconSparkle size={15} /> {busy ? "Posting…" : "Publish ad"}
              </button>
              <button className="btn-outline !rounded-full" onClick={reset} disabled={busy}>Clear</button>
              <span className="text-[12px] text-slate-400">
                {!ready ? (kind === "text" ? "Type your message to continue." : kind === "link" ? "Paste a valid video link to continue." : "Upload your creative to continue.")
                  : !title.trim() ? "Add a title to publish." : "Ready to publish."}
              </span>
            </div>
          </AdStep>
        </div>

        {/* ---- live preview ---- */}
        <aside className="xl:sticky xl:top-4">
          <AdPreview banner={previewBanner}
                     note={kind === "text" ? "Hover to pause. Longer text scrolls for longer, so it stays readable."
                       : "Images, GIFs and videos fill the frame edge to edge — anything outside it is trimmed evenly."} />
        </aside>
      </div>

      {/* ---- your ads ---- */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <ProfHead icon={IconSparkle} title={`Your ads (${ads.length})`} />
        {ads.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon={IconSparkle} title="No ads running"
                        body="Publish an image, GIF, video or scroller above and it starts showing to job seekers straight away." />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ads.map((ad) => {
              const b = { ...ad, media_url: ad.media_url || ad.image_url };
              const isLive = ad.status === "active";
              return (
                <div key={ad.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-card">
                  <div className="relative bg-slate-100" style={{ aspectRatio: "3 / 1" }}>
                    {ad.ad_format === "scroller" ? (
                      <div className="flex h-full items-center bg-gradient-to-br from-navy to-navy-600 px-3">
                        <span className="line-clamp-2 text-[11.5px] font-semibold leading-tight text-white">{ad.text_content || ad.title}</span>
                      </div>
                    ) : adHasVisual(b) ? <AdMedia banner={b} /> : null}
                    <span className={`absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide
                      ${isLive ? "bg-brandgreen text-white" : "bg-white/90 text-slate-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isLive ? "animate-pulse bg-white" : "bg-slate-400"}`} />
                      {isLive ? "Live" : "Paused"}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 truncate font-heading text-[14px] font-bold text-slate-900">{ad.title}</p>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold capitalize text-slate-500">
                        {ad.ad_format === "scroller" ? "Scroller" : ad.video_url ? "Video link" : ad.media_type === "gif" ? "GIF" : ad.media_type === "video" ? "Video" : "Image"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] text-slate-400">
                      {ad.impressions} views · {ad.clicks} clicks · {new Date(ad.created_at).toLocaleDateString()}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button className="btn-outline btn-sm flex-1 !rounded-full"
                              onClick={() => setStatus(ad, isLive ? "paused" : "active")}>
                        {isLive ? "Pause" : "Resume"}
                      </button>
                      <button className="btn-outline btn-sm !rounded-full !text-red-500 hover:!bg-red-50" onClick={() => remove(ad)}
                              title={`Remove ${ad.title}`} aria-label={`Remove ${ad.title}`}>
                        <IconClose size={13} /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* Shared with the recruiter portal — off the menu, still routable. */
function PostJob() {
  return <PostJobForm endpoint="/api/institute/jobs"
                      postedNote="Your students and matching job seekers will be alerted automatically." />;
}
