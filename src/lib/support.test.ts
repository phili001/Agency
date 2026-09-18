import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSupportLink, buildSupportMessage, SUPPORT_PHONE_E164 } from "./support.ts";

describe("contacto de soporte", () => {
  it("pide una persona y dice el paso para que quede en el resumen", () => {
    const message = buildSupportMessage({
      companyName: "Clínica Norte",
      stepIndex: 4,
      stepTitle: "Tu WhatsApp",
    });
    assert.match(message, /hablar con una persona/);
    assert.match(message, /paso 4 \(Tu WhatsApp\)/);
    assert.match(message, /Clínica Norte/);
  });

  it("en la bienvenida no inventa un número de paso", () => {
    const message = buildSupportMessage({
      companyName: "X",
      stepIndex: 0,
      stepTitle: "Bienvenida",
    });
    assert.match(message, /pantalla "Bienvenida"/);
    assert.doesNotMatch(message, /paso 0/);
  });

  it("arma el enlace de WhatsApp con el número sin símbolos", () => {
    const link = buildSupportLink("hola mundo");
    assert.equal(SUPPORT_PHONE_E164, "+34640102897");
    assert.ok(link.startsWith("https://wa.me/34640102897?text=hola%20mundo"));
  });
});
