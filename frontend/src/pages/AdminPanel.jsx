import {
  Calendar,
  Check,
  ChevronRight,
  Clock,
  LayoutGrid,
  LogOut,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPost, clearToken, getNegocioId } from "../api/client.js";
import { useDialog } from "../components/Dialog.jsx";
import { fechaHora, formatoPrecio, isoFecha } from "../lib/format.js";
import { ICONO_DEFAULT, IconoNegocio } from "../lib/iconos.jsx";
import AdminGestion from "./AdminGestion.jsx";
import SEO from "../components/SEO.jsx";

// Contexto con la clave de ícono del negocio, para que header y tarjetas
// muestren el ícono correcto según el rubro (no siempre una tijera).
const IconoNegocioContext = createContext(ICONO_DEFAULT);

const TABS = [
  { id: "Dashboard", label: "Inicio", icon: LayoutGrid },
  { id: "Turnos", label: "Turnos", icon: Calendar },
  { id: "Clientes", label: "Clientes", icon: Users },
  { id: "Reseñas", label: "Reseñas", icon: Star },
  { id: "Gestión", label: "Gestión", icon: SlidersHorizontal },
];

// ─── Iconos / helpers ─────────────────────────────────────────────────────────

function IconWhatsApp({ size = 14, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

function formatearWhatsapp(telefono) {
  if (!telefono) return null;
  const solo = telefono.replace(/\D/g, "");
  if (solo.startsWith("54")) return solo;
  if (solo.startsWith("0")) return "54" + solo.slice(1);
  return "549" + solo;
}

function iniciales(nombre = "") {
  return nombre.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

// ─── Layout principal ─────────────────────────────────────────────────────────

export default function AdminPanel() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("Dashboard");
  const [icono, setIcono] = useState(ICONO_DEFAULT);

  const onError = useCallback(
    (err) => {
      if (err.status === 401) {
        clearToken();
        navigate("/admin/login");
      }
    },
    [navigate]
  );

  // Cargamos el ícono del negocio para adaptar el panel a cualquier rubro.
  useEffect(() => {
    apiGet("/admin/negocio")
      .then((n) => setIcono(n.icono || ICONO_DEFAULT))
      .catch(() => {});
  }, []);

  function salir() {
    clearToken();
    navigate("/admin/login");
  }

  const tabActual = TABS.find((t) => t.id === tab);

  return (
    <IconoNegocioContext.Provider value={icono}>
    <div className="min-h-screen bg-neutral-100">
      <SEO noIndex title="Panel de Control - Administración | MiTurno" />
      <header className="bg-neutral-950 text-white sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <IconoNegocio clave={icono} size={16} className="text-neutral-400" strokeWidth={1.5} />
            {/* En móvil: título de la sección actual. En desktop: nombre completo */}
            <h1 className="font-serif text-lg tracking-[0.05em]">
              <span className="sm:hidden">{tabActual?.id}</span>
              <span className="hidden sm:inline">MiTurno · Administración</span>
            </h1>
          </div>
          <button onClick={salir} className="flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-neutral-400 hover:text-white transition-colors">
            <LogOut size={14} strokeWidth={1.5} /> <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
        {/* Tabs superiores: solo desktop */}
        <nav className="hidden sm:flex max-w-5xl mx-auto px-5 gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative px-3 py-3 text-xs uppercase tracking-[0.12em] transition-colors"
            >
              <span className={tab === t.id ? "text-white" : "text-neutral-500 hover:text-neutral-300"}>{t.label}</span>
              {tab === t.id && <span className="absolute bottom-0 left-0 right-0 h-px bg-white line-grow" />}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-5 py-6 pb-28 sm:pb-6">
        {tab === "Dashboard" && <Dashboard onError={onError} />}
        {tab === "Turnos" && <Turnos onError={onError} />}
        {tab === "Clientes" && <Clientes onError={onError} />}
        {tab === "Reseñas" && <Resenas onError={onError} />}
        {tab === "Gestión" && <AdminGestion onError={onError} />}
      </main>

      {/* Bottom nav: solo móvil (estilo app) */}
      <nav
        className="sm:hidden fixed inset-x-0 bottom-0 z-30 bg-white border-t border-neutral-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex">
          {TABS.map((t) => {
            const Icon = t.icon;
            const activo = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 active:scale-95 transition-transform"
              >
                <div className={`relative flex items-center justify-center w-11 h-7 rounded-full transition-colors ${activo ? "bg-neutral-900" : ""}`}>
                  <Icon size={18} strokeWidth={1.75} className={activo ? "text-white" : "text-neutral-400"} />
                </div>
                <span className={`text-[10px] tracking-wide ${activo ? "text-neutral-900 font-medium" : "text-neutral-400"}`}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
    </IconoNegocioContext.Provider>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ onError }) {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let activo = true;
    const cargar = () => {
      apiGet("/admin/dashboard").then((d) => activo && setData(d)).catch(onError);
      apiGet("/admin/estadisticas?dias=30").then((s) => activo && setStats(s)).catch(onError);
    };
    cargar();
    const id = setInterval(cargar, 15000);
    return () => { activo = false; clearInterval(id); };
  }, [onError]);

  if (!data) return <Cargando />;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-neutral-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-neutral-900 opacity-40 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-neutral-900" />
        </span>
        En vivo · se actualiza solo
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <Metrica titulo="Turnos hoy" valor={data.turnos_hoy} />
        <Metrica titulo="Turnos esta semana" valor={data.turnos_semana} />
      </div>

      {stats && <GraficoTrafico datos={stats.datos} />}

      {data.hoy?.length > 0 && (
        <section>
          <TituloSeccion>Turnos de hoy</TituloSeccion>
          <ListaTurnos turnos={data.hoy} />
        </section>
      )}

      <section>
        <TituloSeccion>Próximos turnos</TituloSeccion>
        <ListaTurnos turnos={data.proximos} />
      </section>

      <section>
        <TituloSeccion>Accesos recientes al panel</TituloSeccion>
        <div className="rounded-2xl border border-neutral-200 bg-white divide-y divide-neutral-100 text-sm overflow-hidden">
          {data.accesos_recientes.length === 0 && (
            <p className="px-4 py-3 text-neutral-400">Sin registros.</p>
          )}
          {data.accesos_recientes.map((a, i) => (
            <div key={i} className="px-4 py-3 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs">
                  {iniciales(a.usuario_nombre)}
                </div>
                <div>
                  <span className="font-medium text-neutral-900">{a.usuario_nombre}</span>
                  {a.usuario_dni && <span className="ml-2 text-xs text-neutral-400">DNI {a.usuario_dni}</span>}
                </div>
              </div>
              <span className="text-neutral-400 text-xs">{fechaHora(a.ingreso_en)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function GraficoTrafico({ datos }) {
  const maximo = Math.max(...datos.map((d) => d.turnos), 1);
  const ancho = 720;
  const alto = 100;
  const barWidth = Math.floor((ancho - 20) / datos.length) - 2;
  const gap = Math.floor((ancho - 20) / datos.length);

  return (
    <section>
      <TituloSeccion>Actividad · últimos 30 días</TituloSeccion>
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <svg viewBox={`0 0 ${ancho} ${alto + 24}`} className="w-full" style={{ height: 140 }}>
          {[0, 0.5, 1].map((f) => (
            <line key={f} x1={10} y1={alto - f * alto} x2={ancho - 10} y2={alto - f * alto} stroke="#e5e5e5" strokeWidth={1} />
          ))}
          {datos.map((d, i) => {
            const h = Math.max(2, Math.round((d.turnos / maximo) * (alto - 8)));
            const x = 10 + i * gap;
            const y = alto - h;
            const esHoy = i === datos.length - 1;
            return (
              <g key={d.fecha}>
                <rect x={x} y={y} width={barWidth} height={h} rx={2}
                  fill={esHoy ? "#0a0a0a" : "#a3a3a3"} opacity={d.turnos === 0 ? 0.35 : 1} />
                {d.turnos > 0 && (
                  <text x={x + barWidth / 2} y={y - 3} textAnchor="middle" fontSize={9} fill="#525252">{d.turnos}</text>
                )}
              </g>
            );
          })}
          {datos.map((d, i) => {
            if (i % 7 !== 0 && i !== datos.length - 1) return null;
            const x = 10 + i * gap + barWidth / 2;
            const partes = d.fecha.split("-");
            return (
              <text key={d.fecha + "-l"} x={x} y={alto + 16} textAnchor="middle" fontSize={9} fill="#a3a3a3">
                {`${partes[2]}/${partes[1]}`}
              </text>
            );
          })}
        </svg>
        <p className="text-[10px] uppercase tracking-[0.1em] text-neutral-400 mt-2 text-right">
          Barra negra = hoy · turnos confirmados y completados
        </p>
      </div>
    </section>
  );
}

// ─── Turnos ───────────────────────────────────────────────────────────────────

const FILTROS_RAPIDOS = [
  { label: "Hoy", dias: 0 },
  { label: "Semana", dias: 6 },
  { label: "Mes", dias: 29 },
];

const ESTADO_CONFIG = {
  confirmada: { label: "Confirmado", dot: "bg-neutral-900" },
  completada: { label: "Completado", dot: "bg-green-600" },
  cancelada:  { label: "Cancelado",  dot: "bg-neutral-300" },
  no_show:    { label: "No asistió", dot: "bg-red-500" },
};

function Turnos({ onError }) {
  const dialog = useDialog();
  const hoy = isoFecha(new Date());
  const enUnaSemana = isoFecha(new Date(Date.now() + 7 * 86400000));
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(enUnaSemana);
  const [turnos, setTurnos] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("");

  const cargar = useCallback(() => {
    setTurnos(null);
    apiGet(`/admin/reservas?desde=${desde}&hasta=${hasta}`).then(setTurnos).catch(onError);
  }, [desde, hasta, onError]);

  const refrescar = useCallback(() => {
    apiGet(`/admin/reservas?desde=${desde}&hasta=${hasta}`).then(setTurnos).catch(() => {});
  }, [desde, hasta]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const id = setInterval(refrescar, 12000);
    return () => clearInterval(id);
  }, [refrescar]);

  async function accion(id, fn) {
    try { await fn(); refrescar(); }
    catch (err) { onError(err); await dialog.error(err.message); }
  }

  function aplicarFiltroRapido(dias) {
    const d = new Date();
    setDesde(isoFecha(d));
    setHasta(isoFecha(new Date(d.getTime() + dias * 86400000)));
  }

  const turnosFiltrados = turnos ? (filtroEstado ? turnos.filter((t) => t.estado === filtroEstado) : turnos) : null;
  const contadores = turnos ? {
    confirmada: turnos.filter((t) => t.estado === "confirmada").length,
    completada: turnos.filter((t) => t.estado === "completada").length,
    cancelada: turnos.filter((t) => t.estado === "cancelada").length,
    no_show: turnos.filter((t) => t.estado === "no_show").length,
  } : null;

  return (
    <div className="space-y-4">
      {/* Filtros de fecha */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 flex flex-wrap gap-4 items-end">
        <div className="flex gap-2 items-end">
          <Fecha label="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <ChevronRight size={16} className="text-neutral-300 mb-2.5" />
          <Fecha label="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="flex gap-1.5 pb-0.5">
          {FILTROS_RAPIDOS.map((f) => (
            <button key={f.label} onClick={() => aplicarFiltroRapido(f.dias)}
              className="text-xs uppercase tracking-[0.1em] rounded-full border border-neutral-300 px-3 py-1.5 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 transition-colors">
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contadores por estado (filtro) */}
      {contadores && (
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {Object.entries(ESTADO_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => setFiltroEstado(filtroEstado === key ? "" : key)}
              className={`rounded-2xl border p-3 text-left transition-all ${
                filtroEstado === key ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white hover:border-neutral-400"
              }`}>
              <span className={`inline-block h-2 w-2 rounded-full mb-2 ${filtroEstado === key ? "bg-white" : cfg.dot}`} />
              <div className={`font-serif text-2xl ${filtroEstado === key ? "text-white" : "text-neutral-900"}`}>{contadores[key]}</div>
              <div className={`text-[10px] uppercase tracking-[0.1em] ${filtroEstado === key ? "text-white/70" : "text-neutral-400"}`}>{cfg.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {!turnosFiltrados ? (
        <Cargando />
      ) : turnosFiltrados.length === 0 ? (
        <div className="text-center py-12 text-neutral-300">
          <Calendar size={36} className="mx-auto mb-3" strokeWidth={1} />
          <p className="text-sm text-neutral-400">No hay turnos en este período.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {turnosFiltrados.map((t) => (
            <TarjetaTurno key={t.id} turno={t} conAcciones
              onCompletar={() => accion(t.id, () => apiPost(`/admin/reservas/${t.id}/asistencia`, { estado: "completada" }))}
              onNoShow={() => accion(t.id, () => apiPost(`/admin/reservas/${t.id}/asistencia`, { estado: "no_show" }))}
              onCancelar={() => accion(t.id, () => apiPost(`/admin/reservas/${t.id}/cancelar`))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TarjetaTurno({ turno: t, conAcciones, onCompletar, onNoShow, onCancelar }) {
  const iconoNegocio = useContext(IconoNegocioContext);
  const wa = formatearWhatsapp(t.cliente_telefono);
  const cfg = ESTADO_CONFIG[t.estado] ?? ESTADO_CONFIG.cancelada;
  const fecha = new Date(t.inicio);
  const diaMes = fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }).toUpperCase();
  const hora = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
      <div className="flex items-stretch">
        <div className={`w-1.5 flex-shrink-0 ${cfg.dot}`} />
        <div className="flex-1 p-4 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Top row: Date/time on left, status on right (hidden on desktop) */}
            <div className="flex items-center justify-between sm:justify-start gap-4 flex-shrink-0">
              <div className="text-left sm:text-center min-w-[54px]">
                <div className="text-[10px] tracking-[0.1em] text-neutral-400 font-semibold">{diaMes}</div>
                <div className="font-serif text-lg text-neutral-900 leading-tight">{hora}</div>
                <div className="flex items-center sm:justify-center gap-0.5 text-[10px] text-neutral-400 mt-0.5">
                  <Clock size={10} strokeWidth={1.5} />{t.total_duracion} min
                </div>
              </div>
              <div className="w-px bg-neutral-100 self-stretch hidden sm:block" />
              {/* Mobile status pill */}
              <span className="inline-flex sm:hidden items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-full px-2.5 py-0.5">
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
              </span>
            </div>

            {/* Client info */}
            <div className="flex items-center gap-3 min-w-0 sm:min-w-[150px]">
              <div className="w-9 h-9 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs flex-shrink-0">
                {iniciales(t.cliente_nombre) || <User size={15} />}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-neutral-900 truncate">{t.cliente_nombre}</div>
                {t.cliente_telefono ? (
                  <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${t.cliente_nombre}, te contactamos desde el local.`)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 mt-0.5">
                    <IconWhatsApp size={13} />{t.cliente_telefono}
                  </a>
                ) : (
                  <span className="text-xs text-neutral-400">Sin teléfono</span>
                )}
              </div>
            </div>

            {/* Services */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <IconoNegocio clave={iconoNegocio} size={12} className="text-neutral-300 flex-shrink-0" strokeWidth={1.5} />
                <div className="flex flex-wrap gap-1">
                  {t.servicios.map((s) => (
                    <span key={s} className="text-xs border border-neutral-200 text-neutral-600 px-2 py-0.5 rounded-full truncate max-w-[150px]">{s}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <User size={11} strokeWidth={1.5} />{t.profesional_nombre}
                <span>·</span>
                <span className="font-medium text-neutral-700">{formatoPrecio(t.total_precio)}</span>
              </div>
            </div>

            {/* Desktop status / Actions (full-width on mobile to avoid overflow) */}
            <div className="flex flex-col items-stretch sm:items-end gap-2 flex-shrink-0 pt-3 sm:pt-0 border-t border-neutral-100 sm:border-0 w-full sm:w-auto">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-neutral-500">
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
              </span>
              {conAcciones && t.estado === "confirmada" && (
                <div className="flex flex-wrap gap-1.5 justify-end sm:justify-start">
                  <button onClick={onCompletar}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1 text-xs rounded-full border border-green-300 text-green-700 px-3 py-1.5 hover:bg-green-50 transition-colors">
                    <Check size={12} strokeWidth={2} /> Vino
                  </button>
                  <button onClick={onNoShow}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1 text-xs rounded-full border border-red-300 text-red-600 px-3 py-1.5 hover:bg-red-50 transition-colors">
                    <X size={12} strokeWidth={2} /> No vino
                  </button>
                  <button onClick={onCancelar}
                    className="flex-1 sm:flex-none text-xs rounded-full border border-neutral-300 text-neutral-500 px-3 py-1.5 hover:bg-neutral-50 transition-colors">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListaTurnos({ turnos }) {
  if (!turnos || turnos.length === 0)
    return <p className="text-neutral-400 text-sm">No hay turnos próximos.</p>;
  return (
    <div className="space-y-2">
      {turnos.map((t) => <TarjetaTurno key={t.id} turno={t} />)}
    </div>
  );
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

const SEGMENTO_CONFIG = {
  nuevo:     { label: "Nuevo",     dot: "bg-neutral-400" },
  regular:   { label: "Regular",   dot: "bg-neutral-700" },
  fiel:      { label: "Fiel",      dot: "bg-green-600" },
  en_riesgo: { label: "En riesgo", dot: "bg-red-500" },
};

const FILTROS_SEGMENTO = [
  { key: "", label: "Todos" },
  { key: "nuevo", label: "Nuevos" },
  { key: "regular", label: "Regulares" },
  { key: "fiel", label: "Fieles" },
  { key: "en_riesgo", label: "En riesgo" },
];

function Clientes({ onError }) {
  const [segmento, setSegmento] = useState("");
  const [clientes, setClientes] = useState(null);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    setClientes(null);
    const q = segmento ? `?segmento=${segmento}` : "";
    apiGet(`/admin/clientes${q}`).then(setClientes).catch(onError);
  }, [segmento, onError]);

  const clientesFiltrados = clientes
    ? clientes.filter((c) => !busqueda || c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || c.email.toLowerCase().includes(busqueda.toLowerCase()))
    : null;

  const contadores = clientes
    ? Object.fromEntries(Object.keys(SEGMENTO_CONFIG).map((k) => [k, clientes.filter((c) => c.segmento === k).length]))
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTROS_SEGMENTO.map((f) => (
          <button key={f.key} onClick={() => setSegmento(f.key)}
            className={`text-xs uppercase tracking-[0.1em] rounded-full border px-4 py-1.5 transition-all ${
              segmento === f.key ? "bg-neutral-900 text-white border-neutral-900" : "border-neutral-300 text-neutral-600 hover:border-neutral-900"
            }`}>
            {f.label}
            {contadores && (f.key ? <span className="ml-1.5 opacity-60">{contadores[f.key] ?? 0}</span> : <span className="ml-1.5 opacity-60">{clientes.length}</span>)}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" strokeWidth={1.5} />
        <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o email"
          className="w-full rounded-full border border-neutral-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors" />
      </div>

      {!clientesFiltrados ? (
        <Cargando />
      ) : clientesFiltrados.length === 0 ? (
        <div className="text-center py-10 text-neutral-300">
          <User size={32} className="mx-auto mb-2" strokeWidth={1} />
          <p className="text-sm text-neutral-400">No hay clientes con ese filtro.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {clientesFiltrados.map((c) => <TarjetaCliente key={c.id} cliente={c} />)}
        </div>
      )}
    </div>
  );
}

function TarjetaCliente({ cliente: c }) {
  const cfg = SEGMENTO_CONFIG[c.segmento] ?? SEGMENTO_CONFIG.nuevo;
  const wa = formatearWhatsapp(c.telefono);
  const msgWa = encodeURIComponent(`Hola ${c.nombre}, te contactamos desde el local. ¿Cómo estás?`);

  const stats = [
    { label: "Visitas", valor: c.turnos_completados },
    { label: "Canceló", valor: c.turnos_cancelados },
    { label: "No vino", valor: c.no_shows },
  ];

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Avatar & Info */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-11 h-11 rounded-full bg-neutral-900 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
            {iniciales(c.nombre) || <User size={16} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-neutral-900 truncate">{c.nombre}</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-neutral-500 bg-neutral-50 border border-neutral-200 px-2 py-0.5 rounded-full">
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-neutral-400 truncate max-w-[180px] sm:max-w-none">{c.email}</span>
              {c.telefono && (
                <a href={`https://wa.me/${wa}?text=${msgWa}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium">
                  <IconWhatsApp size={13} />{c.telefono}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Right: Stats (spaced out on mobile, tight on desktop) */}
        <div className="flex items-center justify-around sm:justify-end gap-6 sm:gap-8 pt-3 sm:pt-0 border-t border-neutral-100 sm:border-0 flex-shrink-0">
          {stats.map((s) => (
            <div key={s.label} className="text-center min-w-[50px]">
              <div className={`font-serif text-lg ${s.valor > 0 ? "text-neutral-900" : "text-neutral-300"}`}>{s.valor}</div>
              <div className="text-[10px] uppercase tracking-[0.1em] text-neutral-400 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Reseñas ──────────────────────────────────────────────────────────────────

function Resenas({ onError }) {
  const [resenas, setResenas] = useState(null);
  const [eliminando, setEliminando] = useState(null);
  const negocioId = getNegocioId();
  const dialog = useDialog();

  const cargar = useCallback(() => {
    if (negocioId) {
      apiGet(`/negocios/${negocioId}/resenas`).then(setResenas).catch(onError);
    } else {
      setResenas([]);
    }
  }, [negocioId, onError]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function eliminar(r) {
    const ok = await dialog.confirm(
      `¿Eliminar la reseña de ${r.cliente_nombre}? Esta acción no se puede deshacer.`,
      "Eliminar reseña",
      { btnConfirm: "Eliminar" }
    );
    if (!ok) return;
    setEliminando(r.id);
    try {
      await apiDelete(`/admin/resenas/${r.id}`);
      setResenas((prev) => prev.filter((x) => x.id !== r.id));
    } catch (err) {
      onError(err);
      await dialog.error(err.message);
    } finally {
      setEliminando(null);
    }
  }

  if (!resenas) return <Cargando />;
  if (resenas.length === 0) return <p className="text-neutral-400 text-sm">Todavía no hay reseñas.</p>;
  return (
    <div className="space-y-2">
      {resenas.map((r) => (
        <div key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs">
                {iniciales(r.cliente_nombre)}
              </div>
              <span className="font-medium text-neutral-900">{r.cliente_nombre}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={14} strokeWidth={1.5}
                    className={n <= r.puntuacion ? "fill-amber-400 text-amber-400" : "text-neutral-300"} />
                ))}
              </div>
              <button
                onClick={() => eliminar(r)}
                disabled={eliminando === r.id}
                title="Eliminar reseña"
                className="text-neutral-300 hover:text-red-500 transition-colors disabled:opacity-40"
              >
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            </div>
          </div>
          {r.profesional_nombre && (
            <div className="text-[10px] uppercase tracking-[0.1em] text-neutral-400 mt-1.5 ml-12">Atendió · {r.profesional_nombre}</div>
          )}
          {r.comentario && <p className="text-sm text-neutral-600 mt-1 ml-12">{r.comentario}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Compartidos ──────────────────────────────────────────────────────────────

function Metrica({ titulo, valor }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="font-serif text-4xl text-neutral-900">{valor}</div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 mt-1">{titulo}</div>
    </div>
  );
}

function TituloSeccion({ children }) {
  return <h2 className="font-serif text-lg text-neutral-900 mb-3">{children}</h2>;
}

function Fecha({ label, ...props }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-1">{label}</label>
      <input type="date" {...props}
        className="rounded-xl border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 transition-colors" />
    </div>
  );
}

function Cargando() {
  return <p className="text-neutral-400 text-sm py-6">Cargando…</p>;
}
