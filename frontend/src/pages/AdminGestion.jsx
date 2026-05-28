import {
  BookOpen,
  Bot,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Image as ImageIcon,
  List,
  Loader2,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Store,
  Tag,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, getNegocioId } from "../api/client.js";
import { formatoPrecio } from "../lib/format.js";
import ImageUploader from "../components/ImageUploader.jsx";

const SUBTABS = [
  { id: "Servicios", icon: Tag, label: "Servicios" },
  { id: "Categorias", icon: List, label: "Categorías" },
  { id: "Profesionales", icon: Users, label: "Profesionales" },
  { id: "Agenda", icon: CalendarClock, label: "Agenda" },
  { id: "Portafolio", icon: ImageIcon, label: "Portafolio" },
  { id: "Negocio", icon: Store, label: "Negocio" },
];

export default function AdminGestion({ onError }) {
  const [sub, setSub] = useState("Servicios");
  const negocioId = getNegocioId();

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-neutral-200 overflow-x-auto whitespace-nowrap scrollbar-none flex-nowrap -mx-4 px-4 sm:mx-0 sm:px-0">
        {SUBTABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs uppercase tracking-[0.1em] border-b-2 -mb-px transition-colors flex-shrink-0 ${
              sub === id
                ? "border-neutral-900 text-neutral-900 font-medium"
                : "border-transparent text-neutral-400 hover:text-neutral-700"
            }`}
          >
            <Icon size={14} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>
      {sub === "Servicios" && <Servicios negocioId={negocioId} onError={onError} />}
      {sub === "Categorias" && <Categorias negocioId={negocioId} onError={onError} />}
      {sub === "Profesionales" && <Profesionales negocioId={negocioId} onError={onError} />}
      {sub === "Agenda" && <Agenda negocioId={negocioId} onError={onError} />}
      {sub === "Portafolio" && <Portafolio onError={onError} />}
      {sub === "Negocio" && <ConfigNegocio onError={onError} />}
    </div>
  );
}

// ─── Categorías ──────────────────────────────────────────────────────────────

function Categorias({ negocioId, onError }) {
  const [categorias, setCategorias] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [editandoNombre, setEditandoNombre] = useState("");
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(() => {
    apiGet(`/negocios/${negocioId}/categorias`)
      .then(setCategorias)
      .catch(onError);
  }, [negocioId, onError]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function crear(e) {
    e.preventDefault();
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    setCargando(true);
    try {
      await apiPost(`/negocios/${negocioId}/categorias`, {
        nombre,
        orden: categorias ? categorias.length : 0,
      });
      setNuevoNombre("");
      cargar();
    } catch (err) {
      onError(err);
      alert(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function guardarEdicion(id) {
    const nombre = editandoNombre.trim();
    if (!nombre) return;
    try {
      await apiPatch(`/categorias/${id}`, { nombre });
      setEditandoId(null);
      setEditandoNombre("");
      cargar();
    } catch (err) {
      onError(err);
      alert(err.message);
    }
  }

  async function borrar(id) {
    if (!confirm("¿Seguro que querés eliminar esta categoría? Los servicios asociados quedarán sin categoría.")) return;
    try {
      await apiDelete(`/categorias/${id}`);
      cargar();
    } catch (err) {
      onError(err);
      alert(err.message);
    }
  }

  if (!categorias) return <Cargando />;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 max-w-xl">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={16} className="text-neutral-700" strokeWidth={1.5} />
          <h3 className="font-serif text-lg text-neutral-900">Nueva categoría</h3>
        </div>
        <form onSubmit={crear} className="flex gap-2">
          <input
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Ej: Manicura"
            required
            className="campo-admin flex-1"
          />
          <button
            type="submit"
            disabled={cargando || !nuevoNombre.trim()}
            className="flex items-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-2.5 text-xs uppercase tracking-[0.1em] font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {cargando ? <Loader2 size={14} className="animate-spin" /> : null}
            Agregar
          </button>
        </form>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden max-w-xl divide-y divide-neutral-100">
        {categorias.length === 0 && (
          <p className="text-sm text-neutral-400 text-center py-8">Todavía no hay categorías creadas.</p>
        )}
        {categorias.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-4 gap-4">
            {editandoId === c.id ? (
              <div className="flex-1 flex gap-2">
                <input
                  value={editandoNombre}
                  onChange={(e) => setEditandoNombre(e.target.value)}
                  className="campo-admin text-sm py-1.5"
                  required
                />
                <button
                  onClick={() => guardarEdicion(c.id)}
                  disabled={!editandoNombre.trim()}
                  className="rounded-lg bg-neutral-900 text-white px-3 text-xs font-medium hover:bg-neutral-800"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditandoId(null)}
                  className="rounded-lg border border-neutral-300 px-3 text-xs text-neutral-600 hover:bg-neutral-50"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <List size={14} className="text-neutral-400" />
                  <span className="text-sm font-medium text-neutral-900">{c.nombre}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditandoId(c.id);
                      setEditandoNombre(c.nombre);
                    }}
                    className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 px-2.5 py-1.5 rounded-lg hover:bg-neutral-50"
                  >
                    <Pencil size={12} /> Editar
                  </button>
                  <button
                    onClick={() => borrar(c.id)}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2.5 py-1.5 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 size={12} /> Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── Configuración del negocio ────────────────────────────────────────────────

const ZONAS = [
  "America/Argentina/Buenos_Aires",
  "America/Montevideo",
  "America/Santiago",
  "America/Asuncion",
  "America/Bogota",
  "America/Mexico_City",
  "America/Lima",
  "Europe/Madrid",
];

function ConfigNegocio({ onError }) {
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    apiGet("/negocios/mi-negocio").then(setForm).catch(onError);
  }, [onError]);

  function set(k) {
    return (e) => setForm({ ...form, [k]: e.target.value });
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setOk(false);
    try {
      const res = await apiPatch("/negocios/mi-negocio", {
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        direccion: form.direccion || null,
        zona_horaria: form.zona_horaria,
        email_notificaciones: form.email_notificaciones || null,
        logo: form.logo || null,
        redes: form.redes || null,
      });
      setForm(res);
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch (err) {
      onError(err);
      alert(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!form) return <Cargando />;
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-5">
        <Store size={16} className="text-neutral-700" strokeWidth={1.5} />
        <h3 className="font-serif text-lg text-neutral-900">Datos del negocio</h3>
      </div>

      <form onSubmit={guardar} className="space-y-5">
        <div className="grid md:grid-cols-[160px_1fr] gap-5">
          <div>
            <Etiqueta icono={<ImageIcon size={12} />} label="Logo" />
            <ImageUploader value={form.logo || ""} onChange={(url) => setForm({ ...form, logo: url })} onError={onError} alto="h-40" />
          </div>
          <div className="space-y-4">
            <div>
              <Etiqueta icono={<Store size={12} />} label="Nombre del negocio" req />
              <input value={form.nombre} onChange={set("nombre")} required className="campo-admin" />
            </div>
            <div>
              <Etiqueta icono={<BookOpen size={12} />} label="Descripción" />
              <textarea value={form.descripcion || ""} onChange={set("descripcion")} rows={2} className="campo-admin resize-none" placeholder="Breve descripción que verá el cliente" />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Etiqueta label="Dirección" />
            <input value={form.direccion || ""} onChange={set("direccion")} className="campo-admin" placeholder="Ej: Av. Siempre Viva 742" />
          </div>
          <div>
            <Etiqueta label="Zona horaria" />
            <select value={form.zona_horaria} onChange={set("zona_horaria")} className="campo-admin">
              {ZONAS.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
              {!ZONAS.includes(form.zona_horaria) && <option value={form.zona_horaria}>{form.zona_horaria}</option>}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Etiqueta label="Email de notificaciones" />
            <input type="email" value={form.email_notificaciones || ""} onChange={set("email_notificaciones")} className="campo-admin" placeholder="contacto@negocio.com" />
          </div>
          <div>
            <Etiqueta label="Redes / sitio web" />
            <input value={form.redes || ""} onChange={set("redes")} className="campo-admin" placeholder="@instagram o https://..." />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={guardando}
            className="flex items-center gap-2 rounded-full bg-neutral-900 text-white px-6 py-2.5 text-xs uppercase tracking-[0.1em] font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors">
            {guardando ? <Loader2 size={14} className="animate-spin" /> : null}
            {guardando ? "Guardando" : "Guardar cambios"}
          </button>
          {ok && (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <Check size={14} strokeWidth={2} /> Guardado
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

// ─── Asistente IA ─────────────────────────────────────────────────────────────

function AsistenteIA({ onAplicar }) {
  const [abierto, setAbierto] = useState(false);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [respuesta, setRespuesta] = useState(null);
  const inputRef = useRef(null);

  const rapidas = [
    "Soy una barbería masculina clásica",
    "Tengo un salón de belleza femenino",
    "Quiero servicios premium",
    "Sugerime combos y packs",
  ];

  async function consultar(texto) {
    const msg = texto || input.trim();
    if (!msg) return;
    setInput(msg);
    setCargando(true);
    try {
      const res = await apiPost("/admin/ia/sugerencias-servicio", { mensaje: msg, tipo_negocio: msg });
      setRespuesta(res);
    } catch {
      setRespuesta({ respuesta: "No se pudo conectar con el asistente.", servicios: [] });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-900 bg-neutral-950 text-white overflow-hidden">
      <button
        onClick={() => {
          setAbierto((v) => !v);
          if (!abierto) setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-neutral-900 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles size={16} className="text-white" strokeWidth={1.5} />
          <span className="text-sm font-medium">Asistente IA</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 border border-neutral-700 rounded-full px-2 py-0.5">
            Sugerencias
          </span>
        </div>
        {abierto ? <ChevronUp size={16} className="text-neutral-400" /> : <ChevronDown size={16} className="text-neutral-400" />}
      </button>

      {abierto && (
        <div className="border-t border-neutral-800 p-5 space-y-4">
          {!respuesta && (
            <div className="flex flex-wrap gap-2">
              {rapidas.map((s) => (
                <button
                  key={s}
                  onClick={() => consultar(s)}
                  className="text-xs rounded-full border border-neutral-700 px-3 py-1.5 text-neutral-300 hover:border-white hover:text-white transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Bot size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" strokeWidth={1.5} />
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), consultar())}
                placeholder="Describí tu negocio…"
                className="w-full rounded-xl border border-neutral-700 bg-neutral-900 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white"
              />
            </div>
            <button
              onClick={() => consultar()}
              disabled={cargando || !input.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-white text-neutral-900 px-4 py-2.5 text-sm font-medium hover:bg-neutral-200 disabled:opacity-40 transition-colors"
            >
              {cargando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {cargando ? "Pensando" : "Preguntar"}
            </button>
          </div>

          {respuesta && (
            <div className="space-y-3">
              <div className="flex gap-2 bg-neutral-900 rounded-xl border border-neutral-800 p-3">
                <Sparkles size={15} className="text-neutral-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                <p className="text-sm text-neutral-200">{respuesta.respuesta}</p>
              </div>
              {respuesta.servicios.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {respuesta.servicios.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => onAplicar(s)}
                      className="text-left rounded-xl border border-neutral-800 bg-neutral-900 p-3 hover:border-white transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium group-hover:text-white">{s.nombre}</span>
                        <Plus size={14} className="text-neutral-500 flex-shrink-0 mt-0.5" />
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">{s.descripcion}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-500">
                        <span className="flex items-center gap-1"><Clock size={11} />{s.duracion_min} min</span>
                        <span className="flex items-center gap-1"><DollarSign size={11} />{formatoPrecio(s.precio_sugerido)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => { setRespuesta(null); setInput(""); }}
                className="text-xs text-neutral-400 hover:text-white"
              >
                Hacer otra consulta
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Servicios ────────────────────────────────────────────────────────────────

const VACIO_SERVICIO = {
  nombre: "", descripcion: "", duracion_min: 30, buffer_min: 0, precio: 0, imagen: "", badge: "ninguno", categoria_id: "",
};

function Servicios({ negocioId, onError }) {
  const [servicios, setServicios] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [nuevo, setNuevo] = useState(VACIO_SERVICIO);
  const [mostrarAvanzado, setMostrarAvanzado] = useState(false);
  const [generandoDesc, setGenerandoDesc] = useState(false);
  const [nuevaCat, setNuevaCat] = useState("");
  const formRef = useRef(null);

  const cargar = useCallback(() => {
    apiGet(`/negocios/${negocioId}/servicios`).then(setServicios).catch(onError);
    apiGet(`/negocios/${negocioId}/categorias`).then(setCategorias).catch(onError);
  }, [negocioId, onError]);
  useEffect(() => cargar(), [cargar]);

  async function crearCategoria() {
    const nombre = nuevaCat.trim();
    if (!nombre) return;
    try {
      const cat = await apiPost(`/negocios/${negocioId}/categorias`, { nombre, orden: categorias.length });
      setCategorias((prev) => [...prev, cat]);
      setNuevo((p) => ({ ...p, categoria_id: cat.id }));
      setNuevaCat("");
    } catch (err) { onError(err); alert(err.message); }
  }

  function aplicarSugerencia(s) {
    setNuevo((p) => ({ ...p, nombre: s.nombre, descripcion: s.descripcion, duracion_min: s.duracion_min, precio: s.precio_sugerido }));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function generarDescripcion() {
    if (!nuevo.nombre.trim()) return;
    setGenerandoDesc(true);
    try {
      const res = await apiPost("/admin/ia/descripcion-servicio", { texto: nuevo.nombre });
      if (res.texto) setNuevo((p) => ({ ...p, descripcion: res.texto }));
    } catch (err) {
      onError(err);
    } finally {
      setGenerandoDesc(false);
    }
  }

  async function crear(e) {
    e.preventDefault();
    if (!nuevo.nombre.trim()) return;
    try {
      await apiPost(`/negocios/${negocioId}/servicios`, {
        ...nuevo,
        duracion_min: Number(nuevo.duracion_min),
        buffer_min: Number(nuevo.buffer_min),
        precio: Number(nuevo.precio),
        imagen: nuevo.imagen || null,
        descripcion: nuevo.descripcion || null,
        categoria_id: nuevo.categoria_id ? Number(nuevo.categoria_id) : null,
      });
      setNuevo(VACIO_SERVICIO);
      cargar();
    } catch (err) {
      onError(err);
      alert(err.message);
    }
  }

  async function toggle(s) {
    try {
      await apiPatch(`/servicios/${s.id}`, { activo: !s.activo });
      cargar();
    } catch (err) {
      onError(err);
    }
  }

  if (!servicios) return <Cargando />;
  return (
    <div className="space-y-5">
      <AsistenteIA onAplicar={aplicarSugerencia} />

      {/* Form nuevo servicio */}
      <div ref={formRef} className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-5">
          <Plus size={16} className="text-neutral-700" strokeWidth={1.5} />
          <h3 className="font-serif text-lg text-neutral-900">Nuevo servicio</h3>
        </div>

        <form onSubmit={crear} className="space-y-5">
          <div className="grid md:grid-cols-2 gap-5">
            {/* Columna izquierda: imagen */}
            <div>
              <Etiqueta icono={<ImageIcon size={12} />} label="Imagen del servicio" />
              <ImageUploader
                value={nuevo.imagen}
                onChange={(url) => setNuevo({ ...nuevo, imagen: url })}
                onError={onError}
                alto="h-44"
              />
            </div>

            {/* Columna derecha: datos */}
            <div className="space-y-4">
              <div>
                <Etiqueta icono={<Tag size={12} />} label="Nombre del servicio" req />
                <input
                  value={nuevo.nombre}
                  onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                  placeholder="Ej: Corte de cabello"
                  required
                  className="campo-admin"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Etiqueta icono={<Clock size={12} />} label="Duración (min)" />
                  <input type="number" min={5} step={5} value={nuevo.duracion_min}
                    onChange={(e) => setNuevo({ ...nuevo, duracion_min: e.target.value })} className="campo-admin" />
                </div>
                <div>
                  <Etiqueta icono={<DollarSign size={12} />} label="Precio" />
                  <input type="number" min={0} step={100} value={nuevo.precio}
                    onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })} className="campo-admin" />
                </div>
              </div>

              <div>
                <Etiqueta icono={<Tag size={12} />} label="Categoría (opcional)" />
                <select value={nuevo.categoria_id} onChange={(e) => setNuevo({ ...nuevo, categoria_id: e.target.value })} className="campo-admin">
                  <option value="">Sin categoría</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <div className="flex gap-2 mt-2">
                  <input value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), crearCategoria())}
                    placeholder="Nueva categoría" className="campo-admin flex-1 text-xs py-1.5" />
                  <button type="button" onClick={crearCategoria}
                    className="rounded-lg border border-neutral-300 px-3 text-xs text-neutral-600 hover:border-neutral-900 hover:text-neutral-900">
                    Crear
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Descripción con IA */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Etiqueta icono={<BookOpen size={12} />} label="Descripción" sinMargen />
              <button
                type="button"
                onClick={generarDescripcion}
                disabled={!nuevo.nombre.trim() || generandoDesc}
                className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 disabled:opacity-40"
              >
                {generandoDesc ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {generandoDesc ? "Generando…" : "Generar con IA"}
              </button>
            </div>
            <textarea
              value={nuevo.descripcion}
              onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })}
              placeholder="Breve descripción que verá el cliente"
              rows={2}
              className="campo-admin resize-none"
            />
          </div>

          {/* Avanzado */}
          <button type="button" onClick={() => setMostrarAvanzado((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900">
            {mostrarAvanzado ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Opciones avanzadas
          </button>
          {mostrarAvanzado && (
            <div>
              <Etiqueta icono={<Clock size={12} />} label="Pausa entre turnos (min) — tiempo extra después del turno" />
              <input type="number" min={0} step={5} value={nuevo.buffer_min}
                onChange={(e) => setNuevo({ ...nuevo, buffer_min: e.target.value })} className="campo-admin w-32" />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit"
              className="flex items-center gap-2 rounded-full bg-neutral-900 text-white px-6 py-2.5 text-xs uppercase tracking-[0.1em] font-medium hover:bg-neutral-800 transition-colors">
              <Plus size={15} /> Agregar servicio
            </button>
            {nuevo.nombre && (
              <button type="button" onClick={() => setNuevo(VACIO_SERVICIO)}
                className="rounded-full border border-neutral-300 px-5 py-2.5 text-xs uppercase tracking-[0.1em] text-neutral-600 hover:bg-neutral-50">
                Limpiar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {servicios.length === 0 && (
          <p className="text-sm text-neutral-400 text-center py-6">Todavía no hay servicios.</p>
        )}
        {servicios.map((s) => (
          <ServicioFila key={s.id} servicio={s} categorias={categorias} onToggle={() => toggle(s)} onActualizar={cargar} onError={onError} />
        ))}
      </div>
    </div>
  );
}

function ServicioFila({ servicio: s, categorias, onToggle, onActualizar, onError }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    nombre: s.nombre, descripcion: s.descripcion || "", duracion_min: s.duracion_min,
    precio: s.precio, imagen: s.imagen || "", buffer_min: s.buffer_min,
    categoria_id: s.categoria_id || "",
  });
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    try {
      await apiPatch(`/servicios/${s.id}`, {
        ...form,
        duracion_min: Number(form.duracion_min),
        precio: Number(form.precio),
        buffer_min: Number(form.buffer_min),
        descripcion: form.descripcion || null,
        imagen: form.imagen || null,
        categoria_id: form.categoria_id ? Number(form.categoria_id) : null,
      });
      setEditando(false);
      onActualizar();
    } catch (err) {
      onError(err);
      alert(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className={`rounded-2xl border bg-white ${s.activo ? "border-neutral-200" : "border-neutral-200 opacity-60"}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-4 min-w-0">
          {s.imagen ? (
            <img src={s.imagen} alt={s.nombre} className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-neutral-100" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0">
              <Tag size={20} className="text-neutral-300" strokeWidth={1} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium text-sm ${!s.activo ? "line-through" : ""}`}>{s.nombre}</span>
              <span className="flex items-center gap-1 text-xs text-neutral-400"><Clock size={11} />{s.duracion_min} min</span>
              <span className="text-xs text-neutral-500">{formatoPrecio(s.precio)}</span>
            </div>
            {s.descripcion && <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{s.descripcion}</p>}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t border-neutral-100 sm:border-0 flex-shrink-0">
          <button onClick={() => setEditando((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 px-3 py-1.5 rounded-lg hover:bg-neutral-50 border border-transparent hover:border-neutral-200">
            <Pencil size={12} /> Editar
          </button>
          <button onClick={onToggle}
            className={`text-xs px-3 py-1.5 rounded-lg hover:bg-neutral-50 border border-transparent ${s.activo ? "text-neutral-500 hover:text-neutral-900 hover:border-neutral-200" : "text-green-600 hover:border-green-200"}`}>
            {s.activo ? "Desactivar" : "Activar"}
          </button>
        </div>
      </div>

      {editando && (
        <div className="px-4 pb-4 pt-1 border-t border-neutral-100 space-y-4">
          <div className="grid md:grid-cols-2 gap-4 pt-3">
            <div>
              <Etiqueta icono={<ImageIcon size={12} />} label="Imagen" />
              <ImageUploader value={form.imagen} onChange={(url) => setForm({ ...form, imagen: url })} onError={onError} alto="h-32" />
            </div>
            <div className="space-y-3">
              <div>
                <Etiqueta icono={<Tag size={12} />} label="Nombre" />
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="campo-admin" />
              </div>
              <div>
                <Etiqueta label="Categoría" />
                <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })} className="campo-admin">
                  <option value="">Sin categoría</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Etiqueta label="Duración" />
                  <input type="number" value={form.duracion_min} onChange={(e) => setForm({ ...form, duracion_min: e.target.value })} className="campo-admin" />
                </div>
                <div>
                  <Etiqueta label="Precio" />
                  <input type="number" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} className="campo-admin" />
                </div>
                <div>
                  <Etiqueta label="Pausa" />
                  <input type="number" value={form.buffer_min} onChange={(e) => setForm({ ...form, buffer_min: e.target.value })} className="campo-admin" />
                </div>
              </div>
            </div>
          </div>
          <div>
            <Etiqueta icono={<BookOpen size={12} />} label="Descripción" />
            <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={2} className="campo-admin resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={guardar} disabled={guardando}
              className="flex items-center gap-1.5 rounded-full bg-neutral-900 text-white px-5 py-2 text-xs uppercase tracking-[0.1em] disabled:opacity-50">
              {guardando ? <Loader2 size={12} className="animate-spin" /> : null}
              {guardando ? "Guardando" : "Guardar"}
            </button>
            <button onClick={() => setEditando(false)}
              className="rounded-full border border-neutral-300 px-5 py-2 text-xs uppercase tracking-[0.1em] text-neutral-600 hover:bg-neutral-50">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Profesionales ────────────────────────────────────────────────────────────

function Profesionales({ negocioId, onError }) {
  const [profesionales, setProfesionales] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [nuevo, setNuevo] = useState({ nombre: "", bio: "", foto: "", servicio_ids: [] });
  const [mostrarForm, setMostrarForm] = useState(false);

  const cargar = useCallback(() => {
    apiGet(`/negocios/${negocioId}/profesionales`).then(setProfesionales).catch(onError);
    apiGet(`/negocios/${negocioId}/servicios`).then(setServicios).catch(onError);
  }, [negocioId, onError]);
  useEffect(() => cargar(), [cargar]);

  function toggleServicio(id) {
    setNuevo((p) => ({
      ...p,
      servicio_ids: p.servicio_ids.includes(id) ? p.servicio_ids.filter((x) => x !== id) : [...p.servicio_ids, id],
    }));
  }

  async function crear(e) {
    e.preventDefault();
    if (!nuevo.nombre.trim()) return;
    try {
      await apiPost(`/negocios/${negocioId}/profesionales`, { ...nuevo, foto: nuevo.foto || null });
      setNuevo({ nombre: "", bio: "", foto: "", servicio_ids: [] });
      setMostrarForm(false);
      cargar();
    } catch (err) {
      onError(err);
      alert(err.message);
    }
  }

  if (!profesionales) return <Cargando />;
  return (
    <div className="space-y-4">
      {!mostrarForm && (
        <button onClick={() => setMostrarForm(true)}
          className="flex items-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-2.5 text-xs uppercase tracking-[0.1em] font-medium hover:bg-neutral-800 transition-colors">
          <Plus size={15} /> Agregar profesional
        </button>
      )}

      {mostrarForm && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-5">
            <User size={16} className="text-neutral-700" strokeWidth={1.5} />
            <h3 className="font-serif text-lg text-neutral-900">Nuevo profesional</h3>
          </div>
          <form onSubmit={crear} className="space-y-5">
            <div className="grid md:grid-cols-[160px_1fr] gap-5">
              <div>
                <Etiqueta icono={<ImageIcon size={12} />} label="Foto" />
                <ImageUploader value={nuevo.foto} onChange={(url) => setNuevo({ ...nuevo, foto: url })} onError={onError} alto="h-40" />
              </div>
              <div className="space-y-4">
                <div>
                  <Etiqueta icono={<User size={12} />} label="Nombre completo" req />
                  <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                    placeholder="Ej: Carlos Pérez" required className="campo-admin" />
                </div>
                <div>
                  <Etiqueta icono={<BookOpen size={12} />} label="Descripción breve" />
                  <input value={nuevo.bio} onChange={(e) => setNuevo({ ...nuevo, bio: e.target.value })}
                    placeholder="Ej: 10 años de experiencia" className="campo-admin" />
                </div>
              </div>
            </div>

            <div>
              <Etiqueta icono={<Tag size={12} />} label="Servicios que realiza" />
              {servicios.length === 0 ? (
                <p className="text-xs text-neutral-400 italic">Primero creá servicios.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {servicios.map((s) => (
                    <button type="button" key={s.id} onClick={() => toggleServicio(s.id)}
                      className={`text-xs rounded-full border px-3 py-1.5 transition-colors ${
                        nuevo.servicio_ids.includes(s.id) ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600 hover:border-neutral-500"
                      }`}>
                      {s.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button type="submit"
                className="flex items-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-2.5 text-xs uppercase tracking-[0.1em] hover:bg-neutral-800">
                <Plus size={14} /> Agregar
              </button>
              <button type="button" onClick={() => setMostrarForm(false)}
                className="rounded-full border border-neutral-300 px-5 py-2.5 text-xs uppercase tracking-[0.1em] text-neutral-600 hover:bg-neutral-50">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {profesionales.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-6">Todavía no hay profesionales.</p>
      ) : (
        <div className="space-y-2">
          {profesionales.map((p) => (
            <ProfesionalRow key={p.id} profesional={p} servicios={servicios} onError={onError} onSaved={cargar} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfesionalRow({ profesional, servicios, onError, onSaved }) {
  const [ids, setIds] = useState(profesional.servicio_ids);
  const [guardando, setGuardando] = useState(false);
  const cambiado =
    ids.length !== profesional.servicio_ids.length || ids.some((x) => !profesional.servicio_ids.includes(x));

  function toggle(id) {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function guardar() {
    setGuardando(true);
    try {
      await apiPatch(`/profesionales/${profesional.id}`, { servicio_ids: ids });
      onSaved();
    } catch (err) {
      onError(err);
      alert(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {profesional.foto ? (
            <img src={profesional.foto} alt={profesional.nombre} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-medium">
              {profesional.nombre.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase()}
            </div>
          )}
          <div>
            <span className="font-medium text-sm">{profesional.nombre}</span>
            {profesional.bio && <p className="text-xs text-neutral-400">{profesional.bio}</p>}
          </div>
        </div>
        {cambiado && (
          <button onClick={guardar} disabled={guardando}
            className="flex items-center gap-1.5 rounded-full bg-neutral-900 text-white px-4 py-1.5 text-xs uppercase tracking-[0.1em] disabled:opacity-50">
            {guardando ? <Loader2 size={12} className="animate-spin" /> : null}
            {guardando ? "Guardando" : "Guardar"}
          </button>
        )}
      </div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-2">Servicios habilitados</p>
      <div className="flex flex-wrap gap-2">
        {servicios.map((s) => (
          <button key={s.id} onClick={() => toggle(s.id)}
            className={`text-xs rounded-full border px-2.5 py-1 transition-colors ${
              ids.includes(s.id) ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600 hover:border-neutral-500"
            }`}>
            {s.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Portafolio ───────────────────────────────────────────────────────────────

function Portafolio({ onError }) {
  const [imagenes, setImagenes] = useState(null);
  const negocioId = getNegocioId();

  const cargar = useCallback(() => {
    apiGet(`/negocios/${negocioId}/portafolio`).then(setImagenes).catch(onError);
  }, [negocioId, onError]);
  useEffect(() => cargar(), [cargar]);

  async function agregar(url) {
    if (!url) return;
    try {
      await apiPost(`/admin/portafolio`, { url, orden: 0 });
      cargar();
    } catch (err) {
      onError(err);
      alert(err.message);
    }
  }

  async function borrar(id) {
    if (!confirm("¿Eliminar esta foto del portafolio?")) return;
    try {
      await apiDelete(`/admin/portafolio/${id}`);
      cargar();
    } catch (err) {
      onError(err);
    }
  }

  if (!imagenes) return <Cargando />;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h3 className="font-serif text-lg text-neutral-900 mb-1">Agregar foto al portafolio</h3>
        <p className="text-xs text-neutral-400 mb-4">Mostrá tus trabajos en la página pública</p>
        <ImageUploader value="" onChange={agregar} onError={onError} alto="h-40" />
      </div>

      {imagenes.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-6">Todavía no hay fotos.</p>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
          {imagenes.map((img) => (
            <div key={img.id} className="relative rounded-xl overflow-hidden border border-neutral-200 group aspect-square">
              <img src={img.url} alt="" className="w-full h-full object-cover" />
              <button onClick={() => borrar(img.id)}
                className="absolute top-1.5 right-1.5 bg-white/90 rounded-full p-1.5 text-neutral-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={13} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Agenda (horarios + excepciones) ──────────────────────────────────────────

const DIAS_SEMANA = [
  { n: 0, label: "Lun" },
  { n: 1, label: "Mar" },
  { n: 2, label: "Mié" },
  { n: 3, label: "Jue" },
  { n: 4, label: "Vie" },
  { n: 5, label: "Sáb" },
  { n: 6, label: "Dom" },
];

function Agenda({ negocioId, onError }) {
  const [profesionales, setProfesionales] = useState(null);
  const [profId, setProfId] = useState(null);
  const [horarios, setHorarios] = useState([]);
  const [excepciones, setExcepciones] = useState([]);
  const [nuevoHorario, setNuevoHorario] = useState({ dia_semana: 0, hora_inicio: "09:00", hora_fin: "13:00" });
  const [nuevaExc, setNuevaExc] = useState({ fecha: "", tipo: "no_disponible" });

  useEffect(() => {
    apiGet(`/negocios/${negocioId}/profesionales`)
      .then((ps) => {
        setProfesionales(ps);
        if (ps.length && profId == null) setProfId(ps[0].id);
      })
      .catch(onError);
  }, [negocioId, onError]);

  const cargarAgenda = useCallback(() => {
    if (!profId) return;
    apiGet(`/profesionales/${profId}/horarios`).then(setHorarios).catch(onError);
    apiGet(`/profesionales/${profId}/excepciones`).then(setExcepciones).catch(onError);
  }, [profId, onError]);
  useEffect(() => cargarAgenda(), [cargarAgenda]);

  async function agregarHorario(e) {
    e.preventDefault();
    try {
      await apiPost(`/profesionales/${profId}/horarios`, nuevoHorario);
      cargarAgenda();
    } catch (err) { onError(err); alert(err.message); }
  }
  async function quitarHorario(id) {
    try { await apiDelete(`/horarios/${id}`); cargarAgenda(); }
    catch (err) { onError(err); }
  }
  async function agregarExcepcion(e) {
    e.preventDefault();
    if (!nuevaExc.fecha) return;
    try {
      await apiPost(`/profesionales/${profId}/excepciones`, {
        fecha: nuevaExc.fecha,
        tipo: nuevaExc.tipo,
        hora_inicio: nuevaExc.tipo === "horario_especial" ? (nuevaExc.hora_inicio || "09:00") : null,
        hora_fin: nuevaExc.tipo === "horario_especial" ? (nuevaExc.hora_fin || "13:00") : null,
      });
      setNuevaExc({ fecha: "", tipo: "no_disponible" });
      cargarAgenda();
    } catch (err) { onError(err); alert(err.message); }
  }
  async function quitarExcepcion(id) {
    try { await apiDelete(`/excepciones/${id}`); cargarAgenda(); }
    catch (err) { onError(err); }
  }

  if (!profesionales) return <Cargando />;
  if (profesionales.length === 0)
    return <p className="text-sm text-neutral-400 py-6">Primero creá un profesional.</p>;

  const horariosPorDia = DIAS_SEMANA.map((d) => ({
    ...d,
    franjas: horarios.filter((h) => h.dia_semana === d.n),
  }));

  return (
    <div className="space-y-5">
      {/* Selector de profesional */}
      <div className="flex flex-wrap gap-2">
        {profesionales.map((p) => (
          <button key={p.id} onClick={() => setProfId(p.id)}
            className={`text-xs rounded-full border px-4 py-1.5 transition-colors ${
              profId === p.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600 hover:border-neutral-500"
            }`}>
            {p.nombre}
          </button>
        ))}
      </div>

      {/* Horario semanal */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarClock size={16} className="text-neutral-700" strokeWidth={1.5} />
          <h3 className="font-serif text-lg text-neutral-900">Horario semanal</h3>
        </div>

        <div className="space-y-2 mb-5">
          {horariosPorDia.map((d) => (
            <div key={d.n} className="flex items-center gap-3 py-1.5 border-b border-neutral-100 last:border-0">
              <span className="text-xs uppercase tracking-[0.1em] text-neutral-500 w-10">{d.label}</span>
              {d.franjas.length === 0 ? (
                <span className="text-xs text-neutral-300">Cerrado</span>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {d.franjas.map((f) => (
                    <span key={f.id} className="inline-flex items-center gap-2 text-xs bg-neutral-100 rounded-full pl-3 pr-1.5 py-1">
                      {f.hora_inicio?.slice(0, 5)}–{f.hora_fin?.slice(0, 5)}
                      <button onClick={() => quitarHorario(f.id)} className="text-neutral-400 hover:text-red-500">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Agregar franja */}
        <form onSubmit={agregarHorario} className="flex flex-wrap items-end gap-3 pt-4 border-t border-neutral-100">
          <div>
            <Etiqueta label="Día" />
            <select value={nuevoHorario.dia_semana} onChange={(e) => setNuevoHorario({ ...nuevoHorario, dia_semana: Number(e.target.value) })} className="campo-admin">
              {DIAS_SEMANA.map((d) => <option key={d.n} value={d.n}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <Etiqueta label="Desde" />
            <input type="time" value={nuevoHorario.hora_inicio} onChange={(e) => setNuevoHorario({ ...nuevoHorario, hora_inicio: e.target.value })} className="campo-admin" />
          </div>
          <div>
            <Etiqueta label="Hasta" />
            <input type="time" value={nuevoHorario.hora_fin} onChange={(e) => setNuevoHorario({ ...nuevoHorario, hora_fin: e.target.value })} className="campo-admin" />
          </div>
          <button type="submit" className="flex items-center gap-1.5 rounded-full bg-neutral-900 text-white px-4 py-2.5 text-xs uppercase tracking-[0.1em] hover:bg-neutral-800">
            <Plus size={14} /> Agregar
          </button>
        </form>
      </div>

      {/* Excepciones */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h3 className="font-serif text-lg text-neutral-900 mb-1">Excepciones</h3>
        <p className="text-xs text-neutral-400 mb-4">Vacaciones, feriados o un horario distinto en una fecha puntual</p>

        {excepciones.length > 0 && (
          <div className="space-y-2 mb-5">
            {excepciones.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                <div className="text-sm">
                  <span className="text-neutral-900">{ex.fecha}</span>
                  <span className="ml-2 text-xs text-neutral-500">
                    {ex.tipo === "no_disponible" ? "No disponible" : `Horario especial ${ex.hora_inicio?.slice(0,5)}–${ex.hora_fin?.slice(0,5)}`}
                  </span>
                </div>
                <button onClick={() => quitarExcepcion(ex.id)} className="text-neutral-400 hover:text-red-500">
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={agregarExcepcion} className="flex flex-wrap items-end gap-3 pt-2">
          <div>
            <Etiqueta label="Fecha" />
            <input type="date" value={nuevaExc.fecha} onChange={(e) => setNuevaExc({ ...nuevaExc, fecha: e.target.value })} required className="campo-admin" />
          </div>
          <div>
            <Etiqueta label="Tipo" />
            <select value={nuevaExc.tipo} onChange={(e) => setNuevaExc({ ...nuevaExc, tipo: e.target.value })} className="campo-admin">
              <option value="no_disponible">No disponible</option>
              <option value="horario_especial">Horario especial</option>
            </select>
          </div>
          {nuevaExc.tipo === "horario_especial" && (
            <>
              <div>
                <Etiqueta label="Desde" />
                <input type="time" value={nuevaExc.hora_inicio || "09:00"} onChange={(e) => setNuevaExc({ ...nuevaExc, hora_inicio: e.target.value })} className="campo-admin" />
              </div>
              <div>
                <Etiqueta label="Hasta" />
                <input type="time" value={nuevaExc.hora_fin || "13:00"} onChange={(e) => setNuevaExc({ ...nuevaExc, hora_fin: e.target.value })} className="campo-admin" />
              </div>
            </>
          )}
          <button type="submit" className="flex items-center gap-1.5 rounded-full bg-neutral-900 text-white px-4 py-2.5 text-xs uppercase tracking-[0.1em] hover:bg-neutral-800">
            <Plus size={14} /> Agregar
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Compartidos ──────────────────────────────────────────────────────────────

function Etiqueta({ icono, label, req, sinMargen }) {
  return (
    <label className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-neutral-400 ${sinMargen ? "" : "mb-1.5"}`}>
      {icono && <span className="text-neutral-400">{icono}</span>}
      <span>{label}</span>
      {req && <span className="text-red-400">*</span>}
    </label>
  );
}

function Cargando() {
  return (
    <div className="flex items-center gap-2 py-6 text-neutral-400 text-sm">
      <Loader2 size={14} className="animate-spin" /> Cargando…
    </div>
  );
}
