import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildWelcomeLink,
  hasPaidTag,
  parsePurchasePayload,
  resolveCompanyName,
} from "./levy-purchase.ts";

describe("webhook de compra de GHL", () => {
  it("lee los datos de customData, que es donde los pone el workflow", () => {
    const payload = parsePurchasePayload({
      contact_id: "raiz",
      customData: {
        companyName: "Clínica Norte",
        email: "Ana@Correo.com",
        firstName: "Ana",
        ghlContactId: "abc123",
        phone: "+573001234567",
      },
      email: "otro@correo.com",
    });

    assert.deepEqual(payload, {
      companyName: "Clínica Norte",
      email: "ana@correo.com",
      firstName: "Ana",
      ghlContactId: "abc123",
      phone: "+573001234567",
    });
  });

  it("si falta customData usa los datos estándar del contacto", () => {
    const payload = parsePurchasePayload({
      contact_id: "c1",
      email: "luis@correo.com",
      first_name: "Luis",
    });

    assert.equal(payload.ghlContactId, "c1");
    assert.equal(payload.email, "luis@correo.com");
    assert.equal(payload.firstName, "Luis");
    assert.equal(payload.companyName, null);
  });

  it("ignora los merge tags que GHL deja sin rellenar", () => {
    const payload = parsePurchasePayload({
      customData: { companyName: "{{contact.nombre_del_negocio}}", ghlContactId: "c1" },
    });

    assert.equal(payload.companyName, null);
  });

  it("no revienta con cuerpos raros", () => {
    assert.equal(parsePurchasePayload(null).email, null);
    assert.equal(parsePurchasePayload("texto").ghlContactId, null);
  });
});

describe("etiqueta de pago", () => {
  it("reconoce cliente-levy sin importar mayúsculas", () => {
    assert.equal(hasPaidTag(["lead", "Cliente-Levy"]), true);
  });

  it("sin la etiqueta no hay pago", () => {
    assert.equal(hasPaidTag(["cliente-levy-antiguo"]), false);
    assert.equal(hasPaidTag(undefined), false);
  });
});

describe("nombre de la empresa", () => {
  it("usa el del formulario", () => {
    assert.equal(
      resolveCompanyName({ companyName: " Clínica Norte ", email: "a@b.com", firstName: "Ana" }),
      "Clínica Norte",
    );
  });

  it("sin formulario pone uno provisional con el nombre o el correo", () => {
    assert.equal(
      resolveCompanyName({ companyName: null, email: "a@b.com", firstName: "Ana" }),
      "Negocio de Ana",
    );
    assert.equal(
      resolveCompanyName({ companyName: "", email: "luis@b.com", firstName: null }),
      "Negocio de luis",
    );
  });
});

describe("enlace de bienvenida", () => {
  it("apunta a /auth/confirm y vuelve a crear la contraseña", () => {
    const link = new URL(buildWelcomeLink("https://agentelevi.com/", "hash123"));

    assert.equal(link.origin + link.pathname, "https://agentelevi.com/auth/confirm");
    assert.equal(link.searchParams.get("token_hash"), "hash123");
    assert.equal(link.searchParams.get("type"), "recovery");
    assert.equal(link.searchParams.get("next"), "/reset-password?bienvenida=1");
  });
});
