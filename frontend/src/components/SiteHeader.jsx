import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Logo from "./Logo";

/**
 * One header for every public page: Home, About, the three Services pages,
 * Login and Register.
 *
 * WHY THIS EXISTS
 * ---------------
 * Each page had its own hand-written nav, so they disagreed. About us showed
 * only "Contact us / Login / Register" — no way back to Services, and no way
 * to reach About from a Services page. Register showed nothing but the logo.
 * A visitor who landed on one of those pages had reached a dead end and had
 * to use the browser's Back button to carry on looking around.
 *
 * Every link is present on every page. The one you are already on is marked
 * rather than hidden: removing it makes the bar change width between pages,
 * which reads as a glitch, and it hides where you are.
 */

const SERVICES = [
  { to: "/services/promotions",  label: "Promotions" },
  { to: "/services/recruitment", label: "Recruitment Services" },
  { to: "/services/job-search",  label: "Job Search" },
];

const LOGINS = [
  { to: "/login?as=institute",  label: "Institute" },
  { to: "/login?as=enterprise", label: "Recruiter" },
  { to: "/login?as=jobseeker",  label: "Job Seeker" },
];

export default function SiteHeader({ sub }) {
  const { pathname } = useLocation();
  const onServices = pathname.startsWith("/services");

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link to="/" aria-label="QCloneJob home"><Logo className="h-10" /></Link>

        <nav className="flex items-center gap-0.5 sm:gap-1">
          <TopLink to="/about" active={pathname === "/about"}>About us</TopLink>
          <NavMenu label="Services" items={SERVICES} active={onServices} />
          <NavMenu label="Login" items={LOGINS} active={pathname.startsWith("/login")} />
          <TopLink to="/contact" active={pathname === "/contact"}>Contact us</TopLink>
          <Link to="/register"
                className={`ml-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all
                  ${pathname.startsWith("/register")
                    ? "border-2 border-navy bg-white text-navy"
                    : "bg-navy text-white hover:-translate-y-0.5 hover:shadow-cardhover"}`}>
            Register
          </Link>
        </nav>
      </div>
      {sub}
    </header>
  );
}

function TopLink({ to, active, children }) {
  return (
    <Link to={to} aria-current={active ? "page" : undefined}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors
            ${active ? "bg-navy-50 text-navy" : "text-slate-700 hover:bg-slate-50 hover:text-navy"}`}>
      {children}
    </Link>
  );
}

/**
 * A dropdown that opens on hover AND on click.
 *
 * Hover alone is unusable on a touch screen: the first tap registers as a
 * hover, the menu opens, and that tap is swallowed instead of following the
 * link. Click alone makes a mouse user work harder than they need to.
 */
function NavMenu({ label, items, active }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="relative"
         onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-haspopup="menu" aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors
                ${active ? "bg-navy-50 text-navy" : "text-slate-700 hover:bg-slate-50 hover:text-navy"}`}>
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden
             className={`ml-1 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div role="menu"
             className="absolute right-0 top-full z-40 mt-1 min-w-[210px] overflow-hidden
                        rounded-xl border border-slate-200 bg-white py-1 shadow-cardhover">
          {items.map((it) => (
            <Link key={it.to} to={it.to} role="menuitem" onClick={() => setOpen(false)}
                  className="block px-4 py-2.5 text-sm font-medium text-slate-700
                             transition-colors hover:bg-navy-50 hover:text-navy">
              {it.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
