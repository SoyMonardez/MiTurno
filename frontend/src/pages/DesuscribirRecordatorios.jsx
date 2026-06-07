import { ArrowRight, BellOff, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api/client.js";
import { IconoNegocio } from "../lib/iconos.jsx";

export default function DesuscribirRecordatorios() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    apiGet(`/reservas/recordatorios/baja/${token}`)
      .then((d) => {
        setDatos(d);
        if (d.ya_dado_de_baja) setListo(true);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  async function confirmar() {
    setProcesando(true);
    setError(null);
    try {
      await apiPost(`/reservas/recordatorios/baja/${token}`);
      setListo(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-200 flex items-start justify-center">
      <div className="max-w-md w-full bg-white min-h-screen">
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
            Recordatorios
          </p>
        </div>

        <div className="p-6">
          {!datos && !error && (
            <p className="text-center text-neutral-400 text-sm py-10">Cargando…</p>
          )}

          {error && !datos && (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-full border-2 border-neutral-300 flex items-center justify-center mx-auto mb-4">
                <X size={28} className="text-neutral-400" strokeWidth={1.5} />
              </div>
              <p className="font-serif text-xl text-neutral-900 mb-1">Enlace no válido</p>
              <p className="text-sm text-neutral-500">El enlace no es correcto o expiró.</p>
            </div>
          )}

          {datos && listo && (
            <div className="text-center py-10 fade-up">
              <div className="w-16 h-16 rounded-full border-2 border-neutral-900 flex items-center justify-center mx-auto mb-4 scale-in">
                <Check size={30} className="text-neutral-900" strokeWidth={1.5} />
              </div>
              <p className="font-serif text-xl text-neutral-900 mb-1">Listo</p>
              <p className="text-sm text-neutral-500 mb-6">
                No vas a recibir más recordatorios de {datos.negocio_nombre}. Igual podés reservar
                cuando quieras.
              </p>
              <button
                onClick={() => navigate(`/${datos.negocio_slug}`)}
                className="inline-flex items-center gap-2 border border-neutral-900 rounded-full px-6 py-3 text-xs uppercase tracking-[0.15em] font-medium hover:bg-neutral-900 hover:text-white transition-colors"
              >
                Reservar un turno <ArrowRight size={14} strokeWidth={1.5} />
              </button>
            </div>
          )}

          {datos && !listo && (
            <div className="text-center py-8 fade-up">
              <div className="w-16 h-16 rounded-full border-2 border-neutral-300 flex items-center justify-center mx-auto mb-4">
                <BellOff size={26} className="text-neutral-500" strokeWidth={1.5} />
              </div>
              <p className="font-serif text-xl text-neutral-900 mb-1">
                ¿Dejar de recibir recordatorios?
              </p>
              <p className="text-sm text-neutral-500 mb-6">
                {datos.cliente_nombre ? `${datos.cliente_nombre}, ` : ""}no te volveremos a enviar
                los avisos de "volvé a visitarnos" de {datos.negocio_nombre}.
              </p>

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 mb-4">
                  {error}
                </div>
              )}

              <button
                onClick={confirmar}
                disabled={procesando}
                className="w-full bg-neutral-900 text-white rounded-full py-3.5 text-xs uppercase tracking-[0.15em] font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
              >
                {procesando ? "Procesando…" : "Sí, darme de baja"}
              </button>
              <button
                onClick={() => navigate(`/${datos.negocio_slug}`)}
                className="w-full mt-2 py-3 text-xs uppercase tracking-[0.15em] text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                No, seguir recibiéndolos
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
