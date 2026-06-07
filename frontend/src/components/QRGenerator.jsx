import { useEffect, useRef, useState } from "react";
import QRCodeStyling from "qr-code-styling";

/**
 * Generador de QR por sucursal (panel admin del tenant).
 * 100% del lado del cliente: no requiere endpoint nuevo.
 * Requiere: npm install qr-code-styling
 */
export default function QRGenerator({
  url,                       // URL pública completa de la sucursal
  logoUrl = null,            // logo del negocio (opcional)
  brandColor = "#0a0a0a",    // color de marca (neutro de MiTurno)
  bgColor = "#ffffff",
  slug = "miturno",          // nombre del archivo descargado
  size = 240,                // tamaño en pantalla (px)
  downloadAt = 1024,         // resolución de descarga (nítido para imprimir)
}) {
  const containerRef = useRef(null);
  const qrRef = useRef(null);
  const [incluirLogo, setIncluirLogo] = useState(Boolean(logoUrl));

  const logoActivo = incluirLogo && logoUrl ? logoUrl : undefined;

  const buildOptions = (width) => ({
    width,
    height: width,
    type: "canvas",
    data: url,
    image: logoActivo,
    margin: 8,
    dotsOptions: { color: brandColor, type: "rounded" },
    cornersSquareOptions: { color: brandColor, type: "extra-rounded" },
    cornersDotOptions: { color: brandColor },
    backgroundOptions: { color: bgColor },
    imageOptions: {
      crossOrigin: "anonymous",
      margin: 6,
      imageSize: 0.32,
      hideBackgroundDots: true,
    },
    qrOptions: { errorCorrectionLevel: "H" },
  });

  // Crear la instancia una sola vez
  useEffect(() => {
    qrRef.current = new QRCodeStyling(buildOptions(size));
    qrRef.current.append(containerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render al cambiar datos
  useEffect(() => {
    qrRef.current?.update(buildOptions(size));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, logoActivo, brandColor, bgColor, size]);

  const download = (extension) => {
    const printQR = new QRCodeStyling(buildOptions(downloadAt));
    printQR.download({ name: `qr-${slug}`, extension });
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={containerRef} className="rounded-xl border border-neutral-200 p-3 bg-white" />

      {logoUrl && (
        <label className="flex items-center gap-2 text-xs text-neutral-500 cursor-pointer">
          <input
            type="checkbox"
            checked={incluirLogo}
            onChange={(e) => setIncluirLogo(e.target.checked)}
            className="rounded border-neutral-300"
          />
          Incluir mi logo en el centro
        </label>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => download("png")}
          className="rounded-full bg-neutral-900 px-4 py-2 text-xs uppercase tracking-[0.1em] font-medium text-white hover:bg-neutral-800 transition-colors"
        >
          Descargar PNG
        </button>
        <button
          type="button"
          onClick={() => download("svg")}
          className="rounded-full border border-neutral-300 px-4 py-2 text-xs uppercase tracking-[0.1em] font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          Descargar SVG
        </button>
      </div>
    </div>
  );
}
