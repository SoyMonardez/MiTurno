import {
  Brush,
  Camera,
  Car,
  Coffee,
  Dumbbell,
  Flower2,
  GraduationCap,
  Hand,
  HeartPulse,
  PawPrint,
  Scale,
  Scissors,
  Smile,
  Sparkles,
  Stethoscope,
  Store,
  Wrench,
} from "lucide-react";

// Catálogo de íconos elegibles por cada negocio.
// La clave se guarda en negocio.icono; el label se muestra en el selector.
export const ICONOS = {
  scissors: { label: "Peluquería / Barbería", Icon: Scissors },
  brush: { label: "Estética / Maquillaje", Icon: Brush },
  hand: { label: "Manicura / Uñas", Icon: Hand },
  sparkles: { label: "Belleza", Icon: Sparkles },
  flower: { label: "Spa / Masajes", Icon: Flower2 },
  car: { label: "Lavadero / Automotor", Icon: Car },
  wrench: { label: "Taller / Mecánica", Icon: Wrench },
  dumbbell: { label: "Gimnasio / Coach", Icon: Dumbbell },
  stethoscope: { label: "Médico / Salud", Icon: Stethoscope },
  heart: { label: "Kinesiología / Bienestar", Icon: HeartPulse },
  smile: { label: "Dentista / Odontología", Icon: Smile },
  paw: { label: "Veterinaria / Mascotas", Icon: PawPrint },
  scale: { label: "Abogado / Estudio", Icon: Scale },
  graduation: { label: "Clases / Educación", Icon: GraduationCap },
  camera: { label: "Fotografía", Icon: Camera },
  coffee: { label: "Gastronomía", Icon: Coffee },
  store: { label: "Genérico / Comercio", Icon: Store },
};

export const ICONO_DEFAULT = "scissors";

export function getIcono(clave) {
  return (ICONOS[clave] ?? ICONOS[ICONO_DEFAULT]).Icon;
}

/** Renderiza el ícono del negocio (con fallback). */
export function IconoNegocio({ clave, ...props }) {
  const Icon = getIcono(clave);
  return <Icon {...props} />;
}
