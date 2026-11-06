import { CalendarClock, Eye, Lock } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost, setNegocioId, setToken } from "../api/client.js";
import SEO from "../components/SEO.jsx";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", dni: "", password: "" });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);

  function campo(k) {
    return (e) => setForm({ ...form, [k]: e.target.value });
  }

  async function entrar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      // Limpiamos espacios y caracteres invisibles (el login es sensible a eso)
      const credenciales = {
        username: form.username.trim(),
        dni: form.dni.trim(),
        password: form.password.trim(),
      };
      const res = await apiPost("/auth/login", credenciales);
      setToken(res.access_token);
      setNegocioId(res.negocio_id);
      navigate(
        res.rol === "super_admin"
          ? "/super-admin"
          : res.rol === "profesional"
          ? "/profesional"
          : "/admin"
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 px-4">
      <SEO noIndex title="Panel de Administración - Iniciar Sesión | MiTurno" />
      <form
        onSubmit={entrar}
        method="post"
        action="/admin/login"
        className="w-full max-w-sm scale-in"
      >
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="h-px w-8 bg-white/30" />
            <CalendarClock size={16} className="text-white/60" strokeWidth={1.5} />
            <span className="h-px w-8 bg-white/30" />
          </div>
          <h1 className="font-serif text-3xl text-white tracking-[0.06em]">MiTurno</h1>
          <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-500 mt-2">Panel de administración</p>
        </div>

        <div className="bg-white rounded-2xl p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">{error}</div>
          )}
          <Campo
            label="Usuario"
            id="username"
            name="username"
            autoComplete="username"
            value={form.username}
            onChange={campo("username")}
          />
          <Campo
            label="DNI"
            id="dni"
            name="dni"
            autoComplete="off"
            inputMode="numeric"
            value={form.dni}
            onChange={campo("dni")}
          />
          <Campo
            label="Contraseña"
            id="current-password"
            name="password"
            type={mostrarContrasena ? "text" : "password"}
            autoComplete="current-password"
            value={form.password}
            onChange={campo("password")}
            endAdornment={
              <button
                type="button"
                aria-label="Mantener presionado para mostrar la contraseña"
                aria-pressed={mostrarContrasena}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-neutral-400 transition-colors hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 rounded-md"
                onPointerDown={() => setMostrarContrasena(true)}
                onPointerUp={() => setMostrarContrasena(false)}
                onPointerLeave={() => setMostrarContrasena(false)}
                onPointerCancel={() => setMostrarContrasena(false)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") setMostrarContrasena(true);
                }}
                onKeyUp={(e) => {
                  if (e.key === " " || e.key === "Enter") setMostrarContrasena(false);
                }}
                onBlur={() => setMostrarContrasena(false)}
              >
                <Eye size={18} strokeWidth={1.8} aria-hidden="true" />
              </button>
            }
          />
          <button type="submit" disabled={enviando}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-neutral-900 text-white py-3 text-xs uppercase tracking-[0.15em] font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors">
            <Lock size={14} strokeWidth={1.5} />
            {enviando ? "Ingresando…" : "Ingresar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Campo({ label, id, endAdornment, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-1.5">{label}</label>
      <div className="relative">
        <input id={id} {...props} required className={`campo-admin ${endAdornment ? "pr-11" : ""}`} />
        {endAdornment}
      </div>
    </div>
  );
}
