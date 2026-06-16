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
  QrCode,
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
import { useDialog } from "../components/Dialog.jsx";
import { ICONOS } from "../lib/iconos.jsx";
import { formatoPrecio } from "../lib/format.js";
import ImageUploader from "../components/ImageUploader.jsx";
import QRGenerator from "../components/QRGenerator.jsx";

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
  const dialog = useDialog();
  const [categorias, setCategorias] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [editandoNombre, setEditandoNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const [sugerencias, setSugerencias] = useState([]);
  const [sugeridorCargando, setSugeridorCargando] = useState(false);
  const [promptCategorias, setPromptCategorias] = useState("");

  const cargar = useCallback(() => {
    apiGet(`/negocios/${negocioId}/categorias`)
      .then(setCategorias)
      .catch(onError);
  }, [negocioId, onError]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function obtenerSugerencias() {
    setSugeridorCargando(true);
    try {
      const miNegocio = await apiGet("/negocios/mi-negocio");
      const res = await apiPost("/admin/ia/sugerir-categorias", { texto: promptCategorias.trim() || miNegocio.nombre || "" });
      if (res.categorias) {
        setSugerencias(res.categorias);
      }
    } catch (err) {
      onError(err);
    } finally {
      setSugeridorCargando(false);
    }
  }

  async function crearCategoriaSugerida(nombre) {
    setCargando(true);
    try {
      await apiPost(`/negocios/${negocioId}/categorias`, {
        nombre,
        orden: categorias ? categorias.length : 0,
      });
      setSugerencias((prev) => prev.filter((x) => x !== nombre));
      cargar();
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
    } finally {
      setCargando(false);
    }
  }

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
      await dialog.error(err.message);
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
      await dialog.error(err.message);
    }
  }

  async function borrar(id) {
    if (!await dialog.confirm("¿Seguro que querés eliminar esta categoría? Los servicios asociados quedarán sin categoría.")) return;
    try {
      await apiDelete(`/categorias/${id}`);
      cargar();
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
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

      {/* Asistente de Categorías con IA */}
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6 max-w-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-neutral-700" strokeWidth={1.5} />
            <h3 className="font-serif text-base text-neutral-900">Sugerir categorías con IA</h3>
          </div>
          <button
            type="button"
            onClick={obtenerSugerencias}
            disabled={sugeridorCargando}
            className="flex items-center gap-1.5 text-xs bg-white border border-neutral-200 text-neutral-955 rounded-full px-3 py-1 font-medium hover:bg-neutral-100 active:scale-95 transition-all shadow-sm disabled:opacity-50"
          >
            {sugeridorCargando ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
            {sugeridorCargando ? "Sugiriendo…" : "Sugerir con IA"}
          </button>
        </div>

        <div className="mb-3">
          <input
            value={promptCategorias}
            onChange={(e) => setPromptCategorias(e.target.value)}
            placeholder="Describí tu negocio o especialidad (ej: Peluquería canina, Clínica estética...)"
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs focus:outline-none focus:border-neutral-900 placeholder:text-neutral-400 transition-colors"
          />
        </div>

        {sugerencias.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">Hacé clic para agregar al instante:</p>
            <div className="flex flex-wrap gap-2">
              {sugerencias.map((catName) => (
                <button
                  key={catName}
                  type="button"
                  onClick={() => crearCategoriaSugerida(catName)}
                  disabled={cargando}
                  className="flex items-center gap-1 text-xs bg-white border border-neutral-200 text-neutral-800 rounded-full px-3 py-1.5 font-medium hover:border-neutral-900 hover:text-neutral-900 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Plus size={11} /> {catName}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-neutral-400">¿No estás seguro de qué categorías crear? Dejá que la IA te recomiende las mejores para tu negocio.</p>
        )}
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
  const dialog = useDialog();
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const [generandoDesc, setGenerandoDesc] = useState(false);
  const [antUnidad, setAntUnidad] = useState("min");

  useEffect(() => {
    apiGet("/negocios/mi-negocio").then((n) => {
      setForm(n);
      // Mostrar en horas si el valor es múltiplo exacto de 60 (y >= 60).
      const m = n.cancelacion_anticipacion_min ?? 20;
      if (m >= 60 && m % 60 === 0) setAntUnidad("hora");
    }).catch(onError);
  }, [onError]);

  async function generarDescripcionConIA() {
    if (!form.nombre?.trim()) {
      await dialog.error("Por favor ingresá primero el nombre del negocio.");
      return;
    }
    setGenerandoDesc(true);
    try {
      const res = await apiPost("/admin/ia/descripcion-negocio", { texto: form.nombre });
      if (res.texto) {
        setForm(prev => ({ ...prev, descripcion: res.texto }));
      }
    } catch (err) {
      onError(err);
    } finally {
      setGenerandoDesc(false);
    }
  }

  function set(k) {
    return (e) => setForm({ ...form, [k]: e.target.value });
  }

  // El logo del cartel se guarda al instante (sin esperar a "Guardar cambios").
  async function guardarLogoQr(url) {
    setForm((p) => ({ ...p, logo_qr: url || null }));
    try {
      await apiPatch("/negocios/mi-negocio", { logo_qr: url || null });
    } catch (err) {
      onError(err);
    }
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
        logo_qr: form.logo_qr || null,
        icono: form.icono || "scissors",
        cancelacion_anticipacion_min: form.cancelacion_anticipacion_min ?? 20,
        redes: form.redes || null,
        mapa_url: form.mapa_url || null,
        recordatorios_canal: form.recordatorios_canal || "email",
      });
      setForm(res);
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!form) return <Cargando />;
  const urlPublica = `${window.location.origin}/${form.slug}`;
  return (
    <div className="space-y-5 max-w-2xl">
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
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
              <div className="flex items-center justify-between mb-1.5">
                <Etiqueta icono={<BookOpen size={12} />} label="Descripción" sinMargen />
                <button
                  type="button"
                  onClick={generarDescripcionConIA}
                  disabled={!form.nombre?.trim() || generandoDesc}
                  className="flex items-center gap-1 text-xs bg-neutral-100 border border-neutral-200 text-neutral-900 rounded-full px-3 py-1 font-medium hover:bg-neutral-200 active:scale-95 transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                >
                  {generandoDesc ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="text-neutral-500" />}
                  {generandoDesc ? "Generando…" : "Generar con IA"}
                </button>
              </div>
              <textarea value={form.descripcion || ""} onChange={set("descripcion")} rows={2} className="campo-admin resize-none" placeholder="Breve descripción que verá el cliente" />
            </div>
          </div>
        </div>

        {/* Selector de ícono / rubro */}
        <div>
          <Etiqueta icono={<Sparkles size={12} />} label="Ícono del negocio (según tu rubro)" />
          <p className="text-xs text-neutral-400 mb-2">Se muestra en tu página si no subís un logo.</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Object.entries(ICONOS).map(([clave, { label, Icon }]) => {
              const activo = (form.icono || "scissors") === clave;
              return (
                <button
                  key={clave}
                  type="button"
                  onClick={() => setForm({ ...form, icono: clave })}
                  title={label}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-all active:scale-95 ${
                    activo ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-500 hover:border-neutral-400"
                  }`}
                >
                  <Icon size={20} strokeWidth={1.5} />
                  <span className="text-[9px] leading-tight text-center line-clamp-2">{label.split(" / ")[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Etiqueta label="Dirección" />
            <input value={form.direccion || ""} onChange={set("direccion")} className="campo-admin" placeholder="Ej: Av. Siempre Viva 742" />
          </div>
          <div>
            <Etiqueta label="Enlace Google Maps" />
            <input value={form.mapa_url || ""} onChange={set("mapa_url")} className="campo-admin" placeholder="https://maps.app.goo.gl/..." />
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


        {/* Anticipación de cancelación */}
        <div>
          <Etiqueta icono={<Clock size={12} />} label="Hasta cuándo puede cancelar el cliente" />
          <div className="flex items-center gap-2">
            <input
              type="number" min="0"
              value={antUnidad === "hora" ? Math.round((form.cancelacion_anticipacion_min ?? 20) / 60) : (form.cancelacion_anticipacion_min ?? 20)}
              onChange={(e) => {
                const num = Math.max(0, parseInt(e.target.value || "0", 10));
                setForm({ ...form, cancelacion_anticipacion_min: antUnidad === "hora" ? num * 60 : num });
              }}
              className="campo-admin w-28"
            />
            <select
              value={antUnidad}
              onChange={(e) => setAntUnidad(e.target.value)}
              className="campo-admin w-32"
            >
              <option value="min">minutos</option>
              <option value="hora">horas</option>
            </select>
            <span className="text-sm text-neutral-400">antes del turno</span>
          </div>
          <p className="text-xs text-neutral-400 mt-1.5">
            El cliente solo podrá cancelar online hasta ese tiempo antes de su turno. Después tendrá que llamarte.
          </p>
        </div>

        {/* Canal de recordatorios automáticos */}
        <div>
          <Etiqueta icono={<Send size={12} />} label="Recordatorios automáticos: ¿cómo se envían?" />
          <select
            value={form.recordatorios_canal || "email"}
            onChange={set("recordatorios_canal")}
            className="campo-admin w-full sm:w-72"
          >
            <option value="email">Solo por email</option>
            {form.plan === "premium" && <option value="whatsapp">Solo por WhatsApp</option>}
            {form.plan === "premium" && <option value="ambos">Email y WhatsApp</option>}
          </select>
          <p className="text-xs text-neutral-400 mt-1.5">
            Recordatorio del turno (24 h antes), "volvé a visitarnos" y recuperación de
            inasistencias.{" "}
            {form.plan === "premium"
              ? "Por WhatsApp requiere tenerlo conectado más arriba."
              : "El envío por WhatsApp está disponible en el plan Premium."}
          </p>
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

    {form.plan === "premium" && <ConectarWhatsApp onError={onError} />}

    {form.plan === "premium" && <BotRespuestas onError={onError} />}

    {/* Cartel con QR de la sucursal */}
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex items-center gap-2 mb-1">
        <QrCode size={16} className="text-neutral-700" strokeWidth={1.5} />
        <h3 className="font-serif text-lg text-neutral-900">Cartel con QR</h3>
      </div>
      <p className="text-xs text-neutral-400 mb-5">
        Personalizalo, descargalo e imprimilo para tu local. Lleva directo a tu página de reservas:
        <a href={urlPublica} target="_blank" rel="noopener noreferrer" className="text-neutral-600 hover:text-neutral-900 ml-1 break-all">{urlPublica}</a>
      </p>

      {/* Logo específico del QR (opcional) */}
      <div className="mb-5 max-w-[200px]">
        <Etiqueta icono={<ImageIcon size={12} />} label="Logo del cartel (opcional)" />
        <ImageUploader
          value={form.logo_qr || ""}
          onChange={guardarLogoQr}
          onError={onError}
          alto="h-28"
        />
        <p className="text-[11px] text-neutral-400 mt-1">Si lo dejás vacío, se usa el logo del negocio.</p>
      </div>

      <QRGenerator
        url={urlPublica}
        logoUrl={form.logo_qr || form.logo || null}
        businessName={form.nombre}
        slug={form.slug}
      />
    </div>
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
  const dialog = useDialog();
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
    } catch (err) { onError(err); await dialog.error(err.message); }
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
        badge: nuevo.badge || "ninguno",
      });
      setNuevo(VACIO_SERVICIO);
      cargar();
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Etiqueta icono={<Tag size={12} />} label="Categoría" />
                  <select value={nuevo.categoria_id} onChange={(e) => setNuevo({ ...nuevo, categoria_id: e.target.value })} className="campo-admin">
                    <option value="">Sin categoría</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <Etiqueta label="Etiqueta / Badge" />
                  <select value={nuevo.badge} onChange={(e) => setNuevo({ ...nuevo, badge: e.target.value })} className="campo-admin">
                    <option value="ninguno">Ninguno</option>
                    <option value="recomendado">Recomendado</option>
                    <option value="popular">Popular</option>
                    <option value="nuevo">Nuevo</option>
                    <option value="hot">Destacado 🔥 (Hot)</option>
                  </select>
                </div>
              </div>
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

          {/* Descripción con IA */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Etiqueta icono={<BookOpen size={12} />} label="Descripción" sinMargen />
              <button
                type="button"
                onClick={generarDescripcion}
                disabled={!nuevo.nombre.trim() || generandoDesc}
                className="flex items-center gap-1 text-xs bg-neutral-100 border border-neutral-200 text-neutral-900 rounded-full px-3 py-1 font-medium hover:bg-neutral-200 active:scale-95 transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none"
              >
                {generandoDesc ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="text-neutral-500" />}
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
  const dialog = useDialog();
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    nombre: s.nombre, descripcion: s.descripcion || "", duracion_min: s.duracion_min,
    precio: s.precio, imagen: s.imagen || "", buffer_min: s.buffer_min,
    categoria_id: s.categoria_id || "", badge: s.badge || "ninguno",
  });
  const [guardando, setGuardando] = useState(false);

  async function eliminar() {
    if (!await dialog.confirm(`¿Seguro que querés eliminar el servicio "${s.nombre}"? Esta acción no se puede deshacer.`)) return;
    setGuardando(true);
    try {
      await apiDelete(`/servicios/${s.id}`);
      onActualizar();
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
      onActualizar();
    } finally {
      setGuardando(false);
    }
  }

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
        badge: form.badge || "ninguno",
      });
      setEditando(false);
      onActualizar();
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
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
            {s.badge && s.badge !== "ninguno" && (
              <span className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] mb-1 ${
                s.badge === "hot" ? "text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100" : "text-neutral-500"
              }`}>
                {s.badge === "hot" ? "🔥 Mas pedido" : s.badge}
              </span>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium text-sm ${!s.activo ? "line-through" : ""}`}>{s.nombre}</span>
              <span className="flex items-center gap-1 text-xs text-neutral-400"><Clock size={11} />{s.duracion_min} min</span>
              <span className="text-xs text-neutral-500">{formatoPrecio(s.precio)}</span>
            </div>
            {s.descripcion && <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{s.descripcion}</p>}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t border-neutral-100 sm:border-0 flex-shrink-0">
          <button onClick={() => {
            if (!editando) {
              setForm({
                nombre: s.nombre,
                descripcion: s.descripcion || "",
                duracion_min: s.duracion_min,
                precio: s.precio,
                imagen: s.imagen || "",
                buffer_min: s.buffer_min,
                categoria_id: s.categoria_id || "",
                badge: s.badge || "ninguno",
              });
            }
            setEditando((v) => !v);
          }}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 px-3 py-1.5 rounded-lg hover:bg-neutral-50 border border-transparent hover:border-neutral-200">
            <Pencil size={12} /> Editar
          </button>
          <button onClick={onToggle}
            className={`text-xs px-3 py-1.5 rounded-lg hover:bg-neutral-50 border border-transparent ${s.activo ? "text-neutral-500 hover:text-neutral-900 hover:border-neutral-200" : "text-green-600 hover:border-green-200"}`}>
            {s.activo ? "Desactivar" : "Activar"}
          </button>
          <button onClick={eliminar} disabled={guardando}
            className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200 disabled:opacity-50">
            <Trash2 size={12} /> Eliminar
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Etiqueta label="Categoría" />
                  <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })} className="campo-admin">
                    <option value="">Sin categoría</option>
                    {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <Etiqueta label="Etiqueta" />
                  <select value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} className="campo-admin">
                    <option value="ninguno">Ninguno</option>
                    <option value="recomendado">Recomendado</option>
                    <option value="popular">Popular</option>
                    <option value="nuevo">Nuevo</option>
                    <option value="hot">Destacado 🔥 (Hot)</option>
                  </select>
                </div>
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

const LIMITE_PROF = { basico: 1, pro: 5, premium: Infinity };
const PLAN_LABEL  = { basico: "Básico", pro: "Pro", premium: "Premium" };

function Profesionales({ negocioId, onError }) {
  const dialog = useDialog();
  const [profesionales, setProfesionales] = useState(null);
  const [servicios, setServicios] = useState([]);
  const [plan, setPlan] = useState("pro");
  const [nuevo, setNuevo] = useState({ nombre: "", bio: "", foto: "", servicio_ids: [] });
  const [mostrarForm, setMostrarForm] = useState(false);

  const cargar = useCallback(() => {
    apiGet(`/negocios/${negocioId}/servicios`).then(setServicios).catch(onError);
    apiGet("/admin/negocio")
      .then((n) => {
        const planActual = n.plan || "pro";
        setPlan(planActual);
        // En Premium usamos el listado del admin (incluye comisión y acceso).
        const ruta = planActual === "premium"
          ? "/admin/profesionales"
          : `/negocios/${negocioId}/profesionales`;
        return apiGet(ruta).then(setProfesionales);
      })
      .catch(onError);
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
      await dialog.error(err.message);
    }
  }

  if (!profesionales) return <Cargando />;

  const limite = LIMITE_PROF[plan] ?? Infinity;
  const alcanzado = profesionales.length >= limite;

  return (
    <div className="space-y-4">
      {!mostrarForm && (
        alcanzado ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <span className="font-medium">Límite del plan {PLAN_LABEL[plan]}:</span> ya tenés {limite} profesional{limite !== 1 ? "es" : ""} cargado{limite !== 1 ? "s" : ""}.
            {" "}Para agregar más, pedile al administrador que actualice el plan.
          </div>
        ) : (
          <button onClick={() => setMostrarForm(true)}
            className="flex items-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-2.5 text-xs uppercase tracking-[0.1em] font-medium hover:bg-neutral-800 transition-colors">
            <Plus size={15} /> Agregar profesional
            {limite < Infinity && (
              <span className="ml-1 text-white/60">({profesionales.length}/{limite})</span>
            )}
          </button>
        )
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
              <div className="flex items-center justify-between mb-1.5">
                <Etiqueta icono={<Tag size={12} />} label="Servicios que realiza" sinMargen />
                {servicios.length > 0 && (
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => setNuevo({ ...nuevo, servicio_ids: servicios.map(s => s.id) })}
                      className="text-[10px] bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-full px-2.5 py-0.5 font-medium transition-colors">
                      Seleccionar todos
                    </button>
                    <button type="button" onClick={() => setNuevo({ ...nuevo, servicio_ids: [] })}
                      className="text-[10px] bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-full px-2.5 py-0.5 font-medium transition-colors">
                      Deseleccionar todos
                    </button>
                  </div>
                )}
              </div>
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
            <ProfesionalRow key={p.id} profesional={p} servicios={servicios} plan={plan} onError={onError} onSaved={cargar} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfesionalRow({ profesional, servicios, plan, onError, onSaved }) {
  const dialog = useDialog();
  const [ids, setIds] = useState(profesional.servicio_ids);
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    nombre: profesional.nombre,
    bio: profesional.bio || "",
    foto: profesional.foto || "",
    servicio_ids: profesional.servicio_ids,
  });

  useEffect(() => {
    setIds(profesional.servicio_ids);
  }, [profesional.servicio_ids]);

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
      await dialog.error(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setGuardando(true);
    try {
      await apiPatch(`/profesionales/${profesional.id}`, {
        nombre: form.nombre,
        bio: form.bio || null,
        foto: form.foto || null,
        servicio_ids: form.servicio_ids,
      });
      setEditando(false);
      onSaved();
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!await dialog.confirm(`¿Seguro que querés eliminar al profesional ${profesional.nombre}? Esta acción no se puede deshacer.`)) return;
    setGuardando(true);
    try {
      await apiDelete(`/profesionales/${profesional.id}`);
      onSaved();
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
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
        <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t border-neutral-100 sm:border-0 flex-shrink-0">
          {cambiado && (
            <button onClick={guardar} disabled={guardando}
              className="flex items-center gap-1.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-1.5 text-xs uppercase tracking-[0.1em] font-medium disabled:opacity-50 transition-colors shadow-sm animate-pulse">
              {guardando ? <Loader2 size={12} className="animate-spin" /> : null}
              {guardando ? "Guardando" : "Guardar cambios"}
            </button>
          )}
          <button onClick={() => {
            setForm({
              nombre: profesional.nombre,
              bio: profesional.bio || "",
              foto: profesional.foto || "",
              servicio_ids: profesional.servicio_ids,
            });
            setEditando(true);
          }}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 px-3 py-1.5 rounded-lg hover:bg-neutral-50 border border-transparent hover:border-neutral-200">
            <Pencil size={12} /> Editar
          </button>
          <button onClick={eliminar} disabled={guardando}
            className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200 disabled:opacity-50">
            <Trash2 size={12} /> Eliminar
          </button>
        </div>
      </div>

      {!editando && (
        <>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">Servicios habilitados</p>
            {servicios.length > 0 && (
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setIds(servicios.map(s => s.id))}
                  className="text-[10px] bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-full px-2.5 py-0.5 font-medium transition-colors">
                  Seleccionar todos
                </button>
                <button type="button" onClick={() => setIds([])}
                  className="text-[10px] bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-full px-2.5 py-0.5 font-medium transition-colors">
                  Deseleccionar todos
                </button>
              </div>
            )}
          </div>
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

          {plan === "premium" && (
            <PremiumProfesional profesional={profesional} onError={onError} onSaved={onSaved} />
          )}
        </>
      )}

      {editando && (
        <form onSubmit={guardarEdicion} className="px-1 pb-2 pt-1 border-t border-neutral-100 space-y-4">
          <div className="grid md:grid-cols-[160px_1fr] gap-4 pt-3">
            <div>
              <Etiqueta icono={<ImageIcon size={12} />} label="Foto" />
              <ImageUploader value={form.foto} onChange={(url) => setForm({ ...form, foto: url })} onError={onError} alto="h-32" />
            </div>
            <div className="space-y-3">
              <div>
                <Etiqueta icono={<User size={12} />} label="Nombre completo" req />
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="campo-admin" required />
              </div>
              <div>
                <Etiqueta icono={<BookOpen size={12} />} label="Descripción breve" />
                <input value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="campo-admin" />
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Etiqueta icono={<Tag size={12} />} label="Servicios habilitados" sinMargen />
              {servicios.length > 0 && (
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setForm({ ...form, servicio_ids: servicios.map(s => s.id) })}
                    className="text-[10px] bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-full px-2.5 py-0.5 font-medium transition-colors">
                    Seleccionar todos
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, servicio_ids: [] })}
                    className="text-[10px] bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-full px-2.5 py-0.5 font-medium transition-colors">
                    Deseleccionar todos
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {servicios.map((s) => {
                const activo = form.servicio_ids.includes(s.id);
                return (
                  <button type="button" key={s.id}
                    onClick={() => {
                      setForm({
                        ...form,
                        servicio_ids: activo
                          ? form.servicio_ids.filter((x) => x !== s.id)
                          : [...form.servicio_ids, s.id],
                      });
                    }}
                    className={`text-xs rounded-full border px-2.5 py-1 transition-colors ${
                      activo ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600 hover:border-neutral-500"
                    }`}>
                    {s.nombre}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={guardando}
              className="flex items-center gap-1.5 rounded-full bg-neutral-900 text-white px-5 py-2 text-xs uppercase tracking-[0.1em] disabled:opacity-50">
              {guardando ? <Loader2 size={12} className="animate-spin" /> : null}
              {guardando ? "Guardando" : "Guardar"}
            </button>
            <button type="button" onClick={() => setEditando(false)}
              className="rounded-full border border-neutral-300 px-5 py-2 text-xs uppercase tracking-[0.1em] text-neutral-600 hover:bg-neutral-50">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Portafolio ───────────────────────────────────────────────────────────────

function Portafolio({ onError }) {
  const dialog = useDialog();
  const [imagenes, setImagenes] = useState(null);
  const [plan, setPlan] = useState("pro");
  const negocioId = getNegocioId();

  const cargar = useCallback(() => {
    apiGet(`/negocios/${negocioId}/portafolio`).then(setImagenes).catch(onError);
    apiGet("/admin/negocio").then((n) => setPlan(n.plan || "pro")).catch(() => {});
  }, [negocioId, onError]);
  useEffect(() => cargar(), [cargar]);

  async function agregar(url) {
    if (!url) return;
    try {
      await apiPost(`/admin/portafolio`, { url, orden: 0 });
      cargar();
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
    }
  }

  async function borrar(id) {
    if (!await dialog.confirm("¿Eliminar esta foto del portafolio?")) return;
    try {
      await apiDelete(`/admin/portafolio/${id}`);
      cargar();
    } catch (err) {
      onError(err);
    }
  }

  if (!imagenes) return <Cargando />;

  if (plan === "basico") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <ImageIcon size={32} className="mx-auto mb-3 text-amber-400" strokeWidth={1.5} />
        <h3 className="font-serif text-lg text-neutral-900 mb-1">Portafolio de fotos</h3>
        <p className="text-sm text-amber-700">
          Disponible desde el plan <span className="font-medium">Pro</span>. Mostrá tus trabajos
          en la página pública para atraer más clientes.
        </p>
      </div>
    );
  }

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
  const dialog = useDialog();
  const [profesionales, setProfesionales] = useState(null);
  const [profId, setProfId] = useState(null);
  const [horarios, setHorarios] = useState([]);
  const [excepciones, setExcepciones] = useState([]);
  const [nuevoHorario, setNuevoHorario] = useState({ dia_semana: 0, hora_inicio: "09:00", hora_fin: "13:00" });
  const [nuevaExc, setNuevaExc] = useState({ fecha: "", tipo: "no_disponible" });
  const [diasSeleccionados, setDiasSeleccionados] = useState([0, 1, 2, 3, 4]);
  const [turno1, setTurno1] = useState({ hora_inicio: "09:00", hora_fin: "13:00" });
  const [turno2, setTurno2] = useState({ hora_inicio: "15:00", hora_fin: "19:00" });
  const [dobleTurno, setDobleTurno] = useState(false);
  const [autocompletando, setAutocompletando] = useState(false);

  async function autocompletarHorarios(e) {
    e.preventDefault();
    if (diasSeleccionados.length === 0) {
      await dialog.error("Por favor selecciona al menos un día.");
      return;
    }
    if (!await dialog.confirm("Esto reemplazará todos los horarios recurrentes de este profesional. ¿Deseas continuar?")) return;
    setAutocompletando(true);
    try {
      const rangos = [
        { hora_inicio: turno1.hora_inicio, hora_fin: turno1.hora_fin }
      ];
      if (dobleTurno) {
        rangos.push({ hora_inicio: turno2.hora_inicio, hora_fin: turno2.hora_fin });
      }
      
      await apiPost(`/profesionales/${profId}/horarios/bulk`, {
        dias_semana: diasSeleccionados,
        rangos: rangos,
        limpiar_existentes: true
      });
      
      cargarAgenda();
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
    } finally {
      setAutocompletando(false);
    }
  }

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
    } catch (err) { onError(err); await dialog.error(err.message); }
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
    } catch (err) { onError(err); await dialog.error(err.message); }
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

      {/* Autocompletar Horarios Rápido */}
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-neutral-700" strokeWidth={1.5} />
          <h3 className="font-serif text-base text-neutral-900">Autocompletar horarios</h3>
          <span className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 border border-neutral-200 bg-white rounded-full px-2 py-0.5 ml-auto">
            Semana rápida
          </span>
        </div>

        <form onSubmit={autocompletarHorarios} className="space-y-4">
          {/* Selección de Días */}
          <div>
            <Etiqueta label="Días de trabajo" />
            <div className="flex flex-wrap gap-1.5">
              {DIAS_SEMANA.map((d) => {
                const activo = diasSeleccionados.includes(d.n);
                return (
                  <button
                    key={d.n}
                    type="button"
                    onClick={() => {
                      setDiasSeleccionados((prev) =>
                        activo ? prev.filter((x) => x !== d.n) : [...prev, d.n]
                      );
                    }}
                    className={`text-xs rounded-full border px-3 py-1.5 font-medium transition-all active:scale-95 ${
                      activo
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Turno 1 */}
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-700">Turno Principal</span>
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Etiqueta label="Desde" sinMargen />
                  <input
                    type="time"
                    value={turno1.hora_inicio}
                    onChange={(e) => setTurno1({ ...turno1, hora_inicio: e.target.value })}
                    className="campo-admin py-1.5 text-xs"
                    required
                  />
                </div>
                <div>
                  <Etiqueta label="Hasta" sinMargen />
                  <input
                    type="time"
                    value={turno1.hora_fin}
                    onChange={(e) => setTurno1({ ...turno1, hora_fin: e.target.value })}
                    className="campo-admin py-1.5 text-xs"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Turno 2 (Doble Turno) */}
            <div className={`p-4 rounded-xl border transition-all ${
              dobleTurno 
                ? "bg-white border-neutral-200 shadow-sm" 
                : "bg-neutral-100/50 border-neutral-200 opacity-60"
            } space-y-3`}>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dobleTurno}
                    onChange={(e) => setDobleTurno(e.target.checked)}
                    className="rounded text-neutral-900 focus:ring-neutral-900"
                  />
                  <span className="text-xs font-semibold text-neutral-700">Doble Turno (Tarde)</span>
                </label>
              </div>
              
              {dobleTurno && (
                <div className="grid grid-cols-2 gap-2 fade-in">
                  <div>
                    <Etiqueta label="Desde" sinMargen />
                    <input
                      type="time"
                      value={turno2.hora_inicio}
                      onChange={(e) => setTurno2({ ...turno2, hora_inicio: e.target.value })}
                      className="campo-admin py-1.5 text-xs"
                      required={dobleTurno}
                    />
                  </div>
                  <div>
                    <Etiqueta label="Hasta" sinMargen />
                    <input
                      type="time"
                      value={turno2.hora_fin}
                      onChange={(e) => setTurno2({ ...turno2, hora_fin: e.target.value })}
                      className="campo-admin py-1.5 text-xs"
                      required={dobleTurno}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={autocompletando || diasSeleccionados.length === 0}
              className="flex items-center gap-2 rounded-full bg-neutral-900 text-white px-5 py-2.5 text-xs uppercase tracking-[0.1em] font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors shadow-sm"
            >
              {autocompletando ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {autocompletando ? "Generando..." : "Autocompletar semana"}
            </button>
            <p className="text-[10px] text-neutral-400 italic">
              * Esto borrará los horarios recurrentes cargados de este profesional y aplicará la plantilla.
            </p>
          </div>
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

// ─── Premium: comisión y acceso individual del profesional ───────────────────

function PremiumProfesional({ profesional, onError, onSaved }) {
  const dialog = useDialog();
  const [comision, setComision] = useState({
    tipo_comision: profesional.tipo_comision || "porcentaje_corte",
    valor_comision: profesional.valor_comision ?? 0,
  });
  const [guardando, setGuardando] = useState(false);
  const [accesoAbierto, setAccesoAbierto] = useState(false);
  const [acceso, setAcceso] = useState({ username: profesional.username || "", dni: "", password: "" });

  const esPorcentaje = comision.tipo_comision === "porcentaje_corte";
  const comisionCambiada =
    comision.tipo_comision !== (profesional.tipo_comision || "porcentaje_corte") ||
    Number(comision.valor_comision) !== Number(profesional.valor_comision ?? 0);

  async function guardarComision() {
    setGuardando(true);
    try {
      await apiPatch(`/profesionales/${profesional.id}/comision`, {
        tipo_comision: comision.tipo_comision,
        valor_comision: Number(comision.valor_comision) || 0,
      });
      onSaved();
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarAcceso(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      await apiPost(`/profesionales/${profesional.id}/credenciales`, {
        username: acceso.username.trim(),
        dni: acceso.dni.trim(),
        password: acceso.password.trim(),
      });
      setAccesoAbierto(false);
      setAcceso({ ...acceso, dni: "", password: "" });
      await dialog.alert(
        `Listo: ${profesional.nombre} ya puede entrar desde la pantalla de login con su usuario y verá solo sus turnos y comisiones.`,
        "Acceso creado"
      );
      onSaved();
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function revocarAcceso() {
    if (!await dialog.confirm(`¿Desactivar el acceso de ${profesional.nombre} a su panel?`)) return;
    try {
      await apiDelete(`/profesionales/${profesional.id}/credenciales`);
      onSaved();
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-dashed border-neutral-200 space-y-3">
      {/* Comisión */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-2">
          Comisión (Premium)
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            {[
              { id: "porcentaje_corte", label: "% por corte" },
              { id: "fijo_local", label: "Fijo del local" },
            ].map((t) => (
              <button key={t.id} type="button"
                onClick={() => setComision({ ...comision, tipo_comision: t.id })}
                className={`text-xs rounded-full border px-3 py-1.5 transition-colors ${
                  comision.tipo_comision === t.id
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 text-neutral-600 hover:border-neutral-500"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          {esPorcentaje && (
            <div className="flex items-center gap-1">
              <input
                type="number" min="0" max="100" step="0.5"
                value={comision.valor_comision}
                onChange={(e) => setComision({ ...comision, valor_comision: e.target.value })}
                className="w-20 rounded-xl border border-neutral-200 px-2.5 py-1.5 text-sm"
              />
              <span className="text-sm text-neutral-500">%</span>
            </div>
          )}
          {comisionCambiada && (
            <button onClick={guardarComision} disabled={guardando}
              className="text-xs rounded-full bg-orange-600 hover:bg-orange-700 text-white px-3.5 py-1.5 uppercase tracking-[0.1em] font-medium disabled:opacity-50 transition-colors">
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          )}
        </div>
        {!esPorcentaje && (
          <p className="text-[11px] text-neutral-400 mt-1.5">
            El local retiene el total de los cortes; el profesional se liquida por sueldo fijo aparte.
          </p>
        )}
      </div>

      {/* Acceso individual */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-2">
          Acceso a su panel (Premium)
        </p>
        {!accesoAbierto ? (
          <div className="flex flex-wrap items-center gap-2">
            {profesional.username ? (
              <>
                <span className="text-xs rounded-full bg-emerald-50 text-emerald-700 px-3 py-1.5">
                  Usuario: <span className="font-medium">{profesional.username}</span>
                </span>
                <button onClick={() => setAccesoAbierto(true)}
                  className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2">
                  Cambiar credenciales
                </button>
                <button onClick={revocarAcceso}
                  className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2">
                  Desactivar
                </button>
              </>
            ) : (
              <button onClick={() => setAccesoAbierto(true)}
                className="text-xs rounded-full border border-neutral-300 px-3.5 py-1.5 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 transition-colors">
                Crear acceso individual
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={guardarAcceso} className="grid sm:grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-center">
            <input
              value={acceso.username}
              onChange={(e) => setAcceso({ ...acceso, username: e.target.value })}
              placeholder="Usuario" required minLength={3}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
            <input
              value={acceso.dni}
              onChange={(e) => setAcceso({ ...acceso, dni: e.target.value })}
              placeholder="DNI" required inputMode="numeric"
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={acceso.password}
              onChange={(e) => setAcceso({ ...acceso, password: e.target.value })}
              placeholder="Contraseña (mín. 6)" required minLength={6}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            />
            <button type="submit" disabled={guardando}
              className="text-xs rounded-full bg-neutral-900 text-white px-4 py-2 uppercase tracking-[0.1em] disabled:opacity-50 hover:bg-neutral-800 transition-colors">
              {guardando ? "…" : "Guardar"}
            </button>
            <button type="button" onClick={() => setAccesoAbierto(false)}
              className="text-xs text-neutral-400 hover:text-neutral-700 px-2 py-2">
              Cancelar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Bot de WhatsApp: respuestas personalizables (Premium) ───────────────────

const CAMPOS_BOT = [
  { clave: "bienvenida", label: "Bienvenida / cuando no entiende", ayuda: "Se usa al saludar o si el bot no entiende la consulta." },
  { clave: "precios", label: "Precios", ayuda: "Respuesta cuando preguntan por precios. Usá {precios} para insertar la lista real." },
  { clave: "horarios", label: "Horarios", ayuda: "Cuando preguntan por horarios. Usá {horarios} para los horarios reales." },
  { clave: "direccion", label: "Dirección / cómo llegar", ayuda: "Cuando preguntan dónde están. Usá {direccion} y {mapa}." },
  { clave: "reservar", label: "Reservar turno", ayuda: "Cuando quieren agendar. Usá {link} para el enlace de reservas." },
];

function BotRespuestas({ onError }) {
  const dialog = useDialog();
  const [data, setData] = useState(null);      // {respuestas, automaticas}
  const [form, setForm] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(null); // clave en curso
  const [ok, setOk] = useState(false);

  useEffect(() => {
    apiGet("/admin/bot-respuestas")
      .then((d) => { setData(d); setForm(d.respuestas); })
      .catch(onError);
  }, [onError]);

  async function generar(clave) {
    setGenerando(clave);
    try {
      const r = await apiPost("/admin/ia/bot-respuesta", { clave });
      setForm((f) => ({ ...f, [clave]: r.texto }));
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
    } finally {
      setGenerando(null);
    }
  }

  async function guardar() {
    setGuardando(true);
    setOk(false);
    try {
      const d = await apiPatch("/admin/bot-respuestas", form);
      setData(d);
      setForm(d.respuestas);
      setOk(true);
      setTimeout(() => setOk(false), 2500);
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!form) return null;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <Bot size={16} className="text-neutral-700" strokeWidth={1.5} />
        <h3 className="font-serif text-lg text-neutral-900">Respuestas del bot de WhatsApp</h3>
      </div>
      <p className="text-xs text-neutral-400 mb-5">
        Personalizá lo que responde el bot a las consultas comunes. Si dejás un campo
        vacío, usa la respuesta automática con tus datos reales. Podés generarlas con IA.
      </p>

      <div className="space-y-5">
        {CAMPOS_BOT.map(({ clave, label, ayuda }) => (
          <div key={clave}>
            <div className="flex items-center justify-between mb-1.5">
              <Etiqueta label={label} sinMargen />
              <button
                type="button"
                onClick={() => generar(clave)}
                disabled={generando === clave}
                className="flex items-center gap-1 text-xs bg-neutral-100 border border-neutral-200 text-neutral-900 rounded-full px-3 py-1 font-medium hover:bg-neutral-200 active:scale-95 transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none"
              >
                {generando === clave ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="text-neutral-500" />}
                {generando === clave ? "Generando…" : "Generar con IA"}
              </button>
            </div>
            <textarea
              value={form[clave] ?? ""}
              onChange={(e) => setForm({ ...form, [clave]: e.target.value })}
              rows={2}
              placeholder={data?.automaticas?.[clave] || "Respuesta automática"}
              className="campo-admin resize-none w-full text-sm"
            />
            <p className="text-[11px] text-neutral-400 mt-1">{ayuda}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={guardar}
          disabled={guardando}
          className="flex items-center gap-2 rounded-full bg-neutral-900 text-white px-6 py-2.5 text-xs uppercase tracking-[0.1em] font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
        >
          {guardando ? <Loader2 size={14} className="animate-spin" /> : null}
          {guardando ? "Guardando" : "Guardar respuestas"}
        </button>
        {ok && (
          <span className="flex items-center gap-1.5 text-xs text-green-600">
            <Check size={14} strokeWidth={2} /> Guardado
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Conectar WhatsApp del negocio (Premium) ─────────────────────────────────

function ConectarWhatsApp({ onError }) {
  const dialog = useDialog();
  const [estado, setEstado] = useState(null);   // {estado, qr, conectado, instancia}
  const [cargando, setCargando] = useState(false);
  const pollRef = useRef(null);

  const cargarEstado = useCallback(async () => {
    try {
      const e = await apiGet("/admin/whatsapp/estado");
      setEstado(e);
      return e;
    } catch (err) {
      onError(err);
      return null;
    }
  }, [onError]);

  useEffect(() => {
    cargarEstado();
    return () => clearInterval(pollRef.current);
  }, [cargarEstado]);

  // Mientras esperamos el escaneo, refrescamos estado + QR cada 4s.
  function iniciarPolling() {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const e = await cargarEstado();
      if (e?.conectado) {
        clearInterval(pollRef.current);
      } else if (e && !e.qr && e.estado !== "connecting") {
        // si dejó de haber QR y no está conectando, pedimos uno nuevo
        try { setEstado(await apiPost("/admin/whatsapp/conectar")); } catch { /* ignore */ }
      }
    }, 4000);
  }

  async function conectar() {
    setCargando(true);
    try {
      const e = await apiPost("/admin/whatsapp/conectar");
      setEstado(e);
      if (!e.conectado) iniciarPolling();
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
    } finally {
      setCargando(false);
    }
  }

  async function desconectar() {
    if (!(await dialog.confirm("¿Desconectar el WhatsApp del bot? Vas a tener que volver a escanear el QR para reconectarlo."))) return;
    setCargando(true);
    try {
      await apiPost("/admin/whatsapp/desconectar");
      clearInterval(pollRef.current);
      await cargarEstado();
    } catch (err) {
      onError(err);
    } finally {
      setCargando(false);
    }
  }

  if (!estado) return null;

  const conectado = estado.conectado;
  const noDisponible = estado.estado === "no_disponible";

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <Bot size={16} className="text-neutral-700" strokeWidth={1.5} />
        <h3 className="font-serif text-lg text-neutral-900">Conectar WhatsApp</h3>
      </div>
      <p className="text-xs text-neutral-400 mb-5">
        Conectá el WhatsApp del negocio para activar el bot de atención 24 hs y los
        avisos automáticos de la lista de espera. Se vincula como WhatsApp Web.
      </p>

      {noDisponible ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 text-sm">
          El servicio de WhatsApp todavía no está habilitado en el servidor. Contactá al administrador.
        </div>
      ) : conectado ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-700 px-4 py-2 text-sm font-medium">
            <Check size={15} strokeWidth={2} /> WhatsApp conectado
          </span>
          <button onClick={desconectar} disabled={cargando}
            className="text-xs text-red-500 hover:text-red-700 underline underline-offset-2 disabled:opacity-50">
            Desconectar
          </button>
        </div>
      ) : estado.qr ? (
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <img src={estado.qr} alt="Código QR de WhatsApp" className="w-52 h-52 rounded-xl border border-neutral-200 bg-white" />
          <div className="text-sm text-neutral-600 space-y-2">
            <p className="font-medium text-neutral-900">Escaneá este código:</p>
            <ol className="list-decimal list-inside space-y-1 text-neutral-500">
              <li>Abrí WhatsApp en el celular del negocio</li>
              <li>Tocá <span className="text-neutral-700">Configuración → Dispositivos vinculados</span></li>
              <li>Tocá <span className="text-neutral-700">Vincular un dispositivo</span> y escaneá</li>
            </ol>
            <p className="text-[11px] text-neutral-400">El código se renueva solo. Cuando conecte, esta tarjeta lo va a mostrar.</p>
          </div>
        </div>
      ) : (
        <button onClick={conectar} disabled={cargando}
          className="flex items-center gap-2 rounded-full bg-neutral-900 text-white px-6 py-2.5 text-xs uppercase tracking-[0.1em] font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors">
          {cargando ? <Loader2 size={14} className="animate-spin" /> : <Bot size={14} strokeWidth={1.5} />}
          {cargando ? "Generando QR…" : "Conectar WhatsApp"}
        </button>
      )}
    </div>
  );
}
