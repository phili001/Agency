import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { translateAuthError } from "./auth-messages.ts";
import { normalizeAppUrl } from "./app-url.ts";

describe("translateAuthError", () => {
  it("traduce el error real de credenciales de Supabase", () => {
    assert.equal(
      translateAuthError("Invalid login credentials"),
      "El email o la contraseña no son correctos.",
    );
  });

  it("traduce el límite de intentos", () => {
    assert.match(translateAuthError("Email rate limit exceeded"), /Demasiados intentos/);
  });

  it("nunca devuelve el texto crudo del proveedor", () => {
    const raw = "PostgrestException: relation auth.users does not exist";
    const translated = translateAuthError(raw);
    assert.notEqual(translated, raw);
    assert.doesNotMatch(translated, /Postgrest|auth\.users/);
  });

  it("responde algo útil sin mensaje", () => {
    assert.ok(translateAuthError(null).length > 0);
    assert.ok(translateAuthError("").length > 0);
  });
});

describe("normalizeAppUrl", () => {
  it("añade el protocolo y quita la barra final", () => {
    assert.equal(normalizeAppUrl("ejemplo.com/"), "https://ejemplo.com");
  });

  it("respeta un dominio propio ya completo", () => {
    assert.equal(normalizeAppUrl("https://app.cliente.com"), "https://app.cliente.com");
  });

  it("cae en la URL canónica si no hay valor", () => {
    assert.match(normalizeAppUrl(undefined), /^https:\/\//);
    assert.match(normalizeAppUrl("   "), /^https:\/\//);
  });

  it("ignora las URLs de preview de Vercel", () => {
    const canonical = normalizeAppUrl(undefined);
    assert.equal(normalizeAppUrl("https://algo-abc123.vercel.app"), canonical);
  });
});
