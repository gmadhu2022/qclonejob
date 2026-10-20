import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { IconUser, IconBriefcase, IconCheck, IconSparkle, IconSearch,
         IconShield, IconTrend, IconLayers } from "../components/icons";

/**
 * About us.
 *
 * NOT built on StaticPage. That wrapper is an auth card — max-w-md, one
 * bordered box — which is right for a two-line privacy notice and wrong for
 * nine sections: the text would run at roughly forty characters a line for
 * three screens, which nobody reads.
 *
 * The richness here is typographic, not decorative: a wide display size for
 * the lede, a measured ~68-character column for body copy, and a clear step
 * between section headings and prose. No new colours and no new fonts — the
 * existing navy/brandgreen palette and Inter, used with more contrast.
 */
export default function About() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* ---------------- Lede ---------------- */}
      <section className="relative overflow-hidden border-b border-slate-100">
        <div className="absolute inset-0 bg-gradient-to-b from-navy-50/70 to-white" />
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center">
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-[52px]">
            Connecting Talent<br className="hidden sm:block" /> with Opportunities
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-slate-700">
            Welcome to <b className="font-semibold text-navy">QCloneJob</b>, your trusted platform
            for connecting job seekers with the right career opportunities and helping employers
            find the right talent.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-[17px] leading-relaxed text-slate-700">
            Our mission is to simplify the recruitment process by bringing job seekers and
            employers together on a single, easy-to-use platform. We aim to make job searching
            easier, faster, and more accessible for everyone.
          </p>
        </div>
      </section>

      {/* ---------------- Who we are ---------------- */}
      <Section eyebrow="Who we are" title="An online employment platform">
        <p>
          QCloneJob is an online employment platform designed to bridge the gap between job
          seekers and recruiters. We provide a convenient platform where candidates can explore
          job opportunities, showcase their skills, and take the next step in their professional
          journey.
        </p>
        <p>
          At the same time, we help employers and organizations connect with qualified candidates,
          streamline recruitment activities, and identify talent that matches their business
          requirements.
        </p>
      </Section>

      {/* ---------------- Mission / Vision ---------------- */}
      <section className="border-y border-slate-100 bg-slate-50/60 py-16">
        <div className="mx-auto grid max-w-5xl gap-5 px-6 md:grid-cols-2">
          <Pillar icon={IconTrend} title="Our Mission">
            To empower individuals to achieve their career goals while helping organizations build
            successful teams through efficient and accessible recruitment solutions.
          </Pillar>
          <Pillar icon={IconSparkle} title="Our Vision">
            To become a trusted employment platform that connects talent with opportunities and
            contributes to professional growth and organizational success.
          </Pillar>
        </div>
      </section>

      {/* ---------------- What we offer ---------------- */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <Eyebrow>What we offer</Eyebrow>
        <h2 className="mt-2 text-[28px] font-extrabold tracking-tight text-slate-900">
          Built for both sides of the hire
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2 stagger">
          <OfferCard icon={IconUser} title="For Job Seekers" items={[
            "Explore job opportunities across multiple industries and locations",
            "Create and manage professional profiles",
            "Upload resumes and highlight skills, qualifications, and experience",
            "Discover opportunities that match career goals",
            "Apply for suitable positions and track career opportunities",
          ]} />
          <OfferCard icon={IconBriefcase} title="For Employers and Recruiters" items={[
            "Post job openings and reach potential candidates",
            "Search for candidates based on skills, qualifications, and experience",
            "Manage job applications and recruitment activities",
            "Connect with suitable talent for current and future hiring needs",
            "Improve the efficiency of the recruitment process",
          ]} />
        </div>
      </section>

      {/* ---------------- Core values ---------------- */}
      <section className="border-t border-slate-100 bg-slate-50/60 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <Eyebrow>Our core values</Eyebrow>
          <h2 className="mt-2 text-[28px] font-extrabold tracking-tight text-slate-900">
            What we hold ourselves to
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger">
            {[
              [IconShield, "Trust and Transparency",
               "We aim to create a reliable platform that supports transparent interactions between job seekers and employers."],
              [IconSearch, "Accessibility",
               "We strive to make career opportunities accessible to candidates from diverse professional backgrounds."],
              [IconSparkle, "Innovation",
               "We continuously seek ways to improve the job search and recruitment experience through technology."],
              [IconTrend, "Growth",
               "We support career development for individuals and talent acquisition for organizations."],
              [IconLayers, "Commitment",
               "We are dedicated to providing a user-friendly experience that meets the needs of both candidates and employers."],
            ].map(([Icon, title, body]) => (
              <div key={title}
                   className="rounded-xl border border-slate-200 bg-white p-5 zoom hover:border-navy-200">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy">
                  <Icon size={17} />
                </span>
                <h3 className="mt-3 font-bold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Close ---------------- */}
      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="text-[26px] font-extrabold tracking-tight text-slate-900">
          Ready to take the next step?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-slate-700">
          Whether you're looking for your next role or your next hire, it takes about a minute
          to get started.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/register" className="btn !px-8">Register for free</Link>
          <Link to="/login" className="btn-outline !px-8">Login</Link>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        <Link to="/" className="font-medium text-navy hover:underline">← Back to home</Link>
      </footer>
    </div>
  );
}

/* ---------- Small building blocks, all at module scope ----------
   Declaring a component inside another creates a new type on every render,
   which makes React throw the subtree away instead of updating it. Cheap to
   avoid, expensive to debug. */

function Eyebrow({ children }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-brandgreen-600">
      {children}
    </span>
  );
}

function Section({ eyebrow, title, children }) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-2 text-[28px] font-extrabold tracking-tight text-slate-900">{title}</h2>
      {/* ~68 characters per line. Wider than this and the eye loses the start
          of the next line; narrower and long paragraphs turn into a column of
          fragments. */}
      <div className="mt-5 space-y-4 text-[16px] leading-[1.75] text-slate-700">{children}</div>
    </section>
  );
}

function Pillar({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-card zoom hover:border-navy-200">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brandgreen-50 text-brandgreen-600">
        <Icon size={20} />
      </span>
      <h3 className="mt-4 text-xl font-extrabold tracking-tight text-slate-900">{title}</h3>
      <p className="mt-2.5 text-[15px] leading-relaxed text-slate-700">{children}</p>
    </div>
  );
}

function OfferCard({ icon: Icon, title, items }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-card zoom hover:border-navy-200">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy">
          <Icon size={18} />
        </span>
        <h3 className="text-lg font-extrabold tracking-tight text-slate-900">{title}</h3>
      </div>
      <ul className="mt-5 space-y-3">
        {items.map((t) => (
          <li key={t} className="flex items-start gap-3 text-[15px] leading-relaxed text-slate-700">
            <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full
                             bg-brandgreen text-white">
              <IconCheck size={10} />
            </span>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
