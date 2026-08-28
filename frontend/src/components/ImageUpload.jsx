import { useRef, useState } from "react";
import { getToken } from "../lib/api";
import { useToast } from "./ui";
import { IconCamera } from "./icons";

/**
 * Avatar / logo uploader. kind: "avatar" | "logo".
 * Posts to /api/uploads/image and returns the stored URL via onUploaded.
 */
export default function ImageUpload({ kind = "avatar", currentUrl, onUploaded, round = true }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState(currentUrl || null);

  const pick = () => inputRef.current?.click();

  const onChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast("Image must be 2 MB or smaller.", "error");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/uploads/image?kind=${kind}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setUrl(data.url);
      onUploaded?.(data.url);
      toast(data.message);
    } catch (err) { toast(err.message, "error"); }
    finally { setBusy(false); e.target.value = ""; }
  };

  return (
    <div className="flex items-center gap-4">
      <div className={`flex h-20 w-20 items-center justify-center overflow-hidden border-2 border-dashed border-slate-300 bg-slate-50 ${round ? "rounded-full" : "rounded-xl"}`}>
        {url
          ? <img src={url} alt="" className="h-full w-full object-cover" />
          : <IconCamera size={24} className="text-slate-400" />}
      </div>
      <div>
        <button type="button" className="btn-outline btn-sm" onClick={pick} disabled={busy}>
          {busy ? "Uploading…" : url ? "Change image" : "Upload image"}
        </button>
        <p className="mt-1.5 text-xs text-slate-400">PNG, JPG or WEBP. Max 2 MB.</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
    </div>
  );
}
