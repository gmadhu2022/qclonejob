import { useEffect, useRef, useState } from "react";
import { api, getToken, mediaUrl } from "../lib/api";
import { useToast, refreshAccount } from "./ui";
import { useConfirm } from "./Dialog";
import { IconCamera, IconCheck } from "./icons";
import ImageCropper from "./ImageCropper";

/**
 * Avatar / logo uploader. kind: "avatar" | "logo".
 *
 * Two modes:
 *  - signed in  -> POST /api/uploads/image        (also writes logo_url/avatar
 *                  onto the profile row server-side)
 *  - registering-> POST /api/uploads/public-image (no token exists yet; the URL
 *                  is returned and submitted with the registration form)
 *
 * The public mode is picked automatically when there is no token, so the same
 * component works on the recruiter registration page and inside the portal.
 */
export default function ImageUpload({
  kind = "avatar",
  currentUrl,
  onUploaded,
  round = true,
  publicUpload,            // force the no-auth endpoint
  label,
  doneText,                // confirmation shown after a successful upload
  crop = true,             // show the square cropper before uploading
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(currentUrl || null);
  const [preview, setPreview] = useState(null);   // local blob shown while uploading
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(null);   // file waiting in the cropper

  // keep in step if the parent form is reset / cleared
  useEffect(() => { setUrl(currentUrl || null); if (!currentUrl) setDone(false); }, [currentUrl]);

  // release the object URL so we don't leak blobs
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const isPublic = publicUpload || !getToken();
  const pick = () => inputRef.current?.click();

  /* Picking a file only validates it. The actual upload happens after the
     cropper hands back a square blob (or after the user skips cropping). */
  const onChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";                       // allow re-picking the same file
    if (!file) return;

    // Accept ANY image the browser or the server recognises. Some formats
    // (HEIC from iPhone, AVIF, TIFF) have no reliable MIME type on Windows,
    // so fall back to the extension before rejecting anything.
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const looksLikeImage =
      (file.type || "").startsWith("image/") ||
      ["png", "jpg", "jpeg", "jfif", "webp", "gif", "bmp", "dib", "tif", "tiff",
       "heic", "heif", "avif", "ico", "jp2", "tga", "pcx", "svg"].includes(ext);
    if (!looksLikeImage) {
      return toast("That file isn't an image. Try JPG, PNG, WEBP, GIF, HEIC, BMP or TIFF.", "error");
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast(`That image is ${(file.size / 1048576).toFixed(1)} MB. Maximum is 5 MB.`, "error");
    }

    if (crop) setPending(file);                // open the cropper
    else upload(file);
  };

  /* blob === null means "the cropper was skipped, send the original". */
  const onCropped = (blob) => {
    const file = pending;
    setPending(null);
    if (!file) return;
    if (!blob) return upload(file);
    // Keep a sensible filename so the server's extension check is happy.
    const cropped = new File([blob], `${(file.name || "image").replace(/\.[^.]+$/, "")}-square.png`,
                             { type: "image/png" });
    upload(cropped);
  };

  const upload = async (file) => {
    // The size check on selection ran against the ORIGINAL file. A cropped PNG
    // is a different file, so re-check before sending it.
    if (file.size > 5 * 1024 * 1024) {
      return toast(`That image is ${(file.size / 1048576).toFixed(1)} MB. Maximum is 5 MB.`, "error");
    }
    const blobUrl = URL.createObjectURL(file);
    setPreview(blobUrl);                       // instant preview while it uploads
    setBusy(true);
    setDone(false);
    try {
      const path = isPublic
        ? `/api/uploads/public-image?kind=${kind}`
        : `/api/uploads/image?kind=${kind}`;
      const data = await api.uploadFile(path, file, { auth: !isPublic });
      setUrl(data.url);
      setDone(true);
      onUploaded?.(data.url);
      /* Update the header chip straight away. Only for a signed-in AVATAR
         upload: the header shows a picture for job seekers only, so a company
         logo upload has nothing to refresh. */
      if (!isPublic && kind === "avatar") refreshAccount();
      confirm(kind === "logo" ? "Logo changed successfully" : "Photo changed successfully",
              { message: doneText || data.message });
    } catch (err) {
      setPreview(null);                        // upload failed: drop the preview
      URL.revokeObjectURL(blobUrl);
      toast(err.message || "Upload failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setUrl(null);
    setDone(false);
    onUploaded?.(null);
  };

  const shown = preview || (url ? mediaUrl(url) : null);

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={pick}
        title="Choose an image"
        className={`relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden
          border-2 border-dashed bg-slate-50 transition-colors
          ${done ? "border-brandgreen" : "border-slate-300 hover:border-navy"}
          ${round ? "rounded-full" : "rounded-xl"}`}
      >
        {shown
          ? <img src={shown} alt="" className="h-full w-full object-contain p-1" />
          : <IconCamera size={24} className="text-slate-400" />}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[10px] font-bold text-navy">
            Uploading…
          </span>
        )}
      </button>

      <div className="min-w-0">
        {label && <div className="mb-1 text-xs font-semibold text-slate-600">{label}</div>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline btn-sm" onClick={pick} disabled={busy}>
            {busy ? "Uploading…" : shown ? "Change image" : "Upload image"}
          </button>
          {shown && !busy && (
            <button type="button" className="btn-sm text-xs font-semibold text-slate-400 hover:text-red-500"
                    onClick={remove}>
              Remove
            </button>
          )}
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
          {done
            ? <><IconCheck size={12} className="text-brandgreen-600" /> {doneText || "Image uploaded."}</>
            : crop
              ? "Any image format. You'll be able to crop it to a square next. Max 5 MB."
              : "JPG, PNG, WEBP, GIF, HEIC, BMP or TIFF. Max 5 MB."}
        </p>
      </div>

      <input ref={inputRef} type="file" className="hidden" onChange={onChange}
             accept="image/*,.heic,.heif,.avif,.bmp,.tif,.tiff,.jfif" />

      {pending && (
        <ImageCropper
          file={pending}
          round={round}
          title={kind === "logo" ? "Position your logo" : "Position your photo"}
          onCancel={() => setPending(null)}
          onApply={onCropped}
        />
      )}
    </div>
  );
}
