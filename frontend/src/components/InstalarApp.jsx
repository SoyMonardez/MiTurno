import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

const DESCARTADO_KEY = "miturno_pwa_descartado";

/**
 * Botón flotante "Descargar App": aparece cuando el navegador dispara
 * beforeinstallprompt (Chrome/Edge en Android y escritorio). En iOS la
 * instalación es manual desde el menú compartir, así que no se muestra.
 */
export default function InstalarApp() {
  const [promptEvento, setPromptEvento] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onPrompt(e) {
      e.preventDefault();
      if (sessionStorage.getItem(DESCARTADO_KEY)) return;
      setPromptEvento(e);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible || !promptEvento) return null;

  async function instalar() {
    promptEvento.prompt();
    await promptEvento.userChoice;
    setVisible(false);
    setPromptEvento(null);
  }

  function descartar() {
    sessionStorage.setItem(DESCARTADO_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 scale-in">
      <button
        onClick={instalar}
        className="flex items-center gap-2 rounded-full bg-neutral-900 text-white pl-4 pr-5 py-3 text-xs uppercase tracking-[0.15em] font-medium shadow-xl hover:bg-neutral-800 transition-colors"
      >
        <Download size={14} strokeWidth={1.5} />
        Descargar App
      </button>
      <button
        onClick={descartar}
        aria-label="Cerrar"
        className="rounded-full bg-white/90 border border-neutral-200 p-2 text-neutral-500 shadow-lg hover:text-neutral-800 transition-colors"
      >
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}
