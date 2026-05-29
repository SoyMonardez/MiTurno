/**
 * Sistema de diálogos estilizados para reemplazar alert/confirm/prompt nativos.
 *
 * Uso:
 *   const dialog = useDialog();
 *   await dialog.alert("Mensaje");
 *   const ok = await dialog.confirm("¿Seguro?");
 *   const val = await dialog.prompt("Nueva clave:", { placeholder: "mín. 6 chars" });
 *   await dialog.error("Algo salió mal");
 */
import { AlertTriangle, Check, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
  const [dialogo, setDialogo] = useState(null);

  const abrir = useCallback((config) => {
    return new Promise((resolve) => {
      setDialogo({ ...config, resolve });
    });
  }, []);

  function cerrar(valor) {
    dialogo?.resolve(valor);
    setDialogo(null);
  }

  const dialog = {
    /** Muestra un mensaje informativo. Resuelve con undefined. */
    alert: (mensaje, titulo = "Aviso") =>
      abrir({ tipo: "alert", titulo, mensaje }),

    /** Muestra un error. Resuelve con undefined. */
    error: (mensaje, titulo = "Ocurrió un error") =>
      abrir({ tipo: "error", titulo, mensaje }),

    /** Pide confirmación. Resuelve con true/false. */
    confirm: (mensaje, titulo = "Confirmación", opts = {}) =>
      abrir({ tipo: "confirm", titulo, mensaje, ...opts }),

    /** Pide un valor de texto. Resuelve con el string o null si cancela. */
    prompt: (mensaje, titulo = "Ingresá un valor", opts = {}) =>
      abrir({ tipo: "prompt", titulo, mensaje, ...opts }),
  };

  return (
    <DialogContext.Provider value={dialog}>
      {children}
      {dialogo && <DialogModal dialogo={dialogo} onClose={cerrar} />}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog debe estar dentro de <DialogProvider>");
  return ctx;
}

// ─── Modal visual ─────────────────────────────────────────────────────────────

const ICONO = {
  alert:   { Icon: Info,          bg: "bg-neutral-100",  color: "text-neutral-700" },
  error:   { Icon: AlertTriangle, bg: "bg-red-100",      color: "text-red-600" },
  confirm: { Icon: AlertTriangle, bg: "bg-amber-100",    color: "text-amber-600" },
  prompt:  { Icon: Info,          bg: "bg-neutral-100",  color: "text-neutral-700" },
};

const BTN_CONFIRM = {
  alert:   "bg-neutral-900 hover:bg-neutral-800 text-white",
  error:   "bg-red-600 hover:bg-red-700 text-white",
  confirm: "bg-neutral-900 hover:bg-neutral-800 text-white",
  prompt:  "bg-neutral-900 hover:bg-neutral-800 text-white",
};

function DialogModal({ dialogo, onClose }) {
  const { tipo, titulo, mensaje, placeholder, btnConfirm, btnCancel } = dialogo;
  const { Icon, bg, color } = ICONO[tipo] ?? ICONO.alert;
  const [valor, setValor] = useState("");

  function confirmar() {
    if (tipo === "prompt") {
      onClose(valor || null);
    } else if (tipo === "confirm") {
      onClose(true);
    } else {
      onClose(undefined);
    }
  }

  function cancelar() {
    if (tipo === "confirm") onClose(false);
    else if (tipo === "prompt") onClose(null);
    else onClose(undefined);
  }

  function onKey(e) {
    if (e.key === "Enter" && tipo !== "confirm") confirmar();
    if (e.key === "Escape") cancelar();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) cancelar(); }}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-6 scale-in"
        onKeyDown={onKey}
      >
        {/* Icono + título */}
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
            <Icon size={18} className={color} strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-serif text-base text-neutral-900 leading-tight">{titulo}</h3>
            <p className="text-sm text-neutral-500 mt-1 leading-relaxed">{mensaje}</p>
          </div>
        </div>

        {/* Campo de texto para prompt */}
        {tipo === "prompt" && (
          <input
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder={placeholder ?? ""}
            className="campo-admin mb-4"
          />
        )}

        {/* Botones */}
        <div className="flex gap-2 justify-end">
          {(tipo === "confirm" || tipo === "prompt") && (
            <button
              onClick={cancelar}
              className="rounded-full border border-neutral-300 px-4 py-2 text-xs uppercase tracking-[0.1em] text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              {btnCancel ?? "Cancelar"}
            </button>
          )}
          <button
            autoFocus={tipo !== "prompt"}
            onClick={confirmar}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs uppercase tracking-[0.1em] font-medium transition-colors ${BTN_CONFIRM[tipo]}`}
          >
            <Check size={13} strokeWidth={2} />
            {btnConfirm ?? (tipo === "confirm" ? "Confirmar" : "Aceptar")}
          </button>
        </div>
      </div>
    </div>
  );
}
