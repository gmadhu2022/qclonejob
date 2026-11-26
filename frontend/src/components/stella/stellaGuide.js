/**
 * Stella's built-in JobBay guide.
 *
 * Stella is shown to visitors (not logged in) on public pages, so every link here
 * points to a PUBLIC page that really exists in the app. Known questions are
 * answered from this guide first (instant, always-correct links); anything else
 * goes to the AI on the server, and this guide is the fallback when the server
 * can't be reached.
 *
 * Only describe features the app actually has. (No job alerts / notifications.)
 */

export const PAGES = {
  home: { to: "/", label: "Home" },
  regSeeker: { to: "/register/jobseeker", label: "Register as a job seeker" },
  regRecruiter: { to: "/register/enterprise", label: "Register as a recruiter" },
  regInstitute: { to: "/register/institute", label: "Register your institute" },
  loginSeeker: { to: "/login?as=jobseeker", label: "Job seeker login" },
  loginRecruiter: { to: "/login?as=enterprise", label: "Recruiter login" },
  loginInstitute: { to: "/login?as=institute", label: "Institute login" },
  forgot: { to: "/forgot-password", label: "Reset password" },
  svcSearch: { to: "/services/job-search", label: "Job search service" },
  svcRecruit: { to: "/services/recruitment", label: "Recruitment services" },
  svcPromo: { to: "/services/promotions", label: "Promotions & ads" },
  about: { to: "/about", label: "About us" },
  contact: { to: "/contact", label: "Contact us" },
};

const MENU = ["regSeeker", "regRecruiter", "regInstitute", "loginSeeker", "svcSearch", "svcRecruit", "svcPromo", "about", "contact"];

/* k: keywords · reply: **bold** and "- " bullets · s: follow-up chips (each maps to a topic below) · links: PAGES keys */
const TOPICS = [
  {
    id: "greet", short: true,
    k: ["hi", "hii", "hello", "hey", "namaste", "good morning", "good evening", "good afternoon", "thanks", "thank you"],
    reply: "Hi! I'm **Stella**, your JobBay assistant. I can show you around JobBay, help you register or log in, and point you to the right page. What would you like to do?",
    s: ["What can I do here?", "How do I register?", "Find a job"],
  },
  {
    id: "menu",
    k: ["menu", "options", "option", "what can i do", "what can you do", "help me", "help", "pages", "features", "explore", "show options", "available", "navigate", "all pages"],
    reply: "Here's everything you can do on JobBay — tap a page to open it:",
    s: ["How do I register?", "Find a job", "I want to hire"],
    links: MENU,
  },
  {
    id: "jobs",
    k: ["find a job", "find job", "find jobs", "latest jobs", "jobs near", "search job", "search jobs", "job search", "looking for job", "looking for a job", "vacancy", "vacancies", "openings", "jobs", "job in", "jobs in", "work"],
    reply: "JobBay has **1,400+ roles across 50+ industries** — from daily-wage work to postgraduate roles, worldwide.\n- Create a free **job seeker account**\n- Search by **role, sector, location, experience and salary**\n- Open a job and **apply in one click**",
    s: ["How do I apply?", "Jobs for freshers", "How do I register?"],
    links: ["regSeeker", "svcSearch"],
  },
  {
    id: "apply",
    k: ["apply", "applying", "application", "applications", "status", "track"],
    reply: "To apply for a job:\n- **Log in** as a job seeker (or register for free)\n- Open a job and click **Apply** — your JobBay profile is sent as your resume\n- Follow every application and its status in **My applications** after you log in",
    s: ["How do I register?", "Improve my resume"],
    links: ["loginSeeker", "regSeeker"],
  },
  {
    id: "resume",
    k: ["resume", "cv", "profile", "objective", "skills", "improve my"],
    reply: "After you log in as a job seeker, open **My profile** to build your resume:\n- Career objective and **key skills**\n- Education, experience and certifications\n- Choose a **resume template**\n- Built-in **AI help** to polish your objective, suggest skills and review your resume",
    s: ["How do I apply?", "Interview tips"],
    links: ["loginSeeker", "regSeeker"],
  },
  {
    id: "interview",
    k: ["interview", "interview tips", "prepare", "preparation", "mock"],
    reply: "Quick interview tips:\n- Read the job description and research the company\n- Prepare 2–3 examples using **situation → action → result**\n- Practise common questions out loud and keep answers short\n- Ask one thoughtful question at the end\n\nAfter you log in, each job also has **AI interview prep**.",
    s: ["Improve my resume", "Find a job"],
  },
  {
    id: "fresher",
    k: ["fresher", "freshers", "jobs for freshers", "no experience", "first job", "internship"],
    reply: "Freshers are welcome! Register as a job seeker, add your education, projects and skills, then filter jobs by **0 years of experience** and apply. If your college uses JobBay, your **institute** may already have created your account — check your email for your login.",
    s: ["How do I register?", "Interview tips"],
    links: ["regSeeker", "loginSeeker"],
  },
  {
    id: "salary",
    k: ["salary", "pay", "ctc", "package", "wage", "wages"],
    reply: "Most jobs on JobBay show a **salary range** in the local currency. After you log in, open any job to see its salary, experience and location details.",
    s: ["Find a job", "How do I register?"],
    links: ["svcSearch"],
  },
  {
    id: "register",
    k: ["register", "registration", "sign up", "signup", "create account", "create an account", "join", "new account"],
    reply: "Registration on JobBay is **free**. Choose the account that fits you:",
    s: ["How do I log in?", "What can I do here?"],
    links: ["regSeeker", "regRecruiter", "regInstitute"],
  },
  {
    id: "login",
    k: ["login", "log in", "sign in", "signin", "cannot login", "can't login", "my account"],
    reply: "Each account type has its own login. Choose yours:",
    s: ["Forgot my password", "How do I register?"],
    links: ["loginSeeker", "loginRecruiter", "loginInstitute"],
  },
  {
    id: "password",
    k: ["password", "forgot", "reset", "otp", "verification code"],
    reply: "No worries — open **Reset password**, enter your registered email and we'll send you a code to set a new password. Never share your password or code with anyone.",
    s: ["How do I log in?"],
    links: ["forgot"],
  },
  {
    id: "services",
    k: ["services", "service", "what do you offer", "offerings"],
    reply: "JobBay offers three services:\n- **Job search** — for job seekers\n- **Recruitment** — for employers and recruiters\n- **Promotions & ads** — for companies and institutes",
    s: ["I want to hire", "Find a job"],
    links: ["svcSearch", "svcRecruit", "svcPromo"],
  },
  {
    id: "hire",
    k: ["hire", "hiring", "recruit", "recruiter", "recruitment", "recruitment services", "employer", "candidate", "candidates", "talent"],
    reply: "Hiring on JobBay:\n- **Post jobs** in minutes — or auto-fill from a job description document\n- **Search candidates** by skills, location and experience\n- Review **applications** and chat with candidates in one place",
    s: ["How do I post a job?", "Plans & pricing"],
    links: ["regRecruiter", "svcRecruit"],
  },
  {
    id: "postjob",
    k: ["post a job", "post job", "job post", "posting", "jd", "job description"],
    reply: "Posting a job needs a **recruiter account**. After you log in, open **Post a job**, choose the sector and role, add the title, location, experience, salary and skills, and publish. You can also auto-fill it from a JD document (PDF, Word, Excel, CSV or text).",
    s: ["Plans & pricing", "I want to hire"],
    links: ["loginRecruiter", "regRecruiter"],
  },
  {
    id: "pricing",
    k: ["plan", "plans", "price", "pricing", "cost", "fee", "fees", "subscription", "payment", "free", "charges"],
    reply: "Job seekers use JobBay **free**. Recruiters choose a plan for job posts and candidate searches — the plans are shown in your recruiter account. For a quote or help choosing, contact our team.",
    s: ["I want to hire", "What can I do here?"],
    links: ["svcRecruit", "contact"],
  },
  {
    id: "promo",
    k: ["ad", "ads", "advert", "advertise", "advertisement", "promote", "promotion", "promotions", "banner", "branding"],
    reply: "Companies and institutes can **promote** themselves on JobBay with image, GIF, video or scrolling-text ads shown to job seekers.",
    s: ["Plans & pricing", "Contact us"],
    links: ["svcPromo", "contact"],
  },
  {
    id: "institute",
    k: ["institute", "college", "university", "school", "upload", "student", "students", "student data", "placement", "placements", "template", "excel", "csv"],
    reply: "For institutes:\n- **Upload student data** from Excel/CSV (a template is on the upload page)\n- JobBay creates a profile for each student and **emails them their login**\n- Recruiters can find your students, and you can **post jobs and ads**",
    s: ["How do I register?", "What can I do here?"],
    links: ["regInstitute", "loginInstitute"],
  },
  {
    id: "about",
    k: ["about", "about us", "what is jobbay", "who are you", "jobbay", "company", "mission", "vision"],
    reply: "**JobBay** is an advanced job searching platform connecting **job seekers, recruiters and institutes** across the world — from daily-wage workers to postgraduates. Read more about us here:",
    s: ["What can I do here?", "Contact us"],
    links: ["about"],
  },
  {
    id: "contact",
    k: ["contact", "contact us", "support", "help desk", "complaint", "call", "email", "phone", "talk to", "reach"],
    reply: "You can reach the JobBay team from the **Contact us** page — we usually reply within one working day.",
    s: ["What can I do here?"],
    links: ["contact"],
  },
  {
    id: "safety",
    k: ["safe", "safety", "privacy", "data", "secure", "fraud", "scam", "fake"],
    reply: "Your safety matters: JobBay **never asks for payment to apply** for a job, and we never ask for your password or OTP in chat. If something looks suspicious, please report it to our team.",
    s: ["Contact us"],
    links: ["contact"],
  },
  {
    id: "noalerts",
    k: ["alert", "alerts", "job alert", "job alerts", "notify", "notify me", "notification", "notifications", "subscribe", "newsletter"],
    reply: "JobBay doesn't offer job alerts or email notifications at the moment. The best way to see new openings is to **log in** and check the **Jobs** page regularly — new jobs are added every day.",
    s: ["Find a job", "How do I register?"],
    links: ["loginSeeker", "regSeeker"],
  },
  {
    id: "home",
    k: ["home", "home page", "homepage", "main page"],
    reply: "Here's the JobBay home page:",
    s: ["What can I do here?"],
    links: ["home"],
  },
];

const FALLBACK = {
  id: "fallback",
  reply: "I can only help with **JobBay** — finding and applying for jobs, registering or logging in, hiring, and institute placements. What would you like to know?",
  s: ["What can I do here?", "How do I register?", "Find a job"],
};

/** Best built-in answer: { reply, suggestions, links, topic, score }. score 0 = no topic matched. */
export function guideAnswer(question) {
  const q = ` ${question.toLowerCase().replace(/[^a-z0-9+#' ]+/g, " ").replace(/\s+/g, " ")} `;
  let best = null, bestScore = 0;
  for (const t of TOPICS) {
    if (t.short && q.trim().split(" ").length > 5) continue;            // greetings only for short messages
    let score = 0;
    for (const k of t.k) if (q.includes(` ${k} `)) score += k.split(" ").length + 1;
    if (score > bestScore) { best = t; bestScore = score; }
  }
  const t = best || FALLBACK;
  return {
    reply: t.reply, suggestions: t.s || [], topic: t.id, score: bestScore,
    links: (t.links || []).map((k) => PAGES[k]).filter(Boolean),
  };
}

/** Pages Stella may link to (used to filter links coming from the server too). */
export const ALLOWED_PATHS = new Set(Object.values(PAGES).map((p) => p.to));

/* ------------------------------------------------------------------ guided flows
 * "How do I register?" / "How do I log in?" → Stella asks which kind of account,
 * then opens the matching registration (or login) page. Handled in the browser,
 * so it works instantly and even when the server is unreachable.
 */
export const ROLE_OPTIONS = [
  { key: "jobseeker", label: "Job seeker", desc: "Find jobs and apply in one click", icon: "💼" },
  { key: "enterprise", label: "Recruiter", desc: "Post jobs and hire talent", icon: "🏢" },
  { key: "institute", label: "Institute", desc: "Upload students and boost placements", icon: "🎓" },
];

const ROLE_WORDS = {
  jobseeker: /\b(job ?seeker|jobseeker|seeker|candidate|fresher|student|employee|looking for (a )?job|find (a )?job|1)\b/,
  enterprise: /\b(recruiter|employer|company|hr|hiring|hire|business|organi[sz]ation|enterprise|2)\b/,
  institute: /\b(institute|institution|college|university|school|academy|training|3)\b/,
};

/** Which role a short answer refers to ("recruiter", "I'm a college", "2"), or null. */
export function matchRole(text) {
  const t = ` ${text.toLowerCase()} `;
  const hits = Object.entries(ROLE_WORDS).filter(([, re]) => re.test(t)).map(([k]) => k);
  return hits.length === 1 ? hits[0] : null;
}

/** { flow: "register" | "login", role: key | null } when the question asks how to sign up / log in. */
export function detectFlow(text) {
  const t = text.toLowerCase();
  const register = /\b(register|registration|sign ?up|create (an |my )?account|new account|open (an )?account|join jobbay|how (do|can) i join|enrol|enroll)\b/.test(t);
  const login = !register && /\b(log ?in|sign ?in|signin|my account|access (my )?account)\b/.test(t) && !/\b(forgot|reset|password)\b/.test(t);
  if (!register && !login) return null;
  return { flow: register ? "register" : "login", role: matchRole(t) };
}

export function flowTarget(flow, role) {
  return flow === "register" ? `/register/${role}` : `/login?as=${role}`;
}

export function flowQuestion(flow) {
  return flow === "register"
    ? "Happy to help you get started! **Who are you registering as?**"
    : "Sure! **Which portal would you like to sign in to?**";
}

export function flowConfirm(flow, role) {
  const o = ROLE_OPTIONS.find((r) => r.key === role);
  return flow === "register"
    ? `Great choice! I'm opening the **${o.label} registration** page for you. Fill in the details to create your free account — I'm right here if you need help.`
    : `Opening the **${o.label} login** page for you. Sign in with your registered email and password.`;
}
