/**
 * Lectura pura del payload de YCloud. Vive aparte del webhook para poder
 * probarla sin arrastrar `next/server` ni Supabase.
 */

export type YCloudMessageType = "text" | "audio" | "image" | "file" | "event";

export type YCloudMediaKind = "audio" | "document" | "image" | "sticker" | "video";

export type YCloudMediaFields = {
  mediaCaption: string | null;
  mediaFilename: string | null;
  /** Bloque de WhatsApp donde venia el archivo (image, audio, document...). */
  mediaKind: YCloudMediaKind | null;
  mediaMimeType: string | null;
  mediaUrl: string | null;
};

export function readPath(value: unknown, paths: string[][]) {
  for (const path of paths) {
    let current = value;

    for (const key of path) {
      if (!current || typeof current !== "object" || !(key in current)) {
        current = undefined;
        break;
      }

      current = (current as Record<string, unknown>)[key];
    }

    if (current !== undefined && current !== null && current !== "") {
      return String(current);
    }
  }

  return null;
}

export function normalizeMessageType(value: string | null): YCloudMessageType {
  switch (value?.toLowerCase()) {
    case "audio":
    case "image":
    case "file":
    case "text":
      return value.toLowerCase() as YCloudMessageType;
    case "document":
    case "video":
      return "file";
    case "sticker":
      return "image";
    default:
      return "event";
  }
}

const MEDIA_KINDS = ["image", "audio", "document", "video", "sticker"] as const;
const MESSAGE_WRAPPERS: string[][] = [
  [],
  ["whatsappInboundMessage"],
  ["whatsappMessage"],
  ["message"],
  ["data"],
  ["data", "message"],
  ["data", "whatsappInboundMessage"],
  ["data", "whatsappMessage"],
];

/**
 * YCloud manda el archivo en `<tipo>.link` (image, audio, document, video,
 * sticker). El link es publico solo unos minutos; despues exige la API key
 * durante 30 dias, por eso el inbox lo sirve a traves de /api/media.
 */
export function readMediaFields(payload: Record<string, unknown>): YCloudMediaFields {
  for (const kind of MEDIA_KINDS) {
    const link = readPath(
      payload,
      MESSAGE_WRAPPERS.map((wrapper) => [...wrapper, kind, "link"]),
    );

    if (!link) {
      continue;
    }

    const field = (name: string) =>
      readPath(payload, MESSAGE_WRAPPERS.map((wrapper) => [...wrapper, kind, name]));

    return {
      mediaCaption: field("caption"),
      mediaFilename: field("filename"),
      mediaKind: kind,
      mediaMimeType: field("mime_type") ?? field("mimeType"),
      mediaUrl: link,
    };
  }

  return {
    mediaCaption: null,
    mediaFilename: null,
    mediaKind: null,
    mediaMimeType: null,
    mediaUrl: null,
  };
}

/**
 * Tipo del MENSAJE, no del evento. YCloud pone `type: "whatsapp.inbound_message.received"`
 * en la raiz y el tipo real dentro (`whatsappInboundMessage.type: "image"`).
 * Mirar la raiz primero convertia todas las fotos y audios en "event".
 * Si hay archivo, su bloque manda; la raiz solo se consulta al final.
 */
export function readMessageType(
  payload: Record<string, unknown>,
  media: YCloudMediaFields = readMediaFields(payload),
): YCloudMessageType {
  if (media.mediaKind) {
    return normalizeMessageType(media.mediaKind);
  }

  return normalizeMessageType(
    readPath(payload, [
      ...MESSAGE_WRAPPERS.filter((wrapper) => wrapper.length > 0).map((wrapper) => [
        ...wrapper,
        "type",
      ]),
      ["data", "object", "messages", "0", "type"],
      ["type"],
    ]),
  );
}
