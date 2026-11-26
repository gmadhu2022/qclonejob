import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import StellaAvatar, { StellaCutout } from "./StellaAvatar";
import { guideAnswer, detectFlow, matchRole, flowTarget, flowQuestion, flowConfirm, ROLE_OPTIONS, ALLOWED_PATHS } from "./stellaGuide";

/**
 * Stella — JobBay's AI assistant. A floating launcher (bottom-right, every page)
 * that opens a chat panel. Talks to POST /api/stella/chat, which works for
 * visitors and every portal, and falls back to a built-in guide when AI is off.
 *
 * Extras: quick-start cards per role, tappable follow-up suggestions, page links
 * (filtered server-side), voice input (Web Speech API, where supported) and an
 * optional read-aloud voice. The conversation survives page changes within the
 * tab (sessionStorage) and is kept separately per role.
 */

const QUICK = {
  visitor: [
    { icon: "🧭", t: "What can I do here?", q: "What can I do here?" },
    { icon: "🔎", t: "Find a job", q: "Find a job" },
    { icon: "📝", t: "How do I register?", q: "How do I register?" },
    { icon: "🔐", t: "Log in to my account", q: "How do I log in?" },
    { icon: "🛠️", t: "Our services", q: "What services do you offer?" },
    { icon: "📞", t: "Contact us", q: "Contact us" },
  ],
  jobseeker: [
    { icon: "🎯", t: "Jobs for my skills", q: "Find jobs that match my skills" },
    { icon: "📄", t: "Improve my resume", q: "How can I improve my profile and resume?" },
    { icon: "📬", t: "My applications", q: "What's the status of my applications?" },
    { icon: "💬", t: "Interview tips", q: "Give me quick interview tips" },
  ],
  enterprise: [
    { icon: "✍️", t: "Write a job post", q: "Help me write a great job post" },
    { icon: "🧑‍💼", t: "Find candidates", q: "How do I find the right candidates?" },
    { icon: "⚡", t: "Hire faster", q: "Tips to hire faster on JobBay" },
    { icon: "💳", t: "Plans & pricing", q: "What plans are available for recruiters?" },
  ],
  institute: [
    { icon: "📤", t: "Upload students", q: "How do I upload student data?" },
    { icon: "📢", t: "Post a job", q: "How do I post a job for my students?" },
    { icon: "🏫", t: "Promote institute", q: "How can I promote my institute with ads?" },
    { icon: "🏆", t: "Placement tips", q: "Tips to improve placements for my students" },
  ],
  admin: [
    { icon: "📊", t: "Platform overview", q: "Give me a quick overview of the platform" },
    { icon: "🧭", t: "Where is…", q: "Where can I approve jobs?" },
  ],
};
const INTRO = {
  visitor: "I can help you find jobs, sign up, hire talent or place students.",
  jobseeker: "I can find jobs for your skills, polish your resume and prep you for interviews.",
  enterprise: "I can help you write job posts, find candidates and hire faster.",
  institute: "I can help you upload students, post jobs and boost placements.",
  admin: "I can help you find your way around the admin tools.",
};



const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "");

function HeaderBtn({ onClick, title, active, children }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} aria-pressed={active}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${active ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}>
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
    </button>
  );
}

/* **bold**, "- " bullets and line breaks → React elements (never raw HTML). */
function RichText({ text }) {
  const inline = (s, k) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <b key={`${k}-${i}`} className="font-semibold text-slate-900">{p.slice(2, -2)}</b> : p);
  const blocks = [];
  let list = null;
  text.split(/\n/).forEach((line, i) => {
    const m = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (m) { (list ||= []).push(<li key={i}>{inline(m[1], i)}</li>); return; }
    if (list) { blocks.push(<ul key={`u${i}`} className="my-1 list-disc space-y-0.5 pl-5">{list}</ul>); list = null; }
    if (line.trim()) blocks.push(<p key={i} className="my-1">{inline(line, i)}</p>);
  });
  if (list) blocks.push(<ul key="u-end" className="my-1 list-disc space-y-0.5 pl-5">{list}</ul>);
  return <>{blocks}</>;
}

function pickVoice() {
  const vs = window.speechSynthesis?.getVoices?.() || [];
  const en = vs.filter((v) => /^en/i.test(v.lang));
  return en.find((v) => /female|zira|samantha|aria|jenny|heera|veena|susan|google uk english female|google us english/i.test(v.name)) || en[0] || null;
}

export default function Stella() {
  const { auth } = useAuth();
  const role = auth?.role || "visitor";
  const nav = useNavigate();
  const loc = useLocation();
  const key = `jobbay.stella.v1.${role}`;

  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState(() => { try { return JSON.parse(sessionStorage.getItem(key)) || []; } catch { return []; } });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [teaser, setTeaser] = useState(() => !localStorage.getItem("jobbay.stella.greetClosed"));
  const [voiceOn, setVoiceOn] = useState(() => localStorage.getItem("jobbay.stella.voice") === "1");
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const recRef = useRef(null);
  const panelRef = useRef(null);
  const launcherRef = useRef(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Click / tap anywhere outside the chat window (and outside the launcher) → minimise it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (panelRef.current?.contains(e.target) || launcherRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  useEffect(() => { if (!open) setConfirmClear(false); }, [open]);

  // Switching account (login / logout) loads that role's own conversation.
  useEffect(() => { try { setMsgs(JSON.parse(sessionStorage.getItem(key)) || []); } catch { setMsgs([]); } }, [key]);
  useEffect(() => { sessionStorage.setItem(key, JSON.stringify(msgs.slice(-40))); }, [key, msgs]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy, open]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 250); }, [open]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Greeting card: always shown (whenever the chat is closed) until the visitor
  // closes it with ✕ — remembered on this browser so it doesn't come back.
  const closeGreeting = () => { setTeaser(false); localStorage.setItem("jobbay.stella.greetClosed", "1"); };
  useEffect(() => () => window.speechSynthesis?.cancel?.(), []);

  const speak = useCallback((text) => {
    if (!voiceOn || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, "").replace(/^\s*[-*•]\s+/gm, ""));
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 1.02; u.pitch = 1.1;
    u.onstart = () => setSpeaking(true);
    u.onend = u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [voiceOn]);

  // Ask the server; on failure leave an error card that can retry the same question.
  const ask = useCallback(async (q, history) => {
    setBusy(true);
    try {
      const r = await api.post("/api/stella/chat", { message: q, history, page: loc.pathname });
      const links = (r.links || []).filter((l) => ALLOWED_PATHS.has(l?.to));
      setMsgs((m) => [...m, { role: "assistant", content: r.reply, suggestions: r.suggestions || [], links, at: Date.now() }]);
      speak(r.reply);
    } catch (e) {
      const limited = /fast|429/i.test(e?.message || "");
      if (limited) {
        setMsgs((m) => [...m, { role: "assistant", error: "limit", retry: q, history, at: Date.now(), content: e.message }]);
      } else {
        // Server unreachable: answer from Stella's built-in JobBay guide instead of failing.
        const g = guideAnswer(q);
        setMsgs((m) => [...m, { role: "assistant", content: g.reply, suggestions: g.suggestions, links: g.links, mode: "guide", at: Date.now() }]);
        speak(g.reply);
      }
    } finally {
      setBusy(false);
    }
  }, [loc.pathname, speak, role]);

  // Guided flow: the user picked (or typed) an account type → confirm and open the page.
  const choose = useCallback((idx, roleKey, typed) => {
    const m = msgs[idx];
    if (!m?.flow) return;
    const o = ROLE_OPTIONS.find((r) => r.key === roleKey);
    const to = flowTarget(m.flow, roleKey);
    setMsgs((all) => [
      ...all.map((x, i) => (i === idx ? { ...x, chosen: roleKey } : x)),
      { role: "user", content: typed || o.label, at: Date.now() },
      isHere(to)
        ? { role: "assistant", content: `The **${o.label} ${m.flow === "register" ? "registration" : "login"}** page is already open for you — just fill in the form. Is there anything else you'd like to ask?`, at: Date.now() }
        : { role: "assistant", content: flowConfirm(m.flow, roleKey), links: [{ to, label: m.flow === "register" ? `Open ${o.label} registration` : `Open ${o.label} login` }], at: Date.now() },
    ]);
    setTimeout(() => { if (!isHere(to)) nav(to); }, 900);
  }, [msgs, nav, loc.pathname, loc.search]);

  const send = useCallback((text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    // 1) answering Stella's "Who are you registering as?" question
    const lastIdx = msgs.length - 1;
    const pending = msgs[lastIdx]?.flow && !msgs[lastIdx]?.chosen ? lastIdx : -1;
    if (pending >= 0) {
      const r = matchRole(q);
      if (r) { choose(pending, r, q); return; }
    }
    // 2) "how do I register / log in?" → ask which account type (or go straight there if they said)
    const f = detectFlow(q);
    if (f) {
      const userMsg = { role: "user", content: q, at: Date.now() };
      if (f.role) {
        const to = flowTarget(f.flow, f.role);
        const o = ROLE_OPTIONS.find((x) => x.key === f.role);
        setMsgs((m) => [...m, userMsg, isHere(to)
          ? { role: "assistant", content: `The **${o.label} ${f.flow === "register" ? "registration" : "login"}** page is already open for you — just fill in the form. Is there anything else you'd like to ask?`, at: Date.now() }
          : { role: "assistant", content: flowConfirm(f.flow, f.role), links: [{ to, label: f.flow === "register" ? `Open ${o.label} registration` : `Open ${o.label} login` }], at: Date.now() }]);
        setTimeout(() => { if (!isHere(to)) nav(to); }, 900);
      } else {
        setMsgs((m) => [...m, userMsg, { role: "assistant", content: flowQuestion(f.flow), flow: f.flow, at: Date.now() }]);
      }
      return;
    }
    // 3) known JobBay topic → answer from the guide straight away
    const g = guideAnswer(q);
    if (g.score >= 2) {
      setMsgs((m) => [...m, { role: "user", content: q, at: Date.now() }]);
      setBusy(true);
      setTimeout(() => {
        setMsgs((m) => [...m, { role: "assistant", content: g.reply, suggestions: g.suggestions, links: g.links, at: Date.now() }]);
        setBusy(false);
        speak(g.reply);
      }, 450);
      return;
    }
    const history = msgs.filter((m) => !m.error).slice(-8).map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: q, at: Date.now() }]);
    ask(q, history);
  }, [input, busy, msgs, ask, choose, nav, speak, loc.pathname, loc.search]);

  const retry = (idx) => {
    const m = msgs[idx];
    if (!m?.retry || busy) return;
    setMsgs((all) => all.filter((_, i) => i !== idx));
    ask(m.retry, m.history || []);
  };

  const [copied, setCopied] = useState(null);
  const copy = (text, idx) => {
    navigator.clipboard?.writeText(text.replace(/\*\*/g, ""))
      .then(() => { setCopied(idx); setTimeout(() => setCopied(null), 1400); })
      .catch(() => {});
  };

  const toggleVoice = () => {
    const v = !voiceOn;
    setVoiceOn(v);
    localStorage.setItem("jobbay.stella.voice", v ? "1" : "0");
    if (!v) window.speechSynthesis?.cancel?.();
  };

  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const toggleMic = () => {
    if (!SR) return;
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = navigator.language || "en-IN";
    rec.interimResults = true;
    rec.onresult = (e) => setInput(Array.from(e.results).map((r) => r[0].transcript).join(" "));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  // Open a page from the chat. If it's the page already on screen, say so instead.
  const isHere = (to) => {
    const [path, query = ""] = to.split("?");
    if (loc.pathname.replace(/\/+$/, "") !== (path.replace(/\/+$/, "") || "")) {
      if (!(path === "/" && (loc.pathname === "/" || loc.pathname === ""))) return false;
    }
    if (!query) return true;
    const want = new URLSearchParams(query), have = new URLSearchParams(loc.search);
    return [...want].every(([k, v]) => have.get(k) === v);
  };
  const go = (to, label) => {
    if (isHere(to)) {
      setMsgs((m) => [...m, { role: "assistant", at: Date.now(),
        content: `The **${label || "page"}** page is already open for you. Is there anything else you'd like to ask?`,
        suggestions: ["What can I do here?"] }]);
      return;
    }
    nav(to);
    if (window.innerWidth < 640) setOpen(false);
  };
  const clear = () => { setMsgs([]); setConfirmClear(false); window.speechSynthesis?.cancel?.(); sessionStorage.removeItem(key); };
  const quick = QUICK[role] || QUICK.visitor;
  const firstName = useMemo(() => {
    const e = auth?.email || "";
    const n = e.split("@")[0].split(/[._\d-]/)[0];
    return n && role !== "visitor" ? n.charAt(0).toUpperCase() + n.slice(1) : "";
  }, [auth, role]);
  const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");

  const p = loc.pathname.replace(/\/+$/, "") || "/";
  // Public pages only — never inside a logged-in portal.
  const visible = !auth && (p === "/" || p === "/register" || p.startsWith("/register/") ||
    p === "/login" || p.startsWith("/login/") || p === "/about" || p === "/contact" || p.startsWith("/services/"));
  useEffect(() => { if (!visible) setOpen(false); }, [visible]);
  if (!visible) return null;

  return (
    <>
      {/* ---------- launcher ---------- */}
      <div ref={launcherRef} className="stella-launcher fixed bottom-0 right-3 z-[90] flex flex-col items-end sm:right-6">
        {teaser && !open && (
          <div role="status" className="stella-teaser relative mb-1.5 mr-2 flex items-center gap-1.5 rounded-full bg-white py-1.5 pl-3.5 pr-1.5 shadow-[0_10px_28px_-10px_rgba(12,48,96,.45)] ring-1 ring-slate-200">
            <span className="whitespace-nowrap text-[13px] font-medium text-slate-800">
              <span aria-hidden="true">👋</span> Hi, need help?
            </span>
            <button type="button" onClick={() => setOpen(true)}
                    className="sh-sync-click ml-1 shrink-0 rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#0ea5a0] px-3 py-1 text-xs font-bold text-white transition hover:brightness-110">
              Ask Stella
            </button>
            <button type="button" aria-label="Close message" onClick={closeGreeting}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
            <span className="absolute -bottom-[5px] right-9 h-2.5 w-2.5 rotate-45 bg-white [clip-path:polygon(100%_0,100%_100%,0_100%)] ring-1 ring-slate-200" />
          </div>
        )}
        {!teaser && !open && (
          <span className="stella-tag pointer-events-none absolute bottom-[34px] right-[82px] whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-md ring-1 ring-slate-200 sm:right-[88px]">
            Ask me anything
          </span>
        )}
        {open ? (
          <button type="button" onClick={() => setOpen(false)} aria-label="Close Stella" aria-expanded="true"
                  className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-[#0c3060] text-xl text-white shadow-[0_14px_34px_-8px_rgba(12,48,96,.55)] transition hover:scale-105 sm:mb-6">✕</button>
        ) : (
          <button type="button" onClick={() => setOpen(true)} aria-label="Chat with Stella, your AI assistant" aria-expanded="false"
                  className="stella-fab group relative block transition-transform duration-300 hover:-translate-y-1">
            <StellaCutout height={96} talking={speaking} className="drop-shadow-[0_10px_18px_rgba(12,48,96,.35)]" />
            <span className="absolute bottom-[22%] right-[12%] h-3 w-3 rounded-full border-2 border-white bg-emerald-400 shadow" />
          </button>
        )}
      </div>

      {/* ---------- panel ---------- */}
      {open && (
        <section role="dialog" aria-label="Stella, JobBay AI assistant"
                 ref={panelRef} className="stella-panel stella-glass fixed inset-0 z-[95] flex flex-col overflow-hidden sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(660px,calc(100vh-120px))] sm:w-[410px] sm:rounded-[28px]">
          <span aria-hidden="true" className="pointer-events-none absolute -left-24 top-24 h-64 w-64 rounded-full bg-[#60a5fa]/30 blur-3xl" />
          <span aria-hidden="true" className="pointer-events-none absolute -right-20 top-72 h-60 w-60 rounded-full bg-[#2dd4bf]/25 blur-3xl" />
          <span aria-hidden="true" className="pointer-events-none absolute bottom-10 left-16 h-48 w-48 rounded-full bg-[#f0abfc]/20 blur-3xl" />
          {/* header */}
          <header className="relative shrink-0 overflow-hidden bg-gradient-to-r from-[#1e3a8a] via-[#2563eb] to-[#0d9488] px-4 py-3.5 text-white shadow-[0_10px_24px_-14px_rgba(30,58,138,.9)]">
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-white/0" />
            <span aria-hidden="true" className="stella-sheen pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-white/0 via-white/20 to-white/0" />
            <span className="pointer-events-none absolute -right-8 -top-14 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <span className="relative">
                <StellaAvatar size={44} talking={busy || speaking} />
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#1e3a8a] bg-emerald-400" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-heading text-[17px] font-bold leading-tight">
                  Stella
                  <span className="rounded-md bg-white/20 px-1.5 py-[1px] text-[9.5px] font-bold uppercase tracking-wider">AI</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-white/80">
                  <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" /></span>
                  {busy ? "Typing…" : speaking ? "Speaking…" : "Online · JobBay assistant"}
                </div>
              </div>
              <HeaderBtn onClick={toggleVoice} title={voiceOn ? "Turn voice off" : "Read replies aloud"} active={voiceOn}>
                {voiceOn
                  ? <path d="M11 5 6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
                  : <path d="M11 5 6 9H3v6h3l5 4V5zM22 9l-6 6M16 9l6 6" />}
              </HeaderBtn>
              {msgs.length > 0 && (
                <HeaderBtn onClick={() => setConfirmClear((v) => !v)} title="Clear chat" active={confirmClear}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></HeaderBtn>
              )}
              <HeaderBtn onClick={() => setOpen(false)} title="Minimise"><path d="m6 9 6 6 6-6" /></HeaderBtn>
            </div>
          </header>

          {confirmClear && (
            <div role="alertdialog" aria-label="Clear chat" className="stella-msg relative z-10 mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-white/90 p-3 shadow-[0_12px_30px_-14px_rgba(15,23,42,.45)] ring-1 ring-rose-100 backdrop-blur">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600">
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-slate-800">Clear this chat?</div>
                <div className="text-[11.5px] text-slate-500">All messages will be removed.</div>
              </div>
              <button type="button" onClick={() => setConfirmClear(false)} className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button type="button" onClick={clear} className="rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-[0_6px_14px_-6px_rgba(225,29,72,.8)] hover:brightness-110">Clear</button>
            </div>
          )}

          {/* messages */}
          <div className="stella-scroll relative flex-1 overflow-y-auto px-4 py-4">
            {msgs.length === 0 ? (
              <div className="stella-welcome flex flex-col items-center pt-1 text-center">
                <StellaAvatar size={84} className="!ring-4" />
                <h3 className="mt-3 font-heading text-[19px] font-bold text-slate-900">
                  {greeting()}{firstName ? `, ${firstName}` : ""}! I'm Stella
                </h3>
                <p className="mt-1 max-w-[300px] text-[13.5px] leading-snug text-slate-500">{INTRO[role] || INTRO.visitor}</p>
                <div className="mt-4 w-full rounded-2xl bg-white/70 p-2 text-left shadow-[0_10px_30px_-18px_rgba(15,23,42,.5)] ring-1 ring-white/80 backdrop-blur-md">
                  <div className="px-2 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Popular questions</div>
                  {quick.map((c) => (
                    <button key={c.t} type="button" onClick={() => send(c.q)}
                            className="group flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-slate-50">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-50 to-teal-50 text-base ring-1 ring-blue-100">{c.icon}</span>
                      <span className="flex-1 text-[13.5px] font-semibold text-slate-800">{c.t}</span>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="space-y-1">
                <li className="flex items-center gap-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" />Today<span className="h-px flex-1 bg-slate-200" />
                </li>
                {msgs.map((m, i) => {
                  const prev = msgs[i - 1], next = msgs[i + 1];
                  const first = !prev || prev.role !== m.role;
                  const last = !next || next.role !== m.role;
                  if (m.role === "user") {
                    return (
                      <li key={i} className={`stella-msg flex flex-col items-end ${first ? "pt-3" : ""}`}>
                        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-[#3b82f6] via-[#2563eb] to-[#1e40af] px-3.5 py-2.5 text-[14px] leading-relaxed text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_10px_20px_-10px_rgba(37,99,235,.85)]">
                          {m.content}
                        </div>
                        {last && <span className="mt-1 pr-1 text-[10.5px] text-slate-400">You · {fmtTime(m.at)}</span>}
                      </li>
                    );
                  }
                  return (
                    <li key={i} className={`stella-msg flex items-end gap-2 ${first ? "pt-3" : ""}`}>
                      <span className="w-8 shrink-0">{last && <StellaAvatar size={32} />}</span>
                      <div className="group min-w-0 max-w-[82%]">
                        {first && <div className="mb-1 pl-1 text-[11px] font-semibold text-slate-500">Stella</div>}
                        {m.error ? (
                          <div className={`rounded-2xl rounded-bl-md p-3 ring-1 ${m.error === "limit" ? "bg-amber-50 ring-amber-200" : "bg-rose-50 ring-rose-200"}`}>
                            <div className="flex items-start gap-2.5">
                              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${m.error === "limit" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-600"}`}>
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v5M12 16.5h.01" /><circle cx="12" cy="12" r="9" /></svg>
                              </span>
                              <div className="min-w-0">
                                <div className="text-[13px] font-bold text-slate-800">{m.error === "limit" ? "Please slow down" : "Message not delivered"}</div>
                                <p className="mt-0.5 text-[12.5px] leading-snug text-slate-600">{m.content}</p>
                                {m.retry && (
                                  <button type="button" onClick={() => retry(i)} disabled={busy}
                                          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50">
                                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
                                    Retry
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="relative rounded-2xl rounded-bl-md bg-white/80 px-3.5 py-2.5 text-[14px] leading-relaxed text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,.9),0_10px_24px_-14px_rgba(15,23,42,.45)] ring-1 ring-white/90 backdrop-blur-md">
                            <RichText text={m.content} />
                            <button type="button" onClick={() => copy(m.content, i)} title="Copy reply" aria-label="Copy reply"
                                    className="absolute -right-2 -top-2 hidden h-7 w-7 place-items-center rounded-full bg-white text-slate-400 shadow ring-1 ring-slate-200 transition hover:text-slate-700 group-hover:grid">
                              {copied === i
                                ? <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
                                : <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>}
                            </button>
                          </div>
                        )}
                        {m.flow && (
                          <div className="mt-2 grid gap-1.5" role="group" aria-label="Choose an account type">
                            {ROLE_OPTIONS.map((o) => {
                              const picked = m.chosen === o.key, done = !!m.chosen;
                              return (
                                <button key={o.key} type="button" disabled={done} onClick={() => choose(i, o.key)}
                                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left shadow-sm ring-1 transition ${picked
                                          ? "bg-gradient-to-r from-[#2563eb] to-[#0d9488] text-white ring-transparent"
                                          : done ? "bg-white/50 text-slate-400 ring-slate-200/60" : "bg-white/85 ring-blue-100 hover:-translate-y-0.5 hover:bg-white hover:ring-blue-300"}`}>
                                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg ${picked ? "bg-white/20" : "bg-gradient-to-br from-blue-50 to-teal-50 ring-1 ring-blue-100"}`}>{o.icon}</span>
                                  <span className="min-w-0 flex-1">
                                    <span className={`block text-[13.5px] font-bold ${picked ? "text-white" : done ? "" : "text-slate-800"}`}>{o.label}</span>
                                    <span className={`block text-[11.5px] ${picked ? "text-white/85" : "text-slate-500"}`}>{o.desc}</span>
                                  </span>
                                  {picked
                                    ? <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7" /></svg>
                                    : !done && <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {m.links?.length > 0 && (
                          <div className={`mt-2 grid gap-1.5 ${m.links.length > 3 ? "grid-cols-2" : "grid-cols-1"}`}>
                            {m.links.map((l) => (
                              <button key={l.to} type="button" onClick={() => go(l.to, l.label)}
                                      className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-left text-[13px] font-semibold text-blue-700 shadow-sm ring-1 ring-blue-100 transition hover:bg-blue-50 hover:ring-blue-200">
                                {l.label}
                                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                              </button>
                            ))}
                          </div>
                        )}
                        {last && <div className="mt-1 pl-1 text-[10.5px] text-slate-400">{fmtTime(m.at)}</div>}
                      </div>
                    </li>
                  );
                })}
                {busy && (
                  <li className="flex items-end gap-2 pt-3">
                    <span className="w-8 shrink-0"><StellaAvatar size={32} talking /></span>
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-white px-3.5 py-3 shadow-sm ring-1 ring-slate-200/80">
                      <span className="stella-typing flex gap-1"><i /><i /><i /></span>
                      <span className="text-[12px] text-slate-400">Stella is typing</span>
                    </div>
                  </li>
                )}
              </ul>
            )}
            <div ref={endRef} />
          </div>

          {/* suggestions */}
          {!busy && lastAssistant?.suggestions?.length > 0 && msgs[msgs.length - 1] === lastAssistant && (
            <div className="relative shrink-0 border-t border-white/60 bg-white/50 px-4 pb-1 pt-2.5 backdrop-blur-md">
              <div className="stella-scroll flex gap-2 overflow-x-auto pb-1.5">
                {lastAssistant.suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)}
                          className="shrink-0 rounded-full bg-blue-50 px-3 py-1.5 text-[12.5px] font-semibold text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-100">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* composer */}
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="relative shrink-0 border-t border-white/70 bg-white/60 px-3 pb-2.5 pt-2.5 backdrop-blur-xl">
            <div className="flex items-end gap-1.5 rounded-2xl bg-white/85 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_8px_20px_-14px_rgba(15,23,42,.5)] ring-1 ring-slate-200/80 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500">
              <textarea ref={inputRef} rows={1} value={input} maxLength={1200}
                        onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 110) + "px"; }}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                        placeholder={listening ? "Listening…" : "Ask Stella anything…"} aria-label="Message Stella"
                        className="max-h-[110px] min-h-[40px] flex-1 resize-none border-0 bg-transparent px-2.5 py-2.5 text-[14px] text-slate-800 outline-none placeholder:text-slate-400" />
              {SR && (
                <button type="button" onClick={toggleMic} title={listening ? "Stop listening" : "Speak your question"}
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${listening ? "stella-listening bg-rose-500 text-white" : "text-slate-500 hover:bg-slate-200/70"}`}>
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                </button>
              )}
              <button type="submit" disabled={!input.trim() || busy} aria-label="Send"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#1d4ed8] to-[#0e9488] text-white shadow-[0_6px_14px_-6px_rgba(29,78,216,.8)] transition enabled:hover:brightness-110 disabled:bg-none disabled:bg-slate-300 disabled:shadow-none">
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" /></svg>
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1 text-[10.5px] text-slate-400">
              <span><b className="font-semibold text-slate-500">Enter</b> to send · <b className="font-semibold text-slate-500">Shift + Enter</b> new line</span>
              <span>AI can make mistakes</span>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
