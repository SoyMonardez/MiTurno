const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`API ${path} respondió ${res.status}`);
  }
  return res.json();
}

export { BASE_URL };
