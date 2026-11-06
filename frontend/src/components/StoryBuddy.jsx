import { useState } from "react";

/* Ravi — the job seeker's side of the "How it works" story, as a small
   illustrated scene beside the laptop. He is dressed formally (blazer,
   white shirt, tie) and every pose matches what the laptop is showing:

     01  waits while his institute uploads → reads the login email on his
         phone → fist-pump "Logged in!"
     02  clicks through resume templates with the mouse → thumbs up
     03  types a job search → clicks Apply → thumbs up "Applied!"
     04  interview: listens, answers with a gesture, shakes hands at the end
     05  watches his status change at the desk → stands and jumps, "I'M HIRED!"

   Timings mirror the scenes in ScrollStory.jsx (Upload / Resume / Search /
   Connect / Track). Pure SVG + CSS. Hover: he says hi. Click: he hops. */

const W = 280, H = 186, FLOOR = 176;
const TEMPLATES = [
  ["Classic", "#4f46e5"], ["Modern", "#4f46e5"], ["Forest", "#41922e"], ["Professional", "#4f46e5"],
  ["Executive", "#41922e"], ["Minimal", "#334155"], ["Timeline", "#4f46e5"], ["Trades", "#41922e"],
];
const STATUSES = ["Applied", "Under Review", "Shortlisted", "Interview", "Offered", "Hired"];

const clamp = (v) => Math.min(1, Math.max(0, v));
const span = (t, a, b) => clamp((t - a) / (b - a));
const ease = (t) => 1 - Math.pow(1 - t, 3);

/* ---------------------------------------------------------------------
   What Ravi does at each moment — mirrors the laptop scenes' timings.
   pose = his arm/hand action; mood = face.
   --------------------------------------------------------------------- */
function moment(idx, t) {
  if (idx === 0) { // UploadScene: dialog .25–.52, table .58+, "logins emailed" .93
    if (t < 0.52) return { scene: "desk", screen: "wait", pose: "chin", mood: "calm", line: "My institute is uploading my details…" };
    if (t < 0.9) return { scene: "desk", screen: "mail", pose: "phone", mood: "wow", line: "📩 My login details arrived!" };
    return { scene: "desk", screen: "welcome", pose: "fist", mood: "joy", line: "Logged in! 👋" };
  }
  if (idx === 1) { // ResumeScene: template changes .05–.9, "saved" .93
    const sel = Math.min(TEMPLATES.length - 1, Math.floor(span(t, 0.05, 0.9) * TEMPLATES.length));
    if (t >= 0.92) return { scene: "desk", screen: "resume", sel, pose: "thumb", mood: "joy", line: "My resume is ready ✅" };
    return { scene: "desk", screen: "resume", sel, pose: "mouse", mood: "smile", line: `Trying the ${TEMPLATES[sel][0]} design…` };
  }
  if (idx === 2) { // SearchScene: filters typed .0–.46, results .55, download .86
    if (t < 0.55) return { scene: "desk", screen: "jobs", pose: "type", mood: "calm", line: "Searching for Electrician jobs…" };
    if (t < 0.86) return { scene: "desk", screen: "apply", pose: "mouse", mood: "smile", line: "Clicking Apply on BuildRight Infra…" };
    return { scene: "desk", screen: "applied", pose: "thumb", mood: "joy", line: "Applied! ✅" };
  }
  if (idx === 3) { // ConnectScene chat: .55 r / .66 s / .77 r / .88 s
    if (t < 0.3) return { scene: "interview", speaker: 205, line: "Welcome, Ravi! Please sit." };
    if (t < 0.55) return { scene: "interview", speaker: 52, line: "Thank you, sir. Good morning." };
    if (t < 0.77) return { scene: "interview", speaker: 252, line: "Tell us about your wiring work." };
    if (t < 0.9) return { scene: "interview", speaker: 52, line: "5 years of house & panel wiring." };
    return { scene: "interview", speaker: 205, shake: true, line: "Great — welcome aboard soon! 🤝" };
  }
  // TrackScene: Applied → Under Review → Shortlisted → Interview → Offered → Hired (.82)
  const fill = ease(span(t, 0.04, 0.8));
  const reached = Math.min(5, Math.floor(fill * 5 + 0.001));
  if (t > 0.82) return { scene: "hired", line: "I got the job! 🎉" };
  return {
    scene: "desk", screen: "status", reached, fill,
    pose: ["chin", "chin", "fist", "thumb", "wow", "fist"][reached],
    mood: ["calm", "calm", "joy", "smile", "wow", "joy"][reached],
    line: ["Applied — now waiting… 🤞", "Under review… 🤞", "Shortlisted! 😮", "Interview round 💼", "An offer?! 😲", "Hired!"][reached],
  };
}

/* ---------------------------------------------------------------------
   Formal seated man in profile, facing LEFT, origin at the seat.
   --------------------------------------------------------------------- */
const POSE = {
  //        elbow        hand        hand drawn as
  type:  { e: [-15, -17], h: [-42, -19] },
  mouse: { e: [-12, -16], h: [-28, -19], cls: "rv-click" },
  table: { e: [-15, -16], h: [-34, -16] },
  gesture: { e: [-18, -25], h: [-31, -36], cls: "rv-gesture" },
  chin:  { e: [-18, -20], h: [-15, -45] },
  phone: { e: [-17, -22], h: [-24, -46], prop: "phone" },
  fist:  { e: [-20, -40], h: [-14, -64], prop: "fist", cls: "rv-pump" },
  thumb: { e: [-18, -26], h: [-30, -40], prop: "thumb" },
  wow:   { e: [-18, -30], h: [-20, -52] },
  shake: { e: [-26, -26], h: [-58, -28], prop: "shake", cls: "rv-shake" },
};

function Man({ blazer = "#1e3a8a", shirt = "#ffffff", tie = "#dc2626", pants = "#334155",
               skin = "#f1c27d", skinShade = "#d9a066", hair = "#111827", grey, glasses, bun,
               pose = "table", mood = "calm", talking, typing, chair = "#475569" }) {
  const P = POSE[pose] || POSE.table;
  const sleeve = (dx, dy, color) => (
    <g className={typing ? (dx ? "rv-type-b" : "rv-type-a") : (!dx && P.cls) || ""}>
      <polyline points={`${-4 + dx},${-34 + dy} ${P.e[0] + dx},${P.e[1] + dy} ${P.h[0] + dx},${P.h[1] + dy}`}
                fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      {/* white cuff */}
      <circle cx={P.h[0] + dx + (P.e[0] - P.h[0]) * 0.12} cy={P.h[1] + dy + (P.e[1] - P.h[1]) * 0.12} r="4.4" fill={shirt} />
      {!dx && P.prop === "phone" && (
        <g>
          <rect x={P.h[0] - 7} y={P.h[1] - 10} width="9" height="15" rx="2" fill="#0f172a" />
          <rect x={P.h[0] - 6} y={P.h[1] - 8.5} width="7" height="11" rx="1" fill="#a5b4fc" className="rv-pulse" />
        </g>
      )}
      <circle cx={P.h[0] + dx} cy={P.h[1] + dy} r="3.8" fill={skin} />
      {!dx && P.prop === "thumb" && <rect x={P.h[0] - 1.6} y={P.h[1] - 8} width="3.2" height="6" rx="1.6" fill={skin} />}
      {!dx && P.prop === "fist" && <circle cx={P.h[0]} cy={P.h[1]} r="4.6" fill={skin} />}
    </g>
  );
  const eyeY = pose === "phone" ? -56.5 : -58;
  return (
    <g>
      {/* chair */}
      <rect x="14" y="-44" width="7" height="49" rx="3.5" fill={chair} />
      <rect x="-15" y="0" width="36" height="6" rx="3" fill={chair} />
      <rect x="1" y="6" width="4" height="34" fill="#64748b" />
      <rect x="-12" y="40" width="31" height="5" rx="2.5" fill="#64748b" />
      {/* trousers + polished shoes */}
      <rect x="-37" y="-9" width="43" height="12" rx="6" fill={pants} />
      <rect x="-37" y="-3" width="11.5" height="42" rx="5" fill={pants} />
      <path d="M-47 44 Q-47 36 -38 36 L-24 36 Q-22 36 -22 40 L-22 44 Z" fill="#111827" />
      <path d="M-44 38.5 l6 0" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />
      {/* back arm (shadowed sleeve) */}
      {sleeve(4, -1, "#172554")}
      {/* torso: blazer, shirt front, collar, tie, lapel, pocket square */}
      <rect x="-14" y="-43" width="28" height="47" rx="11" fill={blazer} />
      <path d="M-14 -40 Q-14 -43 -10 -43 L-4 -43 L-7 -16 L-14 -16 Z" fill={shirt} />
      <path d="M-11 -41 L-5 -41 L-6.5 -21 L-8.5 -17 L-10.5 -21 Z" fill={tie} />
      <path d="M-10.5 -41 L-5.5 -41 L-8 -37.5 Z" fill="#991b1b" />
      <path d="M-4 -43 L-7 -16" stroke="#0b1d4d" strokeWidth="1.4" />
      <path d="M-4 -43 L1 -33 L-5.6 -28" stroke="#0b1d4d" strokeWidth="1.2" fill="none" />
      <path d="M3 -30 l5 0 l-1 3 l-3 0 Z" fill="#fff" opacity=".9" />
      <circle cx="-5.5" cy="-12" r="1" fill="#0b1d4d" />
      {/* head */}
      <g className={talking ? "" : "rv-nod"} style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}>
        <rect x="-6" y="-48" width="9" height="8" rx="3" fill={skinShade} />
        {/* white collar points */}
        <path d="M-9 -44 L-3 -44 L-6 -39 Z M-3 -44 L2 -44 L-1 -39 Z" fill={shirt} />
        {/* face with jaw */}
        <path d="M-17 -60 C-17 -73 9 -74 11 -60 C12 -51 8 -45 0 -44 C-7 -43 -13 -46 -16 -51 C-17 -54 -17 -57 -17 -60 Z" fill={skin} />
        {/* hair: neat side part, or bun / grey */}
        <path d="M-18 -60 C-19 -76 10 -79 13 -62 C13 -56 11 -51 9 -48 L8 -58 C5 -64 -2 -67 -10 -66 C-14 -65 -17 -63 -18 -60 Z"
              fill={grey ? "#9ca3af" : hair} />
        <path d="M-15 -66 C-8 -71 2 -71 8 -66" stroke={grey ? "#d1d5db" : "#374151"} strokeWidth="1.2" fill="none" opacity=".8" />
        {bun && <circle cx="12" cy="-70" r="6.5" fill={hair} />}
        {/* ear */}
        <ellipse cx="5" cy="-56" rx="3.2" ry="4.2" fill={skinShade} />
        <path d="M5 -58 q1.5 2 0 4" stroke="#b07a4a" strokeWidth=".9" fill="none" />
        {/* eye */}
        {mood === "joy" ? (
          <path d="M-14.5 -58 q2.6 -3.2 5.2 0" stroke="#0f172a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        ) : (
          <g className="rv-blink" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            <ellipse cx="-11.5" cy={eyeY} rx="2.6" ry={mood === "wow" ? 2.8 : 2.2} fill="#fff" />
            <circle cx="-12.6" cy={eyeY + 0.2} r="1.5" fill="#0f172a" />
          </g>
        )}
        {glasses && <><circle cx="-11.5" cy="-58" r="4.4" fill="none" stroke="#1f2937" strokeWidth="1.2" /><path d="M-7 -58.5 L4 -59" stroke="#1f2937" strokeWidth="1" /></>}
        {/* eyebrow */}
        <path d={mood === "wow" ? "M-15 -65 q3.5 -2.5 7 -0.5" : "M-15 -63 q3.5 -1.8 7 0"} stroke={grey ? "#6b7280" : hair}
              strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {/* nose */}
        <path d="M-16.5 -55.5 l-2.3 3.4 l2.6 0.5" stroke={skinShade} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* mouth */}
        {talking ? (
          <ellipse cx="-12.5" cy="-48.6" rx="2.3" ry="1.6" fill="#7f1d1d" className="rv-talk" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
        ) : mood === "joy" ? (
          <path d="M-16 -50 q3.5 4.5 7 0 Z" fill="#7f1d1d" />
        ) : mood === "wow" ? (
          <ellipse cx="-12.5" cy="-48.6" rx="1.8" ry="2.3" fill="#7f1d1d" />
        ) : mood === "smile" ? (
          <path d="M-15.5 -50 q3 3 6 0" stroke="#7f1d1d" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M-15 -49.3 l4.5 0.3" stroke="#7f1d1d" strokeWidth="1.5" strokeLinecap="round" />
        )}
        <circle cx="-7" cy="-51.5" r="2.4" fill="#f59e8b" opacity={mood === "joy" ? 0.55 : 0.25} />
      </g>
      {/* front arm (blazer sleeve) */}
      {sleeve(0, 0, blazer)}
    </g>
  );
}

/* ---------------------------------------------------------------------
   The monitor on his desk shows what he is doing.
   --------------------------------------------------------------------- */
function Screen({ m }) {
  const T = (x, y, s, txt, fill = "#0f172a", w = 700) =>
    <text x={x} y={y} fontSize={s} fontWeight={w} fill={fill} fontFamily="Inter, sans-serif">{txt}</text>;
  const header = (title) => (<><rect x="0" y="0" width="70" height="10" fill="#4f46e5" />{T(3.5, 7.2, 5.6, title, "#fff", 800)}</>);
  const cursor = (x, y) => (
    <path d={`M${x} ${y} l0 7 l2 -2 l1.5 3 l1.2 -.6 l-1.5 -3 l2.8 0 Z`} fill="#0f172a" stroke="#fff" strokeWidth=".5" />
  );
  switch (m.screen) {
    case "wait":
      return (<g>{header("INBOX")}
        {[16, 26, 36].map((y) => <rect key={y} x="5" y={y} width="60" height="6" rx="2" fill="#e2e8f0" />)}
        <g className="rv-spin" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          <circle cx="58" cy="45" r="3.5" fill="none" stroke="#4f46e5" strokeWidth="1.5" strokeDasharray="12 10" />
        </g></g>);
    case "mail":
      return (<g>{header("INBOX")}
        <rect x="3" y="14" width="64" height="15" rx="2.5" fill="#eef2ff" stroke="#a5b4fc" strokeWidth=".8" className="rv-pulse" />
        <rect x="6" y="17" width="11" height="8" rx="1.5" fill="#fff" stroke="#4f46e5" strokeWidth=".9" />
        <path d="M6 17 l5.5 4 l5.5 -4" stroke="#4f46e5" strokeWidth=".9" fill="none" />
        {T(20, 21.5, 5, "Your login")}{T(20, 27, 4.4, "QCloneJob", "#64748b", 600)}
        <rect x="5" y="34" width="60" height="5" rx="2" fill="#e2e8f0" />
        <rect x="5" y="42" width="44" height="5" rx="2" fill="#e2e8f0" /></g>);
    case "welcome":
      return (<g>{header("QCLONEJOB")}
        <circle cx="35" cy="27" r="8" fill="#4faa38" className="rv-pop" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
        <path d="M31 27 l3 3 l6 -6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {T(14.5, 45, 6.2, "Welcome, Ravi!")}</g>);
    case "resume": {
      const [, color] = TEMPLATES[m.sel];
      return (<g>{header("RESUME DESIGN")}
        <g key={m.sel} className="rv-pop" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          <rect x="16" y="13" width="38" height="36" rx="1.5" fill="#fff" stroke="#e2e8f0" />
          <rect x="16" y="13" width="38" height="9" fill={color} />
          <circle cx="22" cy="17.5" r="3" fill="#fff" />
          {[26, 31, 36, 41].map((y, i) => <rect key={y} x="19" y={y} width={30 - i * 5} height="2.4" rx="1.2" fill="#cbd5e1" />)}
        </g>
        {cursor(50, 38)}</g>);
    }
    case "jobs":
    case "apply":
    case "applied": {
      const btn = m.screen === "applied"
        ? <><rect x="45" y="18" width="21" height="9" rx="2.5" fill="#4faa38" />{T(47.2, 24.6, 5, "Applied", "#fff", 800)}</>
        : <><rect x="47" y="18" width="18" height="9" rx="2.5" fill={m.screen === "apply" ? "#4f46e5" : "#c7d2fe"}
                  className={m.screen === "apply" ? "rv-pulse" : ""} />{T(50, 24.6, 5, "Apply", "#fff", 800)}</>;
      return (<g>{header("FIND JOBS")}
        {m.screen === "jobs" && <rect x="3" y="12" width="64" height="0" />}
        <rect x="3" y="13" width="64" height="18" rx="2.5" fill="#fff" stroke={m.screen === "applied" ? "#4faa38" : "#c7d2fe"} />
        {T(6, 21, 5.4, "Electrician")}{T(6, 27.5, 4.2, "BuildRight · Hyd", "#64748b", 600)}
        {btn}
        <rect x="3" y="34" width="64" height="13" rx="2.5" fill="#f8fafc" stroke="#e2e8f0" />
        <rect x="6" y="38" width="30" height="3" rx="1.5" fill="#cbd5e1" />
        <rect x="6" y="43" width="20" height="2" rx="1" fill="#e2e8f0" />
        {m.screen !== "jobs" && cursor(57, 23)}</g>);
    }
    case "status":
      return (<g>{header("MY APPLICATIONS")}
        {T(5, 20, 5.4, "Electrician")}
        <rect x="5" y="25" width="60" height="3.5" rx="1.75" fill="#e2e8f0" />
        <rect x="5" y="25" width={60 * m.fill} height="3.5" rx="1.75" fill="#4faa38" />
        <g key={m.reached} className="rv-pop" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          <rect x="5" y="33" width="44" height="10" rx="5" fill={m.reached >= 2 ? "#dcfce7" : "#fef3c7"} />
          {T(8.5, 40, 5, STATUSES[m.reached], m.reached >= 2 ? "#15803d" : "#b45309", 800)}
        </g></g>);
    default:
      return null;
  }
}

function DeskScene({ m }) {
  return (
    <g transform="translate(10 6)">
      {/* window + plant for a bit of office life */}
      <rect x="6" y="16" width="34" height="40" rx="3" fill="#e0f2fe" stroke="#cbd5e1" />
      <path d="M23 16 v40 M6 36 h34" stroke="#cbd5e1" />
      <rect x="20" y="138" width="16" height="32" rx="3" fill="#e2e8f0" />
      <path d="M28 140 C18 128 16 118 22 110 M28 140 C34 124 40 118 44 112 M28 140 C27 126 29 116 29 106"
            stroke="#4faa38" strokeWidth="4" fill="none" strokeLinecap="round" />
      {/* desk */}
      <rect x="44" y="104" width="124" height="6" rx="2" fill="#92400e" />
      <rect x="50" y="110" width="5" height="60" fill="#78350f" />
      <rect x="157" y="110" width="5" height="60" fill="#78350f" />
      {/* mug */}
      <rect x="50" y="93" width="9" height="11" rx="2" fill="#fff" stroke="#cbd5e1" />
      <path d="M59 96 q4 0 4 3 q0 3 -4 3" stroke="#cbd5e1" fill="none" strokeWidth="1.5" />
      <path d="M53 89 q2 -3 0 -5 M56 89 q2 -3 0 -5" stroke="#cbd5e1" strokeWidth="1" fill="none" className="rv-steam" />
      {/* monitor */}
      <rect x="64" y="38" width="76" height="58" rx="4" fill="#0f172a" />
      <svg x="67" y="41" width="70" height="52" viewBox="0 0 70 52">
        <rect width="70" height="52" fill="#fff" />
        <Screen m={m} />
      </svg>
      <rect x="98" y="96" width="9" height="8" fill="#334155" />
      <rect x="89" y="102" width="27" height="3" rx="1.5" fill="#334155" />
      {/* keyboard + mouse */}
      <rect x="128" y="101" width="22" height="3.5" rx="1.5" fill="#cbd5e1" />
      <rect x="154" y="100.5" width="8" height="4" rx="2" fill="#e2e8f0" stroke="#94a3b8" strokeWidth=".6" />
      <g transform="translate(188 124)">
        <Man pose={m.pose} mood={m.mood} typing={m.pose === "type"} />
      </g>
    </g>
  );
}

function InterviewScene({ m }) {
  return (
    <g>
      {/* office wall details */}
      <rect x="112" y="22" width="40" height="26" rx="2" fill="#eef2ff" stroke="#c7d2fe" />
      <text x="132" y="38" textAnchor="middle" fontSize="6" fontWeight="800" fill="#4f46e5" fontFamily="Inter, sans-serif">BUILDRIGHT</text>
      {/* Ravi, facing right */}
      <g style={{ transform: `translate(${m.shake ? 68 : 52}px, 130px) scale(-1, 1)`, transition: "transform .5s ease-out" }}>
        <Man pose={m.shake ? "shake" : m.speaker === 52 ? "gesture" : "table"} talking={m.speaker === 52}
             mood={m.shake ? "joy" : "smile"} />
      </g>
      {/* interviewers, facing left */}
      <g style={{ transform: `translate(${m.shake ? 190 : 205}px, 130px)`, transition: "transform .5s ease-out" }}>
        <Man blazer="#111827" tie="#4f46e5" grey glasses pants="#1f2937" chair="#334155"
             pose={m.shake ? "shake" : m.speaker === 205 ? "gesture" : "table"} talking={m.speaker === 205}
             mood={m.shake ? "joy" : "smile"} />
      </g>
      <g transform="translate(252 130)">
        <Man blazer="#0f766e" tie="#f59e0b" hair="#3f2d20" bun skin="#e8b48a" skinShade="#c98f5f" pants="#1f2937" chair="#334155"
             pose={m.speaker === 252 ? "gesture" : "table"} talking={m.speaker === 252} mood="smile" />
      </g>
      {/* table */}
      <rect x="78" y="109" width="104" height="6" rx="2" fill="#92400e" />
      <rect x="84" y="115" width="5" height="61" fill="#78350f" />
      <rect x="171" y="115" width="5" height="61" fill="#78350f" />
      <rect x="146" y="102" width="20" height="7" rx="1" fill="#fff" stroke="#e2e8f0" />
      <rect x="149" y="104.5" width="14" height="1.5" rx=".75" fill="#94a3b8" />
      <rect x="96" y="103" width="16" height="6" rx="1" fill="#fff" stroke="#e2e8f0" />
      <text x="98" y="107.4" fontSize="3.2" fontWeight="800" fill="#4f46e5" fontFamily="Inter, sans-serif">RESUME</text>
    </g>
  );
}

function HiredScene() {
  return (
    <g>
      {Array.from({ length: 16 }).map((_, i) => (
        <rect key={i} x={30 + ((i * 47) % 220)} y="-10" width="4" height="7" rx="1"
              fill={["#4faa38", "#4f46e5", "#f59e0b", "#ec4899"][i % 4]}
              className="rv-confetti" style={{ animationDelay: `${(i % 8) * 0.15}s`, transformBox: "fill-box", transformOrigin: "center" }} />
      ))}
      <ellipse cx="140" cy={FLOOR} rx="26" ry="4" fill="rgba(15,23,42,.14)" className="rv-shadow"
               style={{ transformBox: "fill-box", transformOrigin: "center" }} />
      <g className="rv-jump" transform="translate(15 16)">
        {/* sign */}
        <rect x="86" y="20" width="78" height="22" rx="4" fill="#4faa38" stroke="#fff" strokeWidth="2" />
        <text x="125" y="35.5" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff" fontFamily="Inter, sans-serif">I'M HIRED!</text>
        {/* arms up in blazer sleeves with white cuffs */}
        <path d="M112 86 L100 62 L98 47" stroke="#1e3a8a" strokeWidth="9.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M138 86 L150 62 L152 47" stroke="#1e3a8a" strokeWidth="9.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="98" cy="49" r="4.6" fill="#fff" /><circle cx="152" cy="49" r="4.6" fill="#fff" />
        <circle cx="98" cy="44" r="4.5" fill="#f1c27d" /><circle cx="152" cy="44" r="4.5" fill="#f1c27d" />
        {/* trousers + shoes, knees tucked mid-jump */}
        <path d="M118 124 L111 142 L119 157" stroke="#334155" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M132 124 L139 142 L131 157" stroke="#334155" strokeWidth="10" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M112 160 q0 -6 7 -6 l7 0 l0 6 Z M138 160 q0 -6 -7 -6 l-7 0 l0 6 Z" fill="#111827" />
        {/* blazer, shirt, tie */}
        <rect x="105" y="78" width="40" height="50" rx="14" fill="#1e3a8a" />
        <path d="M117 78 L125 106 L133 78 Z" fill="#fff" />
        <path d="M122.5 80 L127.5 80 L126.5 100 L125 103 L123.5 100 Z" fill="#dc2626" />
        <path d="M117 78 L121 92 L114 96 M133 78 L129 92 L136 96" stroke="#0b1d4d" strokeWidth="1.3" fill="none" />
        <path d="M134 88 l6 0 l-1 3 l-4 0 Z" fill="#fff" />
        {/* head, front view, big laugh */}
        <rect x="120" y="72" width="10" height="8" rx="3" fill="#d9a066" />
        <path d="M120 76 L125 81 L130 76" fill="none" stroke="#fff" strokeWidth="3" />
        <ellipse cx="125" cy="62" rx="16" ry="17" fill="#f1c27d" />
        <ellipse cx="109.5" cy="63" rx="3" ry="4" fill="#d9a066" /><ellipse cx="140.5" cy="63" rx="3" ry="4" fill="#d9a066" />
        <path d="M108 60 C107 42 143 41 142 60 C138 52 131 49 124 50 C117 50 111 53 108 60 Z" fill="#111827" />
        <path d="M113 51 C120 46 130 46 137 51" stroke="#374151" strokeWidth="1.2" fill="none" />
        <path d="M115 61 q3 -4 6 0 M129 61 q3 -4 6 0" stroke="#0f172a" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M115.5 56 q3 -2 6 0 M128.5 56 q3 -2 6 0" stroke="#111827" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M117 68 q8 10 16 0 Z" fill="#7f1d1d" />
        <path d="M119.5 68.5 q5.5 2.5 11 0" stroke="#fff" strokeWidth="1.6" fill="none" />
        <circle cx="113" cy="68" r="3" fill="#f59e8b" opacity=".55" /><circle cx="137" cy="68" r="3" fill="#f59e8b" opacity=".55" />
      </g>
    </g>
  );
}

export default function StoryBuddy({ idx, t }) {
  const [hover, setHover] = useState(false);
  const [hopTick, setHopTick] = useState(0);
  const m = moment(idx, t);
  const line = hover && m.scene !== "hired" ? "Hi! I'm Ravi — I found my job on QCloneJob 👋" : m.line;
  const speakerX = m.scene === "interview" && !hover ? m.speaker : m.scene === "hired" ? 230 : 196;
  const left = Math.min(78, Math.max(22, (speakerX / W) * 100));

  return (
    <div className="relative w-[310px] cursor-pointer select-none"
         onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
         onClick={() => setHopTick((n) => n + 1)}
         role="img" aria-label={`Ravi: ${line}`}>
      {m.scene !== "hired" && <div aria-hidden="true" className="absolute inset-x-0 bottom-0 top-9 rounded-[1.75rem] bg-gradient-to-b from-indigo-50 to-white shadow-[0_24px_48px_-20px_rgba(79,70,229,.45)] ring-1 ring-indigo-100" />}

      {m.scene !== "hired" && <div key={line} className="buddy-bubble absolute z-10 w-max max-w-[210px] rounded-2xl bg-white px-3 py-1.5 text-center text-[11px] font-bold leading-snug text-slate-800 shadow-lg ring-1 ring-slate-200"
           style={{ left: `${left}%`, top: m.scene === "hired" ? "70px" : "0px" }}>
        {line}
        <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-white ring-1 ring-slate-200 [clip-path:polygon(100%_0,100%_100%,0_100%)]" />
      </div>}

      <svg key={`${m.scene}-${hopTick}`} viewBox={`0 0 ${W} ${H}`} width="310" height={(310 * H) / W}
           className={`relative mt-9 overflow-visible transition-transform duration-300 ${hover ? "scale-[1.03]" : ""} ${hopTick ? "buddy-hop" : ""} rv-enter`}>
        {m.scene !== "hired" && <rect x="8" y={FLOOR} width={W - 16} height="2" rx="1" fill="#e2e8f0" />}
        {m.scene === "desk" && <DeskScene m={m} />}
        {m.scene === "interview" && <InterviewScene m={m} />}
        {m.scene === "hired" && <HiredScene />}
      </svg>
    </div>
  );
}
