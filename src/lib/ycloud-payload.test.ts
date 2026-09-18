import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeMessageType,
  readMediaFields,
  readMessageType,
  readPath,
} from "./ycloud-payload.ts";

// Forma real de un evento inbound de YCloud (docs: whatsapp-inbound-message-webhook-examples).
const inbound = (message: Record<string, unknown>) => ({
  type: "whatsapp.inbound_message.received",
  whatsappInboundMessage: {
    from: "34600111222",
    id: "wim123",
    to: "34600999888",
    ...message,
  },
});

describe("readMediaFields", () => {
  it("lee una imagen con pie de foto", () => {
    const fields = readMediaFields(
      inbound({
        image: {
          caption: "¿cuánto cuesta esto?",
          id: "m1",
          link: "https://media.ycloud.test/m1.jpg",
          mime_type: "image/jpeg",
        },
        type: "image",
      }),
    );
    assert.equal(fields.mediaUrl, "https://media.ycloud.test/m1.jpg");
    assert.equal(fields.mediaCaption, "¿cuánto cuesta esto?");
    assert.equal(fields.mediaMimeType, "image/jpeg");
    assert.equal(fields.mediaFilename, null);
    assert.equal(fields.mediaKind, "image");
  });

  it("lee una nota de voz", () => {
    const fields = readMediaFields(
      inbound({ audio: { link: "https://media.ycloud.test/a.ogg", mime_type: "audio/ogg" }, type: "audio" }),
    );
    assert.equal(fields.mediaUrl, "https://media.ycloud.test/a.ogg");
    assert.equal(fields.mediaCaption, null);
  });

  it("lee un documento con nombre de archivo", () => {
    const fields = readMediaFields(
      inbound({
        document: {
          filename: "presupuesto.pdf",
          link: "https://media.ycloud.test/d.pdf",
          mime_type: "application/pdf",
        },
        type: "document",
      }),
    );
    assert.equal(fields.mediaFilename, "presupuesto.pdf");
    assert.equal(fields.mediaUrl, "https://media.ycloud.test/d.pdf");
  });

  it("acepta el mensaje anidado bajo data", () => {
    const fields = readMediaFields({
      data: { whatsappInboundMessage: { image: { link: "https://x/y.jpg" } } },
    });
    assert.equal(fields.mediaUrl, "https://x/y.jpg");
  });

  it("devuelve nulos en un mensaje de texto", () => {
    const fields = readMediaFields(inbound({ text: { body: "hola" }, type: "text" }));
    assert.deepEqual(fields, {
      mediaCaption: null,
      mediaFilename: null,
      mediaKind: null,
      mediaMimeType: null,
      mediaUrl: null,
    });
  });
});

describe("readMessageType", () => {
  // El bug real: `type` en la raiz es el nombre del EVENTO. Mirarlo primero
  // convertia todas las fotos en "event" y el inbox las pintaba como documento.
  it("no confunde el tipo del evento con el tipo del mensaje", () => {
    const payload = inbound({
      image: { link: "https://media.ycloud.test/m1.jpg", mime_type: "image/jpeg" },
      type: "image",
    });
    assert.equal(payload.type, "whatsapp.inbound_message.received");
    assert.equal(readMessageType(payload), "image");
  });

  it("clasifica cada tipo de archivo aunque la raiz diga otra cosa", () => {
    for (const [block, expected] of [
      ["audio", "audio"],
      ["document", "file"],
      ["video", "file"],
      ["sticker", "image"],
    ] as const) {
      const payload = inbound({ [block]: { link: "https://x/y" }, type: block });
      assert.equal(readMessageType(payload), expected, block);
    }
  });

  it("para texto usa el tipo anidado", () => {
    assert.equal(readMessageType(inbound({ text: { body: "hola" }, type: "text" })), "text");
  });

  it("solo cae en la raiz si no hay nada anidado", () => {
    assert.equal(readMessageType({ type: "text" }), "text");
    assert.equal(readMessageType({}), "event");
  });
});

describe("normalizeMessageType", () => {
  it("mapea los tipos de WhatsApp a los que admite la tabla messages", () => {
    // La columna solo acepta text/audio/image/file/event: video y sticker
    // tienen que caer en uno de esos o el insert falla.
    assert.equal(normalizeMessageType("document"), "file");
    assert.equal(normalizeMessageType("video"), "file");
    assert.equal(normalizeMessageType("sticker"), "image");
    assert.equal(normalizeMessageType("IMAGE"), "image");
    assert.equal(normalizeMessageType("location"), "event");
    assert.equal(normalizeMessageType(null), "event");
  });
});

describe("readPath", () => {
  it("devuelve la primera ruta con valor y salta las vacías", () => {
    const value = readPath({ a: { b: "" }, c: { d: "ok" } }, [["a", "b"], ["c", "d"]]);
    assert.equal(value, "ok");
  });
});
