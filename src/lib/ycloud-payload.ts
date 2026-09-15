/**
 * Lectura pura del payload de YCloud. Vive aparte del webhook para poder
 * probarla sin arrastrar `next/server` ni Supabase.
 */

export type YCloudMessageType = "text" | "audio" | "image" | "file" | "event";

export type YCloudMediaFields = {
  mediaCaption: string | null;
  mediaFilename: string | null;
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
      mediaMimeType: field("mime_type") ?? field("mimeType"),
      mediaUrl: link,
    };
  }

  return {
    mediaCaption: null,
    mediaFilename: null,
    mediaMimeType: null,
    mediaUrl: null,
  };
}
