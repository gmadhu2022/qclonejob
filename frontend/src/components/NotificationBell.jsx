import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { IconBell, IconCheck } from "./icons";

const KIND_STYLE = {
  application: "bg-navy-50 text-navy",
  view: "bg-brandgreen-50 text-brandgreen-600",
  message: "bg-amber-50 text-amber-600",
  job: "bg-violet-50 text-violet-600",
  system: "bg-slate-100 text-slate-500",
};
const KIND_LABEL = {
  application: "Application", view: "Profile view", message: "Message", job: "Job alert", system: "System",
};

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ unread: 0, items: [] });
  const navigate = useNavigate();
  const ref = useRef(null);

  const load = useCallback(() => {
    api.get("/api/notifications?limit=15").then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000); // live
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const openItem = async (n) => {
    if (!n.is_read) await api.post(`/api/notifications/${n.id}/read`).catch(() => {});
    setOpen(false); load();
    if (n.link) navigate(n.link);
  };

  const readAll = async () => { await api.post("/api/notifications/read-all").catch(() => {}); load(); };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-navy"
              aria-label="Notifications">
        <IconBell size={20} />
        {data.unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brandgreen px-1 text-[10px] font-bold text-white">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-cardhover">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-semibold text-slate-700">Notifications</span>
            {data.unread > 0 && (
              <button onClick={readAll} className="flex items-center gap-1 text-xs font-medium text-navy hover:underline">
                <IconCheck size={12} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {data.items.map((n) => (
              <button key={n.id} onClick={() => openItem(n)}
                      className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50 ${n.is_read ? "" : "bg-navy-50/40"}`}>
                <span className={`mt-0.5 h-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${KIND_STYLE[n.kind] || KIND_STYLE.system}`}>
                  {KIND_LABEL[n.kind] || "Update"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-snug text-slate-800">{n.title}</span>
                  {n.body && <span className="block truncate text-xs text-slate-500">{n.body}</span>}
                  <span className="mt-0.5 block text-[11px] text-slate-400">{timeAgo(n.created_at)}</span>
                </span>
                {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brandgreen" />}
              </button>
            ))}
            {data.items.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-400">No notifications yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
