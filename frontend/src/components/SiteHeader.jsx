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
  /* CLICK IS THE ONLY WAY THIS OPENS.
     ---------------------------------
     The previous version opened on hover AND toggled on click, which made it
     fail in a way that looked random:

       1. Moving the pointer onto the button opened the menu (hover). The
          click that followed ran a TOGGLE, so it closed again instantly —
          clicking appeared to do nothing. On desktop the pointer always
          enters before the click, so this happened almost every time.
       2. onMouseLeave closed the menu, and there is a 4px gap between the
          button and the panel. Moving down to an item crossed that gap,
          left the container, and shut the menu before the cursor arrived.
       3. On a touch screen the tap fired the hover handler first and the
          same toggle-cancels-hover race applied.

     Click-only has none of those races and behaves identically with a mouse,
     a finger and a keyboard. */
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const btn = useRef(null);
  const { pathname, search } = useLocation();

  /* Close when the route changes. Clicking an item already closes it, but a
     link to the page you are ALREADY on does not remount this component, so
     without this the menu would stay open over the page you just asked for. */
  useEffect(() => { setOpen(false); }, [pathname, search]);

  useEffect(() => {
    if (!open) return;
    /* pointerdown, not mousedown: it covers mouse, touch and pen in one
       listener. It also fires before click, so the menu is already closing
       as the click lands — and because the panel is inside `box`, clicking
       an item is correctly treated as inside and the navigation still runs. */
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const key = (e) => {
      if (e.key === "Escape") { setOpen(false); btn.current?.focus(); }
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={box} className="relative"
         /* Tabbing past the last item closes the menu, so a keyboard user is
            never left with an invisible open panel behind the next control. */
         onBlur={(e) => {
           if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
         }}>
      <button ref={btn} type="button" aria-haspopup="menu" aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); }
              }}
              className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors
                ${active || open ? "bg-navy-50 text-navy" : "text-slate-700 hover:bg-slate-50 hover:text-navy"}`}>
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden
             className={`ml-1 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        /* pt-1 on the wrapper instead of mt-1 on the panel: the gap between
           button and panel is now INSIDE the element, so there is no dead
           strip to cross. */
        <div className="absolute right-0 top-full z-50 pt-1">
          <div role="menu" aria-label={label}
               className="min-w-[210px] overflow-hidden rounded-xl border border-slate-200
                          bg-white py-1 shadow-cardhover">
            {items.map((it) => (
              <Link key={it.to} to={it.to} role="menuitem" onClick={() => setOpen(false)}
                    className="block px-4 py-2.5 text-sm font-medium text-slate-700
                               transition-colors hover:bg-navy-50 hover:text-navy">
                {it.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
