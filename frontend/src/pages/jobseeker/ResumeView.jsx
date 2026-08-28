/**
 * Resume renderer — 20 print-ready templates built from 9 layout archetypes
 * × 4 accent schemes. Driven by TEMPLATE_META from the API, so adding a
 * template is a config change, not a new component.
 */

/* ---------------- accent schemes ---------------- */
const ACCENTS = {
  navy:   { bar: "bg-navy",   text: "text-navy",   bgSoft: "bg-navy-50",   chip: "bg-navy-50 text-navy",
            panel: "bg-navy", panelText: "text-white", panelMuted: "text-navy-100", rule: "border-navy" },
  green:  { bar: "bg-brandgreen", text: "text-brandgreen-600", bgSoft: "bg-brandgreen-50", chip: "bg-brandgreen-50 text-brandgreen-600",
            panel: "bg-brandgreen-600", panelText: "text-white", panelMuted: "text-white/75", rule: "border-brandgreen" },
  slate:  { bar: "bg-slate-700", text: "text-slate-700", bgSoft: "bg-slate-100", chip: "bg-slate-100 text-slate-600",
            panel: "bg-slate-800", panelText: "text-white", panelMuted: "text-slate-300", rule: "border-slate-700" },
  cobalt: { bar: "bg-blue-700", text: "text-blue-700", bgSoft: "bg-blue-50", chip: "bg-blue-50 text-blue-700",
            panel: "bg-blue-800", panelText: "text-white", panelMuted: "text-blue-100", rule: "border-blue-700" },
};
const acc = (k) => ACCENTS[k] || ACCENTS.navy;

/* ---------------- helpers ---------------- */
const fullName = (s) => `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.email || "Your Name";
const initials = (s) => {
  const n = fullName(s).split(" ").filter(Boolean);
  return ((n[0]?.[0] || "") + (n[1]?.[0] || "")).toUpperCase() || "H";
};
const headline = (s) => {
  if (s.headline) return s.headline;
  const e = (s.education || [])[0];
  const deg = [e?.degree, e?.branch].filter(Boolean).join(" · ");
  return deg || (s.key_skills || []).slice(0, 3).join(" · ") || "Job Seeker";
};
const contacts = (s) => [s.email, s.phone, s.location].filter(Boolean);
const has = (a) => Array.isArray(a) && a.length > 0;
const isWorker = (s) => (s.profile_type || "professional") === "worker";

function Sheet({ children, className = "" }) {
  return (
    <div className="printable mx-auto w-full max-w-[820px] overflow-hidden rounded-lg bg-white shadow-cardhover ring-1 ring-slate-200 print:rounded-none print:shadow-none print:ring-0">
      <div className={`min-h-[1000px] ${className}`}>{children}</div>
    </div>
  );
}
const Muted = ({ children }) => <p className="text-[13px] italic text-slate-300">{children}</p>;

function Chips({ items, cls }) {
  if (!has(items)) return <Muted>Not added yet.</Muted>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((k) => <span key={k} className={`rounded px-2 py-0.5 text-[11px] font-medium ${cls}`}>{k}</span>)}
    </div>
  );
}

function EduRows({ list, serif }) {
  if (!has(list)) return <Muted>No education added yet.</Muted>;
  return (
    <div className="space-y-2.5">
      {list.map((e, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4">
          <div>
            <p className={`text-[13.5px] font-semibold text-slate-800 ${serif ? "font-serif" : ""}`}>
              {[e.degree, e.branch].filter(Boolean).join(" — ") || "Qualification"}
            </p>
            <p className="text-[12.5px] text-slate-500">{[e.institute, e.location].filter(Boolean).join(", ")}</p>
          </div>
          <div className="shrink-0 text-right">
            {e.year_of_passing && <p className="text-[12px] font-medium text-slate-600">{e.year_of_passing}</p>}
            {e.percentage && <p className="text-[11.5px] text-slate-400">{e.percentage}%</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExpRows({ list }) {
  if (!has(list)) return <Muted>No work experience added yet.</Muted>;
  return (
    <div className="space-y-3">
      {list.map((x, i) => (
        <div key={i}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13.5px] font-semibold text-slate-800">{x.role || "Role"}</p>
            {x.years && <span className="text-[11.5px] text-slate-500">{x.years}</span>}
          </div>
          <p className="text-[12.5px] text-slate-500">{x.company}</p>
          {x.description && <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600">{x.description}</p>}
        </div>
      ))}
    </div>
  );
}

function ProjectRows({ list }) {
  if (!has(list)) return null;
  return (
    <div className="space-y-3">
      {list.map((p, i) => (
        <div key={i}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13.5px] font-semibold text-slate-800">{p.title || "Project"}</p>
            {p.tech && <span className="text-[11.5px] text-slate-500">{p.tech}</span>}
          </div>
          {p.description && <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-600">{p.description}</p>}
          {p.link && <p className="text-[11.5px] text-slate-400">{p.link}</p>}
        </div>
      ))}
    </div>
  );
}

function Timeline({ list, a, render }) {
  if (!has(list)) return <Muted>Nothing added yet.</Muted>;
  return (
    <div className="relative space-y-4 border-l border-slate-200 pl-5">
      {list.map((x, i) => (
        <div key={i} className="relative">
          <span className={`absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ${a.bar}`} />
          {render(x)}
        </div>
      ))}
    </div>
  );
}

/* Sections in the right order for the profile type (item 1). */
function sections(s) {
  if (isWorker(s)) {
    return [
      { key: "experience", title: "Work Experience", node: <ExpRows list={s.experience} /> },
      { key: "skills", title: "Trade Skills" },
      { key: "availability", title: "Availability", node: (
          <p className="text-[13px] text-slate-700">
            {[s.availability && `Available: ${s.availability}`, s.notice_period && `Notice: ${s.notice_period}`,
              s.expected_salary && `Expected pay: ${s.expected_salary}`].filter(Boolean).join("  •  ") || "—"}
          </p>) },
      { key: "education", title: "Education", node: <EduRows list={s.education} /> },
      { key: "languages", title: "Languages", show: has(s.languages) },
      { key: "additional", title: "Additional Information", show: !!s.additional_info },
    ];
  }
  return [
    { key: "objective", title: "Profile", show: !!s.career_objective },
    { key: "experience", title: "Work Experience", node: <ExpRows list={s.experience} />, show: has(s.experience) },
    { key: "education", title: "Education", node: <EduRows list={s.education} /> },
    { key: "projects", title: "Projects", node: <ProjectRows list={s.projects} />, show: has(s.projects) },
    { key: "skills", title: "Key Skills" },
    { key: "certifications", title: "Certifications", show: has(s.certifications) },
    { key: "achievements", title: "Achievements", show: has(s.achievements) },
    { key: "languages", title: "Languages", show: has(s.languages) },
    { key: "additional", title: "Additional Information", show: !!s.additional_info },
  ];
}

function sectionBody(s, key, a) {
  switch (key) {
    case "objective": return <p className="text-[13px] leading-relaxed text-slate-600">{s.career_objective}</p>;
    case "skills": return <Chips items={s.key_skills} cls={a.chip} />;
    case "certifications": return <Chips items={s.certifications} cls={a.chip} />;
    case "achievements": return <ul className="space-y-1">{(s.achievements || []).map((x, i) => <li key={i} className="text-[13px] text-slate-600">• {x}</li>)}</ul>;
    case "languages": return <Chips items={s.languages} cls="bg-slate-100 text-slate-600" />;
    case "additional": return <p className="text-[13px] leading-relaxed text-slate-600">{s.additional_info}</p>;
    default: return null;
  }
}

function renderSections(s, a, H, exclude = []) {
  return sections(s)
    .filter((sec) => sec.show !== false && !exclude.includes(sec.key))
    .map((sec) => (
    <section key={sec.key} className="mt-5 first:mt-0">
      <H>{sec.title}</H>
      {sec.node || sectionBody(s, sec.key, a)}
    </section>
  ));
}

/* ---------------- layout archetypes ---------------- */
function LayoutSingle({ s, a, serif }) {
  const H = ({ children }) => (
    <h3 className={`mb-2 border-b pb-1 text-[12px] font-bold uppercase tracking-[0.14em] ${a.text} ${a.rule} ${serif ? "font-serif" : ""}`}>{children}</h3>
  );
  return (
    <Sheet className="px-12 py-10">
      <header className={`border-b-2 pb-4 text-center ${a.rule}`}>
        <h1 className={`text-[30px] font-bold tracking-wide text-slate-900 ${serif ? "font-serif" : ""}`}>{fullName(s)}</h1>
        <p className={`mt-1 text-[13px] ${serif ? "font-serif italic" : ""} text-slate-600`}>{headline(s)}</p>
        <p className="mt-2 text-[12px] text-slate-600">{contacts(s).join("  •  ")}</p>
      </header>
      <div className="mt-5">{renderSections(s, a, H)}</div>
    </Sheet>
  );
}

function LayoutSidebar({ s, a, right }) {
  const SideH = ({ children }) => <h3 className={`mb-2 text-[10.5px] font-bold uppercase tracking-[0.16em] ${a.panelMuted}`}>{children}</h3>;
  const MainH = ({ children }) => (
    <h3 className={`mb-2.5 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] ${a.text}`}>
      <span className={`h-4 w-1 rounded ${a.bar}`} />{children}
    </h3>
  );
  const side = (
    <aside className={`px-7 py-9 ${a.panel} ${a.panelText}`}>
      {s.profile_picture_url
        ? <img src={s.profile_picture_url} alt="" className="mb-5 h-20 w-20 rounded-full object-cover ring-2 ring-white/25" />
        : <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-xl font-bold ring-2 ring-white/20">{initials(s)}</div>}
      <h1 className="text-[21px] font-extrabold leading-tight">{fullName(s)}</h1>
      <p className={`mt-1 text-[12px] ${a.panelMuted}`}>{headline(s)}</p>
      <div className="mt-7 space-y-5">
        <div><SideH>Contact</SideH>
          <ul className={`space-y-1.5 text-[12px] ${a.panelMuted}`}>
            {s.email && <li className="break-all">{s.email}</li>}
            {s.phone && <li>{s.phone}</li>}
            {s.location && <li>{s.location}</li>}
            {s.linkedin_url && <li className="break-all">{s.linkedin_url}</li>}
          </ul>
        </div>
        <div><SideH>{isWorker(s) ? "Trade Skills" : "Skills"}</SideH><Chips items={s.key_skills} cls="bg-white/15 text-white" /></div>
        {has(s.languages) && <div><SideH>Languages</SideH><Chips items={s.languages} cls="bg-white/15 text-white" /></div>}
        {has(s.certifications) && <div><SideH>Certifications</SideH>
          <ul className={`space-y-1 text-[12px] ${a.panelMuted}`}>{s.certifications.map((c) => <li key={c}>{c}</li>)}</ul></div>}
        {(s.availability || s.expected_salary) && (
          <div><SideH>Availability</SideH>
            <p className={`text-[12px] ${a.panelMuted}`}>{[s.availability, s.expected_salary].filter(Boolean).join(" · ")}</p></div>
        )}
      </div>
    </aside>
  );
  const main = (
    <main className="px-8 py-9">
      {renderSections(s, a, MainH, ["skills", "languages", "certifications"])}
    </main>
  );
  return (
    <Sheet>
      <div className={`grid ${right ? "grid-cols-[1fr_255px]" : "grid-cols-[255px_1fr]"}`}>
        {right ? <>{main}{side}</> : <>{side}{main}</>}
      </div>
    </Sheet>
  );
}

function LayoutBand({ s, a }) {
  const H = ({ children }) => (
    <h3 className={`mb-2.5 border-b-2 pb-1 text-[11.5px] font-bold uppercase tracking-[0.14em] ${a.text} ${a.rule}`}>{children}</h3>
  );
  const secs = sections(s).filter((x) => x.show !== false);
  const leftKeys = ["objective", "experience", "education", "projects", "additional"];
  return (
    <Sheet>
      <header className={`px-10 py-8 ${a.panel} ${a.panelText}`}>
        <div className="flex items-end justify-between gap-6">
          <div className="flex items-center gap-4">
            {s.profile_picture_url && <img src={s.profile_picture_url} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-white/25" />}
            <div>
              <h1 className="text-[28px] font-extrabold leading-tight">{fullName(s)}</h1>
              <p className={`mt-1 text-[13px] ${a.panelMuted}`}>{headline(s)}</p>
            </div>
          </div>
          <ul className={`shrink-0 space-y-0.5 text-right text-[11.5px] ${a.panelMuted}`}>
            {contacts(s).map((c) => <li key={c} className="break-all">{c}</li>)}
          </ul>
        </div>
      </header>
      <div className="grid grid-cols-[1.55fr_1fr] gap-8 px-10 py-8">
        <div>{secs.filter((x) => leftKeys.includes(x.key)).map((sec) => (
          <section key={sec.key} className="mb-6"><H>{sec.title}</H>{sec.node || sectionBody(s, sec.key, a)}</section>))}</div>
        <div>{secs.filter((x) => !leftKeys.includes(x.key)).map((sec) => (
          <section key={sec.key} className="mb-6"><H>{sec.title}</H>{sec.node || sectionBody(s, sec.key, a)}</section>))}</div>
      </div>
    </Sheet>
  );
}

function LayoutMonogram({ s, a, serif = true }) {
  const H = ({ children }) => (
    <h3 className={`mb-3 text-[13px] font-bold uppercase tracking-[0.18em] text-slate-800 ${serif ? "font-serif" : ""}`}>
      {children}<span className={`mt-1.5 block h-[3px] w-10 ${a.bar}`} />
    </h3>
  );
  return (
    <Sheet className="px-11 py-10">
      <header className="flex items-center gap-6 border-b border-slate-200 pb-6">
        {s.profile_picture_url
          ? <img src={s.profile_picture_url} alt="" className="h-20 w-20 shrink-0 rounded-full object-cover" />
          : <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full ${a.bar} text-2xl font-extrabold text-white`}>{initials(s)}</div>}
        <div className="min-w-0">
          <h1 className={`text-[30px] font-bold leading-tight text-slate-900 ${serif ? "font-serif" : ""}`}>{fullName(s)}</h1>
          <p className={`text-[13.5px] font-medium ${a.text}`}>{headline(s)}</p>
          <p className="mt-1.5 text-[12px] text-slate-500">{contacts(s).join("  |  ")}</p>
        </div>
      </header>
      <div className="mt-6">{renderSections(s, a, H)}</div>
    </Sheet>
  );
}

function LayoutMinimal({ s, a }) {
  const Row = ({ title, children }) => (
    <section className="grid grid-cols-[135px_1fr] gap-6 border-t border-slate-100 py-5 first:border-0">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">{title}</h3>
      <div>{children}</div>
    </section>
  );
  return (
    <Sheet className="px-12 py-14">
      <header className="pb-8">
        <h1 className="text-[34px] font-light tracking-tight text-slate-900">{fullName(s)}</h1>
        <p className="mt-1 text-[13px] tracking-wide text-slate-400">{headline(s)}</p>
      </header>
      <Row title="Contact">
        <ul className="space-y-0.5 text-[13px] text-slate-600">{contacts(s).map((c) => <li key={c}>{c}</li>)}</ul>
      </Row>
      {sections(s).filter((x) => x.show !== false).map((sec) => (
        <Row key={sec.key} title={sec.title}>{sec.node || sectionBody(s, sec.key, a)}</Row>
      ))}
    </Sheet>
  );
}

function LayoutCompact({ s, a }) {
  const H = ({ children }) => (
    <h3 className={`mb-1.5 ${a.bgSoft} px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${a.text}`}>{children}</h3>
  );
  const secs = sections(s).filter((x) => x.show !== false);
  return (
    <Sheet className="px-9 py-8">
      <header className={`flex items-start justify-between gap-6 border-b-2 pb-3 ${a.rule}`}>
        <div>
          <h1 className={`text-[23px] font-extrabold leading-tight ${a.text}`}>{fullName(s)}</h1>
          <p className="text-[12px] text-slate-500">{headline(s)}</p>
        </div>
        <ul className="shrink-0 space-y-0.5 text-right text-[11px] text-slate-500">
          {contacts(s).map((c) => <li key={c} className="break-all">{c}</li>)}
        </ul>
      </header>
      <div className="mt-4 grid grid-cols-2 gap-x-7 gap-y-4">
        {secs.map((sec, i) => (
          <section key={sec.key} className={["experience", "education", "projects", "additional"].includes(sec.key) ? "col-span-2" : ""}>
            <H>{sec.title}</H>{sec.node || sectionBody(s, sec.key, a)}
          </section>
        ))}
      </div>
    </Sheet>
  );
}

function LayoutTimeline({ s, a }) {
  const H = ({ children }) => (
    <h3 className={`mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] ${a.text}`}>
      <span className={`h-4 w-1 rounded ${a.bar}`} />{children}
    </h3>
  );
  return (
    <Sheet className="px-11 py-10">
      <header className={`mb-7 flex items-center justify-between gap-6 border-b-2 pb-5 ${a.rule}`}>
        <div>
          <h1 className="text-[28px] font-extrabold leading-tight text-slate-900">{fullName(s)}</h1>
          <p className={`text-[13px] font-medium ${a.text}`}>{headline(s)}</p>
        </div>
        <ul className="shrink-0 space-y-0.5 text-right text-[11.5px] text-slate-500">
          {contacts(s).map((c) => <li key={c} className="break-all">{c}</li>)}
        </ul>
      </header>
      {s.career_objective && <section className="mb-6"><H>Profile</H>
        <p className="text-[13px] leading-relaxed text-slate-600">{s.career_objective}</p></section>}
      {has(s.experience) && (
        <section className="mb-6"><H>Career</H>
          <Timeline list={s.experience} a={a} render={(x) => (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13.5px] font-semibold text-slate-800">{x.role || "Role"}</p>
                {x.years && <span className="text-[11.5px] text-slate-500">{x.years}</span>}
              </div>
              <p className="text-[12.5px] text-slate-500">{x.company}</p>
              {x.description && <p className="mt-0.5 text-[12.5px] text-slate-600">{x.description}</p>}
            </>)} />
        </section>
      )}
      <section className="mb-6"><H>Education</H>
        <Timeline list={s.education} a={a} render={(e) => (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[13.5px] font-semibold text-slate-800">{[e.degree, e.branch].filter(Boolean).join(" — ")}</p>
              {e.year_of_passing && <span className="text-[11.5px] text-slate-500">{e.year_of_passing}</span>}
            </div>
            <p className="text-[12.5px] text-slate-500">{e.institute}</p>
          </>)} />
      </section>
      {has(s.projects) && <section className="mb-6"><H>Projects</H><ProjectRows list={s.projects} /></section>}
      <section className="mb-6"><H>Skills</H><Chips items={s.key_skills} cls={a.chip} /></section>
      {s.additional_info && <section><H>Additional Information</H>
        <p className="text-[13px] leading-relaxed text-slate-600">{s.additional_info}</p></section>}
    </Sheet>
  );
}

function LayoutSplit({ s, a }) {
  const H = ({ children }) => (
    <h3 className={`mb-2 text-center text-[11px] font-bold uppercase tracking-[0.16em] ${a.text}`}>{children}</h3>
  );
  const secs = sections(s).filter((x) => x.show !== false);
  const mid = Math.ceil(secs.length / 2);
  return (
    <Sheet className="px-10 py-10">
      <header className={`mb-7 border-b-2 pb-5 text-center ${a.rule}`}>
        {s.profile_picture_url && <img src={s.profile_picture_url} alt="" className="mx-auto mb-3 h-20 w-20 rounded-full object-cover" />}
        <h1 className="text-[30px] font-extrabold text-slate-900">{fullName(s)}</h1>
        <p className={`text-[13px] font-medium ${a.text}`}>{headline(s)}</p>
        <p className="mt-1.5 text-[12px] text-slate-500">{contacts(s).join("  •  ")}</p>
      </header>
      <div className="grid grid-cols-2 gap-8">
        <div>{secs.slice(0, mid).map((sec) => <section key={sec.key} className="mb-5"><H>{sec.title}</H>{sec.node || sectionBody(s, sec.key, a)}</section>)}</div>
        <div>{secs.slice(mid).map((sec) => <section key={sec.key} className="mb-5"><H>{sec.title}</H>{sec.node || sectionBody(s, sec.key, a)}</section>)}</div>
      </div>
    </Sheet>
  );
}

/* Purpose-built for skilled / worker profiles: work + trade skills + availability first. */
function LayoutTrades({ s, a }) {
  const H = ({ children }) => (
    <h3 className={`mb-2 rounded px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${a.bgSoft} ${a.text}`}>{children}</h3>
  );
  return (
    <Sheet className="px-10 py-9">
      <header className={`mb-6 flex items-center gap-5 rounded-xl p-5 ${a.panel} ${a.panelText}`}>
        {s.profile_picture_url
          ? <img src={s.profile_picture_url} alt="" className="h-20 w-20 rounded-lg object-cover ring-2 ring-white/25" />
          : <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-white/15 text-2xl font-extrabold">{initials(s)}</div>}
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-extrabold leading-tight">{fullName(s)}</h1>
          <p className={`text-[13px] ${a.panelMuted}`}>{headline(s)}</p>
          <p className={`mt-1.5 text-[12px] ${a.panelMuted}`}>{contacts(s).join("  •  ")}</p>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <InfoBox label="Experience" value={s.total_experience || "—"} a={a} />
        <InfoBox label="Available" value={s.availability || "—"} a={a} />
        <InfoBox label="Expected pay" value={s.expected_salary || "—"} a={a} />
      </div>

      <section className="mt-6"><H>Trade Skills</H><Chips items={s.key_skills} cls={a.chip} /></section>
      <section className="mt-5"><H>Work Experience</H><ExpRows list={s.experience} /></section>
      {has(s.certifications) && <section className="mt-5"><H>Certificates & Licences</H><Chips items={s.certifications} cls={a.chip} /></section>}
      <section className="mt-5"><H>Education</H><EduRows list={s.education} /></section>
      {has(s.languages) && <section className="mt-5"><H>Languages</H><Chips items={s.languages} cls="bg-slate-100 text-slate-600" /></section>}
      {s.additional_info && <section className="mt-5"><H>Additional Information</H>
        <p className="text-[13px] leading-relaxed text-slate-600">{s.additional_info}</p></section>}
    </Sheet>
  );
}
function InfoBox({ label, value, a }) {
  return (
    <div className={`rounded-lg border border-slate-200 p-3 text-center`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-[13px] font-semibold ${a.text}`}>{value}</p>
    </div>
  );
}

/* ---------------- dispatcher ---------------- */
const LAYOUTS = {
  single: (p) => <LayoutSingle {...p} serif={p.tpl === "classic"} />,
  sidebar: (p) => <LayoutSidebar {...p} />,
  "sidebar-r": (p) => <LayoutSidebar {...p} right />,
  band: (p) => <LayoutBand {...p} />,
  monogram: (p) => <LayoutMonogram {...p} serif />,
  minimal: (p) => <LayoutMinimal {...p} />,
  compact: (p) => <LayoutCompact {...p} />,
  timeline: (p) => <LayoutTimeline {...p} />,
  split: (p) => <LayoutSplit {...p} />,
  trades: (p) => <LayoutTrades {...p} />,
};

/**
 * @param seeker  resume data
 * @param template  template key
 * @param meta  TEMPLATE_META entry from the API ({layout, accent}); falls back sensibly
 */
export default function ResumeView({ seeker, template, meta }) {
  const tpl = template || seeker.resume_template || "classic";
  const layout = meta?.layout || "single";
  const a = acc(meta?.accent || "navy");
  const render = LAYOUTS[layout] || LAYOUTS.single;
  return render({ s: seeker, a, tpl });
}
