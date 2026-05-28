import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api/client.js";
import { emailValido, fechaLegible, formatoPrecio, horaLocal, isoFecha } from "../lib/format.js";

const PASOS = ["Servicios", "Profesional", "Horario", "Tus datos", "Listo"];

const OPCIONES_FRECUENCIA = [
  { label: "No, gracias", dias: null },
  { label: "Cada 2 semanas", dias: 14 },
  { label: "Cada 3 semanas", dias: 21 },
  { label: "Cada 1 mes", dias: 30 },
  { label: "Cada 2 meses", dias: 60 },
];

export default function Negocio() {
  const { slug } = useParams();
  const [negocio, setNegocio] = useState(null);
  const [error, setError] = useState(null);
  const [paso, setPaso] = useState(0);

  const [seleccion, setSeleccion] = useState([]); // ids de servicios
  const [profesionalId, setProfesionalId] = useState(null); // null = cualquiera
  const [fecha, setFecha] = useState(isoFecha(new Date()));
  const [franjas, setFranjas] = useState(null);
  const [cargandoSlots, setCargandoSlots] = useState(false);
  const [slot, setSlot] = useState(null);
  const [datos, setDatos] = useState({ nombre: "", email: "", telefono: "" });
  const [frecuencia, setFrecuencia] = useState(null);
  const [reserva, setReserva] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    apiGet(`/negocios/${slug}`)
      .then(setNegocio)
      .catch((e) => setError(e.message));
  }, [slug]);

  const serviciosElegidos = useMemo(
    () => (negocio?.servicios ?? []).filter((s) => seleccion.includes(s.id)),
    [negocio, seleccion]
  );
  const totalPrecio = serviciosElegidos.reduce((acc, s) => acc + Number(s.precio), 0);
  const totalDuracion = serviciosElegidos.reduce(
    (acc, s) => acc + s.duracion_min + s.buffer_min,
    0
  );

  useEffect(() => {
    if (paso !== 2 || seleccion.length === 0) return;
    setCargandoSlots(true);
    setSlot(null);
    const params = new URLSearchParams({ negocio_id: negocio.id, fecha });
    seleccion.forEach((id) => params.append("servicio_ids", id));
    if (profesionalId) params.append("profesional_id", profesionalId);
    apiGet(`/disponibilidad?${params.toString()}`)
      .then(setFranjas)
      .catch((e) => setError(e.message))
      .finally(() => setCargandoSlots(false));
  }, [paso, fecha, seleccion, profesionalId, negocio]);

  function toggleServicio(id) {
    setSeleccion((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function confirmar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await apiPost("/reservas", {
        negocio_id: negocio.id,
        servicio_ids: seleccion,
        profesional_id: slot.profesional_id,
        inicio: slot.inicio,
        cliente: datos,
        frecuencia_recordatorio_dias: frecuencia,
      });
      setReserva(res);
      setPaso(4);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  if (error && !negocio) {
    return <Centro>Error: {error}</Centro>;
  }
  if (!negocio) {
    return <Centro>Cargando...</Centro>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">{negocio.nombre}</h1>
          {negocio.descripcion && (
            <p className="text-slate-500 mt-1">{negocio.descripcion}</p>
          )}
          <div className="text-sm text-slate-400 mt-2 flex gap-4 flex-wrap">
            {negocio.direccion && <span>{negocio.direccion}</span>}
            {negocio.calificacion_promedio != null && (
              <span>★ {negocio.calificacion_promedio.toFixed(1)}</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <Stepper paso={paso} />
        {error && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
            {error}
          </div>
        )}

        {paso === 0 && (
          <PasoServicios
            negocio={negocio}
            seleccion={seleccion}
            toggleServicio={toggleServicio}
          />
        )}
        {paso === 1 && (
          <PasoProfesional
            negocio={negocio}
            profesionalId={profesionalId}
            setProfesionalId={setProfesionalId}
          />
        )}
        {paso === 2 && (
          <PasoHorario
            fecha={fecha}
            setFecha={setFecha}
            franjas={franjas}
            cargando={cargandoSlots}
            slot={slot}
            setSlot={setSlot}
          />
        )}
        {paso === 3 && (
          <PasoDatos
            datos={datos}
            setDatos={setDatos}
            frecuencia={frecuencia}
            setFrecuencia={setFrecuencia}
          />
        )}
        {paso === 4 && reserva && (
          <PasoConfirmacion reserva={reserva} negocio={negocio} datos={datos} />
        )}

        {paso < 4 && (
          <Navegacion
            paso={paso}
            setPaso={setPaso}
            puedeAvanzar={puedeAvanzar(paso, { seleccion, slot, datos })}
            esUltimo={paso === 3}
            onConfirmar={confirmar}
            enviando={enviando}
          />
        )}

        {paso < 3 && serviciosElegidos.length > 0 && (
          <ResumenCarrito
            servicios={serviciosElegidos}
            totalPrecio={totalPrecio}
            totalDuracion={totalDuracion}
          />
        )}
      </main>
    </div>
  );
}

function puedeAvanzar(paso, { seleccion, slot, datos }) {
  if (paso === 0) return seleccion.length > 0;
  if (paso === 1) return true; // profesional es opcional (cualquiera)
  if (paso === 2) return slot != null;
  if (paso === 3)
    return (
      datos.nombre.trim() && emailValido(datos.email) && datos.telefono.trim()
    );
  return false;
}

function Centro({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      {children}
    </div>
  );
}

function Stepper({ paso }) {
  return (
    <ol className="flex items-center gap-2 mb-6 text-xs">
      {PASOS.map((nombre, i) => (
        <li key={nombre} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full ${
              i <= paso ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-500"
            }`}
          >
            {i + 1}
          </span>
          <span className={i <= paso ? "text-slate-800" : "text-slate-400"}>
            {nombre}
          </span>
          {i < PASOS.length - 1 && <span className="text-slate-300">—</span>}
        </li>
      ))}
    </ol>
  );
}

function PasoServicios({ negocio, seleccion, toggleServicio }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Elegí los servicios</h2>
      {negocio.servicios.map((s) => {
        const activo = seleccion.includes(s.id);
        return (
          <button
            key={s.id}
            onClick={() => toggleServicio(s.id)}
            className={`w-full text-left rounded-lg border px-4 py-3 transition ${
              activo
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-200 bg-white hover:border-slate-400"
            }`}
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {s.nombre}
                  {s.badge !== "ninguno" && (
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${activo ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>
                      {s.badge}
                    </span>
                  )}
                </div>
                <div className={`text-sm ${activo ? "text-white/70" : "text-slate-500"}`}>
                  {s.duracion_min} min
                </div>
              </div>
              <div className="font-semibold">{formatoPrecio(s.precio)}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PasoProfesional({ negocio, profesionalId, setProfesionalId }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Elegí profesional</h2>
      <button
        onClick={() => setProfesionalId(null)}
        className={`w-full text-left rounded-lg border px-4 py-3 ${
          profesionalId === null
            ? "border-slate-800 bg-slate-800 text-white"
            : "border-slate-200 bg-white hover:border-slate-400"
        }`}
      >
        <div className="font-medium">Cualquier profesional</div>
        <div className={`text-sm ${profesionalId === null ? "text-white/70" : "text-slate-500"}`}>
          Máxima disponibilidad
        </div>
      </button>
      {negocio.profesionales.map((p) => (
        <button
          key={p.id}
          onClick={() => setProfesionalId(p.id)}
          className={`w-full text-left rounded-lg border px-4 py-3 ${
            profesionalId === p.id
              ? "border-slate-800 bg-slate-800 text-white"
              : "border-slate-200 bg-white hover:border-slate-400"
          }`}
        >
          <div className="font-medium">{p.nombre}</div>
          {p.calificacion_promedio != null && (
            <div className="text-sm">★ {p.calificacion_promedio.toFixed(1)}</div>
          )}
        </button>
      ))}
    </div>
  );
}

function PasoHorario({ fecha, setFecha, franjas, cargando, slot, setSlot }) {
  const hoy = isoFecha(new Date());
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Elegí fecha y horario</h2>
      <input
        type="date"
        value={fecha}
        min={hoy}
        onChange={(e) => setFecha(e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-2"
      />
      {cargando && <p className="text-slate-500">Buscando horarios...</p>}
      {!cargando && franjas && (
        <div className="space-y-4">
          {["manana", "tarde", "noche"].map((f) =>
            franjas[f].length > 0 ? (
              <div key={f}>
                <h3 className="text-sm font-medium text-slate-500 capitalize mb-2">
                  {f === "manana" ? "Mañana" : f}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {franjas[f].map((s) => (
                    <button
                      key={s.inicio}
                      onClick={() => setSlot(s)}
                      className={`rounded-md border px-3 py-1.5 text-sm ${
                        slot?.inicio === s.inicio
                          ? "border-slate-800 bg-slate-800 text-white"
                          : "border-slate-300 bg-white hover:border-slate-500"
                      }`}
                    >
                      {horaLocal(s.inicio)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null
          )}
          {franjas.manana.length === 0 &&
            franjas.tarde.length === 0 &&
            franjas.noche.length === 0 && (
              <p className="text-slate-500">No hay horarios disponibles ese día.</p>
            )}
        </div>
      )}
    </div>
  );
}

function PasoDatos({ datos, setDatos, frecuencia, setFrecuencia }) {
  function campo(k) {
    return (e) => setDatos({ ...datos, [k]: e.target.value });
  }
  return (
    <div className="space-y-4 max-w-md">
      <h2 className="text-lg font-semibold">Tus datos</h2>
      <Input label="Nombre" value={datos.nombre} onChange={campo("nombre")} />
      <Input
        label="Email"
        type="email"
        value={datos.email}
        onChange={campo("email")}
        error={
          datos.email.trim() && !emailValido(datos.email)
            ? "Ingresá un email válido (ej: nombre@dominio.com)"
            : null
        }
      />
      <Input label="Teléfono" value={datos.telefono} onChange={campo("telefono")} />
      <div>
        <label className="block text-sm text-slate-600 mb-1">
          ¿Cada cuánto solés volver? (opcional)
        </label>
        <div className="flex flex-wrap gap-2">
          {OPCIONES_FRECUENCIA.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setFrecuencia(o.dias)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                frecuencia === o.dias
                  ? "border-slate-800 bg-slate-800 text-white"
                  : "border-slate-300 bg-white hover:border-slate-500"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Input({ label, error, ...props }) {
  return (
    <div>
      <label className="block text-sm text-slate-600 mb-1">{label}</label>
      <input
        {...props}
        className={`w-full rounded-md border px-3 py-2 ${
          error ? "border-red-400" : "border-slate-300"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function PasoConfirmacion({ reserva, negocio, datos }) {
  return (
    <div className="text-center space-y-3 py-6">
      <div className="text-5xl">✅</div>
      <h2 className="text-xl font-semibold">¡Reserva confirmada!</h2>
      <p className="text-slate-600">
        {fechaLegible(reserva.inicio)} a las {horaLocal(reserva.inicio)}
      </p>
      <p className="text-slate-600">
        Total: {formatoPrecio(reserva.total_precio)} · {reserva.total_duracion} min
      </p>
      <p className="text-sm text-slate-500">
        Te enviamos la confirmación a <strong>{datos.email}</strong> y avisamos a{" "}
        {negocio.nombre}.
      </p>
    </div>
  );
}

function ResumenCarrito({ servicios, totalPrecio, totalDuracion }) {
  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="font-medium mb-2">Tu reserva</h3>
      <ul className="text-sm text-slate-600 space-y-1">
        {servicios.map((s) => (
          <li key={s.id} className="flex justify-between">
            <span>{s.nombre}</span>
            <span>{formatoPrecio(s.precio)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between font-semibold">
        <span>Total ({totalDuracion} min)</span>
        <span>{formatoPrecio(totalPrecio)}</span>
      </div>
    </div>
  );
}

function Navegacion({ paso, setPaso, puedeAvanzar, esUltimo, onConfirmar, enviando }) {
  return (
    <div className="mt-6 flex justify-between">
      <button
        onClick={() => setPaso((p) => Math.max(0, p - 1))}
        disabled={paso === 0}
        className="rounded-md px-4 py-2 text-slate-600 disabled:opacity-40"
      >
        Atrás
      </button>
      {esUltimo ? (
        <button
          onClick={onConfirmar}
          disabled={!puedeAvanzar || enviando}
          className="rounded-md bg-slate-800 px-6 py-2 text-white disabled:opacity-40"
        >
          {enviando ? "Confirmando..." : "Confirmar reserva"}
        </button>
      ) : (
        <button
          onClick={() => setPaso((p) => p + 1)}
          disabled={!puedeAvanzar}
          className="rounded-md bg-slate-800 px-6 py-2 text-white disabled:opacity-40"
        >
          Continuar
        </button>
      )}
    </div>
  );
}
