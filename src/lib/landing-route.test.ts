import assert from "node:assert/strict";
import { test } from "node:test";

import { hasSessionCookie } from "./landing-route.ts";

test("reconoce la cookie de sesión de Supabase, entera o partida", () => {
  assert.equal(hasSessionCookie(["sb-abc-auth-token"]), true);
  assert.equal(hasSessionCookie(["otra=1", "sb-abc-auth-token.0", "sb-abc-auth-token.1"]), true);
});

test("sin sesión: visitante nuevo u otro tipo de cookie", () => {
  assert.equal(hasSessionCookie([]), false);
  assert.equal(hasSessionCookie(["_ga", "sb-abc-auth-token-code-verifier"]), false);
});
