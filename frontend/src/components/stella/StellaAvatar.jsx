/**
 * Stella — portrait-based assistant avatar (images in /public/stella).
 *
 *   stella-open.webp   her portrait (transparent background, 530×676)
 *   stella-blink.webp  the same frame with eyes closed
 *
 * The blink frame is stacked on top and flashed by CSS (.sp-blink in index.css):
 * a natural rhythm with an occasional double blink. The figure also "breathes"
 * very slightly. prefers-reduced-motion turns both off.
 *
 * Coordinates below are in the 530×676 source image.
 */
const SRC_W = 530, SRC_H = 676;
const FACE = { x: 284, y: 212, box: 300 };    // square around her face for round avatars

function Layers({ style }) {
  return (
    <>
      <img src="/stella/stella-open.webp" alt="" draggable="false" className="absolute max-w-none select-none" style={style} />
      <img src="/stella/stella-blink.webp" alt="" draggable="false" className="sp-blink absolute max-w-none select-none" style={style} />
    </>
  );
}

/** Round face avatar: launcher, chat header, message bubbles. */
export default function StellaAvatar({ size = 48, talking = false, className = "" }) {
  const k = size / FACE.box;
  const style = { width: SRC_W * k, height: SRC_H * k, left: -(FACE.x - FACE.box / 2) * k, top: -(FACE.y - FACE.box / 2) * k };
  return (
    <span aria-hidden="true" style={{ width: size, height: size }}
          className={`sp-avatar relative inline-block shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#e8f1ff] to-[#c9dcff] ring-2 ring-white shadow-[0_6px_18px_-6px_rgba(12,48,96,.4)] ${talking ? "is-talking" : ""} ${className}`}>
      <span className="sp-breathe absolute inset-0"><Layers style={style} /></span>
    </span>
  );
}

/** Head-and-shoulders card: greeting and chat welcome. */
export function StellaCard({ width = 200, height = 260, className = "" }) {
  const k = (width * 1.17) / SRC_W;               // a little wider than the card, centred on her face
  const style = { width: SRC_W * k, height: SRC_H * k, left: width / 2 - FACE.x * k, top: 4 };
  return (
    <span aria-hidden="true" style={{ width, height }}
          className={`relative block shrink-0 overflow-hidden rounded-3xl bg-gradient-to-b from-[#eef5ff] via-[#dbe8ff] to-[#b9d0ff] ring-4 ring-white shadow-[0_22px_50px_-16px_rgba(12,48,96,.5)] ${className}`}>
      <span className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/60 blur-2xl" />
      <span className="sp-breathe absolute inset-0"><Layers style={style} /></span>
    </span>
  );
}

/** Stella cut-out (no background, no frame) for the floating launcher in the corner. Blinks and breathes. */
export function StellaCutout({ height = 128, talking = false, className = "" }) {
  const width = Math.round((height * SRC_W) / SRC_H);
  const style = { width, height, left: 0, top: 0 };
  return (
    <span aria-hidden="true" style={{ width, height }}
          className={`sp-cutout relative block shrink-0 ${talking ? "is-talking" : ""} ${className}`}>
      <span className="sp-breathe absolute inset-0"><Layers style={style} /></span>
    </span>
  );
}
