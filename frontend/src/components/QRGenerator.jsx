import { useEffect, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { toPng } from "html-to-image";

const COLORES = [
  "#0a0a0a", "#1e3a8a", "#065f46", "#7c2d12",
  "#831843", "#4c1d95", "#0f766e", "#b45309",
];

function esClaro(hex) {
  const c = (hex || "#000000").replace("#", "");
  if (c.length < 6) return false;
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

/**
 * Generador de cartel con QR para imprimir y poner en el local.
 * Fondo de color + nombre del local + QR + llamada a la acción.
 * 100% del lado del cliente.
 */
export default function QRGenerator({
  url,
  logoUrl = null,
  businessName = "Mi negocio",
  slug = "miturno",
}) {
  const qrContainerRef = useRef(null);
  const qrRef = useRef(null);
  const posterRef = useRef(null);

  const [bgColor, setBgColor] = useState("#0a0a0a");
  const [titulo, setTitulo] = useState(businessName);
  const [cta, setCta] = useState("Escaneá y reservá tu turno");
  const [incluirLogo, setIncluirLogo] = useState(Boolean(logoUrl));
  const [descargando, setDescargando] = useState(false);

  useEffect(() => { setTitulo(businessName); }, [businessName]);

  // Normalizamos el logo a https (evita contenido mixto que rompe el canvas).
  const logoSeguro = (() => {
    if (!logoUrl) return null;
    if (typeof window !== "undefined" && window.location.protocol === "https:") {
      return logoUrl.replace(/^http:\/\//i, "https://");
    }
    return logoUrl;
  })();
  const logoActivo = incluirLogo && logoSeguro ? logoSeguro : undefined;

  const textoColor = esClaro(bgColor) ? "#0a0a0a" : "#ffffff";
  const textoSuave = esClaro(bgColor) ? "rgba(10,10,10,0.6)" : "rgba(255,255,255,0.7)";

  const qrOptions = (width) => ({
    width, height: width, type: "canvas", data: url,
    image: logoActivo, margin: 6,
    dotsOptions: { color: "#0a0a0a", type: "rounded" },
    cornersSquareOptions: { color: "#0a0a0a", type: "extra-rounded" },
    cornersDotOptions: { color: "#0a0a0a" },
    backgroundOptions: { color: "#ffffff" },
    imageOptions: { crossOrigin: "anonymous", margin: 6, imageSize: 0.32, hideBackgroundDots: true },
    qrOptions: { errorCorrectionLevel: "H" },
  });

  useEffect(() => {
    qrRef.current = new QRCodeStyling(qrOptions(190));
    qrRef.current.append(qrContainerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    qrRef.current?.update(qrOptions(190));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, logoActivo]);

  async function descargarCartel() {
    if (!posterRef.current) return;
    setDescargando(true);
    try {
      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: 4,
        cacheBust: true,
        backgroundColor: bgColor,
      });
      const a = document.createElement("a");
      a.download = `cartel-${slug}.png`;
      a.href = dataUrl;
      a.click();
    } catch (e) {
      console.error(e);
      alert("No se pudo generar el cartel. Probá desactivar el logo del QR.");
    } finally {
      setDescargando(false);
    }
  }

  function descargarSoloQR() {
    const printQR = new QRCodeStyling(qrOptions(1024));
    printQR.download({ name: `qr-${slug}`, extension: "png" });
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* ── Vista previa del cartel ── */}
      <div className="flex flex-col items-center gap-3">
        <div
          ref={posterRef}
          style={{ backgroundColor: bgColor }}
          className="w-[300px] rounded-2xl px-7 py-8 flex flex-col items-center text-center shadow-sm"
        >
          {logoActivo && (
            <img
              src={logoActivo}
              alt=""
              crossOrigin="anonymous"
              className="w-14 h-14 object-contain rounded-xl mb-3 bg-white p-1.5"
            />
          )}
          <h3
            style={{ color: textoColor, fontFamily: "Georgia, 'Times New Roman', serif" }}
            className="text-2xl leading-tight mb-1 break-words w-full"
          >
            {titulo || businessName}
          </h3>
          <p style={{ color: textoSuave }} className="text-[10px] uppercase tracking-[0.2em] mb-5">
            Reservá tu turno online
          </p>

          <div className="bg-white rounded-2xl p-3" ref={qrContainerRef} />

          <p style={{ color: textoColor }} className="text-sm font-medium mt-5 leading-snug">
            {cta}
          </p>
          <div style={{ color: textoSuave }} className="text-[9px] uppercase tracking-[0.15em] mt-3">
            miturno.alejomonardez.com
          </div>
        </div>
        <p className="text-[11px] text-neutral-400">Así se verá impreso</p>
      </div>

      {/* ── Controles ── */}
      <div className="flex-1 space-y-4 max-w-sm">
        <div>
          <label className="block text-[10px] uppercase tracking-[0.15em] text-neutral-400 mb-2">Color de fondo</label>
          <div className="flex flex-wrap gap-2 items-center">
            {COLORES.map((c) => (
              <button key={c} type="button" onClick={() => setBgColor(c)}
                style={{ backgroundColor: c }}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${bgColor === c ? "border-neutral-900 scale-110" : "border-transparent"}`}
              />
            ))}
            <label className="w-8 h-8 rounded-full border border-neutral-300 overflow-hidden cursor-pointer relative" title="Color personalizado">
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
                className="absolute inset-0 w-full h-full cursor-pointer opacity-0" />
              <span className="absolute inset-0 flex items-center justify-center text-neutral-400 text-lg">+</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.15em] text-neutral-400 mb-1.5">Nombre que se muestra</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="campo-admin" maxLength={40} />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-[0.15em] text-neutral-400 mb-1.5">Texto de abajo</label>
          <input value={cta} onChange={(e) => setCta(e.target.value)} className="campo-admin" maxLength={60} />
        </div>

        {logoSeguro && (
          <label className="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
            <input type="checkbox" checked={incluirLogo} onChange={(e) => setIncluirLogo(e.target.checked)}
              className="rounded border-neutral-300" />
            Incluir mi logo
          </label>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <button type="button" onClick={descargarCartel} disabled={descargando}
            className="rounded-full bg-neutral-900 text-white px-5 py-3 text-xs uppercase tracking-[0.1em] font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors">
            {descargando ? "Generando…" : "Descargar cartel (PNG)"}
          </button>
          <button type="button" onClick={descargarSoloQR}
            className="rounded-full border border-neutral-300 px-5 py-2.5 text-xs uppercase tracking-[0.1em] font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
            Descargar solo el QR
          </button>
        </div>
      </div>
    </div>
  );
}
