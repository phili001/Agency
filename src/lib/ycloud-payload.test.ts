import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeMessageType,
  readMediaFields,
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
      mediaMimeType: null,
      mediaUrl: null,
    });
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
