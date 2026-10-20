import { Link, NavLink } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import { IconCheck, IconSparkle, IconBriefcase, IconSearch } from "../components/icons";

/**
 * The three Services pages: Promotions, Recruitment Services, Job Search.
 *
 * One module, not three files, because they are the same page with different
 * copy — same shell, same section rhythm, same sub-navigation. Split across
 * three files, the shared layout would have been copied three times and the
 * copies would drift the first time one of them was edited.
 *
 * These are long documents, so the layout does the work prose can't: numbered
 * service cards you can scan for "number 6", a measured ~68-character column
 * for body text, and a sub-nav that makes the other two services reachable
 * without going back to the header menu.
 *
 * No new colours or fonts — the existing navy/brandgreen palette and Inter,
 * used with more typographic contrast.
 */

const TABS = [
  { to: "/services/promotions",  label: "Promotions" },
  { to: "/services/recruitment", label: "Recruitment Services" },
  { to: "/services/job-search",  label: "Job Search" },
];

/* ---------------- shared shell ---------------- */

function ServiceShell({ title, lede, children, cta }) {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader sub={
        /* The three services as a second row. Someone comparing them should
           not have to reopen the Services menu for each one. */
        <div className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6 py-2">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to}
                       className={({ isActive }) =>
                         `whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors
                          ${isActive ? "bg-white text-navy shadow-card"
                                     : "text-slate-600 hover:text-navy"}`}>
                {t.label}
              </NavLink>
            ))}
          </div>
        </div>
      } />

      <section className="relative overflow-hidden border-b border-slate-100">
        <div className="absolute inset-0 bg-gradient-to-b from-navy-50/70 to-white" />
        <div className="relative mx-auto max-w-4xl px-6 py-16 text-center">
          <h1 className="text-[34px] font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-[44px]">
            {title}
          </h1>
          {lede.map((p, i) => (
            <p key={i} className="mx-auto mt-5 max-w-2xl text-[16px] leading-[1.75] text-slate-700">
              {p}
            </p>
          ))}
        </div>
      </section>

      {children}

      <section className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="text-[26px] font-extrabold tracking-tight text-slate-900">{cta.title}</h2>
        {cta.body.map((p, i) => (
          <p key={i} className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-slate-700">{p}</p>
        ))}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/register" className="btn !px-8">{cta.primary}</Link>
          <Link to="/contact" className="btn-outline !px-8">Contact us</Link>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
        <Link to="/" className="font-medium text-navy hover:underline">← Back to home</Link>
      </footer>
    </div>
  );
}

function Eyebrow({ children }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-brandgreen-600">
      {children}
    </span>
  );
}

function Band({ eyebrow, title, intro, tinted, children, narrow }) {
  return (
    <section className={tinted ? "border-y border-slate-100 bg-slate-50/60 py-16" : "py-16"}>
      <div className={`mx-auto px-6 ${narrow ? "max-w-3xl" : "max-w-5xl"}`}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-2 text-[28px] font-extrabold tracking-tight text-slate-900">{title}</h2>
        {intro && (
          <p className="mt-4 max-w-2xl text-[16px] leading-[1.75] text-slate-700">{intro}</p>
        )}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

/* Numbered, because the source copy numbers them and people refer to "service
   number 6" when they call. The number is the anchor, so it leads. */
function NumberedGrid({ items }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 stagger">
      {items.map(([title, body], i) => (
        <div key={title}
             className="rounded-xl border border-slate-200 bg-white p-5 zoom hover:border-navy-200">
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg
                             bg-navy text-[12px] font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TickList({ items, columns = 2 }) {
  return (
    <ul className={`grid gap-x-8 gap-y-3 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
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
  );
}

/* A numbered process reads as a sequence, so it gets a connecting rule down
   the left rather than six separate cards. */
function Steps({ items }) {
  return (
    <ol className="relative space-y-6 border-l-2 border-slate-100 pl-7">
      {items.map(([title, body], i) => (
        <li key={title} className="relative">
          <span className="absolute -left-[38px] flex h-7 w-7 items-center justify-center
                           rounded-full border-2 border-white bg-navy text-[12px] font-bold text-white">
            {i + 1}
          </span>
          <h3 className="font-bold text-slate-900">{title}</h3>
          <p className="mt-1 text-[15px] leading-relaxed text-slate-700">{body}</p>
        </li>
      ))}
    </ol>
  );
}

function Tier({ icon: Icon, name, body }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card zoom hover:border-navy-200">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brandgreen-50 text-brandgreen-600">
        <Icon size={18} />
      </span>
      <h3 className="mt-4 text-lg font-extrabold tracking-tight text-slate-900">{name}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{body}</p>
    </div>
  );
}

/* =====================================================================
   1. PROMOTIONS
   ===================================================================== */
export function Promotions() {
  return (
    <ServiceShell
      title="Promote Your Business. Reach the Right Audience."
      lede={[
        "Welcome to our Commercial Promotion Services, designed to help businesses increase their visibility, promote their services, and connect with a relevant audience through our job portal.",
        "We provide promotional opportunities for companies, recruitment agencies, educational institutions, training providers, and service organizations looking to showcase their offerings to job seekers, employers, and working professionals.",
        "Our platform helps businesses strengthen their online presence, improve brand awareness, and generate potential business opportunities.",
      ]}
      cta={{
        title: "Partner With Us",
        body: [
          "Give your business greater visibility and connect with an audience that matters to your growth.",
          "Whether you want to promote your company, advertise professional services, showcase training programs, or build brand awareness, our Commercial Promotion Services can help you explore new marketing opportunities.",
        ],
        primary: "Get started",
      }}>

      <Band eyebrow="What we offer" title="Our Promotional Services">
        <NumberedGrid items={[
          ["Banner Advertising", "Promote your brand through advertising banners displayed in selected sections of our website. Increase brand visibility and attract the attention of relevant visitors."],
          ["Featured Company Promotion", "Highlight your company profile, services, and business offerings through featured placements on our platform."],
          ["Recruitment Agency Promotion", "Help recruitment agencies showcase their services, hiring expertise, industry specialization, and recruitment opportunities to a wider audience."],
          ["Training and Certification Promotion", "Promote professional training programs, technical courses, certification programs, skill development initiatives, and career-oriented learning opportunities."],
          ["Employer Branding", "Enable organizations to strengthen their employer brand by showcasing company information, workplace culture, career opportunities, and professional growth prospects."],
          ["Sponsored Content", "Promote business announcements, industry updates, educational resources, and career-related content through designated sponsored content sections."],
          ["Email and Newsletter Promotions", "Reach registered users through promotional email campaigns and newsletters, subject to user consent and applicable communication policies."],
          ["Special Promotional Campaigns", "Create customized promotional campaigns based on your business objectives, target audience, campaign duration, and budget."],
        ]} />
      </Band>

      <Band tinted eyebrow="Who it's for" title="Who Can Advertise With Us?"
            intro="Our commercial promotion services are suitable for:">
        <TickList items={[
          "Corporate companies and businesses",
          "Recruitment and staffing agencies",
          "IT companies and technology service providers",
          "Training institutes and certification providers",
          "Colleges and educational institutions",
          "Freelance and consulting service providers",
          "HR technology and recruitment solution companies",
          "Professional development and career coaching organizations",
        ]} />
      </Band>

      <Band eyebrow="The case for it" title="Why Promote Your Business With Us?">
        <TickList items={[
          "Reach an audience interested in employment and professional development.",
          "Improve brand visibility among job seekers and employers.",
          "Showcase your products, services, and business solutions.",
          "Generate relevant inquiries and potential business leads.",
          "Select promotional options according to your marketing objectives.",
          "Explore flexible advertising packages for different business requirements.",
        ]} />
      </Band>

      <Band tinted eyebrow="Packages" title="Advertising Packages"
            intro="We offer flexible promotional opportunities to suit different marketing needs.">
        <div className="grid gap-5 md:grid-cols-3 stagger">
          <Tier icon={IconSearch} name="Basic Promotion"
                body="Entry-level promotional options for businesses looking to establish their presence on our platform." />
          <Tier icon={IconBriefcase} name="Standard Promotion"
                body="Enhanced visibility through selected advertising placements and promotional features." />
          <Tier icon={IconSparkle} name="Premium Promotion"
                body="Expanded promotional opportunities through premium placements and customized campaigns." />
        </div>
        {/* Kept as prose, not a footnote in grey 11px: it is the answer to the
            first question every advertiser asks, and burying it reads evasive. */}
        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-slate-700">
          Specific features, campaign duration, pricing, and availability will be provided based
          on the selected package.
        </p>
      </Band>
    </ServiceShell>
  );
}

/* =====================================================================
   2. RECRUITMENT SERVICES
   ===================================================================== */
export function RecruitmentServices() {
  return (
    <ServiceShell
      title="Connecting Employers with the Right Talent"
      lede={[
        "At QCloneJob, we help organizations connect with suitable candidates through our recruitment services. Our platform enables employers to publish job openings, reach potential candidates, identify relevant talent, and simplify their hiring process.",
        "Whether you are a startup, a growing business, or an established organization, our recruitment solutions are designed to support your hiring requirements across different industries, experience levels, and job functions.",
        "Our goal is to bridge the gap between employers and job seekers by making recruitment more accessible, efficient, and convenient.",
      ]}
      cta={{
        title: "Partner With Us",
        body: [
          "Let us help you connect with candidates who match your organization's recruitment needs.",
          "Register as an employer, publish your vacancies, and explore our recruitment services to support your hiring objectives.",
        ],
        primary: "Register as an employer",
      }}>

      <Band eyebrow="What we offer" title="Our Recruitment Services">
        <NumberedGrid items={[
          ["Job Posting Services", "Publish job vacancies on our platform and reach candidates actively looking for employment opportunities. Employers can provide job descriptions, required qualifications, skills, experience, location, and other relevant details."],
          ["Candidate Database Access", "Explore candidate profiles and resumes to identify individuals whose qualifications, experience, and skills align with your recruitment requirements, subject to the selected service plan and applicable privacy permissions."],
          ["Resume Search and Shortlisting", "Search available candidate profiles using relevant criteria such as skills, qualifications, experience, industry, and location. Shortlist suitable candidates for further evaluation."],
          ["Recruitment Assistance", "Receive support with identifying potential candidates, reviewing applications, and coordinating recruitment activities according to your organization's requirements and the services selected."],
          ["Bulk Hiring Solutions", "Support recruitment campaigns involving multiple vacancies across departments, locations, and experience levels. Our platform can help employers attract candidates for large-scale hiring requirements."],
          ["Employer Branding", "Showcase your organization, workplace culture, company profile, and career opportunities to help candidates understand your business and employment offerings."],
          ["Featured Job Listings", "Increase the visibility of selected vacancies through featured or sponsored job listings, helping employers promote priority openings on designated sections of our platform."],
          ["Recruitment Campaigns", "Promote specific vacancies or hiring initiatives through customized campaigns designed around your target candidate profiles, hiring locations, and recruitment objectives."],
        ]} />
      </Band>

      <Band tinted eyebrow="Coverage" title="Industries We Serve"
            intro="Our recruitment platform can support hiring requirements across various sectors, including:">
        <TickList items={[
          "Information Technology and Software Development",
          "Banking, Financial Services, and Insurance",
          "Manufacturing and Engineering",
          "Healthcare and Pharmaceuticals",
          "Education and Training",
          "Construction and Infrastructure",
          "Sales and Marketing",
          "Finance, Accounting, and Administration",
          "Human Resources and Recruitment",
          "Logistics, Supply Chain, and Operations",
        ]} />
      </Band>

      <Band narrow eyebrow="How it works" title="Our Recruitment Process">
        <Steps items={[
          ["Understand Hiring Requirements", "We collect relevant information about the job role, required qualifications, experience, technical skills, location, and hiring timelines."],
          ["Publish Job Opportunities", "The employer's vacancies are published on our platform with the relevant job details."],
          ["Attract Potential Candidates", "Candidates can discover the published vacancies and submit applications through the available application process."],
          ["Review and Shortlist Applications", "Employers can review applications and identify candidates who meet their recruitment criteria."],
          ["Interview and Selection", "Employers coordinate interviews, conduct assessments, and make hiring decisions based on their selection criteria."],
          ["Complete the Hiring Process", "The employer proceeds with offer discussions, documentation, and onboarding for the selected candidate."],
        ]} />
      </Band>

      <Band tinted eyebrow="The case for it" title="Why Choose Our Recruitment Services?">
        <TickList items={[
          "Access to candidates across multiple industries and experience levels.",
          "Convenient job posting and application management.",
          "Candidate search and resume discovery options.",
          "Flexible recruitment services for different hiring requirements.",
          "Promotional options for priority vacancies.",
          "Support for individual and bulk recruitment needs.",
          "A centralized platform for connecting employers and job seekers.",
        ]} />
      </Band>

      <Band narrow eyebrow="Any size" title="Recruitment Solutions for Every Business">
        <div className="space-y-4 text-[16px] leading-[1.75] text-slate-700">
          <p>
            We understand that every organization has unique hiring requirements. Our recruitment
            services are designed to accommodate different business sizes, recruitment volumes,
            and workforce needs.
          </p>
          <p>
            Whether you need to hire a single professional, build a specialized technical team, or
            recruit employees for multiple locations, QCloneJob provides a platform to help you
            connect with potential talent.
          </p>
        </div>
      </Band>
    </ServiceShell>
  );
}

/* =====================================================================
   3. JOB SEARCH
   ===================================================================== */
export function JobSearchService() {
  return (
    <ServiceShell
      title="Discover Opportunities. Build Your Career."
      lede={[
        "Welcome to QCloneJob, your destination for exploring career opportunities and connecting with potential employers.",
        "We make job searching easier by providing a platform where job seekers can explore vacancies across industries, discover opportunities that match their skills and experience, and take the next step in their professional journey.",
        "Whether you are a fresher looking for your first job, an experienced professional seeking career growth, or someone planning a career change, our platform helps you explore employment opportunities in one convenient place.",
      ]}
      cta={{
        title: "Start Your Job Search Today",
        body: [
          "Your next career opportunity could begin with the right search. Create your profile, explore available vacancies, and discover opportunities that align with your skills, qualifications, and professional ambitions.",
          "Whether you are beginning your career or looking for your next professional challenge, QCloneJob is here to support your job search journey.",
        ],
        primary: "Create your profile",
      }}>

      <Band eyebrow="What we offer" title="Our Job Search Services">
        <NumberedGrid items={[
          ["Search Jobs", "Explore job opportunities across multiple industries, job roles, experience levels, and locations. Find vacancies based on your qualifications, skills, interests, and career objectives."],
          ["Advanced Job Search", "Refine your search using relevant filters such as job title, location, industry, experience, salary range, employment type, and required skills."],
          ["Resume Upload", "Create your candidate profile and upload your resume to showcase your qualifications, professional experience, technical skills, and achievements."],
          ["Job Recommendations", "Discover job opportunities based on your profile information, skills, qualifications, and professional interests, where recommendation features are available."],
          ["Latest Job Notifications", "Stay informed about newly published job opportunities through available alerts and notifications. Receive updates based on your selected preferences."],
          ["Fresher Job Opportunities", "Explore entry-level positions, internships, graduate trainee programs, and opportunities designed for candidates beginning their careers."],
          ["Experienced Professional Jobs", "Discover opportunities for experienced professionals across technical, managerial, administrative, and specialized business functions."],
          ["Remote and Work-from-Home Jobs", "Explore remote, hybrid, and work-from-home opportunities where offered by employers."],
          ["Walk-in Interview Opportunities", "Find information about walk-in interviews, recruitment drives, interview dates, venues, and eligibility requirements when provided by employers."],
          ["Career Opportunities by Industry", "Explore job openings across different sectors and identify opportunities aligned with your professional background and career goals."],
        ]} />
      </Band>

      <Band tinted eyebrow="Coverage" title="Jobs Across Multiple Industries"
            intro="Our job portal aims to bring together opportunities from a wide range of industries, including:">
        <TickList items={[
          "Information Technology and Software Development",
          "Banking, Finance, and Accounting",
          "Engineering and Manufacturing",
          "Healthcare and Pharmaceuticals",
          "Sales and Marketing",
          "Human Resources and Administration",
          "Construction and Infrastructure",
          "Education and Training",
          "Logistics and Supply Chain",
          "Customer Support and Operations",
        ]} />
      </Band>

      <Band narrow eyebrow="How it works" title="How Our Job Search Platform Works">
        <Steps items={[
          ["Create Your Profile", "Register on our platform and provide your basic details, educational qualifications, work experience, and professional skills."],
          ["Upload Your Resume", "Upload your latest resume to present your professional background and qualifications to potential employers."],
          ["Search for Jobs", "Explore available vacancies using job titles, skills, industries, locations, and other search filters."],
          ["Apply for Suitable Opportunities", "Review job descriptions, check eligibility requirements, and apply for positions that match your interests and qualifications."],
          ["Track Your Applications", "Use the available application management features to monitor application status and stay updated on recruitment progress."],
          ["Connect with Employers", "Respond to employer communications and participate in interviews or further selection activities as required."],
        ]} />
      </Band>

      <Band tinted eyebrow="The case for it" title="Why Use Our Job Search Services?">
        <TickList items={[
          "Explore job opportunities from different industries.",
          "Search vacancies by location, skills, and experience.",
          "Discover opportunities for freshers and experienced professionals.",
          "Create a professional candidate profile.",
          "Upload and manage your resume.",
          "Apply for relevant job openings through a convenient platform.",
          "Access job alerts and recommendations where available.",
          "Explore opportunities to support your long-term career development.",
        ]} />
      </Band>
    </ServiceShell>
  );
}
