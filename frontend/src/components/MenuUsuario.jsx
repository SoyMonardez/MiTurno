import { LogIn, Menu, MessageCircle, Moon, Sun, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function MenuUsuario({ negocio, temaOscuro, onCambiarTema, onRegistro }) {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState("menu");
  const [form, setForm] = useState({ nombre: "", email: "", telefono: "" });
  const [registroListo, setRegistroListo] = useState(false);

  function cerrar() {
    setAbierto(false);
    setVista("menu");
    setRegistroListo(false);
  }

  function registrar(e) {
    e.preventDefault();
    const datos = { nombre: form.nombre.trim(), email: form.email.trim(), telefono: form.telefono.trim() };
    localStorage.setItem("miturno_cliente_datos", JSON.stringify(datos));
    onRegistro(datos);
    setRegistroListo(true);
  }

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} aria-label="Abrir menú" aria-expanded={abierto}
        className="absolute right-5 top-5 z-20 grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-black/20 text-white backdrop-blur-sm transition hover:bg-white hover:text-neutral-950 focus:outline-none focus:ring-2 focus:ring-white">
        <Menu size={20} strokeWidth={1.7} />
      </button>
      <div className={`fixed inset-0 z-40 bg-neutral-950/35 transition-opacity duration-300 ${abierto ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={cerrar} />
      <aside aria-label="Menú de navegación" className={`fixed right-0 top-0 z-50 flex h-dvh w-[min(23rem,88vw)] flex-col bg-white shadow-2xl transition-transform duration-500 ${abierto ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-5">
          <div><p className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">MiTurno</p><p className="mt-1 font-serif text-xl text-neutral-900">{negocio.nombre}</p></div>
          <button type="button" onClick={cerrar} aria-label="Cerrar menú" className="grid h-10 w-10 place-items-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5">
          {vista === "menu" && <nav className="space-y-1" aria-label="Opciones de cuenta">
            <MenuItem icon={<LogIn size={18} />} label="Iniciar sesión" onClick={() => navigate("/admin/login")} />
            <MenuItem icon={<UserPlus size={18} />} label="Registrar usuario" onClick={() => setVista("registro")} />
            <MenuItem icon={<MessageCircle size={18} />} label="Consultas" onClick={() => setVista("consultas")} />
            <div className="my-4 border-t border-neutral-200" />
            <button type="button" onClick={onCambiarTema} className="flex w-full items-center justify-between rounded-xl px-3 py-3.5 text-left text-sm text-neutral-700 transition hover:bg-neutral-100">
              <span className="flex items-center gap-3">{temaOscuro ? <Sun size={18} /> : <Moon size={18} />} Tema</span>
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">{temaOscuro ? "Claro" : "Oscuro"}</span>
            </button>
          </nav>}
          {vista === "registro" && <section><BotonVolver onClick={() => setVista("menu")} /><h2 className="mt-5 font-serif text-2xl text-neutral-900">Registrarte</h2><p className="mt-2 text-sm leading-relaxed text-neutral-500">Guardamos tus datos en este dispositivo para agilizar tus próximas reservas.</p>
            {registroListo ? <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Tu perfil quedó guardado. Ya podés reservar tu turno.</div> :
            <form className="mt-6 space-y-4" onSubmit={registrar}><Campo label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} autoComplete="name" /><Campo label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /><Campo label="Teléfono" type="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} autoComplete="tel" /><button className="w-full rounded-full bg-neutral-900 px-4 py-3 text-xs font-medium uppercase tracking-[0.15em] text-white">Guardar perfil</button></form>}
          </section>}
          {vista === "consultas" && <section><BotonVolver onClick={() => setVista("menu")} /><h2 className="mt-5 font-serif text-2xl text-neutral-900">Consultas</h2><p className="mt-2 text-sm leading-relaxed text-neutral-500">¿Necesitás ayuda antes de reservar? Contactá directamente al negocio.</p><div className="mt-6 space-y-3">{negocio.telefono && <a className="block rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700" href={`tel:${negocio.telefono}`}>Llamar al {negocio.telefono}</a>}{negocio.email && <a className="block rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700" href={`mailto:${negocio.email}?subject=${encodeURIComponent(`Consulta para ${negocio.nombre}`)}`}>Enviar consulta por email</a>}{!negocio.telefono && !negocio.email && <p className="rounded-xl bg-neutral-100 p-4 text-sm text-neutral-500">Este negocio todavía no publicó datos de contacto.</p>}</div></section>}
        </div>
      </aside>
    </>
  );
}

function MenuItem({ icon, label, onClick }) { return <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left text-sm text-neutral-700 transition hover:bg-neutral-100">{icon}{label}</button>; }
function BotonVolver({ onClick }) { return <button type="button" onClick={onClick} className="text-[10px] font-medium uppercase tracking-[0.15em] text-neutral-400 transition hover:text-neutral-900">← Volver al menú</button>; }
function Campo({ label, ...props }) { return <label className="block text-xs font-medium text-neutral-700">{label}<input required {...props} className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900" /></label>; }
