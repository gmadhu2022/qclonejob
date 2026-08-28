import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../lib/api";
import { useToast } from "./ui";
import { IconSend, IconBlock, IconChat, IconCheck } from "./icons";

function lastSeenText(iso) {
  if (!iso) return null;
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 120) return "last seen just now";
  if (s < 3600) return `last seen ${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `last seen ${Math.floor(s / 3600)}h ago`;
  return `last seen ${new Date(iso).toLocaleDateString()}`;
}

function Presence({ online, last_seen, dot = true }) {
  if (online) {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-brandgreen-600">
        {dot && <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brandgreen opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-brandgreen" />
        </span>}
        Online
      </span>
    );
  }
  const t = lastSeenText(last_seen);
  return t ? <span className="text-[11px] text-slate-400">{t}</span> : null;
}

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
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${cfg[k] ? "left-[18px]" : "left-0.5"}`} />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Chat panel used by both job seekers and recruiters.
 * - Left: conversation list with unread counts (live-polled).
 * - Right: the selected thread; send box; block / unblock.
 * `openWith` (optional) = a user id to open immediately (e.g. from "Message" buttons).
 */
export default function Chat({ openWith = null, canBlock = false }) {
  const toast = useToast();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(openWith);
  const [thread, setThread] = useState(null);
  const [text, setText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scrollRef = useRef(null);

  const loadConversations = useCallback(() => {
    api.get("/api/chat/conversations").then(setConversations).catch(() => {});
  }, []);

  const loadThread = useCallback((id) => {
    if (!id) return;
    api.get(`/api/chat/with/${id}`).then((t) => {
      setThread(t);
      setTimeout(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight), 50);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // keep "online" accurate while the chat is open
  useEffect(() => {
    const beat = () => api.post("/api/chat/heartbeat").catch(() => {});
    beat();
    const id = setInterval(beat, 45000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (openWith) setActiveId(openWith); }, [openWith]);

  // live: refresh active thread + conversation list every 4s
  useEffect(() => {
    if (!activeId) return;
    loadThread(activeId);
    const id = setInterval(() => { loadThread(activeId); loadConversations(); }, 4000);
    return () => clearInterval(id);
  }, [activeId, loadThread, loadConversations]);

  const send = async () => {
    const body = text.trim();
    if (!body || !activeId) return;
    setText("");
    try {
      await api.post("/api/chat/send", { recipient_user_id: activeId, body });
      loadThread(activeId);
      loadConversations();
    } catch (err) { toast(err.message, "error"); setText(body); }
  };

  const block = async () => {
    try { await api.post(`/api/chat/block/${activeId}`); toast("User blocked."); loadThread(activeId); }
    catch (err) { toast(err.message, "error"); }
  };
  const unblock = async () => {
    try { await api.post(`/api/chat/unblock/${activeId}`); toast("User unblocked."); loadThread(activeId); }
    catch (err) { toast(err.message, "error"); }
  };

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-12 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      {/* Conversation list */}
      <div className="col-span-4 border-r border-slate-200">
        <div className="relative flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <span className="text-sm font-semibold text-slate-500">Messages</span>
          <button onClick={() => setSettingsOpen((o) => !o)}
                  className="text-xs font-medium text-navy hover:underline">Privacy</button>
          {settingsOpen && <ChatSettings onClose={() => setSettingsOpen(false)} />}
        </div>
        <div className="divide-y divide-slate-100 overflow-y-auto">
          {conversations.map((c) => (
            <button key={c.user_id} onClick={() => setActiveId(c.user_id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${activeId === c.user_id ? "bg-navy-50" : ""}`}>
              <div className="relative shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-100 text-sm font-bold text-navy">
                  {c.name?.[0]?.toUpperCase() || "?"}
                </div>
                {c.online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-brandgreen" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-semibold text-slate-800">{c.name}</span>
                  {c.unread > 0 && <span className="badge bg-brandgreen text-white">{c.unread}</span>}
                </div>
                <p className="truncate text-xs text-slate-500">{c.last_message}</p>
                <Presence online={c.online} last_seen={c.last_seen} dot={false} />
              </div>
            </button>
          ))}
          {conversations.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-slate-400">
              <IconChat size={28} />
              <p className="text-sm">No conversations yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Thread */}
      <div className="col-span-8 flex flex-col">
        {!thread ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
            <IconChat size={34} />
            <p className="text-sm">Select a conversation to start chatting.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-100 text-sm font-bold text-navy">
                    {thread.other.name?.[0]?.toUpperCase()}
                  </div>
                  {thread.other.online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-brandgreen" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{thread.other.name}</p>
                  <Presence online={thread.other.online} last_seen={thread.other.last_seen} />
                </div>
              </div>
              {canBlock && (thread.i_blocked_them
                ? <button className="btn-outline btn-sm" onClick={unblock}><IconCheck size={15} /> Unblock</button>
                : <button className="btn-outline btn-sm !text-red-600 hover:!border-red-400 hover:!bg-red-50" onClick={block}><IconBlock size={15} /> Block</button>
              )}
            </div>

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-slate-50/60 p-5">
              {thread.messages.map((m) => (
                <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    m.mine ? "rounded-br-md bg-navy text-white" : "rounded-bl-md bg-white text-slate-700 border border-slate-200"}`}>
                    {m.body}
                    <div className={`mt-1 flex items-center gap-1 text-[10px] ${m.mine ? "text-navy-100" : "text-slate-400"}`}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {m.mine && m.is_read === true && <IconCheck size={11} />}
                    </div>
                  </div>
                </div>
              ))}
              {thread.messages.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-400">Say hello 👋</p>
              )}
            </div>

            {thread.they_blocked_me ? (
              <div className="border-t border-slate-100 px-5 py-4 text-center text-sm text-slate-400">
                You can't message this user.
              </div>
            ) : thread.i_blocked_them ? (
              <div className="border-t border-slate-100 px-5 py-4 text-center text-sm text-slate-400">
                You blocked this user. Unblock to send messages.
              </div>
            ) : (
              <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3">
                <input className="input" placeholder="Type a message…" value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()} />
                <button className="btn shrink-0" onClick={send}><IconSend size={16} /> Send</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
