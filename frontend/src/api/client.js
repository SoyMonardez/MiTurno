const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function handle(res) {
  if (!res.ok) {
    let detail = `Error ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") {
        detail = data.detail;
      } else if (Array.isArray(data.detail)) {
        // Errores de validación de FastAPI: mostramos un mensaje amigable.
        detail = "Revisá los datos ingresados e intentá de nuevo.";
      }
    } catch {
      // sin cuerpo JSON
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function apiGet(path) {
  return handle(await fetch(`${BASE_URL}${path}`));
}

export async function apiPost(path, body) {
  return handle(
    await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

export { BASE_URL };
