export function formatoPrecio(valor) {
  const n = Number(valor);
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

// Hora local (del navegador) a partir de un ISO en UTC.
export function horaLocal(iso) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function fechaLegible(iso) {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// Fecha YYYY-MM-DD para el input date y la query de disponibilidad.
export function isoFecha(d) {
  return d.toISOString().slice(0, 10);
}

export function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
