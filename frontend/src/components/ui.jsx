import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Navigate, useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, mediaUrl } from "../lib/api";
import { IconLogout } from "./icons";
import NotificationBell from "./NotificationBell";
import Logo from "./Logo";

/* ---------- Toast ---------- */
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, kind = "success") => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[100] flex max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-cardhover animate-[fadeIn_.2s_ease]">
          <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${toast.kind === "error" ? "bg-red-500" : "bg-brandgreen"}`} />
          <span className="text-sm text-slate-700">{toast.message}</span>
        </div>
      )}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Route guard ---------- */
export function ProtectedRoute({ role, children }) {
  const { auth } = useAuth();
  const location = useLocation();
  if (!auth) return <Navigate to="/login" state={{ from: location }} replace />;
  if (role && auth.role !== role) return <Navigate to="/" replace />;
  return children;
}

/* ---------- Live unread-messages hook (polling) ---------- */
export function useUnread() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    const tick = () =>
      api.get("/api/chat/unread-count").then((d) => alive && setUnread(d.unread)).catch(() => {});
    tick();
    const id = setInterval(tick, 5000); // live: poll every 5s
    return () => { alive = false; clearInterval(id); };
  }, []);
  return unread;
}

/* ---------- Dashboard shell ---------- */
export function DashboardLayout({ title, menu, children }) {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const unread = useUnread();

  return (
    /* h-screen + overflow-hidden, not min-h-screen: with min-h-screen the whole
       PAGE scrolls, so the sidebar and header scroll away with the content.
       Fixing the height here means only the content pane scrolls, which is what
       keeps the nav and the header on screen on every page. */
    <div className="flex h-screen overflow-hidden">
      <aside className="no-print flex w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Link to="/"><Logo className="h-9" /></Link>
        </div>
        <div className="px-5 pb-2 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 pb-2">
          {menu.map((m) => {
            const active = location.pathname === m.to;
            const Icon = m.icon;
            return (
              <Link key={m.to} to={m.to} className={active ? "navlink-active" : "navlink"}>
                {Icon && <Icon size={18} />}
                <span className="flex-1">{m.label}</span>
                {m.badge && unread > 0 && (
                  <span className="badge bg-brandgreen text-white">{unread}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <p className="px-4 pb-3 text-[10px] text-slate-300" title="Build version — quote this when reporting an issue">
          v{BUILD_VERSION}
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* shrink-0 so the header keeps its height when the content is tall.
            No longer needs `sticky` — it can't scroll away now. */}
        <header className="no-print z-20 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur">
          <h1 className="text-lg font-bold text-navy">{title}</h1>
          <div className="flex items-center gap-3">
            <NotificationBell />
            {/* Profile picture is a JOB SEEKER feature only. The other portals
                keep the plain email they had. */}
            {auth?.role === "jobseeker"
              ? <AccountChip />
              : <span className="hidden text-sm text-slate-500 sm:inline">{auth?.email}</span>}
            <button className="btn-outline btn-sm" onClick={() => { logout(); navigate("/login"); }}>
              <IconLogout size={16} /> Log out
            </button>
          </div>
        </header>
        {/* min-h-0 so this pane can shrink and scroll rather than pushing the
            layout past the viewport. */}
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

/* =====================================================================
   Account chip — avatar, name and email in the header.

   Fetched ONCE per mount from /api/auth/me and cached in module scope, so
   navigating between pages doesn't re-request it. The layout is shared by all
   four portals, so without the cache this would fire on every route change.

   Falls back to initials on a coloured disc when there is no picture, which is
   also what shows while the request is in flight — an empty circle that
   suddenly fills in looks like a bug.
   ===================================================================== */
let accountCache = null;
const accountListeners = new Set();

/** Re-read /api/auth/me and update every mounted chip.
 *
 *  Called after an avatar or logo upload: without it the header would keep
 *  showing the old picture (or the initial) until a full page reload, which
 *  looks like the upload silently failed. */
export function refreshAccount() {
  accountCache = null;
  return api.get("/api/auth/me").then((d) => {
    accountCache = d;
    accountListeners.forEach((fn) => fn(d));
    return d;
  }).catch(() => null);
}

export function AccountChip() {
  const { auth } = useAuth();
  const [me, setMe] = useState(accountCache);

  useEffect(() => {
    accountListeners.add(setMe);
    let dead = false;
    if (!accountCache) {
      api.get("/api/auth/me").then((d) => {
        accountCache = d;
        if (!dead) setMe(d);
      }).catch(() => {});
    }
    return () => { dead = true; accountListeners.delete(setMe); };
  }, []);

  // Clear the cache on sign-out so the next user doesn't inherit this avatar.
  useEffect(() => { if (!auth) accountCache = null; }, [auth]);

  const email = me?.email || auth?.email || "";
  const name = me?.display_name || email;
  const pic = me?.avatar_url ? mediaUrl(me.avatar_url) : null;
  const initial = (name || "?").trim()[0]?.toUpperCase() || "?";

  return (
    <Link to={PROFILE_LINK[me?.role || auth?.role] || "#"}
          title={`${name}${name !== email ? ` · ${email}` : ""}`}
          className="group relative flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-slate-100">
      {pic ? (
        <>
          {/* The chip image scales on hover and settles back on leave.
              transform + transition rather than swapping sizes, so the layout
              never shifts as it grows. */}
          <img src={pic} alt=""
               className="h-11 w-11 rounded-full object-cover ring-2 ring-slate-200
                          transition-transform duration-200 ease-out
                          group-hover:scale-[1.18] group-hover:ring-navy-200" />

          {/* A larger read of the same photo, since 11px of growth still isn't
              enough to actually SEE a face. Sits below the header, fades in,
              and is pointer-events-none so it can't block the link. */}
          <span className="pointer-events-none absolute right-0 top-[calc(100%+10px)] z-40
                           scale-95 opacity-0 transition-all duration-200
                           group-hover:scale-100 group-hover:opacity-100">
            <span className="block rounded-2xl border border-slate-200 bg-white p-2 shadow-cardhover">
              <img src={pic} alt={name}
                   className="h-40 w-40 rounded-xl object-cover" />
              <span className="mt-1.5 block max-w-40 truncate px-1 text-center text-[12px] font-semibold text-slate-700">
                {name}
              </span>
            </span>
          </span>
        </>
      ) : (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy text-sm font-bold text-white
                         ring-2 ring-slate-200 transition-transform duration-200 group-hover:scale-[1.18]">
          {initial}
        </span>
      )}
      <span className="hidden min-w-0 max-w-[180px] flex-col leading-tight sm:flex">
        <span className="truncate text-[13px] font-semibold text-slate-700">{name}</span>
        {name !== email && <span className="truncate text-[11px] text-slate-400">{email}</span>}
      </span>
    </Link>
  );
}

/* Clicking the chip goes where a user expects: their own profile. */
const PROFILE_LINK = {
  jobseeker: "/jobseeker/profile",
  enterprise: "/enterprise/profile",
  institute: "/institute/profile",
  admin: "/admin",
};

export const BUILD_VERSION = "2026.09.20-institute-r1";

export function StatusBadge({ status }) {
  const map = {
    "Applied": "bg-slate-100 text-slate-700",
    "Under Review": "bg-amber-100 text-amber-700",
    "Shortlisted": "bg-navy-50 text-navy",
    "Interview - Phase 1": "bg-blue-50 text-blue-700",
    "Interview - Phase 2": "bg-blue-100 text-blue-700",
    "Interview - Phase 3": "bg-blue-200 text-blue-800",
    "Managerial Round": "bg-violet-100 text-violet-700",
    "Offered": "bg-brandgreen-50 text-brandgreen-600",
    "Hired": "bg-brandgreen text-white",
    "On Hold": "bg-slate-200 text-slate-600",
    "Rejected": "bg-red-100 text-red-700",
  };
  return <span className={`badge ${map[status] || "bg-slate-100 text-slate-700"}`}>{status}</span>;
}
