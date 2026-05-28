import { ImagePlus, Loader2, UploadCloud, X } from "lucide-react";
import { useRef, useState } from "react";
import { apiUpload } from "../api/client.js";

/**
 * Subida de imagen con drag & drop o selección de archivo.
 * Props:
 *  - value: URL actual (o vacío)
 *  - onChange: (url) => void
 *  - onError: (err) => void
 *  - alto: clase de alto del preview (opcional)
 */
export default function ImageUploader({ value, onChange, onError, alto = "h-40" }) {
  const inputRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);

  async function subir(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError?.(new Error("El archivo debe ser una imagen."));
      return;
    }
    setSubiendo(true);
    try {
      const res = await apiUpload("/admin/upload", file);
      onChange(res.url);
    } catch (err) {
      onError?.(err);
      alert(err.message);
    } finally {
      setSubiendo(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setArrastrando(false);
    const file = e.dataTransfer.files?.[0];
    subir(file);
  }

  if (value) {
    return (
      <div className={`relative ${alto} w-full overflow-hidden rounded-2xl border border-neutral-200 group`}>
        <img src={value} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="bg-white/90 text-neutral-800 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-white"
          >
            Cambiar
          </button>
          <button
            type="button"
            onClick={() => onChange("")}
            className="bg-white/90 text-red-600 rounded-full w-8 h-8 flex items-center justify-center hover:bg-white"
            aria-label="Quitar imagen"
          >
            <X size={15} />
          </button>
        </div>
        {subiendo && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-neutral-700" />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => subir(e.target.files?.[0])}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={onDrop}
      className={`${alto} w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors ${
        arrastrando
          ? "border-neutral-900 bg-neutral-50"
          : "border-neutral-300 hover:border-neutral-500 bg-neutral-50/50"
      }`}
    >
      {subiendo ? (
        <>
          <Loader2 size={24} className="animate-spin text-neutral-500" />
          <span className="text-xs text-neutral-500">Subiendo…</span>
        </>
      ) : (
        <>
          <div className="w-11 h-11 rounded-full bg-neutral-100 flex items-center justify-center">
            {arrastrando ? (
              <UploadCloud size={20} className="text-neutral-700" />
            ) : (
              <ImagePlus size={20} className="text-neutral-500" />
            )}
          </div>
          <span className="text-sm text-neutral-700 font-medium">
            {arrastrando ? "Soltá la imagen" : "Arrastrá una imagen o hacé clic"}
          </span>
          <span className="text-xs text-neutral-400">JPG, PNG, WEBP · máx. 5 MB</span>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => subir(e.target.files?.[0])}
      />
    </button>
  );
}
