import { ArrowRight, Check, Clock, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api/client.js";
import { formatoPrecio } from "../lib/format.js";
import { IconoNegocio } from "../lib/iconos.jsx";

function fechaLarga(iso) {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long",
  });
}
function hora(iso) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

const ESTADO_LABEL = {
  confirmada: "Confirmado",
  cancelada: "Cancelado",
  completada: "Completado",
  no_show: "No asististe",
};

export default function CancelarReserva() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cancelando, setCancelando] = useState(false);
  const [cancelado, setCancelado] = useState(false);

  useEffect(() => {
    apiGet(`/reservas/cancelar/${token}`)
      .then(setDatos)
      .catch((e) => setError(e.message));
  }, [token]);

  async function confirmarCancelacion() {
    setCancelando(true);
    setError(null);
    try {
      await apiPost(`/reservas/cancelar/${token}`);
      setCancelado(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-200 flex items-start justify-center">
      <div className="max-w-md w-full bg-white min-h-screen">
        {/* Header negro */}
        <div className="bg-neutral-950 px-6 pt-12 pb-8 text-white text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="h-px w-8 bg-white/40" />
            <IconoNegocio clave={datos?.negocio_icono} size={16} className="text-white/60" strokeWidth={1.5} />
            <span className="h-px w-8 bg-white/40" />
          </div>
          <h1 className="font-serif text-2xl tracking-[0.08em] uppercase">
            {datos?.negocio_nombre ?? "MiTurno"}
          </h1>
          <p className="text-neutral-400 text-[11px] uppercase tracking-[0.2em] mt-2">
            Cancelar reserva
          </p>
        </div>

        <div className="p-6">
          {/* Estado: cargando */}
          {!datos && !error && (
            <p className="text-center text-neutral-400 text-sm py-10">Cargando…</p>
          )}

          {/* Estado: error de carga (token inválido) */}
          {error && !datos && (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-full border-2 border-neutral-300 flex items-center justify-center mx-auto mb-4">
                <X size={28} className="text-neutral-400" strokeWidth={1.5} />
              </div>
              <p className="font-serif text-xl text-neutral-900 mb-1">Reserva no encontrada</p>
              <p className="text-sm text-neutral-500">El enlace no es válido o expiró.</p>
            </div>
          )}

          {/* Estado: cancelación exitosa */}
          {cancelado && (
            <div className="text-center py-10 fade-up">
              <div className="w-16 h-16 rounded-full border-2 border-neutral-900 flex items-center justify-center mx-auto mb-4 scale-in">
                <Check size={30} className="text-neutral-900" strokeWidth={1.5} />
              </div>
              <p className="font-serif text-xl text-neutral-900 mb-1">Reserva cancelada</p>
              <p className="text-sm text-neutral-500 mb-6">Tu turno fue cancelado correctamente.</p>
              <button
                onClick={() => navigate(`/${datos.negocio_slug}`)}
                className="inline-flex items-center gap-2 bg-neutral-900 text-white rounded-full px-6 py-3 text-xs uppercase tracking-[0.15em] font-medium hover:bg-neutral-800 transition-colors"
              >
                Reservar otro turno <ArrowRight size={14} strokeWidth={1.5} />
              </button>
            </div>
          )}

          {/* Estado: muestra la reserva */}
          {datos && !cancelado && (
            <div className="fade-up">
              {/* Detalle de la reserva */}
              <div className="rounded-2xl border border-neutral-200 p-5 mb-5">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-neutral-400 mb-3">
                  <span className={`h-1.5 w-1.5 rounded-full ${datos.estado === "confirmada" ? "bg-neutral-900" : "bg-neutral-300"}`} />
                  {ESTADO_LABEL[datos.estado] ?? datos.estado}
                </div>
                <p className="font-serif text-lg text-neutral-900 capitalize">{fechaLarga(datos.inicio)}</p>
                <div className="flex items-center gap-3 text-sm text-neutral-500 mt-1">
                  <span className="flex items-center gap-1"><Clock size={13} strokeWidth={1.5} /> {hora(datos.inicio)}</span>
                  <span>·</span>
                  <span>{datos.total_duracion} min</span>
                </div>
                <div className="mt-4 pt-4 border-t border-neutral-100 space-y-1.5">
                  {datos.servicios.map((s) => (
                    <div key={s} className="flex items-center gap-2 text-sm text-neutral-700">
                      <IconoNegocio clave={datos.negocio_icono} size={12} className="text-neutral-300" strokeWidth={1.5} /> {s}
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] uppercase tracking-[0.1em] text-neutral-400">{datos.profesional_nombre}</span>
                    <span className="font-medium text-neutral-900">{formatoPrecio(datos.total_precio)}</span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 mb-4">
                  {error}
                </div>
              )}

              {/* Acción según si es cancelable */}
              {datos.cancelable ? (
                <>
                  <p className="text-sm text-neutral-500 text-center mb-4">
                    ¿Seguro que querés cancelar este turno?
                  </p>
                  <button
                    onClick={confirmarCancelacion}
                    disabled={cancelando}
                    className="w-full bg-neutral-900 text-white rounded-full py-3.5 text-xs uppercase tracking-[0.15em] font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                  >
                    {cancelando ? "Cancelando…" : "Sí, cancelar reserva"}
                  </button>
                  <button
                    onClick={() => navigate(`/${datos.negocio_slug}`)}
                    className="w-full mt-2 py-3 text-xs uppercase tracking-[0.15em] text-neutral-500 hover:text-neutral-900 transition-colors"
                  >
                    No, mantener turno
                  </button>
                </>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-neutral-500 mb-4">
                    {datos.estado === "cancelada"
                      ? "Esta reserva ya está cancelada."
                      : datos.estado === "confirmada"
                      ? `Ya no se puede cancelar online (mínimo ${datos.minutos_anticipacion} min antes). Contactá al negocio.`
                      : "Esta reserva no se puede cancelar."}
                  </p>
                  <button
                    onClick={() => navigate(`/${datos.negocio_slug}`)}
                    className="inline-flex items-center gap-2 border border-neutral-900 rounded-full px-6 py-3 text-xs uppercase tracking-[0.15em] font-medium hover:bg-neutral-900 hover:text-white transition-colors"
                  >
                    Ir al negocio <ArrowRight size={14} strokeWidth={1.5} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
