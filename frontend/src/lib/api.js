// Thin fetch wrapper. Base is '' so the Vite dev proxy forwards /api to FastAPI.
// In production set VITE_API_BASE to your Render backend URL.
const BASE = import.meta.env.VITE_API_BASE || "";

function getToken() {
  return localStorage.getItem("hire_token");
}

async function request(path, { method = "GET", body, form, auth = true } = {}) {
  const headers = {};
  if (auth && getToken()) headers["Authorization"] = `Bearer ${getToken()}`;

  let payload;
  if (form) {
    payload = form; // FormData — let the browser set the content type
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      detail = formatDetail(data.detail) || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res;
}

/**
 * FastAPI returns `detail` as a plain string for HTTPException, but as an
 * ARRAY of {loc, msg, type} objects for 422 validation errors. Passing that
 * array to `new Error(...)` stringifies it to "[object Object]", which is
 * useless to the user and hides which field was rejected. Flatten it instead.
 */
function formatDetail(detail) {
  if (!detail) return null;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        // loc looks like ["body", "email"] — the last entry is the field
        const field = Array.isArray(e?.loc) ? e.loc[e.loc.length - 1] : null;
        const label = field && field !== "body" ? `${String(field).replace(/_/g, " ")}: ` : "";
        return `${label}${e?.msg || "is invalid"}`;
      })
      .filter(Boolean)
      .join("; ");
  }
  if (typeof detail === "object") return detail.msg || JSON.stringify(detail);
  return String(detail);
}

export const api = {
  get: (p, opts) => request(p, { ...opts, method: "GET" }),
  post: (p, body, opts) => request(p, { ...opts, method: "POST", body }),
  put: (p, body, opts) => request(p, { ...opts, method: "PUT", body }),
  del: (p, opts) => request(p, { ...opts, method: "DELETE" }),

  // Download an authenticated file (CSV, xlsx) as a browser download
  download: async (p, filename) => {
    const res = await fetch(`${BASE}${p}`, {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },

  // Upload with a custom field name / endpoint.
  // `opts` is forwarded to request(), so `{ auth: false }` gives you an
  // unauthenticated upload — needed on the public registration pages, where
  // there is no token yet. Going through request() also means BASE is applied,
  // so uploads hit the API origin in production instead of the static site.
  uploadFile: (p, file, opts) => {
    const fd = new FormData();
    fd.append("file", file);
    return request(p, { ...opts, method: "POST", form: fd });
  },

  // OAuth2 login uses form-encoded body
  login: async (email, password, expectedRole) => {
    const form = new URLSearchParams({ username: email, password });
    const qs = expectedRole ? `?expected_role=${encodeURIComponent(expectedRole)}` : "";
    const res = await fetch(`${BASE}/api/auth/login${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Login failed");
    }
    return res.json();
  },

  upload: (p, file, opts) => {
    const fd = new FormData();
    fd.append("file", file);
    return request(p, { ...opts, method: "POST", form: fd });
  },
};

/**
 * Resolve an uploaded-file path to something the browser can actually load.
 *
 * The API returns relative paths like "/uploads/abc.webp". In development Vite
 * proxies those; in production the static site and the API are on different
 * origins, so the path must be prefixed with the API base or the image 404s.
 */
export function mediaUrl(path) {
  if (!path) return null;
  if (/^(https?:|data:|blob:)/.test(path)) return path;   // already absolute
  return `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

export { getToken };
