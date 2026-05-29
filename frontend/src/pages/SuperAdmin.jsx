import {
  AlertTriangle,
  Building2,
  Check,
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
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPatch, apiPost, clearToken } from "../api/client.js";
import { useDialog } from "../components/Dialog.jsx";
import SEO from "../components/SEO.jsx";

function slugify(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function SuperAdmin() {
  const navigate = useNavigate();
  const dialog = useDialog();
  const [metricas, setMetricas] = useState(null);
  const [negocios, setNegocios] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState(null);
  const [editando, setEditando] = useState(null); // negocio a editar // negocio a eliminar

  const onError = useCallback(
    (err) => {
      if (err.status === 401 || err.status === 403) {
        clearToken();
        navigate("/admin/login");
      }
    },
    [navigate]
  );

  const cargar = useCallback(() => {
    apiGet("/super-admin/metricas").then(setMetricas).catch(onError);
    apiGet("/super-admin/negocios").then(setNegocios).catch(onError);
  }, [onError]);
  useEffect(() => cargar(), [cargar]);

  async function editarNegocio(negocio_id, nombre, slug) {
    try {
      await apiPatch(`/super-admin/negocios/${negocio_id}/editar`, { nombre, slug });
      setEditando(null);
      cargar();
    } catch (err) {
      throw err; // el modal lo captura y muestra
    }
  }

  async function eliminarNegocio(n) {
    try {
      await apiDelete(`/super-admin/negocios/${n.id}`);
      setConfirmEliminar(null);
      cargar();
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
    }
  }

  async function toggleActivo(n) {
    try {
      await apiPatch(`/super-admin/negocios/${n.id}`, { activo: !n.activo });
      cargar();
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
    }
  }

  async function resetPassword(n) {
    const nueva = await dialog.prompt(
      `Ingresá la nueva contraseña para el admin de "${n.nombre}" (usuario: ${n.admin_username}).`,
      "Restablecer contraseña",
      { placeholder: "Mínimo 6 caracteres" }
    );
    if (!nueva) return;
    if (nueva.trim().length < 6) {
      await dialog.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    try {
      await apiPost(`/super-admin/negocios/${n.id}/reset-password`, { password: nueva.trim() });
      await dialog.alert(
        `Contraseña actualizada.\n\nUsuario: ${n.admin_username}\nContraseña: ${nueva.trim()}\n\nEntrá en /admin/login con esos datos.`,
        `Acceso al panel de "${n.nombre}"`
      );
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
    }
  }

  function salir() {
    clearToken();
    navigate("/admin/login");
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
          <button onClick={salir} className="flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-neutral-400 hover:text-white transition-colors">
            <LogOut size={14} strokeWidth={1.5} /> Salir
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-6 space-y-6">
        {/* Métricas */}
        {metricas && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metrica titulo="Negocios" valor={metricas.total_negocios} sub={`${metricas.negocios_activos} activos`} />
            <Metrica titulo="Turnos totales" valor={metricas.total_turnos} />
            <Metrica titulo="Clientes" valor={metricas.total_clientes} />
            <Metrica titulo="Turnos (30 días)" valor={metricas.turnos_ultimos_30_dias} />
          </div>
        )}

        {/* Acción */}
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-neutral-900">Negocios</h2>
          {!mostrarForm && (
            <button onClick={() => setMostrarForm(true)}
              className="flex items-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-2.5 text-xs uppercase tracking-[0.1em] font-medium hover:bg-neutral-800 transition-colors">
              <Plus size={15} /> Nuevo negocio
            </button>
          )}
        </div>

        {mostrarForm && (
          <FormNegocio
            onError={onError}
            onCreado={() => { setMostrarForm(false); cargar(); }}
            onCancelar={() => setMostrarForm(false)}
          />
        )}

        {/* Modal de edición */}
        {editando && (
          <ModalEditar
            negocio={editando}
            onGuardar={editarNegocio}
            onCancelar={() => setEditando(null)}
          />
        )}

        {/* Modal de confirmación de eliminación */}
        {confirmEliminar && (
          <ModalEliminar
            negocio={confirmEliminar}
            onConfirm={() => eliminarNegocio(confirmEliminar)}
            onCancel={() => setConfirmEliminar(null)}
          />
        )}

        {/* Lista */}
        {!negocios ? (
          <p className="text-neutral-400 text-sm py-6">Cargando…</p>
        ) : negocios.length === 0 ? (
          <p className="text-neutral-400 text-sm py-6">Todavía no hay negocios.</p>
        ) : (
          <div className="space-y-2">
            {negocios.map((n) => (
              <div key={n.id} className="bg-white rounded-2xl border border-neutral-200 p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-neutral-900 text-white flex items-center justify-center flex-shrink-0">
                  <Store size={18} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-neutral-900">{n.nombre}</span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-neutral-500">
                      <span className={`h-1.5 w-1.5 rounded-full ${n.activo ? "bg-green-600" : "bg-red-500"}`} />
                      {n.activo ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-neutral-400 flex-wrap">
                    <a href={`/${n.slug}`} target="_blank" rel="noopener noreferrer" className="hover:text-neutral-900">/{n.slug}</a>
                    <span>·</span>
                    <span>{n.total_turnos} turnos</span>
                    <span>·</span>
                    <span>{n.total_clientes} clientes</span>
                    {n.admin_username && <><span>·</span><span>admin: {n.admin_username}</span></>}
                    {n.admin_dni && <><span>·</span><span>DNI: {n.admin_dni}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setEditando(n)}
                    className="flex items-center gap-1.5 text-xs rounded-full border border-neutral-300 text-neutral-600 px-3 py-1.5 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
                    title="Editar nombre y URL"
                  >
                    <Pencil size={12} strokeWidth={1.5} />
                    Editar
                  </button>
                  <button
                    onClick={() => resetPassword(n)}
                    className="flex items-center gap-1.5 text-xs rounded-full border border-neutral-300 text-neutral-600 px-3 py-1.5 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
                    title="Restablecer contraseña del admin"
                  >
                    <KeyRound size={12} strokeWidth={1.5} />
                    Clave
                  </button>
                  <button
                    onClick={() => toggleActivo(n)}
                    className={`flex items-center gap-1.5 text-xs rounded-full border px-3 py-1.5 transition-colors ${
                      n.activo
                        ? "border-orange-300 text-orange-600 hover:bg-orange-50"
                        : "border-green-300 text-green-700 hover:bg-green-50"
                    }`}
                  >
                    <Power size={12} strokeWidth={1.5} />
                    {n.activo ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    onClick={() => setConfirmEliminar(n)}
                    className="flex items-center gap-1.5 text-xs rounded-full border border-red-300 text-red-600 px-3 py-1.5 hover:bg-red-50 transition-colors"
                    title="Eliminar negocio permanentemente"
                  >
                    <Trash2 size={12} strokeWidth={1.5} />
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function FormNegocio({ onError, onCreado, onCancelar }) {
  const [form, setForm] = useState({
    nombre: "", slug: "", descripcion: "", direccion: "",
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
    setGuardando(true);
    setError(null);
    try {
      await apiPost("/super-admin/negocios", form);
      onCreado();
    } catch (err) {
      setError(err.message);
      onError(err);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-6">
      <div className="flex items-center gap-2 mb-5">
        <Building2 size={16} className="text-neutral-700" strokeWidth={1.5} />
        <h3 className="font-serif text-lg text-neutral-900">Nuevo negocio</h3>
      </div>

      <form onSubmit={crear} className="space-y-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-400 mb-2 flex items-center gap-1.5">
            <Store size={12} /> Datos del negocio
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            <Campo label="Nombre" value={form.nombre} onChange={set("nombre")} required placeholder="Ej: Barbería López" />
            <Campo label="URL (slug)" value={form.slug} onChange={set("slug")} required placeholder="barberia-lopez" />
            <Campo label="Dirección" value={form.direccion} onChange={set("direccion")} placeholder="Opcional" />
            <Campo label="Descripción" value={form.descripcion} onChange={set("descripcion")} placeholder="Opcional" />
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-400 mb-2 flex items-center gap-1.5">
            <Users size={12} /> Usuario administrador
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            <Campo label="Nombre del admin" value={form.admin_nombre} onChange={set("admin_nombre")} required placeholder="Ej: Juan López" />
            <Campo label="Email del admin" type="email" value={form.admin_email} onChange={set("admin_email")} required placeholder="juan@negocio.com" />
            <Campo label="Usuario (login)" value={form.admin_username} onChange={set("admin_username")} required placeholder="juanlopez" />
            <Campo label="DNI" value={form.admin_dni} onChange={set("admin_dni")} required placeholder="30111222" />
            <Campo label="Contraseña" type="text" value={form.admin_password} onChange={set("admin_password")} required placeholder="mínimo 6 caracteres" />
          </div>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={guardando}
            className="flex items-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-2.5 text-xs uppercase tracking-[0.1em] font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors">
            <Check size={15} /> {guardando ? "Creando…" : "Crear negocio"}
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

function Metrica({ titulo, valor, sub }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="font-serif text-3xl text-neutral-900">{valor}</div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 mt-1">{titulo}</div>
      {sub && <div className="text-[10px] text-neutral-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function Campo({ label, ...props }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-1.5">{label}</label>
      <input {...props} className="campo-admin" />
    </div>
  );
}

function ModalEditar({ negocio, onGuardar, onCancelar }) {
  const dialog = useDialog();
  const [nombre, setNombre] = useState(negocio.nombre);
  const [slug, setSlug] = useState(negocio.slug);
  const [slugManual, setSlugManual] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  function onNombreChange(v) {
    setNombre(v);
    if (!slugManual) setSlug(slugify(v));
  }

  function onSlugChange(v) {
    setSlugManual(true);
    setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-"));
  }

  async function guardar(e) {
    e.preventDefault();
    if (!nombre.trim() || !slug.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(negocio.id, nombre.trim(), slug.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const cambioSlug = slug !== negocio.slug;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 modal-backdrop">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 scale-in">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center">
              <Pencil size={16} className="text-neutral-700" strokeWidth={1.5} />
            </div>
            <h3 className="font-serif text-lg text-neutral-900">Editar negocio</h3>
          </div>
          <button onClick={onCancelar} className="text-neutral-400 hover:text-neutral-900">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-1.5">
              Nombre del negocio
            </label>
            <input
              value={nombre}
              onChange={(e) => onNombreChange(e.target.value)}
              required
              className="campo-admin"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-1.5">
              URL pública <span className="normal-case tracking-normal text-neutral-400">(slug)</span>
            </label>
            <div className="flex items-center rounded-xl border border-neutral-300 focus-within:border-neutral-900 transition-colors overflow-hidden">
              <span className="pl-3 pr-1 text-sm text-neutral-400 flex-shrink-0">
                <Link size={13} strokeWidth={1.5} className="inline" />
                <span className="ml-1">/</span>
              </span>
              <input
                value={slug}
                onChange={(e) => onSlugChange(e.target.value)}
                required
                className="flex-1 px-2 py-2.5 text-sm focus:outline-none bg-transparent"
                placeholder="mi-negocio"
              />
            </div>
            <div className="flex items-start gap-1.5 mt-1.5">
              {cambioSlug && (
                <p className="text-[10px] text-amber-600">
                  ⚠ El enlace cambiará de <code className="bg-amber-50 px-1 rounded">/{negocio.slug}</code> a <code className="bg-amber-50 px-1 rounded">/{slug}</code>. Los links anteriores dejarán de funcionar.
                </p>
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={guardando}
              className="flex items-center gap-1.5 rounded-full bg-neutral-900 text-white px-5 py-2.5 text-xs uppercase tracking-[0.1em] font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors">
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

function ModalEliminar({ negocio, onConfirm, onCancel }) {
  const [confirmacion, setConfirmacion] = useState("");
  const coincide = confirmacion.trim() === negocio.nombre;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 modal-backdrop px-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 scale-in">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-red-600" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-serif text-lg text-neutral-900">Eliminar negocio</h3>
            <p className="text-xs text-neutral-500">Esta acción no se puede deshacer.</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-sm text-red-700 space-y-1">
          <p>Se eliminarán permanentemente:</p>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-red-600">
            <li>Todos los turnos y clientes ({negocio.total_turnos} turnos, {negocio.total_clientes} clientes)</li>
            <li>Servicios, profesionales y horarios</li>
            <li>Reseñas, portafolio e imágenes</li>
            <li>Usuario administrador ({negocio.admin_username})</li>
          </ul>
        </div>

        <div className="mb-5">
          <label className="block text-xs text-neutral-600 mb-1.5">
            Para confirmar, escribí el nombre exacto del negocio:
            <span className="ml-1 font-medium text-neutral-900">"{negocio.nombre}"</span>
          </label>
          <input
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
            placeholder={negocio.nombre}
            className="campo-admin"
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            disabled={!coincide}
            className="flex items-center gap-2 rounded-full bg-red-600 text-white px-5 py-2.5 text-xs uppercase tracking-[0.1em] font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 size={14} strokeWidth={1.5} />
            Eliminar definitivamente
          </button>
          <button
            onClick={onCancel}
            className="rounded-full border border-neutral-300 px-5 py-2.5 text-xs uppercase tracking-[0.1em] text-neutral-600 hover:bg-neutral-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
