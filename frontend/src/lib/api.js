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
      detail = data.detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res;
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

  // Upload with a custom field name / endpoint
  uploadFile: (p, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request(p, { method: "POST", form: fd });
  },

  // OAuth2 login uses form-encoded body
  login: async (email, password) => {
    const form = new URLSearchParams({ username: email, password });
    const res = await fetch(`${BASE}/api/auth/login`, {
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

  upload: (p, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request(p, { method: "POST", form: fd });
  },
};

export { getToken };
