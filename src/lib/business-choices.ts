/**
 * Catálogo de opciones del onboarding. La idea: que el dueño del negocio
 * toque botones en vez de redactar. Todo lo que elige se convierte aquí en el
 * texto que leen los agentes (los mismos campos de businessProfileFields).
 */
import type { Json } from "@/lib/supabase/database.types";

export type BusinessSector = {
  key: string;
  label: string;
  /** Servicios típicos del sector: salen como botones para marcar. */
  services: string[];
};

export const businessSectors: BusinessSector[] = [
  {
    key: "dental",
    label: "Clínica dental",
    services: [
      "Limpieza dental",
      "Revisión y diagnóstico",
      "Blanqueamiento",
      "Ortodoncia",
      "Implantes",
      "Endodoncia",
      "Odontopediatría",
      "Urgencias dentales",
    ],
  },
  {
    key: "salud",
    label: "Salud y bienestar",
    services: [
      "Primera consulta",
      "Consulta de seguimiento",
      "Fisioterapia",
      "Nutrición",
      "Psicología",
      "Masajes terapéuticos",
      "Pruebas diagnósticas",
      "Urgencias",
    ],
  },
  {
    key: "belleza",
    label: "Belleza y estética",
    services: [
      "Corte de pelo",
      "Color y mechas",
      "Peinado",
      "Manicura y pedicura",
      "Depilación",
      "Tratamientos faciales",
      "Maquillaje",
      "Pestañas y cejas",
    ],
  },
  {
    key: "fitness",
    label: "Gimnasio y entrenamiento",
    services: [
      "Cuota mensual",
      "Clase de prueba",
      "Entrenamiento personal",
      "Clases dirigidas",
      "Pilates o yoga",
      "Asesoría nutricional",
      "Bono de sesiones",
    ],
  },
  {
    key: "restaurante",
    label: "Restaurante o comida",
    services: [
      "Reserva de mesa",
      "Menú del día",
      "Carta",
      "Pedidos a domicilio",
      "Recoger en local",
      "Eventos y grupos",
      "Catering",
    ],
  },
  {
    key: "tienda",
    label: "Tienda o comercio",
    services: [
      "Venta en tienda",
      "Venta online",
      "Envíos a domicilio",
      "Recogida en tienda",
      "Reparaciones",
      "Garantías y cambios",
      "Pedidos por encargo",
    ],
  },
  {
    key: "inmobiliaria",
    label: "Inmobiliaria",
    services: [
      "Venta de inmuebles",
      "Alquiler",
      "Visitas a propiedades",
      "Valoración gratuita",
      "Gestión de alquileres",
      "Asesoría hipotecaria",
    ],
  },
  {
    key: "educacion",
    label: "Academia o formación",
    services: [
      "Clases presenciales",
      "Clases online",
      "Clases particulares",
      "Cursos intensivos",
      "Preparación de exámenes",
      "Clase de prueba gratis",
      "Matrícula",
    ],
  },
  {
    key: "hogar",
    label: "Servicios para el hogar",
    services: [
      "Presupuesto sin compromiso",
      "Reparaciones",
      "Instalaciones",
      "Mantenimiento",
      "Urgencias 24 h",
      "Limpieza",
      "Reformas",
    ],
  },
  {
    key: "profesional",
    label: "Servicios profesionales",
    services: [
      "Primera consulta",
      "Asesoría mensual",
      "Gestoría y trámites",
      "Contabilidad",
      "Asesoría legal",
      "Consultoría por proyecto",
    ],
  },
  {
    key: "automocion",
    label: "Taller o automoción",
    services: [
      "Cita para revisión",
      "Cambio de aceite",
      "Neumáticos",
      "Chapa y pintura",
      "Pre-ITV",
      "Diagnóstico electrónico",
      "Grúa y asistencia",
    ],
  },
  { key: "otro", label: "Otro tipo de negocio", services: [] },
];

export const weekdays = [
  { key: "mon", label: "Lun", long: "Lunes" },
  { key: "tue", label: "Mar", long: "Martes" },
  { key: "wed", label: "Mié", long: "Miércoles" },
  { key: "thu", label: "Jue", long: "Jueves" },
  { key: "fri", label: "Vie", long: "Viernes" },
  { key: "sat", label: "Sáb", long: "Sábado" },
  { key: "sun", label: "Dom", long: "Domingo" },
] as const;

export type WeekdayKey = (typeof weekdays)[number]["key"];

export const weekdayPresets = [
  { days: ["mon", "tue", "wed", "thu", "fri"], label: "Lunes a viernes" },
  { days: ["mon", "tue", "wed", "thu", "fri", "sat"], label: "Lunes a sábado" },
  { days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], label: "Todos los días" },
] as const;

/** Horas en saltos de media hora: evita escribir y evita formatos raros. */
export function getTimeOptions() {
  const options: string[] = [];

  for (let hour = 6; hour <= 23; hour += 1) {
    options.push(`${String(hour).padStart(2, "0")}:00`);
    options.push(`${String(hour).padStart(2, "0")}:30`);
  }

  return options;
}

export const paymentOptions = [
  "Efectivo",
  "Tarjeta",
  "Transferencia",
  "Bizum",
  "PayPal",
  "Pago a plazos",
  "Seguro médico",
];

export const policyOptions = [
  "Cancelar o cambiar con 24 h de antelación",
  "Llegar 10 minutos antes de la cita",
  "La reserva se confirma con un anticipo",
  "Primera consulta sin coste",
  "Presupuesto sin compromiso",
  "Devoluciones hasta 14 días",
  "Atendemos solo con cita previa",
];

export type AttendMode = "local" | "domicilio" | "online";

export const attendModes: Array<{
  description: string;
  key: AttendMode;
  label: string;
}> = [
  {
    description: "Los clientes vienen a tu local, consulta o tienda.",
    key: "local",
    label: "En mi local",
  },
  {
    description: "Te desplazas tú: a domicilio, obra u oficina del cliente.",
    key: "domicilio",
    label: "Voy donde el cliente",
  },
  {
    description: "Todo a distancia: videollamada, teléfono o envíos.",
    key: "online",
    label: "Solo online",
  },
];

export type Country = {
  cities: string[];
  key: string;
  label: string;
  timezone: string;
};

export const countries: Country[] = [
  {
    cities: [
      "Madrid",
      "Barcelona",
      "Valencia",
      "Sevilla",
      "Zaragoza",
      "Málaga",
      "Murcia",
      "Palma",
      "Las Palmas de Gran Canaria",
      "Bilbao",
      "Alicante",
      "Córdoba",
      "Valladolid",
      "Vigo",
      "Granada",
    ],
    key: "ES",
    label: "España",
    timezone: "Europe/Madrid",
  },
  {
    cities: [
      "Bogotá",
      "Medellín",
      "Cali",
      "Barranquilla",
      "Cartagena",
      "Bucaramanga",
      "Pereira",
      "Manizales",
      "Santa Marta",
      "Cúcuta",
      "Ibagué",
      "Villavicencio",
    ],
    key: "CO",
    label: "Colombia",
    timezone: "America/Bogota",
  },
  {
    cities: [
      "Ciudad de México",
      "Guadalajara",
      "Monterrey",
      "Puebla",
      "Tijuana",
      "Querétaro",
      "Mérida",
      "Cancún",
      "León",
      "Toluca",
    ],
    key: "MX",
    label: "México",
    timezone: "America/Mexico_City",
  },
  {
    cities: [
      "Buenos Aires",
      "Córdoba",
      "Rosario",
      "Mendoza",
      "La Plata",
      "Mar del Plata",
      "Salta",
      "Tucumán",
    ],
    key: "AR",
    label: "Argentina",
    timezone: "America/Argentina/Buenos_Aires",
  },
  {
    cities: ["Santiago", "Valparaíso", "Viña del Mar", "Concepción", "Antofagasta", "Temuco"],
    key: "CL",
    label: "Chile",
    timezone: "America/Santiago",
  },
  {
    cities: ["Lima", "Arequipa", "Trujillo", "Cusco", "Piura", "Chiclayo"],
    key: "PE",
    label: "Perú",
    timezone: "America/Lima",
  },
  {
    cities: ["Quito", "Guayaquil", "Cuenca", "Ambato", "Manta"],
    key: "EC",
    label: "Ecuador",
    timezone: "America/Guayaquil",
  },
  {
    cities: ["Ciudad de Panamá", "San Miguelito", "David"],
    key: "PA",
    label: "Panamá",
    timezone: "America/Panama",
  },
  {
    cities: ["Montevideo", "Salto", "Punta del Este"],
    key: "UY",
    label: "Uruguay",
    timezone: "America/Montevideo",
  },
  {
    cities: ["Miami", "Nueva York", "Los Ángeles", "Houston", "Chicago"],
    key: "US",
    label: "Estados Unidos",
    timezone: "America/New_York",
  },
  { cities: [], key: "other", label: "Otro país", timezone: "" },
];

export type BusinessChoices = {
  attendMode: AttendMode;
  bookingUrl: string;
  city: string;
  closeTime: string;
  country: string;
  days: string[];
  openTime: string;
  payments: string[];
  policies: string[];
  sector: string;
  services: string[];
  servicesExtra: string;
  street: string;
  timezone: string;
  venue: string;
};

export function getCountry(key: string) {
  return countries.find((country) => country.key === key) ?? null;
}

export function getSector(key: string) {
  return businessSectors.find((sector) => sector.key === key) ?? null;
}

/** País probable a partir de la zona horaria del navegador: un toque menos. */
export function guessCountryKey(timeZone: string) {
  return countries.find((country) => country.timezone && country.timezone === timeZone)?.key ?? "";
}

export function createDefaultChoices(timeZone: string): BusinessChoices {
  const countryKey = guessCountryKey(timeZone);

  return {
    attendMode: "local",
    bookingUrl: "",
    city: "",
    closeTime: "18:00",
    country: countryKey,
    days: ["mon", "tue", "wed", "thu", "fri"],
    openTime: "09:00",
    payments: [],
    policies: [],
    sector: "",
    services: [],
    servicesExtra: "",
    street: "",
    timezone: getCountry(countryKey)?.timezone || timeZone,
    venue: "",
  };
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

/** Lee las elecciones guardadas; lo que falte se completa con los valores por defecto. */
export function getBusinessChoices(
  value: Json | null | undefined,
  timeZone: string,
): BusinessChoices {
  const defaults = createDefaultChoices(timeZone);

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const record = value as Record<string, unknown>;
  const days = asStringArray(record.days).filter((day) =>
    weekdays.some((weekday) => weekday.key === day),
  );
  const attendMode = attendModes.some((mode) => mode.key === record.attendMode)
    ? (record.attendMode as AttendMode)
    : defaults.attendMode;

  return {
    attendMode,
    bookingUrl: asString(record.bookingUrl),
    city: asString(record.city),
    closeTime: asString(record.closeTime) || defaults.closeTime,
    country: asString(record.country) || defaults.country,
    days: days.length > 0 ? days : defaults.days,
    openTime: asString(record.openTime) || defaults.openTime,
    payments: asStringArray(record.payments),
    policies: asStringArray(record.policies),
    sector: asString(record.sector),
    services: asStringArray(record.services),
    servicesExtra: asString(record.servicesExtra),
    street: asString(record.street),
    timezone: asString(record.timezone) || defaults.timezone,
    venue: asString(record.venue),
  };
}

/** "Lunes a viernes", "Lunes, miércoles y viernes", "Sábado y domingo". */
export function buildDaysText(days: string[]) {
  const ordered = weekdays.filter((weekday) => days.includes(weekday.key));

  if (ordered.length === 0) {
    return "";
  }

  if (ordered.length === weekdays.length) {
    return "Todos los días";
  }

  const groups: Array<typeof ordered> = [];

  for (const weekday of ordered) {
    const lastGroup = groups[groups.length - 1];
    const previousIndex = weekdays.findIndex(
      (item) => item.key === lastGroup?.[lastGroup.length - 1]?.key,
    );
    const currentIndex = weekdays.findIndex((item) => item.key === weekday.key);

    if (lastGroup && currentIndex === previousIndex + 1) {
      lastGroup.push(weekday);
    } else {
      groups.push([weekday]);
    }
  }

  const parts = groups.map((group) => {
    if (group.length >= 3) {
      return `${group[0].long} a ${group[group.length - 1].long.toLowerCase()}`;
    }

    return group.length === 2
      ? `${group[0].long} y ${group[1].long.toLowerCase()}`
      : group[0].long;
  });

  // Solo el primer tramo va en mayúscula: "Lunes a viernes, sábado y domingo".
  const [first, ...rest] = parts;
  const lowered = rest.map((part) => `${part.charAt(0).toLowerCase()}${part.slice(1)}`);

  if (lowered.length === 0) {
    return first;
  }

  return `${[first, ...lowered.slice(0, -1)].join(", ")} y ${lowered[lowered.length - 1]}`;
}

export function buildHoursText(choices: Pick<BusinessChoices, "closeTime" | "days" | "openTime">) {
  const daysText = buildDaysText(choices.days);

  if (!daysText) {
    return "";
  }

  return `${daysText} de ${choices.openTime} a ${choices.closeTime}`;
}

export function buildServicesText(
  choices: Pick<BusinessChoices, "services" | "servicesExtra">,
) {
  return [...choices.services, ...choices.servicesExtra.split(",")]
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

export function buildLocationText(choices: BusinessChoices) {
  if (choices.attendMode === "online") {
    return "Atención online, sin local físico";
  }

  if (!choices.city.trim()) {
    return "";
  }

  return choices.attendMode === "domicilio"
    ? `${choices.city.trim()} y alrededores (vamos donde el cliente)`
    : choices.city.trim();
}

export function buildAddressText(choices: BusinessChoices) {
  if (choices.attendMode === "online") {
    return "";
  }

  return [choices.venue.trim(), choices.street.trim()].filter(Boolean).join(", ");
}

/**
 * Convierte las elecciones en los campos de texto que ya usan los prompts.
 * Lo que el wizard no gestiona (equipo, campos sueltos) se mantiene igual.
 */
export function buildFieldsFromChoices(
  choices: BusinessChoices,
  current: Record<string, string>,
): Record<string, string> {
  const sector = getSector(choices.sector);
  const country = getCountry(choices.country);

  return {
    ...current,
    address: buildAddressText(choices),
    booking_url: choices.bookingUrl.trim(),
    business_hours: buildHoursText(choices),
    business_type: sector && sector.key !== "otro" ? sector.label : "",
    country: country && country.key !== "other" ? country.label : current.country ?? "",
    location: buildLocationText(choices),
    payment_methods: choices.payments.join(", "),
    policies: choices.policies.join(". "),
    services: buildServicesText(choices),
    timezone: choices.timezone,
  };
}
