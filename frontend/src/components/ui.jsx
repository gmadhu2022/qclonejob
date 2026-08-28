import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Navigate, useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
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
    <div className="flex min-h-screen">
      <aside className="no-print flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Link to="/"><Logo className="h-9" /></Link>
        </div>
        <div className="px-5 pb-2 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 pb-4">
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
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur">
          <h1 className="text-lg font-bold text-navy">{title}</h1>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <span className="hidden text-sm text-slate-500 sm:inline">{auth?.email}</span>
            <button className="btn-outline btn-sm" onClick={() => { logout(); navigate("/login"); }}>
              <IconLogout size={16} /> Log out
            </button>
          </div>
        </header>
        <main className="flex-1 p-6"><div className="mx-auto w-full max-w-[1600px]">{children}</div></main>
      </div>
    </div>
  );
}

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
