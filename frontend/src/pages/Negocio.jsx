import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Globe,
  Mail,
  MapPin,
  Moon,
  PenLine,
  Phone,
  Plus,
  Scissors,
  Search,
  Shuffle,
  Star,
  Sun,
  Sunrise,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api/client.js";
import { emailValido, formatoPrecio, horaLocal, isoFecha } from "../lib/format.js";
import SEO from "../components/SEO.jsx";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIAS_CORTO = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function getDias(cant = 45) {
  return Array.from({ length: cant }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
}

function iniciales(nombre = "") {
  return nombre.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function IconInstagram({ size = 16, className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function renderSocialIcon(type, size = 16) {
  switch (type) {
    case "instagram":
      return <IconInstagram size={size} className="text-neutral-900" />;
    case "whatsapp":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-900">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-900">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-900">
          <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
        </svg>
      );
    default:
      return <Globe size={size} className="text-neutral-900" strokeWidth={1.5} />;
  }
}

function parseRedes(redesString) {
  if (!redesString) return [];
  const items = redesString.split(/[\s,]+/).filter(Boolean);
  return items.map(item => {
    const url = item.startsWith("@")
      ? `https://instagram.com/${item.slice(1)}`
      : item.startsWith("http")
      ? item
      : `https://${item}`;
    
    let label = item;
    let iconType = "globe";
    
    const lower = item.toLowerCase();
    if (lower.includes("instagram.com") || item.startsWith("@")) {
      iconType = "instagram";
      const parts = item.split("instagram.com/");
      const user = parts[1]?.split(/[?#]/)[0] || item;
      label = user.startsWith("@") ? user : `@${user.replace(/^\/+|\/+$/g, "")}`;
    } else if (lower.includes("facebook.com") || lower.includes("fb.me")) {
      iconType = "facebook";
      const parts = item.split(/(?:facebook\.com|fb\.me)\//);
      label = parts[1]?.split(/[?#]/)[0] || "Facebook";
      label = label.replace(/^\/+|\/+$/g, "");
    } else if (lower.includes("tiktok.com")) {
      iconType = "tiktok";
      const parts = item.split("tiktok.com/");
      let user = parts[1]?.split(/[?#]/)[0] || "TikTok";
      user = user.replace(/^\/+|\/+$/g, "");
      label = user.startsWith("@") ? user : `@${user}`;
    } else if (lower.includes("wa.me") || lower.includes("whatsapp.com") || lower.includes("api.whatsapp")) {
      iconType = "whatsapp";
      label = "WhatsApp";
    } else {
      label = item.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/+$/, "");
    }
    
    return { url, label, iconType };
  });
}

// ─── Estrellas (icono, nunca texto) ───────────────────────────────────────────

function Estrellas({ valor = 0, size = 14 }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= Math.round(valor) ? "fill-amber-400 text-amber-400" : "text-neutral-300"}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Negocio() {
  const { slug } = useParams();
  const [negocio, setNegocio] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("servicios");
  const [busqueda, setBusqueda] = useState("");
  const [resenas, setResenas] = useState(null);
  const [portafolio, setPortafolio] = useState(null);

  const [seleccion, setSeleccion] = useState([]);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [paso, setPaso] = useState(1);
  const [profesionalId, setProfesionalId] = useState(null);
  const [fechaObj, setFechaObj] = useState(new Date());
  const [franjas, setFranjas] = useState(null);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [slot, setSlot] = useState(null);
  const [datos, setDatos] = useState({ nombre: "", email: "", telefono: "" });
  const [reserva, setReserva] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [errorModal, setErrorModal] = useState(null);

  useEffect(() => {
    apiGet(`/negocios/${slug}`).then(setNegocio).catch((e) => setError(e.message));
  }, [slug]);

  useEffect(() => {
    if (tab === "resenas" && negocio && !resenas) {
      apiGet(`/negocios/${negocio.id}/resenas`).then(setResenas).catch(() => setResenas([]));
    }
    if (tab === "detalles" && negocio && portafolio === null) {
      apiGet(`/negocios/${negocio.id}/portafolio`).then(setPortafolio).catch(() => setPortafolio([]));
    }
  }, [tab, negocio, resenas, portafolio]);

  useEffect(() => {
    if (!modalAbierto || paso !== 2 || !negocio || seleccion.length === 0) return;
    setCargandoSlots(true);
    setSlot(null);
    setFranjas(null);
    const params = new URLSearchParams({ negocio_id: negocio.id, fecha: isoFecha(fechaObj) });
    seleccion.forEach((id) => params.append("servicio_ids", id));
    if (profesionalId) params.append("profesional_id", profesionalId);
    apiGet(`/disponibilidad?${params.toString()}`)
      .then(setFranjas)
      .catch((e) => setErrorModal(e.message))
      .finally(() => setCargandoSlots(false));
  }, [modalAbierto, paso, fechaObj, seleccion, profesionalId, negocio]);

  const serviciosVisibles = useMemo(() => {
    const todos = (negocio?.servicios ?? []).filter((s) => s.activo);
    if (!busqueda.trim()) return todos;
    const q = busqueda.toLowerCase();
    return todos.filter(
      (s) => s.nombre.toLowerCase().includes(q) || s.descripcion?.toLowerCase().includes(q)
    );
  }, [negocio, busqueda]);

  const serviciosElegidos = useMemo(
    () => (negocio?.servicios ?? []).filter((s) => seleccion.includes(s.id)),
    [negocio, seleccion]
  );
  const totalPrecio = serviciosElegidos.reduce((a, s) => a + Number(s.precio), 0);
  const totalDuracion = serviciosElegidos.reduce((a, s) => a + s.duracion_min + s.buffer_min, 0);

  const seoData = useMemo(() => {
    if (!negocio) return null;
    const serviceNames = (negocio.servicios ?? []).filter((s) => s.activo).slice(0, 8).map((s) => s.nombre);
    const keywordsList = [
      negocio.nombre,
      "reservar turno",
      "turnos online",
      "citas online",
      "MiTurno",
      negocio.direccion || "",
      ...serviceNames
    ].filter(Boolean);

    const schemaObj = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": negocio.nombre,
      "description": negocio.descripcion || `Reserva tu turno online en ${negocio.nombre}`,
      "image": negocio.logo || "",
      "url": window.location.href,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": negocio.direccion || "",
        "addressCountry": "AR"
      }
    };

    if (negocio.calificacion_promedio && resenas && resenas.length > 0) {
      schemaObj.aggregateRating = {
        "@type": "AggregateRating",
        "ratingValue": negocio.calificacion_promedio,
        "reviewCount": resenas.length
      };
    }

    return {
      title: `${negocio.nombre} - Reservar Turno | MiTurno`,
      description: negocio.descripcion 
        ? (negocio.descripcion.length > 155 ? `${negocio.descripcion.substring(0, 152)}...` : negocio.descripcion)
        : `Reserva tu turno en ${negocio.nombre} de forma rápida y online a través de MiTurno.`,
      keywords: keywordsList,
      imageUrl: negocio.logo || "",
      schema: schemaObj
    };
  }, [negocio, resenas]);

  function toggleServicio(id) {
    setSeleccion((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function abrirModal() {
    setErrorModal(null);
    setPaso(1);
    setProfesionalId(null);
    setSlot(null);
    setModalAbierto(true);
  }

  async function confirmar() {
    setEnviando(true);
    setErrorModal(null);
    try {
      const res = await apiPost("/reservas", {
        negocio_id: negocio.id,
        servicio_ids: seleccion,
        profesional_id: slot.profesional_id,
        inicio: slot.inicio,
        cliente: datos,
        frecuencia_recordatorio_dias: null,
      });
      setReserva(res);
      setPaso(4);
    } catch (e) {
      setErrorModal(e.message);
    } finally {
      setEnviando(false);
    }
  }

  function resetear() {
    setSeleccion([]);
    setProfesionalId(null);
    setSlot(null);
    setDatos({ nombre: "", email: "", telefono: "" });
    setReserva(null);
    setModalAbierto(false);
    setPaso(1);
  }

  if (error && !negocio) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-200">
        <div className="max-w-md w-full mx-auto bg-white min-h-screen flex items-center justify-center text-neutral-400 text-sm">
          {error}
        </div>
      </div>
    );
  }
  if (!negocio) return <SkeletonPage />;

  return (
    <div className="min-h-screen bg-neutral-200">
      {seoData && <SEO {...seoData} />}
      <div className="max-w-md mx-auto min-h-screen bg-white relative">
        <NegocioHeader negocio={negocio} />

        {/* Hoja blanca que monta sobre el header */}
        <div className="bg-white rounded-t-3xl -mt-6 relative">
          <Stats negocio={negocio} cantServicios={serviciosVisibles.length} />

          {/* Tabs */}
          <div className="flex border-b border-neutral-200 bg-white sticky top-0 z-10">
            {[
              { id: "servicios", label: "Servicios" },
              { id: "detalles", label: "Detalles" },
              { id: "resenas", label: "Reseñas" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="relative flex-1 py-4 text-xs font-medium uppercase tracking-[0.15em] transition-colors"
              >
                <span className={tab === t.id ? "text-neutral-900" : "text-neutral-400"}>
                  {t.label}
                </span>
                {tab === t.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-neutral-900 line-grow" />
                )}
              </button>
            ))}
          </div>

          <div className="pb-40">
            {tab === "servicios" && (
              <TabServicios
                servicios={serviciosVisibles}
                categorias={negocio.categorias ?? []}
                seleccion={seleccion}
                busqueda={busqueda}
                setBusqueda={setBusqueda}
                onToggle={toggleServicio}
              />
            )}
            {tab === "detalles" && <TabDetalles negocio={negocio} portafolio={portafolio} />}
            {tab === "resenas" && (
              <TabResenas resenas={resenas} setResenas={setResenas} negocio={negocio} />
            )}
          </div>
        </div>

        {seleccion.length > 0 && (
          <BarraCarrito
            servicios={serviciosElegidos}
            total={totalPrecio}
            totalDuracion={totalDuracion}
            onReservar={abrirModal}
            onQuitar={toggleServicio}
          />
        )}
      </div>

      {modalAbierto && (
        <ModalReserva
          key="modal"
          negocio={negocio}
          serviciosElegidos={serviciosElegidos}
          totalPrecio={totalPrecio}
          totalDuracion={totalDuracion}
          paso={paso}
          setPaso={setPaso}
          profesionalId={profesionalId}
          setProfesionalId={setProfesionalId}
          fechaObj={fechaObj}
          setFechaObj={setFechaObj}
          franjas={franjas}
          cargandoSlots={cargandoSlots}
          slot={slot}
          setSlot={setSlot}
          datos={datos}
          setDatos={setDatos}
          reserva={reserva}
          enviando={enviando}
          error={errorModal}
          onConfirmar={confirmar}
          onCerrar={() => setModalAbierto(false)}
          onReset={resetear}
        />
      )}
    </div>
  );
}

// ─── Header editorial negro ───────────────────────────────────────────────────

function NegocioHeader({ negocio }) {
  const bgStyle = negocio.logo
    ? { backgroundImage: `url(${negocio.logo})`, backgroundSize: "cover", backgroundPosition: "center" }
    : {};

  return (
    <div
      style={bgStyle}
      className="bg-neutral-950 px-6 pt-16 pb-14 text-white text-center relative overflow-hidden"
    >
      {/* Filtro oscuro para asegurar legibilidad */}
      {negocio.logo && (
        <div className="absolute inset-0 bg-neutral-950/75 z-0" />
      )}

      <div className="relative z-10">
        <div className="fade-up">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="h-px w-8 bg-white/40" />
            <Scissors size={16} className="text-white/60" strokeWidth={1.5} />
            <span className="h-px w-8 bg-white/40" />
          </div>
          <h1 className="font-serif text-4xl tracking-[0.08em] uppercase leading-tight">
            {negocio.nombre}
          </h1>
        </div>
        {negocio.descripcion && (
          <p className="text-neutral-300 text-[11px] uppercase tracking-[0.15em] mt-3 fade-in max-w-[280px] mx-auto leading-relaxed">
            {negocio.descripcion}
          </p>
        )}
        {negocio.direccion && (
          <p className="text-neutral-400 text-xs mt-3 flex items-center justify-center gap-1.5 fade-in">
            <MapPin size={11} strokeWidth={1.5} />
            {negocio.direccion}
          </p>
        )}
      </div>
    </div>
  );
}

function Stats({ negocio, cantServicios }) {
  const tieneCalif = negocio.calificacion_promedio != null && negocio.calificacion_promedio > 0;
  return (
    <div className="px-6 pt-6 pb-5 flex justify-center divide-x divide-neutral-200">
      {tieneCalif && (
        <div className="text-center px-7">
          <div className="flex items-center justify-center gap-1.5 font-serif text-lg text-neutral-900">
            <Star size={15} className="fill-amber-400 text-amber-400" strokeWidth={1.5} />
            {negocio.calificacion_promedio.toFixed(1)}
          </div>
          <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-400 mt-0.5">
            Calificación
          </div>
        </div>
      )}
      <div className="text-center px-7">
        <div className="font-serif text-lg text-neutral-900">{cantServicios}</div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-400 mt-0.5">
          Servicios
        </div>
      </div>
    </div>
  );
}

// ─── Tab Servicios ────────────────────────────────────────────────────────────

function TabServicios({ servicios, categorias, seleccion, busqueda, setBusqueda, onToggle }) {
  const [catActiva, setCatActiva] = useState(null);

  // Solo mostrar categorías que tengan al menos un servicio visible
  const catsConServicios = (categorias ?? []).filter((c) =>
    servicios.some((s) => s.categoria_id === c.id)
  );

  const visibles = catActiva == null ? servicios : servicios.filter((s) => s.categoria_id === catActiva);

  return (
    <div>
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" strokeWidth={1.5} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar servicios"
            className="w-full rounded-full border border-neutral-200 bg-neutral-50 pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-neutral-900 focus:bg-white placeholder:text-neutral-400 transition-colors"
          />
        </div>
      </div>

      {/* Filtro por categoría */}
      {catsConServicios.length > 0 && (
        <div className="px-4 pb-1 flex gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setCatActiva(null)}
            className={`flex-shrink-0 text-xs uppercase tracking-[0.1em] rounded-full border px-3.5 py-1.5 transition-colors ${
              catActiva == null ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600"
            }`}
          >
            Todos
          </button>
          {catsConServicios.map((c) => (
            <button
              key={c.id}
              onClick={() => setCatActiva(c.id)}
              className={`flex-shrink-0 text-xs uppercase tracking-[0.1em] rounded-full border px-3.5 py-1.5 transition-colors ${
                catActiva === c.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600"
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 py-2 space-y-3 stagger">
        {visibles.map((s) => (
          <ServicioCard
            key={s.id}
            servicio={s}
            seleccionado={seleccion.includes(s.id)}
            onToggle={() => onToggle(s.id)}
          />
        ))}
        {visibles.length === 0 && (
          <div className="text-center py-16 text-neutral-300">
            <Scissors size={32} className="mx-auto mb-3" strokeWidth={1} />
            <p className="text-sm text-neutral-400">No se encontraron servicios</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ServicioCard({ servicio: s, seleccionado, onToggle }) {
  return (
    <div
      className={`flex gap-4 p-3 rounded-2xl border transition-all ${
        seleccionado ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 bg-white"
      }`}
    >
      {s.imagen ? (
        <img
          src={s.imagen}
          alt={s.nombre}
          loading="lazy"
          decoding="async"
          className="w-24 h-24 object-cover rounded-xl flex-shrink-0 bg-neutral-100"
        />
      ) : (
        <div className="w-24 h-24 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0">
          <Scissors size={26} className="text-neutral-300" strokeWidth={1} />
        </div>
      )}

      <div className="flex-1 min-w-0 py-0.5">
        {s.badge && s.badge !== "ninguno" && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500 mb-1">
            <span className="h-1 w-1 rounded-full bg-neutral-900" />
            {s.badge === "popular" ? "Popular" : s.badge}
          </span>
        )}
        <h3 className="font-serif text-base text-neutral-900 leading-snug">{s.nombre}</h3>
        {s.descripcion && (
          <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">
            {s.descripcion}
          </p>
        )}
        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-neutral-900">{formatoPrecio(s.precio)}</span>
            <span className="flex items-center gap-1 text-xs text-neutral-400">
              <Clock size={11} strokeWidth={1.5} />
              {s.duracion_min} min
            </span>
          </div>
          {seleccionado ? (
            <div className="flex items-center gap-3 border border-neutral-900 rounded-full px-2.5 py-1.5">
              <button onClick={onToggle} className="text-neutral-900 active:scale-90 transition-transform">
                <Trash2 size={13} strokeWidth={1.5} />
              </button>
              <span className="text-neutral-900 text-sm w-3 text-center">1</span>
              <button className="text-neutral-300 cursor-not-allowed" disabled>
                <Plus size={13} strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <button
              onClick={onToggle}
              className="rounded-full border border-neutral-900 text-neutral-900 px-4 py-1.5 text-xs uppercase tracking-[0.1em] font-medium hover:bg-neutral-900 hover:text-white active:scale-95 transition-all"
            >
              Reservar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab Detalles ─────────────────────────────────────────────────────────────

function TabDetalles({ negocio, portafolio }) {
  return (
    <div className="p-4 space-y-3 stagger">
      {negocio.descripcion && (
        <div className="rounded-2xl border border-neutral-200 p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-2">Sobre nosotros</p>
          <p className="text-sm text-neutral-700 leading-relaxed">{negocio.descripcion}</p>
        </div>
      )}
      {negocio.direccion && (
        <div className="flex items-start gap-4 rounded-2xl border border-neutral-200 p-5">
          <MapPin size={18} className="text-neutral-900 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
          <div>
            <p className="text-sm text-neutral-800">{negocio.direccion}</p>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(negocio.direccion)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 mt-1 transition-colors"
            >
              Ver en mapa <ArrowRight size={11} strokeWidth={1.5} />
            </a>
          </div>
        </div>
      )}
      {negocio.zona_horaria && (
        <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 p-5">
          <Clock size={18} className="text-neutral-900 flex-shrink-0" strokeWidth={1.5} />
          <p className="text-sm text-neutral-700">{negocio.zona_horaria.replace(/_/g, " ")}</p>
        </div>
      )}

      {(negocio.redes || negocio.email_notificaciones) && (
        <div className="rounded-2xl border border-neutral-200 p-5 space-y-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Contacto y Redes</p>
          <div className="grid grid-cols-1 gap-2.5">
            {negocio.email_notificaciones && (
              <a
                href={`mailto:${negocio.email_notificaciones}`}
                className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-100 bg-neutral-50 hover:bg-neutral-100 hover:border-neutral-200 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-neutral-200/60 shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
                    <Mail size={14} className="text-neutral-900" strokeWidth={1.5} />
                  </div>
                  <span className="text-sm font-medium text-neutral-700 truncate">{negocio.email_notificaciones}</span>
                </div>
                <ArrowRight size={14} className="text-neutral-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all flex-shrink-0" />
              </a>
            )}
            {negocio.redes && parseRedes(negocio.redes).map((red, idx) => (
              <a
                key={idx}
                href={red.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 rounded-xl border border-neutral-100 bg-neutral-50 hover:bg-neutral-100 hover:border-neutral-200 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-neutral-200/60 shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform">
                    {renderSocialIcon(red.iconType, 14)}
                  </div>
                  <span className="text-sm font-semibold text-neutral-850 truncate">{red.label}</span>
                </div>
                <div className="flex items-center gap-1.5 text-neutral-450">
                  <span className="text-[10px] uppercase tracking-wider font-medium opacity-0 group-hover:opacity-100 transition-opacity">Visitar</span>
                  <ArrowRight size={14} className="text-neutral-900 -translate-x-1 group-hover:translate-x-0 transition-transform flex-shrink-0" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Galería del portafolio */}
      {portafolio && portafolio.length > 0 && (
        <div className="pt-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-3 px-1">Nuestros trabajos</p>
          <div className="grid grid-cols-2 gap-2">
            {portafolio.map((img) => (
              <div key={img.id} className="aspect-square overflow-hidden rounded-xl bg-neutral-100">
                <img
                  src={img.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Reseñas ──────────────────────────────────────────────────────────────

function TabResenas({ resenas, setResenas, negocio }) {
  const [mostrando, setMostrando] = useState("lista");
  const [form, setForm] = useState({
    autor_nombre: "",
    autor_email: "",
    puntuacion: 0,
    profesional_id: null,
    comentario: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState(null);

  async function enviar(e) {
    e.preventDefault();
    if (!form.puntuacion) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await apiPost(`/negocios/${negocio.id}/resenas`, {
        ...form,
        autor_email: form.autor_email || null,
        profesional_id: form.profesional_id || null,
      });
      setResenas((prev) => [res, ...(prev ?? [])]);
      setExito(true);
      setTimeout(() => {
        setMostrando("lista");
        setExito(false);
        setForm({ autor_nombre: "", autor_email: "", puntuacion: 0, profesional_id: null, comentario: "" });
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!resenas)
    return <div className="p-8 text-center text-neutral-400 text-sm">Cargando…</div>;

  const promedio =
    resenas.length > 0
      ? (resenas.reduce((a, r) => a + r.puntuacion, 0) / resenas.length).toFixed(1)
      : null;

  // Distribución por estrellas (5 → 1)
  const distribucion = [5, 4, 3, 2, 1].map((n) => ({
    estrellas: n,
    cantidad: resenas.filter((r) => r.puntuacion === n).length,
  }));

  return (
    <div>
      <div className="px-5 pt-5 pb-4 flex items-end justify-between border-b border-neutral-100">
        <div>
          {promedio ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl text-neutral-900">{promedio}</span>
                <Estrellas valor={Number(promedio)} size={14} />
              </div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-400 mt-1">
                {resenas.length} {resenas.length === 1 ? "reseña" : "reseñas"}
              </p>
            </>
          ) : (
            <p className="text-sm text-neutral-400">Sin reseñas aún</p>
          )}
        </div>
        <button
          onClick={() => setMostrando(mostrando === "form" ? "lista" : "form")}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-900 px-4 py-2 text-xs uppercase tracking-[0.12em] font-medium hover:bg-neutral-900 hover:text-white active:scale-95 transition-all"
        >
          {mostrando === "form" ? (
            <>Ver reseñas</>
          ) : (
            <><PenLine size={12} strokeWidth={1.5} /> Escribir</>
          )}
        </button>
      </div>

      {/* Histograma de distribución */}
      {mostrando === "lista" && resenas.length > 0 && (
        <div className="px-5 py-4 border-b border-neutral-100 space-y-1.5">
          {distribucion.map((d) => {
            const pct = resenas.length ? (d.cantidad / resenas.length) * 100 : 0;
            return (
              <div key={d.estrellas} className="flex items-center gap-2">
                <span className="flex items-center gap-0.5 text-xs text-neutral-500 w-8">
                  {d.estrellas}<Star size={10} className="fill-amber-400 text-amber-400" />
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-neutral-400 w-6 text-right">{d.cantidad}</span>
              </div>
            );
          })}
        </div>
      )}

      {mostrando === "form" && (
        <div className="px-5 py-5 fade-up">
          {exito ? (
            <div className="border border-neutral-900 rounded-2xl p-8 text-center scale-in">
              <Check size={32} className="mx-auto mb-3 text-neutral-900" strokeWidth={1.5} />
              <p className="font-serif text-lg text-neutral-900">Gracias por tu reseña</p>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-2">Tu puntuación</p>
                <SelectorEstrellas valor={form.puntuacion} onChange={(v) => setForm({ ...form, puntuacion: v })} />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-1.5">Tu nombre</label>
                <input
                  value={form.autor_nombre}
                  onChange={(e) => setForm({ ...form, autor_nombre: e.target.value })}
                  placeholder="Nombre"
                  required
                  minLength={2}
                  className="campo"
                />
              </div>

              {negocio.profesionales?.length > 0 && (
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-2">
                    ¿Quién te atendió?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <ChipResena activo={!form.profesional_id} onClick={() => setForm({ ...form, profesional_id: null })}>
                      No especificar
                    </ChipResena>
                    {negocio.profesionales.map((p) => (
                      <ChipResena
                        key={p.id}
                        activo={form.profesional_id === p.id}
                        onClick={() => setForm({ ...form, profesional_id: p.id })}
                      >
                        {p.nombre}
                      </ChipResena>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-1.5">Comentario</label>
                <textarea
                  value={form.comentario}
                  onChange={(e) => setForm({ ...form, comentario: e.target.value })}
                  placeholder="Contanos tu experiencia"
                  rows={3}
                  maxLength={500}
                  className="campo resize-none"
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={!form.puntuacion || !form.autor_nombre.trim() || enviando}
                className="w-full bg-neutral-900 text-white rounded-full py-3.5 text-xs uppercase tracking-[0.2em] font-medium hover:bg-neutral-800 disabled:opacity-40 transition-colors"
              >
                {enviando ? "Enviando…" : "Publicar reseña"}
              </button>
            </form>
          )}
        </div>
      )}

      {mostrando === "lista" && (
        <div className="divide-y divide-neutral-100">
          {resenas.length === 0 && (
            <div className="px-5 py-12 text-center text-neutral-400">
              <Star size={28} className="mx-auto mb-3 text-neutral-200" strokeWidth={1} />
              <p className="text-sm">Sé el primero en dejar una reseña</p>
            </div>
          )}
          {resenas.map((r) => (
            <div key={r.id} className="px-5 py-5 fade-in">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-medium">
                    {r.cliente_nombre[0]?.toUpperCase()}
                  </div>
                  <span className="font-medium text-sm text-neutral-900">{r.cliente_nombre}</span>
                </div>
                <Estrellas valor={r.puntuacion} size={13} />
              </div>
              {r.profesional_nombre && (
                <p className="text-[10px] uppercase tracking-[0.1em] text-neutral-400 ml-12 mb-1">
                  Atendió · {r.profesional_nombre}
                </p>
              )}
              {r.comentario && (
                <p className="text-sm text-neutral-600 leading-relaxed ml-12">{r.comentario}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChipResena({ activo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
        activo
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 text-neutral-600 hover:border-neutral-900"
      }`}
    >
      {children}
    </button>
  );
}

function SelectorEstrellas({ valor, onChange }) {
  const [hover, setHover] = useState(0);
  const actual = hover || valor;
  const labels = ["", "Malo", "Regular", "Bueno", "Muy bueno", "Excelente"];
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className="active:scale-90 transition-transform"
          >
            <Star
              size={30}
              className={n <= actual ? "fill-amber-400 text-amber-400" : "text-neutral-200"}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>
      {actual > 0 && (
        <p className="text-xs uppercase tracking-[0.15em] text-neutral-500">{labels[actual]}</p>
      )}
    </div>
  );
}

// ─── Barra carrito ────────────────────────────────────────────────────────────

function BarraCarrito({ servicios, total, totalDuracion, onReservar, onQuitar }) {
  const [expandido, setExpandido] = useState(false);
  const startY = useRef(null);

  function onTouchStart(e) {
    startY.current = e.touches[0].clientY;
  }
  function onTouchMove(e) {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy < -24) setExpandido(true);
    else if (dy > 24) setExpandido(false);
  }
  function onTouchEnd() {
    startY.current = null;
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 fade-up"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* backdrop al expandir, para cerrar tocando afuera */}
      {expandido && (
        <button
          aria-label="Cerrar resumen"
          onClick={() => setExpandido(false)}
          className="fixed inset-0 -z-10 bg-black/30 modal-backdrop cursor-default"
        />
      )}

      <div className="max-w-md mx-auto bg-white rounded-t-3xl border-t border-neutral-200 shadow-[0_-10px_40px_-12px_rgba(0,0,0,0.18)]">
        {/* Zona de gesto: handle + tap para expandir */}
        <button
          onClick={() => setExpandido((v) => !v)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="w-full pt-2.5 pb-1 cursor-grab active:cursor-grabbing touch-none"
          aria-label="Deslizá para ver el resumen"
        >
          <span className="block mx-auto h-1 w-10 rounded-full bg-neutral-300" />
        </button>

        {/* Resumen expandible con controles */}
        <div
          className="overflow-hidden transition-[max-height] duration-300 ease-out"
          style={{ maxHeight: expandido ? 340 : 0 }}
        >
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[0.15em] text-neutral-400">
                {servicios.length} {servicios.length === 1 ? "servicio" : "servicios"} · {totalDuracion} min
              </span>
              <button
                onClick={() => setExpandido(false)}
                className="text-[10px] uppercase tracking-[0.12em] text-neutral-500 hover:text-neutral-900 inline-flex items-center gap-1"
              >
                <Plus size={12} strokeWidth={1.5} /> Agregar más
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto scrollbar-none divide-y divide-neutral-100">
              {servicios.map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-900 truncate">{s.nombre}</p>
                    <p className="text-xs text-neutral-400">{s.duracion_min} min</p>
                  </div>
                  <span className="text-sm text-neutral-900 flex-shrink-0">{formatoPrecio(s.precio)}</span>
                  <button
                    onClick={() => onQuitar(s.id)}
                    aria-label={`Quitar ${s.nombre}`}
                    className="flex-shrink-0 w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-400 hover:border-red-300 hover:text-red-500 active:scale-90 transition-all"
                  >
                    <Trash2 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-1 border-t border-neutral-100">
          <button
            onClick={() => setExpandido((v) => !v)}
            className="flex flex-col items-start flex-shrink-0 text-left"
          >
            <span className="flex items-center gap-1 text-[9px] uppercase tracking-[0.12em] text-neutral-400">
              {expandido ? <ChevronDown size={11} strokeWidth={1.5} /> : <ChevronUp size={11} strokeWidth={1.5} />}
              Resumen
            </span>
            <span className="font-serif text-xl text-neutral-900 leading-tight">{formatoPrecio(total)}</span>
          </button>
          <button
            onClick={onReservar}
            className="flex items-center gap-2 bg-neutral-900 text-white rounded-full px-6 py-3.5 text-[11px] uppercase tracking-[0.12em] font-medium hover:bg-neutral-800 active:scale-95 transition-all flex-shrink-0"
          >
            Reservar
            <span className="bg-white text-neutral-900 rounded-full w-5 h-5 flex items-center justify-center text-[11px]">
              {servicios.length}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de reserva ─────────────────────────────────────────────────────────

function ModalReserva({
  negocio, serviciosElegidos, totalPrecio, totalDuracion, paso, setPaso,
  profesionalId, setProfesionalId, fechaObj, setFechaObj, franjas, cargandoSlots,
  slot, setSlot, datos, setDatos, reserva, enviando, error, onConfirmar, onCerrar, onReset,
}) {
  const puedeAvanzar = useMemo(() => {
    if (paso === 1) return true;
    if (paso === 2) return slot != null;
    if (paso === 3) return datos.nombre.trim() && emailValido(datos.email) && datos.telefono.trim();
    return false;
  }, [paso, slot, datos]);

  function avanzar() {
    if (paso === 3) onConfirmar();
    else setPaso((p) => p + 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 modal-backdrop">
      <div
        className="w-full max-w-md bg-white rounded-t-3xl flex flex-col overflow-hidden modal-sheet"
        style={{ height: "92dvh", maxHeight: "92dvh" }}
      >
        {/* Header modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 flex-shrink-0">
          <h2 className="text-xs uppercase tracking-[0.2em] text-neutral-900">Reservar</h2>
          <div className="flex items-center gap-4">
            {paso >= 2 && paso < 4 && (
              <div className="flex items-center gap-2">
                {[1, 2].map((n) => {
                  const activo = n === 1 ? paso === 2 : paso === 3;
                  const hecho = n === 1 && paso === 3;
                  return (
                    <div key={n} className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium transition-colors ${
                          activo ? "bg-neutral-900 text-white"
                          : hecho ? "bg-neutral-200 text-neutral-700"
                          : "bg-neutral-100 text-neutral-400"
                        }`}
                      >
                        {hecho ? <Check size={11} strokeWidth={2} /> : n}
                      </div>
                      {n < 2 && <div className={`w-6 h-px ${hecho ? "bg-neutral-400" : "bg-neutral-200"}`} />}
                    </div>
                  );
                })}
              </div>
            )}
            <button
              onClick={paso === 4 ? onReset : onCerrar}
              className="w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-2 flex-shrink-0">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {paso === 1 && (
            <PasoEleccionProfesional
              negocio={negocio}
              seleccion={serviciosElegidos.map((s) => s.id)}
              profesionalId={profesionalId}
              setProfesionalId={setProfesionalId}
              serviciosElegidos={serviciosElegidos}
            />
          )}
          {paso === 2 && (
            <PasoFechaHora
              fechaObj={fechaObj} setFechaObj={setFechaObj} franjas={franjas}
              cargandoSlots={cargandoSlots} slot={slot} setSlot={setSlot}
              serviciosElegidos={serviciosElegidos} totalPrecio={totalPrecio}
              totalDuracion={totalDuracion} profesionalId={profesionalId} negocio={negocio}
            />
          )}
          {paso === 3 && <PasoDatosContacto datos={datos} setDatos={setDatos} />}
          {paso === 4 && reserva && (
            <PasoConfirmacion reserva={reserva} datos={datos} negocio={negocio} onReset={onReset} />
          )}
        </div>

        {paso < 4 && (
          <div
            className="border-t border-neutral-200 px-5 py-4 flex items-center justify-between flex-shrink-0 bg-white"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-400 mb-0.5">
                {paso === 3 ? "Total a pagar" : "Total"}
              </p>
              <p className="font-serif text-2xl text-neutral-900">{formatoPrecio(totalPrecio)}</p>
            </div>
            <button
              onClick={avanzar}
              disabled={!puedeAvanzar || enviando}
              className="flex items-center gap-2.5 bg-neutral-900 text-white rounded-full px-7 py-3.5 text-xs uppercase tracking-[0.15em] font-medium hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
            >
              {paso === 3 ? (enviando ? "Confirmando…" : "Confirmar") : "Siguiente"}
              {paso < 3 && <ArrowRight size={14} strokeWidth={1.5} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Paso 1: Profesional ──────────────────────────────────────────────────────

function PasoEleccionProfesional({ negocio, seleccion, profesionalId, setProfesionalId, serviciosElegidos }) {
  const profesionalesValidos = (negocio.profesionales ?? []).filter((p) =>
    seleccion.every((sid) => (p.servicio_ids ?? []).includes(sid))
  );

  return (
    <div className="p-5">
      <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-1">Seleccionar profesional</p>
      <p className="font-serif text-lg text-neutral-900 mb-5">
        {serviciosElegidos.map((s) => s.nombre).join(" · ")}
      </p>
      <div className="grid grid-cols-2 gap-3 stagger">
        <button
          onClick={() => setProfesionalId(null)}
          className={`rounded-2xl border p-5 flex flex-col items-center gap-2.5 transition-all active:scale-95 ${
            profesionalId === null ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"
          }`}
        >
          <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center">
            <Shuffle size={20} className="text-neutral-500" strokeWidth={1.5} />
          </div>
          <span className="font-medium text-sm text-center leading-tight">Cualquier profesional</span>
          <span className="text-[10px] uppercase tracking-[0.1em] text-neutral-400">Máxima disponibilidad</span>
        </button>

        {profesionalesValidos.map((p) => (
          <button
            key={p.id}
            onClick={() => setProfesionalId(p.id)}
            className={`rounded-2xl border p-5 flex flex-col items-center gap-2.5 transition-all active:scale-95 ${
              profesionalId === p.id ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"
            }`}
          >
            {p.foto ? (
              <img src={p.foto} alt={p.nombre} loading="lazy" className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-neutral-900 text-white flex items-center justify-center text-lg font-serif">
                {iniciales(p.nombre)}
              </div>
            )}
            <span className="font-medium text-sm text-center leading-tight">{p.nombre}</span>
            {p.calificacion_promedio != null && p.calificacion_promedio > 0 ? (
              <div className="flex items-center gap-1 text-xs text-neutral-500">
                <Star size={10} className="fill-amber-400 text-amber-400" strokeWidth={1.5} />
                {p.calificacion_promedio.toFixed(1)}
              </div>
            ) : (
              <span className="text-[10px] uppercase tracking-[0.1em] text-neutral-400">Profesional</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Paso 2: Fecha y hora ─────────────────────────────────────────────────────

const FRANJAS_CONFIG = [
  { id: "manana", label: "Mañana", icon: Sunrise },
  { id: "tarde", label: "Tarde", icon: Sun },
  { id: "noche", label: "Noche", icon: Moon },
];

function PasoFechaHora({
  fechaObj, setFechaObj, franjas, cargandoSlots, slot, setSlot,
  serviciosElegidos, totalPrecio, totalDuracion, profesionalId, negocio,
}) {
  const [franja, setFranja] = useState("tarde");
  const dias = useMemo(() => getDias(45), []);
  const calRef = useRef(null);
  const selFechaIso = isoFecha(fechaObj);

  useEffect(() => {
    const idx = dias.findIndex((d) => isoFecha(d) === selFechaIso);
    if (calRef.current && idx >= 0) {
      calRef.current.children[idx]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selFechaIso]);

  const slotsFranja = franjas?.[franja] ?? [];
  const hayAlgunSlot = franjas && (franjas.manana?.length || franjas.tarde?.length || franjas.noche?.length);

  return (
    <div>
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-400">Seleccionar fecha</p>
          <p className="text-xs text-neutral-500">{MESES[fechaObj.getMonth()]} {fechaObj.getFullYear()}</p>
        </div>
        <div ref={calRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {dias.map((d, i) => {
            const sel = isoFecha(d) === selFechaIso;
            const esHoy = i === 0;
            return (
              <button
                key={i}
                onClick={() => setFechaObj(d)}
                className={`flex flex-col items-center gap-1 px-3.5 py-3 flex-shrink-0 min-w-[52px] rounded-2xl border transition-all active:scale-95 ${
                  sel ? "border-neutral-900 bg-neutral-900 text-white"
                  : esHoy ? "border-neutral-900 text-neutral-900"
                  : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                }`}
              >
                <span className="text-[9px] tracking-[0.1em]">{esHoy ? "HOY" : DIAS_CORTO[d.getDay()]}</span>
                <span className="font-serif text-lg leading-none">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resumen del servicio */}
      <div className="mx-5 mb-4 border border-neutral-200 rounded-2xl p-4">
        {!slot ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-neutral-500 mb-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
            Sin hora seleccionada
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-neutral-900 mb-1.5">
            <Check size={11} strokeWidth={2} />
            {horaLocal(slot.inicio)} seleccionado
          </span>
        )}
        <p className="font-serif text-base text-neutral-900">
          {serviciosElegidos.map((s) => s.nombre).join(" · ")}
        </p>
        <p className="text-xs text-neutral-500 mt-1">
          {totalDuracion} min · {profesionalId
            ? (negocio.profesionales ?? []).find((p) => p.id === profesionalId)?.nombre ?? "Profesional"
            : "Cualquier profesional"} · {formatoPrecio(totalPrecio)}
        </p>
      </div>

      {/* Franjas */}
      <div className="px-5 mb-4 flex gap-2">
        {FRANJAS_CONFIG.map((f) => {
          const cant = franjas?.[f.id]?.length ?? 0;
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              onClick={() => setFranja(f.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs rounded-full border transition-all ${
                franja === f.id ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
              }`}
            >
              <Icon size={13} strokeWidth={1.5} />
              {f.label}
              {franjas && <span className={franja === f.id ? "opacity-60" : "text-neutral-400"}>{cant}</span>}
            </button>
          );
        })}
      </div>

      {/* Slots */}
      <div className="px-5 pb-5">
        {cargandoSlots && <p className="text-sm text-neutral-400 text-center py-8">Buscando horarios…</p>}
        {!cargandoSlots && franjas && !hayAlgunSlot && (
          <p className="text-sm text-neutral-400 text-center py-8">No hay horarios este día. Probá otra fecha.</p>
        )}
        {!cargandoSlots && hayAlgunSlot && slotsFranja.length === 0 && (
          <p className="text-sm text-neutral-400 text-center py-6">Sin horarios en este período.</p>
        )}
        {!cargandoSlots && slotsFranja.length > 0 && (
          <div className="grid grid-cols-3 gap-2 fade-in">
            {slotsFranja.map((s) => (
              <button
                key={s.inicio}
                onClick={() => setSlot(s)}
                className={`py-3 text-sm rounded-xl border transition-all active:scale-95 ${
                  slot?.inicio === s.inicio ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 text-neutral-700 hover:border-neutral-900"
                }`}
              >
                {horaLocal(s.inicio)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Paso 3: Datos ────────────────────────────────────────────────────────────

function PasoDatosContacto({ datos, setDatos }) {
  function set(k) {
    return (e) => setDatos({ ...datos, [k]: e.target.value });
  }
  const emailError = datos.email.trim() && !emailValido(datos.email) ? "Email inválido" : null;

  return (
    <div className="p-5 space-y-6">
      <CampoContacto label="Nombre completo" icon={User}>
        <input value={datos.nombre} onChange={set("nombre")} placeholder="Tu nombre" className="campo-modal" />
      </CampoContacto>

      <CampoContacto label="Correo electrónico" icon={Mail} error={emailError}>
        <input
          type="email" value={datos.email} onChange={set("email")} placeholder="tucorreo@ejemplo.com"
          className={`campo-modal ${emailError ? "border-red-400" : ""}`}
        />
      </CampoContacto>

      <div>
        <label className="block text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-2">Teléfono celular</label>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-neutral-300 px-3.5 text-sm text-neutral-600 flex-shrink-0">
            <Phone size={13} strokeWidth={1.5} /> +54
          </div>
          <input value={datos.telefono} onChange={set("telefono")} placeholder="Número" className="campo-modal flex-1" />
        </div>
      </div>
    </div>
  );
}

function CampoContacto({ label, icon: Icon, error, children }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-2">{label}</label>
      <div className="relative">
        <Icon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" strokeWidth={1.5} />
        <div className="[&>input]:pl-9">{children}</div>
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// ─── Paso 4: Confirmación ─────────────────────────────────────────────────────

function PasoConfirmacion({ reserva, datos, negocio, onReset }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 py-12 text-center fade-up">
      <div className="w-20 h-20 rounded-full border-2 border-neutral-900 flex items-center justify-center mb-6 scale-in">
        <Check size={36} className="text-neutral-900" strokeWidth={1.5} />
      </div>
      <h2 className="font-serif text-2xl text-neutral-900 mb-2">Reserva confirmada</h2>
      <p className="text-neutral-500 text-sm mb-8 max-w-xs leading-relaxed">
        Te enviamos la confirmación a <span className="text-neutral-900">{datos.email}</span>.
        También le avisamos a {negocio.nombre}.
      </p>

      <div className="w-full border-y border-neutral-200 divide-y divide-neutral-100 mb-8">
        <FilaResumen label="Hora" valor={horaLocal(reserva.inicio)} />
        <FilaResumen label="Duración" valor={`${reserva.total_duracion} min`} />
        <FilaResumen label="Total" valor={formatoPrecio(reserva.total_precio)} />
      </div>

      <button
        onClick={onReset}
        className="w-full bg-neutral-900 text-white rounded-full py-3.5 text-xs uppercase tracking-[0.2em] font-medium hover:bg-neutral-800 transition-colors"
      >
        Hacer otra reserva
      </button>
    </div>
  );
}

function FilaResumen({ label, valor }) {
  return (
    <div className="flex justify-between py-3">
      <span className="text-[10px] uppercase tracking-[0.15em] text-neutral-400">{label}</span>
      <span className="text-sm text-neutral-900">{valor}</span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonPage() {
  return (
    <div className="min-h-screen bg-neutral-200">
      <div className="max-w-md mx-auto min-h-screen bg-white">
        <div className="bg-neutral-950 px-6 pt-14 pb-10 text-center space-y-3">
          <div className="skeleton h-9 w-52 mx-auto" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="skeleton h-3 w-32 mx-auto" style={{ background: "rgba(255,255,255,0.05)" }} />
        </div>
        <div className="border-b border-neutral-200 px-6 py-4 flex justify-center gap-12">
          <div className="skeleton h-9 w-16" />
          <div className="skeleton h-9 w-16" />
        </div>
        <div className="flex border-b border-neutral-200 h-12">
          {[1, 2, 3].map((i) => <div key={i} className="flex-1 skeleton m-3" />)}
        </div>
        <div className="p-5 space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="skeleton w-20 h-20 flex-shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-full" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
