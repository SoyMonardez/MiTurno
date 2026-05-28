const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "miturno_token";
const NEGOCIO_KEY = "miturno_negocio_id";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NEGOCIO_KEY);
}
export function setNegocioId(id) {
  if (id != null) localStorage.setItem(NEGOCIO_KEY, String(id));
}
export function getNegocioId() {
  const v = localStorage.getItem(NEGOCIO_KEY);
  return v ? Number(v) : null;
}

export async function apiPatch(path, body) {
  return handle(
    await fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body ?? {}),
    })
  );
}

function headers(extra = {}) {
  const h = { ...extra };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function handle(res) {
  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") {
        detail = data.detail;
      } else if (Array.isArray(data.detail)) {
        detail = "Revisá los datos ingresados e intentá de nuevo.";
      }
    } catch {
      // sin cuerpo JSON
    }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function apiGet(path) {
  return handle(await fetch(`${BASE_URL}${path}`, { headers: headers() }));
}

export async function apiPost(path, body) {
  return handle(
    await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(body ?? {}),
    })
  );
}

export async function apiDelete(path) {
  return handle(await fetch(`${BASE_URL}${path}`, { method: "DELETE", headers: headers() }));
}

// Sube un archivo (multipart) y devuelve { url }
export async function apiUpload(path, file) {
  const fd = new FormData();
  fd.append("file", file);
  return handle(
    await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: headers(), // NO seteamos Content-Type: el browser pone el boundary
      body: fd,
    })
  );
}

export { BASE_URL };
