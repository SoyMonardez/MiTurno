import {
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Link,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Power,
  Scissors,
  Store,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPatch, apiPost, clearToken } from "../api/client.js";
import { useDialog } from "../components/Dialog.jsx";
import SEO from "../components/SEO.jsx";
import { formatoPrecio } from "../lib/format.js";

// ─── Planes ───────────────────────────────────────────────────────────────────
const PLANES = [
  { id: "basico",   label: "Básico",   precio: 13_000 },
  { id: "pro",      label: "Pro",      precio: 22_000 },
  { id: "premium",  label: "Premium",  precio: 35_000 },
];
const PLAN_COLOR = {
  basico:  "bg-neutral-100 text-neutral-600",
  pro:     "bg-blue-50 text-blue-700",
  premium: "bg-amber-50 text-amber-700",
};

function slugify(texto) {
  return texto.toLowerCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function SuperAdmin() {
  const navigate = useNavigate();
  const dialog = useDialog();
  const [metricas, setMetricas] = useState(null);
  const [negocios, setNegocios] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState(null);
  const [editando, setEditando] = useState(null);
  const [gestionandoAdmins, setGestionandoAdmins] = useState(null); // negocio_id

  const onError = useCallback((err) => {
    if (err.status === 401 || err.status === 403) { clearToken(); navigate("/admin/login"); }
  }, [navigate]);

  const cargar = useCallback(() => {
    apiGet("/super-admin/metricas").then(setMetricas).catch(onError);
    apiGet("/super-admin/negocios").then(setNegocios).catch(onError);
  }, [onError]);
  useEffect(() => cargar(), [cargar]);

  async function editarNegocio(negocio_id, nombre, slug, plan) {
    try {
      await apiPatch(`/super-admin/negocios/${negocio_id}/editar`, { nombre, slug, plan });
      setEditando(null); cargar();
    } catch (err) { throw err; }
  }

  async function eliminarNegocio(n) {
    try {
      await apiDelete(`/super-admin/negocios/${n.id}`);
      setConfirmEliminar(null); cargar();
    } catch (err) { onError(err); await dialog.error(err.message); }
  }

  async function toggleActivo(n) {
    try {
      await apiPatch(`/super-admin/negocios/${n.id}`, { activo: !n.activo }); cargar();
    } catch (err) { onError(err); await dialog.error(err.message); }
  }

  async function resetPassword(n) {
    const nueva = await dialog.prompt(
      `Nueva contraseña para el admin de "${n.nombre}" (usuario: ${n.admin_username}).`,
      "Restablecer contraseña", { placeholder: "Mínimo 6 caracteres" }
    );
    if (!nueva) return;
    if (nueva.trim().length < 6) { await dialog.error("La contraseña debe tener al menos 6 caracteres."); return; }
    try {
      await apiPost(`/super-admin/negocios/${n.id}/reset-password`, { password: nueva.trim() });
      await dialog.alert(
        `Contraseña actualizada.\n\nUsuario: ${n.admin_username}\nContraseña: ${nueva.trim()}\n\nEntrá en /admin/login con esos datos.`,
        `Acceso al panel de "${n.nombre}"`
      );
    } catch (err) { onError(err); await dialog.error(err.message); }
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      <SEO noIndex title="Super Admin | MiTurno" />
      <header className="bg-neutral-950 text-white">
        <div className="max-w-5xl mx-auto px-5 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Scissors size={16} className="text-neutral-400" strokeWidth={1.5} />
            <h1 className="font-serif text-lg tracking-[0.05em]">MiTurno · Super Admin</h1>
          </div>
          <button onClick={() => { clearToken(); navigate("/admin/login"); }}
            className="flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-neutral-400 hover:text-white transition-colors">
            <LogOut size={14} strokeWidth={1.5} /> Salir
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-6 space-y-6">

        {/* ── Métricas de negocio ── */}
        {metricas && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metrica titulo="Sucursales" valor={metricas.total_negocios}
              sub={`${metricas.negocios_activos} activa${metricas.negocios_activos !== 1 ? "s" : ""}`} />
            <Metrica titulo="Activas" valor={metricas.negocios_activos} />
            <Metrica titulo="Facturación mensual" valor={formatoPrecio(metricas.facturacion_mensual)}
              sub="según planes activos" highlight />
            <Metrica titulo="Facturación anual" valor={formatoPrecio(metricas.facturacion_anual)}
              sub="proyectado" />
          </div>
        )}

        {/* ── Header lista ── */}
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-neutral-900">Sucursales</h2>
          {!mostrarForm && (
            <button onClick={() => setMostrarForm(true)}
              className="flex items-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-2.5 text-xs uppercase tracking-[0.1em] font-medium hover:bg-neutral-800 transition-colors">
              <Plus size={15} /> Nueva sucursal
            </button>
          )}
        </div>

        {mostrarForm && (
          <FormNegocio onError={onError}
            onCreado={() => { setMostrarForm(false); cargar(); }}
            onCancelar={() => setMostrarForm(false)} />
        )}

        {editando && (
          <ModalEditar negocio={editando} onGuardar={editarNegocio} onCancelar={() => setEditando(null)} />
        )}

        {confirmEliminar && (
          <ModalEliminar negocio={confirmEliminar}
            onConfirm={() => eliminarNegocio(confirmEliminar)}
            onCancel={() => setConfirmEliminar(null)} />
        )}

        {gestionandoAdmins && (
          <ModalAdmins negocio_id={gestionandoAdmins}
            nombre={negocios?.find(n => n.id === gestionandoAdmins)?.nombre || ""}
            onClose={() => { setGestionandoAdmins(null); cargar(); }}
            onError={onError} />
        )}

        {/* ── Lista de sucursales ── */}
        {!negocios ? (
          <p className="text-neutral-400 text-sm py-6">Cargando…</p>
        ) : negocios.length === 0 ? (
          <p className="text-neutral-400 text-sm py-6">Todavía no hay sucursales.</p>
        ) : (
          <div className="space-y-3">
            {negocios.map((n) => (
              <TarjetaNegocio key={n.id} n={n}
                onEditar={() => setEditando(n)}
                onReset={() => resetPassword(n)}
                onToggle={() => toggleActivo(n)}
                onEliminar={() => setConfirmEliminar(n)}
                onAdmins={() => setGestionandoAdmins(n.id)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Tarjeta de sucursal ──────────────────────────────────────────────────────
function TarjetaNegocio({ n, onEditar, onReset, onToggle, onEliminar, onAdmins }) {
  const planInfo = PLANES.find(p => p.id === n.plan) || PLANES[1];

  return (
    <div className={`bg-white rounded-2xl border p-4 space-y-3 transition-opacity ${!n.activo ? "opacity-60" : "border-neutral-200"}`}>
      {/* Fila superior: nombre + plan + estado */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0">
            <Store size={17} strokeWidth={1.5} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-neutral-900">{n.nombre}</span>
              <span className={`text-[10px] font-semibold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full ${PLAN_COLOR[n.plan] || PLAN_COLOR.pro}`}>
                {planInfo.label}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-neutral-500">
                <span className={`h-1.5 w-1.5 rounded-full ${n.activo ? "bg-green-600" : "bg-red-500"}`} />
                {n.activo ? "Activa" : "Inactiva"}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-400 flex-wrap">
              <a href={`/${n.slug}`} target="_blank" rel="noopener noreferrer" className="hover:text-neutral-900">
                /{n.slug}
              </a>
              <span>·</span><span>{n.total_turnos} turnos</span>
              <span>·</span><span>{n.total_clientes} clientes</span>
              <span>·</span>
              <span className="text-neutral-500">{n.admins?.length || 0} admin{(n.admins?.length || 0) !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>

        {/* Precio mensual destacado */}
        <div className="text-right flex-shrink-0">
          <div className="font-serif text-xl text-neutral-900">{formatoPrecio(n.precio_mensual)}</div>
          <div className="text-[10px] uppercase tracking-[0.1em] text-neutral-400">por mes</div>
        </div>
      </div>

      {/* Admins inline */}
      {n.admins?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-13">
          {n.admins.map(a => (
            <span key={a.id} className="inline-flex items-center gap-1 text-[11px] bg-neutral-100 text-neutral-600 rounded-full px-2.5 py-1">
              <Users size={10} strokeWidth={2} />
              {a.nombre}
              {a.username && <span className="text-neutral-400">· {a.username}</span>}
              {!a.activo && <span className="text-red-400">(inactivo)</span>}
            </span>
          ))}
        </div>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-neutral-100">
        <BtnAccion onClick={onEditar} icon={<Pencil size={12} strokeWidth={1.5} />}>Editar</BtnAccion>
        <BtnAccion onClick={onReset} icon={<KeyRound size={12} strokeWidth={1.5} />}>Clave</BtnAccion>
        <BtnAccion onClick={onAdmins} icon={<UserPlus size={12} strokeWidth={1.5} />}>Admins</BtnAccion>
        <BtnAccion onClick={onToggle}
          icon={<Power size={12} strokeWidth={1.5} />}
          color={n.activo ? "orange" : "green"}>
          {n.activo ? "Desactivar" : "Activar"}
        </BtnAccion>
        <BtnAccion onClick={onEliminar} icon={<Trash2 size={12} strokeWidth={1.5} />} color="red">
          Eliminar
        </BtnAccion>
      </div>
    </div>
  );
}

function BtnAccion({ onClick, icon, children, color = "neutral" }) {
  const colors = {
    neutral: "border-neutral-300 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900",
    orange: "border-orange-300 text-orange-600 hover:bg-orange-50",
    green: "border-green-300 text-green-700 hover:bg-green-50",
    red: "border-red-300 text-red-600 hover:bg-red-50",
  };
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 text-xs rounded-full border px-3 py-1.5 transition-colors ${colors[color]}`}>
      {icon}{children}
    </button>
  );
}

// ─── Modal: gestión de admins de una sucursal ─────────────────────────────────
function ModalAdmins({ negocio_id, nombre, onClose, onError }) {
  const dialog = useDialog();
  const [admins, setAdmins] = useState(null);
  const [form, setForm] = useState({ nombre: "", email: "", username: "", dni: "", password: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  const cargar = useCallback(() => {
    apiGet(`/super-admin/negocios/${negocio_id}/admins`).then(setAdmins).catch(onError);
  }, [negocio_id, onError]);
  useEffect(() => cargar(), [cargar]);

  async function agregar(e) {
    e.preventDefault();
    setGuardando(true); setError(null);
    try {
      await apiPost(`/super-admin/negocios/${negocio_id}/admins`, form);
      setForm({ nombre: "", email: "", username: "", dni: "", password: "" });
      setMostrarForm(false);
      cargar();
    } catch (err) { setError(err.message); } finally { setGuardando(false); }
  }

  async function eliminar(admin) {
    const ok = await dialog.confirm(
      `¿Eliminar al admin "${admin.nombre}" (${admin.username})? Esta acción no se puede deshacer.`,
      "Eliminar admin", { btnConfirm: "Eliminar" }
    );
    if (!ok) return;
    try {
      await apiDelete(`/super-admin/negocios/${negocio_id}/admins/${admin.id}`);
      cargar();
    } catch (err) { await dialog.error(err.message); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg text-neutral-900">Admins de {nombre}</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Cada admin puede ingresar al panel de esta sucursal.</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900"><X size={18} strokeWidth={1.5} /></button>
        </div>

        {/* Lista */}
        {!admins ? (
          <p className="text-sm text-neutral-400">Cargando…</p>
        ) : (
          <div className="space-y-2">
            {admins.map(a => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-neutral-900">{a.nombre}</div>
                  <div className="text-xs text-neutral-400">{a.username} · DNI {a.dni}</div>
                </div>
                <button onClick={() => eliminar(a)}
                  className="text-neutral-300 hover:text-red-500 transition-colors" title="Eliminar admin">
                  <Trash2 size={15} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Formulario nuevo admin */}
        {!mostrarForm ? (
          <button onClick={() => setMostrarForm(true)}
            className="w-full flex items-center justify-center gap-2 rounded-full border border-neutral-300 text-neutral-600 text-xs uppercase tracking-[0.1em] py-2.5 hover:border-neutral-900 hover:text-neutral-900 transition-colors">
            <Plus size={13} /> Agregar admin
          </button>
        ) : (
          <form onSubmit={agregar} className="space-y-3 border-t border-neutral-100 pt-4">
            <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-400">Nuevo admin</p>
            <div className="grid grid-cols-2 gap-2">
              <CampoSA label="Nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
              <CampoSA label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              <CampoSA label="Usuario (login)" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required />
              <CampoSA label="DNI" value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} required />
              <CampoSA label="Contraseña" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required className="col-span-2" />
            </div>
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={guardando}
                className="flex items-center gap-1.5 rounded-full bg-neutral-900 text-white px-4 py-2 text-xs uppercase tracking-[0.1em] hover:bg-neutral-800 disabled:opacity-50 transition-colors">
                <Check size={13} strokeWidth={2} /> {guardando ? "Guardando…" : "Agregar"}
              </button>
              <button type="button" onClick={() => setMostrarForm(false)}
                className="rounded-full border border-neutral-300 px-4 py-2 text-xs uppercase tracking-[0.1em] text-neutral-600 hover:bg-neutral-50">
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Formulario nuevo negocio ─────────────────────────────────────────────────
function FormNegocio({ onError, onCreado, onCancelar }) {
  const [form, setForm] = useState({
    nombre: "", slug: "", descripcion: "", direccion: "", plan: "pro",
    admin_nombre: "", admin_username: "", admin_dni: "", admin_password: "", admin_email: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  function set(k) {
    return (e) => {
      const v = e.target.value;
      setForm((p) => {
        const next = { ...p, [k]: v };
        if (k === "nombre" && (!p.slug || p.slug === slugify(p.nombre))) next.slug = slugify(v);
        return next;
      });
    };
  }

  async function crear(e) {
    e.preventDefault();
    setGuardando(true); setError(null);
    try { await apiPost("/super-admin/negocios", form); onCreado(); }
    catch (err) { setError(err.message); onError(err); }
    finally { setGuardando(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-6">
      <div className="flex items-center gap-2 mb-5">
        <Building2 size={16} className="text-neutral-700" strokeWidth={1.5} />
        <h3 className="font-serif text-lg text-neutral-900">Nueva sucursal</h3>
      </div>
      <form onSubmit={crear} className="space-y-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-400 mb-2">Datos del negocio</p>
          <div className="grid md:grid-cols-2 gap-3">
            <CampoSA label="Nombre" value={form.nombre} onChange={set("nombre")} required placeholder="Ej: Barbería López" />
            <CampoSA label="URL (slug)" value={form.slug} onChange={set("slug")} required placeholder="barberia-lopez" />
            <CampoSA label="Dirección" value={form.direccion} onChange={set("direccion")} placeholder="Opcional" />
            {/* Plan */}
            <div>
              <label className="block text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-1.5">Plan</label>
              <div className="flex gap-2">
                {PLANES.map(p => (
                  <button key={p.id} type="button" onClick={() => setForm(f => ({ ...f, plan: p.id }))}
                    className={`flex-1 rounded-xl border py-2.5 text-xs font-medium transition-colors ${
                      form.plan === p.id
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-300 text-neutral-600 hover:border-neutral-500"
                    }`}>
                    {p.label}<br />
                    <span className={`text-[10px] ${form.plan === p.id ? "text-white/70" : "text-neutral-400"}`}>
                      {formatoPrecio(p.precio)}/mes
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-400 mb-2">Usuario administrador</p>
          <div className="grid md:grid-cols-2 gap-3">
            <CampoSA label="Nombre del admin" value={form.admin_nombre} onChange={set("admin_nombre")} required placeholder="Ej: Juan López" />
            <CampoSA label="Email del admin" type="email" value={form.admin_email} onChange={set("admin_email")} required placeholder="juan@negocio.com" />
            <CampoSA label="Usuario (login)" value={form.admin_username} onChange={set("admin_username")} required placeholder="juanlopez" />
            <CampoSA label="DNI" value={form.admin_dni} onChange={set("admin_dni")} required placeholder="30111222" />
            <CampoSA label="Contraseña" type="text" value={form.admin_password} onChange={set("admin_password")} required placeholder="mínimo 6 caracteres" />
          </div>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={guardando}
            className="flex items-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-2.5 text-xs uppercase tracking-[0.1em] font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors">
            <Check size={15} /> {guardando ? "Creando…" : "Crear sucursal"}
          </button>
          <button type="button" onClick={onCancelar}
            className="flex items-center gap-1.5 rounded-full border border-neutral-300 px-5 py-2.5 text-xs uppercase tracking-[0.1em] text-neutral-600 hover:bg-neutral-50">
            <X size={14} /> Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Modal editar ─────────────────────────────────────────────────────────────
function ModalEditar({ negocio, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(negocio.nombre);
  const [slug, setSlug] = useState(negocio.slug);
  const [plan, setPlan] = useState(negocio.plan || "pro");
  const [slugManual, setSlugManual] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  function onNombreChange(v) { setNombre(v); if (!slugManual) setSlug(slugify(v)); }
  function onSlugChange(v) {
    setSlugManual(true);
    setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-"));
  }
  async function guardar(e) {
    e.preventDefault();
    if (!nombre.trim() || !slug.trim()) return;
    setGuardando(true); setError(null);
    try { await onGuardar(negocio.id, nombre.trim(), slug.trim(), plan); }
    catch (err) { setError(err.message); }
    finally { setGuardando(false); }
  }
  const cambioSlug = slug !== negocio.slug;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-serif text-lg text-neutral-900">Editar sucursal</h3>
          <button onClick={onCancelar} className="text-neutral-400 hover:text-neutral-900"><X size={18} strokeWidth={1.5} /></button>
        </div>
        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-1.5">Nombre</label>
            <input value={nombre} onChange={e => onNombreChange(e.target.value)} required className="campo-admin" autoFocus />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-1.5">URL pública</label>
            <div className="flex items-center rounded-xl border border-neutral-300 focus-within:border-neutral-900 transition-colors overflow-hidden">
              <span className="pl-3 pr-1 text-sm text-neutral-400 flex-shrink-0">
                <Link size={13} strokeWidth={1.5} className="inline" /><span className="ml-1">/</span>
              </span>
              <input value={slug} onChange={e => onSlugChange(e.target.value)} required
                className="flex-1 px-2 py-2.5 text-sm focus:outline-none bg-transparent" placeholder="mi-negocio" />
            </div>
            {cambioSlug && (
              <p className="text-[10px] text-amber-600 mt-1.5">
                ⚠ El enlace cambiará a <code className="bg-amber-50 px-1 rounded">/{slug}</code>. Los links anteriores dejarán de funcionar.
              </p>
            )}
          </div>
          {/* Plan */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-1.5">Plan</label>
            <div className="flex gap-2">
              {PLANES.map(p => (
                <button key={p.id} type="button" onClick={() => setPlan(p.id)}
                  className={`flex-1 rounded-xl border py-2 text-xs font-medium transition-colors ${
                    plan === p.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600 hover:border-neutral-500"
                  }`}>
                  {p.label}<br />
                  <span className={`text-[10px] ${plan === p.id ? "text-white/70" : "text-neutral-400"}`}>{formatoPrecio(p.precio)}/mes</span>
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={guardando}
              className="flex items-center gap-1.5 rounded-full bg-neutral-900 text-white px-5 py-2.5 text-xs uppercase tracking-[0.1em] hover:bg-neutral-800 disabled:opacity-50 transition-colors">
              {guardando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={2} />}
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" onClick={onCancelar}
              className="rounded-full border border-neutral-300 px-5 py-2.5 text-xs uppercase tracking-[0.1em] text-neutral-600 hover:bg-neutral-50">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal eliminar ───────────────────────────────────────────────────────────
function ModalEliminar({ negocio, onConfirm, onCancel }) {
  const [confirmacion, setConfirmacion] = useState("");
  const coincide = confirmacion.trim() === negocio.nombre;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-600" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-serif text-lg text-neutral-900">Eliminar sucursal</h3>
            <p className="text-xs text-neutral-500">Esta acción no se puede deshacer.</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-sm text-red-700 space-y-1">
          <p>Se eliminarán permanentemente:</p>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-red-600">
            <li>Todos los turnos y clientes ({negocio.total_turnos} turnos, {negocio.total_clientes} clientes)</li>
            <li>Servicios, profesionales y horarios</li>
            <li>Reseñas, portafolio e imágenes</li>
            <li>Todos los administradores ({negocio.admins?.length || 1})</li>
          </ul>
        </div>
        <div className="mb-5">
          <label className="block text-xs text-neutral-600 mb-1.5">
            Para confirmar, escribí el nombre exacto: <span className="font-medium text-neutral-900">"{negocio.nombre}"</span>
          </label>
          <input value={confirmacion} onChange={e => setConfirmacion(e.target.value)}
            placeholder={negocio.nombre} className="campo-admin" autoFocus />
        </div>
        <div className="flex gap-2">
          <button onClick={onConfirm} disabled={!coincide}
            className="flex items-center gap-2 rounded-full bg-red-600 text-white px-5 py-2.5 text-xs uppercase tracking-[0.1em] font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <Trash2 size={14} strokeWidth={1.5} /> Eliminar definitivamente
          </button>
          <button onClick={onCancel}
            className="rounded-full border border-neutral-300 px-5 py-2.5 text-xs uppercase tracking-[0.1em] text-neutral-600 hover:bg-neutral-50">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────
function Metrica({ titulo, valor, sub, highlight }) {
  return (
    <div className={`rounded-2xl border p-5 ${highlight ? "border-neutral-900 bg-neutral-900" : "border-neutral-200 bg-white"}`}>
      <div className={`font-serif text-2xl sm:text-3xl ${highlight ? "text-white" : "text-neutral-900"}`}>{valor}</div>
      <div className={`text-[10px] uppercase tracking-[0.12em] mt-1 ${highlight ? "text-neutral-400" : "text-neutral-400"}`}>{titulo}</div>
      {sub && <div className={`text-[10px] mt-0.5 ${highlight ? "text-neutral-500" : "text-neutral-400"}`}>{sub}</div>}
    </div>
  );
}

function CampoSA({ label, className = "", ...props }) {
  return (
    <div className={className}>
      <label className="block text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-1.5">{label}</label>
      <input {...props} className="campo-admin" />
    </div>
  );
}
