import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  LogOut,
  Plus,
  Scissors,
  Sparkles,
  User,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost, clearToken } from "../api/client.js";
import SEO from "../components/SEO.jsx";
import { fechaLegible, formatoPrecio, horaLocal, isoFecha } from "../lib/format.js";

const ESTADO_LABEL = {
  confirmada: "Confirmado",
  completada: "Completado",
  cancelada: "Cancelado",
  no_show: "No vino",
};

const METODO_LABEL = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercado_pago: "Mercado Pago",
};

function sumarDias(fecha, dias) {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

function inicioSemana(fecha) {
  const d = new Date(fecha);
  const dia = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - dia);
  return d;
}

export default function PanelProfesional() {
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState(null);
  const [error, setError] = useState(null);

  const onError = useCallback(
    (err) => {
      if (err.status === 401 || err.status === 403) {
        clearToken();
        navigate("/admin/login");
      } else {
        setError(err.message);
      }
    },
    [navigate]
  );

  useEffect(() => {
    apiGet("/profesional/perfil").then(setPerfil).catch(onError);
  }, [onError]);

  function salir() {
    clearToken();
    navigate("/admin/login");
  }

  if (!perfil) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        {error ? (
          <p className="text-sm text-red-600 px-6 text-center">{error}</p>
        ) : (
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">Cargando…</p>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 pb-12">
      <SEO noIndex title={`Mi Panel - ${perfil.nombre} | MiTurno`} />
      <header className="bg-neutral-950 text-white sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Scissors size={16} className="text-neutral-400" strokeWidth={1.5} />
            <div>
              <h1 className="font-serif text-lg tracking-[0.05em] leading-tight">{perfil.nombre}</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                {perfil.negocio_nombre} · Mi panel
              </p>
            </div>
          </div>
          <button
            onClick={salir}
            className="flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-neutral-400 hover:text-white transition-colors"
          >
            <LogOut size={14} strokeWidth={1.5} /> <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-5 py-6 space-y-8">
        <Comisiones perfil={perfil} onError={onError} />
        <Agenda onError={onError} />
      </main>
    </div>
  );
}

// ─── Liquidación de comisiones ────────────────────────────────────────────────

function Comisiones({ perfil, onError }) {
  const hoy = new Date();
  const [desde, setDesde] = useState(isoFecha(inicioSemana(hoy)));
  const [hasta, setHasta] = useState(isoFecha(hoy));
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!desde || !hasta) return;
    const cargar = () =>
      apiGet(`/profesional/comisiones?desde=${desde}&hasta=${hasta}`)
        .then(setData)
        .catch(() => {});
    cargar();
    // Se actualiza solo cada 20s para reflejar turnos nuevos sin recargar.
    const id = setInterval(cargar, 20000);
    return () => clearInterval(id);
  }, [desde, hasta]);

  const esPorcentaje = perfil.tipo_comision === "porcentaje_corte";

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-neutral-500">
          <Wallet size={14} strokeWidth={1.5} /> Mis comisiones
        </h2>
        <span className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
          {esPorcentaje ? `${perfil.valor_comision}% por corte` : "Sueldo fijo del local"}
        </span>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
        />
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-neutral-900 text-white rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-1">A cobrar</p>
            <p className="font-serif text-xl">{formatoPrecio(data.total_comision)}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-neutral-200">
            <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-1">Generado</p>
            <p className="font-serif text-xl text-neutral-900">{formatoPrecio(data.total_generado)}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-neutral-200">
            <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-1">Turnos</p>
            <p className="font-serif text-xl text-neutral-900">{data.turnos_completados}</p>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Agenda del profesional ───────────────────────────────────────────────────

function Agenda({ onError }) {
  const [fecha, setFecha] = useState(new Date());
  const [turnos, setTurnos] = useState(null);
  const [clienteFicha, setClienteFicha] = useState(null); // {id, nombre}

  const dia = isoFecha(fecha);

  useEffect(() => {
    setTurnos(null);
    const cargar = (mostrarCarga) => {
      if (mostrarCarga) setTurnos(null);
      apiGet(`/profesional/turnos?desde=${dia}&hasta=${dia}`)
        .then(setTurnos)
        .catch(() => {});
    };
    cargar(true);
    // Refresco automático cada 15s: si entra una reserva nueva, aparece sola.
    const id = setInterval(() => cargar(false), 15000);
    return () => clearInterval(id);
  }, [dia]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-neutral-500">
          <Calendar size={14} strokeWidth={1.5} /> Mi agenda
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFecha(sumarDias(fecha, -1))}
            className="p-2 rounded-full hover:bg-neutral-200 transition-colors"
            aria-label="Día anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-neutral-700 capitalize min-w-[140px] text-center">
            {fechaLegible(fecha.toISOString())}
          </span>
          <button
            onClick={() => setFecha(sumarDias(fecha, 1))}
            className="p-2 rounded-full hover:bg-neutral-200 transition-colors"
            aria-label="Día siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {!turnos ? (
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-400 py-8 text-center">Cargando…</p>
      ) : turnos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center text-sm text-neutral-400">
          Sin turnos para este día
        </div>
      ) : (
        <ul className="space-y-2">
          {turnos.map((t) => (
            <li key={t.id} className="bg-white rounded-2xl border border-neutral-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900">
                    {horaLocal(t.inicio)} · {t.cliente_nombre}
                  </p>
                  <p className="text-sm text-neutral-500 truncate">
                    {t.servicios.join(" + ") || "Servicio a definir"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span
                      className={`text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full ${
                        t.estado === "completada"
                          ? "bg-emerald-50 text-emerald-700"
                          : t.estado === "cancelada" || t.estado === "no_show"
                          ? "bg-red-50 text-red-600"
                          : "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {ESTADO_LABEL[t.estado] ?? t.estado}
                    </span>
                    {t.metodo_pago && (
                      <span className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                        {METODO_LABEL[t.metodo_pago]}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-serif text-lg text-neutral-900">{formatoPrecio(t.total_precio)}</p>
                  {t.pago_profesional != null && (
                    <p className="text-xs text-emerald-700">
                      Mi parte: {formatoPrecio(t.pago_profesional)}
                    </p>
                  )}
                  <button
                    onClick={() => setClienteFicha({ id: t.cliente_id, nombre: t.cliente_nombre })}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-neutral-500 hover:text-neutral-900 transition-colors"
                  >
                    <ClipboardList size={12} strokeWidth={1.5} /> Historial
                  </button>
                </div>
              </div>

              {/* Resumen de la última sesión: el profesional sabe qué le hizo la última vez */}
              {t.ultima_nota && (
                <div className="mt-3 pt-3 border-t border-neutral-100">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 mb-1">
                    Última vez{t.ultima_nota_fecha ? ` · ${new Date(t.ultima_nota_fecha).toLocaleDateString("es-AR")}` : ""}
                  </p>
                  <p className="text-sm text-neutral-600 line-clamp-2">{t.ultima_nota}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {clienteFicha && (
        <FichaTecnica cliente={clienteFicha} onCerrar={() => setClienteFicha(null)} onError={onError} />
      )}
    </section>
  );
}

// ─── Ficha técnica del cliente ────────────────────────────────────────────────

function FichaTecnica({ cliente, onCerrar, onError }) {
  const [notas, setNotas] = useState(null);
  const [nueva, setNueva] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [mejorando, setMejorando] = useState(false);
  const [resumen, setResumen] = useState(null);
  const [resumiendo, setResumiendo] = useState(false);

  useEffect(() => {
    apiGet(`/profesional/clientes/${cliente.id}/historial`).then(setNotas).catch(onError);
  }, [cliente.id, onError]);

  async function mejorar() {
    if (!nueva.trim()) return;
    setMejorando(true);
    try {
      const r = await apiPost("/profesional/ia/nota-historial", { texto: nueva.trim() });
      if (r.texto) setNueva(r.texto);
    } catch (err) {
      onError(err);
    } finally {
      setMejorando(false);
    }
  }

  async function generarResumen() {
    setResumiendo(true);
    try {
      const r = await apiPost(`/profesional/clientes/${cliente.id}/historial/resumen`, {});
      setResumen(r.texto);
    } catch (err) {
      onError(err);
    } finally {
      setResumiendo(false);
    }
  }

  async function agregar(e) {
    e.preventDefault();
    if (!nueva.trim()) return;
    setGuardando(true);
    try {
      const creada = await apiPost(`/profesional/clientes/${cliente.id}/historial`, {
        notas_estilo: nueva.trim(),
      });
      setNotas([creada, ...(notas ?? [])]);
      setNueva("");
      setResumen(null);
    } catch (err) {
      onError(err);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col scale-in">
        <div className="flex items-center justify-between p-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <User size={16} strokeWidth={1.5} className="text-neutral-400" />
            <div>
              <h3 className="font-medium text-neutral-900">{cliente.nombre}</h3>
              <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-400">
                Historial del cliente
              </p>
            </div>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" className="p-2 rounded-full hover:bg-neutral-100">
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pt-3">
          <button onClick={generarResumen} disabled={resumiendo}
            className="flex items-center gap-1.5 text-xs bg-neutral-100 border border-neutral-200 text-neutral-900 rounded-full px-3 py-1.5 font-medium hover:bg-neutral-200 disabled:opacity-40 transition-colors">
            {resumiendo ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} className="text-neutral-500" />}
            {resumiendo ? "Resumiendo…" : "Resumen con IA"}
          </button>
          {resumen && (
            <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
              {resumen}
            </div>
          )}
        </div>

        <form onSubmit={agregar} className="p-4 border-b border-neutral-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-[0.12em] text-neutral-400">Nueva nota</span>
            <button type="button" onClick={mejorar} disabled={mejorando || !nueva.trim()}
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 disabled:opacity-40 transition-colors">
              {mejorando ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              {mejorando ? "Mejorando…" : "Mejorar con IA"}
            </button>
          </div>
          <textarea
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            rows={2}
            placeholder="Anotá qué se hizo hoy, observaciones, recomendaciones para la próxima…"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm resize-none focus:outline-none focus:border-neutral-400"
          />
          <button
            type="submit"
            disabled={guardando || !nueva.trim()}
            className="mt-2 w-full flex items-center justify-center gap-2 rounded-full bg-neutral-900 text-white py-2.5 text-xs uppercase tracking-[0.15em] disabled:opacity-40 hover:bg-neutral-800 transition-colors"
          >
            <Plus size={14} strokeWidth={1.5} /> {guardando ? "Guardando…" : "Agregar nota"}
          </button>
        </form>

        <div className="overflow-y-auto p-4 space-y-3">
          {!notas ? (
            <p className="text-xs text-neutral-400 text-center py-4">Cargando…</p>
          ) : notas.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-4">
              Todavía no hay notas para este cliente.
            </p>
          ) : (
            notas.map((n) => (
              <div key={n.id} className="rounded-xl bg-neutral-50 border border-neutral-100 p-3">
                <p className="text-sm text-neutral-800 whitespace-pre-wrap">{n.notas_estilo}</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-neutral-400 mt-1.5">
                  {n.profesional_nombre ?? "Administración"} ·{" "}
                  {new Date(n.fecha_actualizacion).toLocaleDateString("es-AR")}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
