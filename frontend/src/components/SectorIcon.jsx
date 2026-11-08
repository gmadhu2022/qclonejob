import { useState } from "react";

/* =====================================================================
   Crisp vector icons for job sectors.

   Emoji render differently on every OS — on Windows they come out small
   and soft — so sector tiles use these SVG line icons instead. They scale
   to any size without blurring and take the tile's colour.
   ===================================================================== */
const P = {
  tools: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />,
  hardhat: <><path d="M2 18h20M4 18v-2a8 8 0 0 1 16 0v2" /><path d="M10 8V5h4v3M9 12V9M15 12V9" /></>,
  home: <><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  utensils: <><path d="M5 3v8a2 2 0 0 0 4 0V3M7 11v10" /><path d="M17 3c-2 2-2.5 5-2 8h3v10" /></>,
  heart: <><path d="M20.8 6.6a5 5 0 0 0-8.8-2.4 5 5 0 0 0-8.8 2.4c-.6 4.5 4.3 8.6 8.8 12.9 4.5-4.3 9.4-8.4 8.8-12.9z" /><path d="M12 9v5M9.5 11.5h5" /></>,
  stethoscope: <><path d="M5 3v5a5 5 0 0 0 10 0V3" /><path d="M10 13v2a5 5 0 0 0 10 0v-1" /><circle cx="20" cy="12" r="2" /></>,
  leaf: <><path d="M11 20A7 7 0 0 1 4 13c0-6 7-10 16-10-1 9-4 16-9 17z" /><path d="M4 21c4-6 8-9 12-11" /></>,
  store: <><path d="M3 9 4.5 4h15L21 9" /><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /><path d="M5 11v9h14v-9M10 20v-5h4v5" /></>,
  truck: <><path d="M2 6h12v10H2zM14 10h4l4 4v2h-8" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  shield: <><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  factory: <><path d="M3 21V10l6 4V10l6 4V5h4v16z" /><path d="M7 17h2M12 17h2M17 17h1" /></>,
  code: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="m9 9-2 2 2 2M15 9l2 2-2 2M8 21h8" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>,
  cap: <><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v6" /></>,
  building: <><path d="M3 21h18M5 21V9l7-5 7 5v12" /><path d="M9 21v-6h6v6M9 11h.01M15 11h.01" /></>,
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  bank: <><path d="M3 10 12 4l9 6" /><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" /></>,
  signal: <><path d="M12 20v-6" /><circle cx="12" cy="12" r="2" /><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" /></>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  car: <><path d="M5 17H3v-5l2-5h14l2 5v5h-2" /><path d="M3 12h18" /><circle cx="7.5" cy="17" r="2" /><circle cx="16.5" cy="17" r="2" /></>,
  flask: <><path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9V3" /><path d="M7 15h10" /></>,
  cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6" /></>,
  camera: <><path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></>,
  film: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4M3 12h18" /></>,
  scale: <><path d="M12 3v18M7 21h10M5 7h14" /><path d="m5 7-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M14 9l2 2" /></>,
  plane: <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />,
  ship: <><path d="M2 21c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0" /><path d="M4 18 3 12h18l-2 6M12 12V3M12 4l5 4h-5" /></>,
  pickaxe: <><path d="M14.5 6.5 4 17l3 3L17.5 9.5" /><path d="M9 4c4-1 8 0 11 3 0 0-3-1-6 1" /></>,
  thread: <><circle cx="12" cy="12" r="8" /><path d="M7 7c3 2 7 6 10 10M5 12c3 0 7 2 9 7M12 4c0 4 2 8 7 9" /></>,
  package: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8M7.5 5.5l9 5" /></>,
  run: <><circle cx="14" cy="4" r="2" /><path d="m6 21 3-6 3 2v5M8 11l3-3 3 2 3 1M11 8l-1 5" /></>,
  hands: <><path d="M11 17 8.5 19.5a2 2 0 0 1-3-3L9 13M13 7l2.5-2.5a2 2 0 0 1 3 3L15 11" /><path d="m8 12 4-4 4 4-4 4z" /></>,
  badge: <><path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5z" /><path d="m12 8 1.2 2.6 2.8.3-2.1 1.9.6 2.7-2.5-1.4-2.5 1.4.6-2.7-2.1-1.9 2.8-.3z" /></>,
  microscope: <><path d="M6 18h8M3 22h18M14 22a7 7 0 1 0 0-14h-1" /><path d="M9 14h2M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2zM12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" /></>,
  paw: <><circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="4" cy="8" r="2" /><path d="M8 14c0-2 2-4 4-4s4 2 4 4c1 1 2 2 2 4a3 3 0 0 1-3 3c-1 0-2-.5-3-.5s-2 .5-3 .5a3 3 0 0 1-3-3c0-2 1-3 2-4z" /></>,
  recycle: <><path d="M7 19H4.8a1.8 1.8 0 0 1-1.6-2.7L7 9.5M11 19h8.2a1.8 1.8 0 0 0 1.6-2.7l-1.2-2M14 16l-3 3 3 3M8.3 5.3l1.4-2.4a1.8 1.8 0 0 1 3.1 0l4 6.8" /><path d="m13.4 9.4 3.4-.9.9 3.4" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>,
  bed: <><path d="M2 20V6M2 11h20v9M2 17h20M22 11a3 3 0 0 0-3-3h-8v3" /><circle cx="6.5" cy="9.5" r="1.5" /></>,
  mountain: <path d="m3 20 7-12 4 6 2-3 5 9z" />,
  map: <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
};

export const SECTOR_ICON_KEYS = Object.keys(P);

export default function SectorIcon({ name, size = 22, strokeWidth = 1.9, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {P[name] || P.briefcase}
    </svg>
  );
}

/**
 * Realistic 3D sector image (Microsoft Fluent Emoji, MIT licence) with a
 * gentle idle float and a bounce on hover. Falls back to the vector icon if
 * the image can't load.
 */
export function SectorImage({ name, sector, size = 40, animate = true, delay = 0, className = "" }) {
  // 0 = industry-specific image, 1 = generic icon image, 2 = vector icon
  const [stage, setStage] = useState(sector ? 0 : 1);
  const key = P[name] ? name : "briefcase";
  if (stage >= 2) return <SectorIcon name={key} size={size * 0.6} className={className} />;
  const src = stage === 0 ? `/sector-images/${sector}.png` : `/sector-icons/${key}.png`;
  return (
    <img key={src} src={src} alt="" width={size} height={size} draggable="false" loading="lazy"
         onError={() => setStage((n) => n + 1)}
         className={`select-none object-contain drop-shadow-[0_8px_10px_rgba(15,23,42,.22)] ${animate ? "icon-bob" : ""} ${className}`}
         style={{ width: size, height: size, animationDelay: `${delay}s` }} />
  );
}
