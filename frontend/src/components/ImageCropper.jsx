import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Square image cropper — zoom, drag to position, then apply.
 *
 * Written against the plain canvas API on purpose: the project has no image
 * dependencies and adding one would mean an npm install on every machine that
 * builds this. Everything here is React + canvas.
 *
 * Why it exists: a logo uploaded at, say, 1200x300 was being letterboxed into
 * the square avatar box and ended up a tiny strip in the middle. Cropping to a
 * square before upload lets the logo actually fill its box.
 *
 * Props
 *   file       File chosen by the user
 *   round      preview the crop as a circle (avatars) rather than a square
 *   title      heading text
 *   onCancel   () => void
 *   onApply    (blob | null) => void   — null means "upload the original
 *              untouched", used when the browser can't decode the format
 *              (HEIC and some AVIF have no canvas decoder).
 */
const VIEW = 320;        // on-screen crop window, px
const OUT = 800;         // exported image, px — matches the server's logo cap

export default function ImageCropper({ file, round = false, title = "Position your logo",
                                       onCancel, onApply }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const dragRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);     // browser can't decode it
  const [scale, setScale] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [bounds, setBounds] = useState({ fit: 1, cover: 1 });
  const [busy, setBusy] = useState(false);

  /* ---------- load the file into an <img> ---------- */
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) { setFailed(true); return; }
      imgRef.current = img;
      const fit = Math.min(VIEW / img.naturalWidth, VIEW / img.naturalHeight);
      const cover = Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight);
      setBounds({ fit, cover });
      setScale(cover);                 // start filling the square
      setOff({ x: 0, y: 0 });
      setReady(true);
    };
    img.onerror = () => setFailed(true);   // HEIC etc. — offer the original
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  /* Keep the image from sliding away from the frame. When the image is
     smaller than the window (zoomed out past "cover") it stays centred. */
  const clamp = useCallback((next, s) => {
    const img = imgRef.current;
    if (!img) return next;
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    const mx = Math.max(0, (w - VIEW) / 2);
    const my = Math.max(0, (h - VIEW) / 2);
    return {
      x: Math.min(mx, Math.max(-mx, next.x)),
      y: Math.min(my, Math.max(-my, next.y)),
    };
  }, []);

  /* ---------- paint ---------- */
  const paint = useCallback(() => {
    const cv = canvasRef.current, img = imgRef.current;
    if (!cv || !img) return;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#ffffff";          // the server flattens onto white too
    ctx.fillRect(0, 0, VIEW, VIEW);
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (VIEW - w) / 2 + off.x, (VIEW - h) / 2 + off.y, w, h);
  }, [scale, off]);

  useEffect(() => { if (ready) paint(); }, [ready, paint]);

  /* ---------- drag to reposition ---------- */
  const down = (e) => {
    const pt = e.touches ? e.touches[0] : e;
    dragRef.current = { x: pt.clientX, y: pt.clientY, ox: off.x, oy: off.y };
  };
  const move = (e) => {
    if (!dragRef.current) return;
    const pt = e.touches ? e.touches[0] : e;
    const d = dragRef.current;
    setOff(clamp({ x: d.ox + (pt.clientX - d.x), y: d.oy + (pt.clientY - d.y) }, scale));
  };
  const up = () => { dragRef.current = null; };

  useEffect(() => {
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
  });

  const zoomTo = (s) => {
    const next = Math.min(bounds.cover * 5, Math.max(bounds.fit * 0.5, s));
    setScale(next);
    setOff((o) => clamp(o, next));
  };
  const wheel = (e) => { e.preventDefault(); zoomTo(scale * (e.deltaY < 0 ? 1.08 : 0.92)); };

  /* How many real source pixels the crop square covers. Below ~200 the
     exported logo is genuinely low-res, however big we render it. */
  const sourcePx = ready && scale ? Math.round(VIEW / scale) : 0;
  const lowRes = ready && sourcePx > 0 && sourcePx < 200;

  /* ---------- export ---------- */
  const apply = () => {
    const im = imgRef.current;
    if (!im) return onApply(null);
    setBusy(true);
    /* Never export bigger than the crop square actually contains — upscaling
       a 64px crest to 800px just makes a larger blurry file. */
    const size = Math.max(256, Math.min(OUT, Math.round(VIEW / scale)));
    const k = size / VIEW;                      // same framing, different size
    const cv = document.createElement("canvas");
    cv.width = size; cv.height = size;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingQuality = "high";
    const w = im.naturalWidth * scale * k, h = im.naturalHeight * scale * k;
    ctx.drawImage(im, (size - w) / 2 + off.x * k, (size - h) / 2 + off.y * k, w, h);
    cv.toBlob((blob) => { setBusy(false); onApply(blob || null); }, "image/png");
  };

  /* ---------- formats the browser can't decode ---------- */
  if (failed) {
    return (
      <Shell title="Can't preview this image" footer={
        <div className="flex gap-2">
          <button className="btn flex-1" onClick={() => onApply(null)}>Upload without cropping</button>
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
        </div>
      }>
        <p className="pb-2 text-sm text-slate-600">
          Your browser can't open this format for cropping — HEIC and some AVIF
          files can only be read by the server. You can still upload it as-is,
          and it will be converted automatically.
        </p>
      </Shell>
    );
  }

  return (
    <Shell title={title} footer={
      <>
        <div className="flex gap-2">
          <button type="button" className="btn flex-1" onClick={apply} disabled={!ready || busy}>
            {busy ? "Preparing…" : "Apply and upload"}
          </button>
          <button type="button" className="btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
        <button type="button" onClick={() => onApply(null)} disabled={busy}
                className="mt-3 w-full text-center text-xs font-medium text-slate-400 hover:text-navy">
          Skip cropping and upload the original
        </button>
      </>
    }>
      <p className="mb-4 text-sm text-slate-500">
        Drag to move, scroll or use the slider to zoom. The square is exactly what gets saved.
      </p>

      <div className="flex justify-center">
        <div className="relative select-none" style={{ width: VIEW, height: VIEW }}
             onMouseDown={down} onTouchStart={down} onWheel={wheel}>
          <canvas ref={canvasRef} width={VIEW} height={VIEW}
                  className={`cursor-grab bg-white active:cursor-grabbing ${round ? "rounded-full" : "rounded-xl"}`} />
          {/* frame overlay */}
          <div className={`pointer-events-none absolute inset-0 ring-2 ring-navy/70
                           ${round ? "rounded-full" : "rounded-xl"}`} />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
              Loading image…
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <span className="text-xs font-semibold text-slate-400">Zoom</span>
        <input type="range" className="flex-1" min={bounds.fit * 0.5} max={bounds.cover * 5}
               step={(bounds.cover * 5 - bounds.fit * 0.5) / 200 || 0.001}
               value={scale} onChange={(e) => zoomTo(Number(e.target.value))} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-outline btn-sm"
                onClick={() => { setScale(bounds.cover); setOff({ x: 0, y: 0 }); }}>
          Fill square
        </button>
        <button type="button" className="btn-outline btn-sm"
                onClick={() => { setScale(bounds.fit); setOff({ x: 0, y: 0 }); }}>
          Fit whole logo
        </button>
        <button type="button" className="btn-outline btn-sm"
                onClick={() => { setScale(bounds.cover); setOff({ x: 0, y: 0 }); }}>
          Reset
        </button>
      </div>

      {/* Upscaling past the source resolution looks soft — say so rather than
          letting a blurry logo get saved and be blamed on the cropper. */}
      {ready && lowRes && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          The square covers only {sourcePx}×{sourcePx} real pixels, so the saved logo
          will look soft.{" "}
          {scale > bounds.fit * 1.05
            ? "Zoom out, or upload a larger file."
            : "Upload a larger version of this image if you have one."}
        </p>
      )}

    </Shell>
  );
}

function Shell({ title, children, footer }) {
  return (
    /* items-start + overflow-y-auto on the backdrop: with items-center a modal
       taller than the viewport is centred, so BOTH ends get clipped and the
       Apply button sits off-screen with nothing to scroll. That is why it was
       invisible on shorter laptop screens and fine on taller ones. */
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto
                    bg-slate-900/50 p-4 backdrop-blur-sm sm:p-6">
      <div className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-md flex-col
                      overflow-hidden rounded-2xl bg-white shadow-2xl">
        <h3 className="shrink-0 px-6 pt-6 text-lg font-extrabold text-navy">{title}</h3>

        {/* The body scrolls; the action row never does. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-2">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-slate-100 bg-white px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}
