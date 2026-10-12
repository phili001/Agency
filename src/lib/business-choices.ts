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

export type CountryTimeZone = {
  key: string;
  /** Nombre en cristiano: "Península y Baleares", no "Europe/Madrid". */
  label: string;
};

export type Country = {
  cities: string[];
  key: string;
  label: string;
  /** La primera es la que se usa por defecto. */
  timezones: CountryTimeZone[];
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
    timezones: [
      { key: "Europe/Madrid", label: "Península y Baleares" },
      { key: "Atlantic/Canary", label: "Canarias" },
    ],
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
    timezones: [{ key: "America/Bogota", label: "Hora de Colombia" }],
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
    timezones: [
      { key: "America/Mexico_City", label: "Centro (CDMX, Guadalajara, Monterrey)" },
      { key: "America/Cancun", label: "Sureste (Cancún, Quintana Roo)" },
      { key: "America/Mazatlan", label: "Pacífico (Mazatlán, La Paz)" },
      { key: "America/Hermosillo", label: "Sonora (Hermosillo)" },
      { key: "America/Tijuana", label: "Noroeste (Tijuana, Baja California)" },
    ],
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
    timezones: [{ key: "America/Argentina/Buenos_Aires", label: "Hora de Argentina" }],
  },
  {
    cities: ["Santiago", "Valparaíso", "Viña del Mar", "Concepción", "Antofagasta", "Temuco"],
    key: "CL",
    label: "Chile",
    timezones: [
      { key: "America/Santiago", label: "Chile continental" },
      { key: "America/Punta_Arenas", label: "Magallanes" },
      { key: "Pacific/Easter", label: "Isla de Pascua" },
    ],
  },
  {
    cities: ["Lima", "Arequipa", "Trujillo", "Cusco", "Piura", "Chiclayo"],
    key: "PE",
    label: "Perú",
    timezones: [{ key: "America/Lima", label: "Hora de Perú" }],
  },
  {
    cities: ["Quito", "Guayaquil", "Cuenca", "Ambato", "Manta"],
    key: "EC",
    label: "Ecuador",
    timezones: [
      { key: "America/Guayaquil", label: "Ecuador continental" },
      { key: "Pacific/Galapagos", label: "Galápagos" },
    ],
  },
  {
    cities: ["Ciudad de Panamá", "San Miguelito", "David"],
    key: "PA",
    label: "Panamá",
    timezones: [{ key: "America/Panama", label: "Hora de Panamá" }],
  },
  {
    cities: ["Montevideo", "Salto", "Punta del Este"],
    key: "UY",
    label: "Uruguay",
    timezones: [{ key: "America/Montevideo", label: "Hora de Uruguay" }],
  },
  {
    cities: ["Miami", "Nueva York", "Los Ángeles", "Houston", "Chicago"],
    key: "US",
    label: "Estados Unidos",
    timezones: [
      { key: "America/New_York", label: "Este (Nueva York, Miami)" },
      { key: "America/Chicago", label: "Centro (Chicago, Houston)" },
      { key: "America/Denver", label: "Montaña (Denver)" },
      { key: "America/Phoenix", label: "Arizona" },
      { key: "America/Los_Angeles", label: "Pacífico (Los Ángeles)" },
    ],
  },
  { cities: [], key: "other", label: "Otro país", timezones: [] },
];

/** Un local, consulta o zona de trabajo. Un negocio puede tener varios. */
export type BusinessLocation = {
  city: string;
  /** Solo para la UI: identifica la fila al editar o borrar. */
  id: string;
  street: string;
  venue: string;
};

export type BusinessChoices = {
  attendMode: AttendMode;
  bookingUrl: string;
  closeTime: string;
  country: string;
  days: string[];
  locations: BusinessLocation[];
  openTime: string;
  payments: string[];
  policies: string[];
  sector: string;
  services: string[];
  servicesExtra: string;
  timezone: string;
};

function createId(prefix: string) {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createLocation(): BusinessLocation {
  return { city: "", id: createId("sede"), street: "", venue: "" };
}

/** Locales con ciudad puesta: los vacíos no llegan a los prompts. */
export function getFilledLocations(choices: BusinessChoices) {
  return choices.locations.filter((location) => location.city.trim());
}

/** "Madrid", "Madrid y Barcelona", "Madrid, Barcelona y Valencia". */
export function joinWithAnd(items: string[]) {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function getCountry(key: string) {
  return countries.find((country) => country.key === key) ?? null;
}

export function getSector(key: string) {
  return businessSectors.find((sector) => sector.key === key) ?? null;
}

/** País probable a partir de la zona horaria del navegador: un toque menos. */
export function guessCountryKey(timeZone: string) {
  return (
    countries.find((country) => country.timezones.some((zone) => zone.key === timeZone))?.key ?? ""
  );
}

/**
 * Zona horaria que le toca al negocio: la del navegador si pertenece al país
 * elegido (así un canario no acaba con hora peninsular) y, si no, la primera.
 */
export function getCountryTimeZone(countryKey: string, timeZone: string) {
  const zones = getCountry(countryKey)?.timezones ?? [];

  if (zones.some((zone) => zone.key === timeZone)) {
    return timeZone;
  }

  return zones[0]?.key || timeZone;
}

export function createDefaultChoices(timeZone: string): BusinessChoices {
  const countryKey = guessCountryKey(timeZone);

  return {
    attendMode: "local",
    bookingUrl: "",
    closeTime: "18:00",
    country: countryKey,
    days: ["mon", "tue", "wed", "thu", "fri"],
    locations: [createLocation()],
    openTime: "09:00",
    payments: [],
    policies: [],
    sector: "",
    services: [],
    servicesExtra: "",
    timezone: getCountryTimeZone(countryKey, timeZone),
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
  const locations = Array.isArray(record.locations)
    ? record.locations
        .filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === "object" && !Array.isArray(item),
        )
        .map((item) => ({
          city: asString(item.city),
          id: asString(item.id) || createLocation().id,
          street: asString(item.street),
          venue: asString(item.venue),
        }))
    : // Perfiles guardados antes de admitir varias sedes: traen una suelta.
      [
        {
          ...createLocation(),
          city: asString(record.city),
          street: asString(record.street),
          venue: asString(record.venue),
        },
      ];

  return {
    attendMode,
    bookingUrl: asString(record.bookingUrl),
    closeTime: asString(record.closeTime) || defaults.closeTime,
    country: asString(record.country) || defaults.country,
    days: days.length > 0 ? days : defaults.days,
    locations: locations.length > 0 ? locations : defaults.locations,
    openTime: asString(record.openTime) || defaults.openTime,
    payments: asStringArray(record.payments),
    policies: asStringArray(record.policies),
    sector: asString(record.sector),
    services: asStringArray(record.services),
    servicesExtra: asString(record.servicesExtra),
    timezone: asString(record.timezone) || defaults.timezone,
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

  const cities = [
    ...new Set(getFilledLocations(choices).map((location) => location.city.trim())),
  ];

  if (cities.length === 0) {
    return "";
  }

  if (choices.attendMode === "domicilio") {
    return cities.length > 1
      ? `${cities.join(", ")} y sus alrededores (vamos donde el cliente)`
      : `${cities[0]} y alrededores (vamos donde el cliente)`;
  }

  return cities.length > 1
    ? `${cities.length} sedes: ${joinWithAnd(cities)}`
    : cities[0];
}

export function buildAddressText(choices: BusinessChoices) {
  if (choices.attendMode === "online") {
    return "";
  }

  const locations = getFilledLocations(choices).filter((location) =>
    location.street.trim(),
  );

  if (locations.length === 0) {
    return "";
  }

  // Con varias sedes, cada una lleva nombre y ciudad para que el agente
  // pueda decir a cuál tiene que ir el cliente.
  return locations
    .map((location) => {
      const street = location.street.trim();
      const venue = location.venue.trim();
      const city = location.city.trim();

      if (locations.length === 1) {
        return [venue, street].filter(Boolean).join(", ");
      }

      return `${venue || city}: ${street}${venue && city ? ` (${city})` : ""}`;
    })
    .join("; ");
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
