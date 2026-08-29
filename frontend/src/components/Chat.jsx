import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../lib/api";
import { useToast } from "./ui";
import { IconSend, IconBlock, IconChat, IconCheck, IconSearch } from "./icons";

/* ---------------- helpers ---------------- */
function lastSeenText(iso) {
  if (!iso) return null;
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 120) return "last seen just now";
  if (s < 3600) return `last seen ${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `last seen ${Math.floor(s / 3600)}h ago`;
  return `last seen ${new Date(iso).toLocaleDateString()}`;
}
function dayLabel(iso) {
  const d = new Date(iso); const today = new Date();
  const y = new Date(today); y.setDate(y.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
const initials = (n) => (n || "?").split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
const AVATAR_TONES = ["bg-navy", "bg-brandgreen-600", "bg-blue-700", "bg-violet-600", "bg-amber-500", "bg-slate-700"];
const toneFor = (id) => AVATAR_TONES[(id || 0) % AVATAR_TONES.length];

function Presence({ online, last_seen, light }) {
  if (online) {
    return (
      <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${light ? "text-brandgreen-400" : "text-brandgreen-600"}`}>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brandgreen opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brandgreen" />
        </span>
        Online
      </span>
    );
  }
  const t = lastSeenText(last_seen);
  return t ? <span className={`text-[11px] ${light ? "text-white/60" : "text-slate-400"}`}>{t}</span> : null;
}

/* ---------------- privacy settings ---------------- */
function ChatSettings({ onClose }) {
  const toast = useToast();
  const [cfg, setCfg] = useState(null);
  useEffect(() => { api.get("/api/chat/settings").then(setCfg).catch(() => {}); }, []);
  const toggle = async (key) => {
    const next = { ...cfg, [key]: !cfg[key] };
    setCfg(next);
    try { await api.put("/api/chat/settings", next); toast("Chat settings updated."); }
    catch (err) { toast(err.message, "error"); }
  };
  const ROWS = [
    ["show_online_status", "Show when I'm online", "Others see a green dot while you're active."],
    ["show_last_seen", "Show my last seen", "Others see when you were last active."],
    ["show_read_receipts", "Send read receipts", "Others can tell when you've read their message."],
  ];
  return (
    <div className="absolute right-0 top-12 z-40 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-cardhover">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Chat privacy</span>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-700">Close</button>
      </div>
      {!cfg ? <p className="text-sm text-slate-400">Loading…</p> : ROWS.map(([k, label, desc]) => (
        <div key={k} className="flex items-start justify-between gap-3 border-t border-slate-100 py-2.5 first:border-0">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-slate-700">{label}</p>
            <p className="text-[11px] text-slate-400">{desc}</p>
          </div>
          <button onClick={() => toggle(k)}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${cfg[k] ? "bg-brandgreen" : "bg-slate-300"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${cfg[k] ? "left-[18px]" : "left-0.5"}`} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   Chat — a proper messaging window, not a table.
   Left rail: searchable conversation cards with hover lift.
   Right: gradient header, date-separated bubbles, sticky composer.
   ================================================================ */
export default function Chat({ openWith = null, canBlock = false }) {
  const toast = useToast();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(openWith);
  const [thread, setThread] = useState(null);
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const loadConversations = useCallback(() => {
    api.get("/api/chat/conversations").then(setConversations).catch(() => {});
  }, []);
  const loadThread = useCallback((id, scroll = false) => {
    if (!id) return;
    api.get(`/api/chat/with/${id}`).then((t) => {
      setThread(t);
      if (scroll) setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 60);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { if (openWith) setActiveId(openWith); }, [openWith]);
  useEffect(() => {
    const beat = () => api.post("/api/chat/heartbeat").catch(() => {});
    beat(); const id = setInterval(beat, 45000); return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!activeId) return;
    loadThread(activeId, true);
    const id = setInterval(() => { loadThread(activeId); loadConversations(); }, 4000);
    return () => clearInterval(id);
  }, [activeId, loadThread, loadConversations]);

  const send = async () => {
    const body = text.trim();
    if (!body || !activeId || sending) return;
    setText(""); setSending(true);
    try {
      await api.post("/api/chat/send", { recipient_user_id: activeId, body });
      loadThread(activeId, true); loadConversations();
      inputRef.current?.focus();
    } catch (err) { toast(err.message, "error"); setText(body); }
    finally { setSending(false); }
  };
  const block = async () => {
    try { await api.post(`/api/chat/block/${activeId}`); toast("User blocked."); loadThread(activeId); }
    catch (err) { toast(err.message, "error"); }
  };
  const unblock = async () => {
    try { await api.post(`/api/chat/unblock/${activeId}`); toast("User unblocked."); loadThread(activeId); }
    catch (err) { toast(err.message, "error"); }
  };

  const shown = q
    ? conversations.filter((c) => (c.name || "").toLowerCase().includes(q.toLowerCase())
        || (c.last_message || "").toLowerCase().includes(q.toLowerCase()))
    : conversations;
  const totalUnread = conversations.reduce((a, c) => a + (c.unread || 0), 0);

  // group messages by day for date separators
  const grouped = [];
  (thread?.messages || []).forEach((m) => {
    const label = dayLabel(m.created_at);
    const last = grouped[grouped.length - 1];
    if (!last || last.label !== label) grouped.push({ label, items: [m] });
    else last.items.push(m);
  });

  return (
    <div className="grid h-[calc(100vh-9rem)] grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:grid-cols-[320px_1fr]">
      {/* ---------------- conversation rail ---------------- */}
      <aside className={`flex flex-col border-r border-slate-200 ${activeId ? "hidden md:flex" : "flex"}`}>
        <div className="relative border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">Messages</span>
              {totalUnread > 0 && (
                <span className="rounded-full bg-brandgreen px-1.5 text-[10px] font-bold text-white">{totalUnread}</span>
              )}
            </div>
            <button onClick={() => setSettingsOpen((o) => !o)}
                    className="text-xs font-semibold text-navy hover:underline">Privacy</button>
          </div>
          {settingsOpen && <ChatSettings onClose={() => setSettingsOpen(false)} />}
          <div className="relative mt-2.5">
            <input className="input !py-2 !pl-8 !text-[13px]" placeholder="Search conversations…"
                   value={q} onChange={(e) => setQ(e.target.value)} />
            <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {shown.map((c) => {
            const active = activeId === c.user_id;
            return (
              <button key={c.user_id} onClick={() => setActiveId(c.user_id)}
                className={`group flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-all duration-150
                  ${active ? "bg-navy text-white shadow-sm"
                           : "hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-sm"}`}>
                <div className="relative shrink-0">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white ${toneFor(c.user_id)}`}>
                    {initials(c.name)}
                  </div>
                  {c.online && (
                    <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 bg-brandgreen ${active ? "border-navy" : "border-white"}`} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-[13.5px] font-semibold ${active ? "text-white" : "text-slate-800"}`}>
                      {c.name}
                    </span>
                    {c.unread > 0 && (
                      <span className="shrink-0 rounded-full bg-brandgreen px-1.5 text-[10px] font-bold text-white">{c.unread}</span>
                    )}
                  </div>
                  <p className={`truncate text-[12px] ${active ? "text-navy-100" : "text-slate-500"}`}>
                    {c.last_message || "No messages yet"}
                  </p>
                  <span className={`text-[10.5px] capitalize ${active ? "text-white/50" : "text-slate-400"}`}>
                    {c.role}{c.online ? " · online" : ""}
                  </span>
                </div>
              </button>
            );
          })}
          {shown.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center text-slate-400">
              <IconChat size={30} />
              <p className="text-sm">{q ? "No conversations match." : "No conversations yet."}</p>
            </div>
          )}
        </div>
      </aside>

      {/* ---------------- thread ---------------- */}
      <section className={`flex flex-col ${activeId ? "flex" : "hidden md:flex"}`}>
        {!thread ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-slate-50/60 text-slate-400">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
              <IconChat size={30} />
            </div>
            <p className="text-sm font-medium">Select a conversation to start chatting</p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 bg-gradient-to-r from-navy to-navy-600 px-5 py-3 text-white">
              <div className="flex min-w-0 items-center gap-3">
                <button onClick={() => setActiveId(null)}
                        className="rounded-lg px-1.5 py-1 text-white/70 hover:bg-white/10 md:hidden">←</button>
                <div className="relative shrink-0">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ring-2 ring-white/20 ${toneFor(thread.other.user_id)}`}>
                    {initials(thread.other.name)}
                  </div>
                  {thread.other.online && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-navy bg-brandgreen" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{thread.other.name}</p>
                  <Presence online={thread.other.online} last_seen={thread.other.last_seen} light />
                </div>
              </div>
              {canBlock && (thread.i_blocked_them ? (
                <button className="rounded-lg border border-white/25 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                        onClick={unblock}><IconCheck size={13} /> Unblock</button>
              ) : (
                <button className="rounded-lg border border-white/25 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/80"
                        onClick={block}><IconBlock size={13} /> Block</button>
              ))}
            </header>

            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-5">
              {grouped.map((g) => (
                <div key={g.label} className="space-y-1.5">
                  <div className="flex justify-center">
                    <span className="rounded-full bg-white px-3 py-1 text-[10.5px] font-semibold text-slate-500 shadow-sm">
                      {g.label}
                    </span>
                  </div>
                  {g.items.map((m) => (
                    <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                      <div className={`group max-w-[75%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed shadow-sm transition-shadow hover:shadow-md
                        ${m.mine ? "rounded-br-sm bg-navy text-white"
                                 : "rounded-bl-sm border border-slate-200 bg-white text-slate-700"}`}>
                        {m.body}
                        <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${m.mine ? "text-white/60" : "text-slate-400"}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {m.mine && m.is_read === true && <IconCheck size={11} />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {grouped.length === 0 && (
                <p className="py-12 text-center text-sm text-slate-400">No messages yet — say hello.</p>
              )}
            </div>

            {thread.they_blocked_me ? (
              <div className="border-t border-slate-100 bg-white px-5 py-4 text-center text-sm text-slate-400">
                You can't message this user.
              </div>
            ) : thread.i_blocked_them ? (
              <div className="border-t border-slate-100 bg-white px-5 py-4 text-center text-sm text-slate-400">
                You blocked this user. Unblock to send messages.
              </div>
            ) : (
              <div className="flex items-end gap-2 border-t border-slate-100 bg-white p-3">
                <textarea
                  ref={inputRef} rows={1}
                  className="input max-h-32 flex-1 resize-none !rounded-2xl !py-2.5"
                  placeholder="Type a message…" value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                />
                <button className="btn shrink-0 !rounded-full !px-4 !py-2.5" onClick={send} disabled={sending || !text.trim()}>
                  <IconSend size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
