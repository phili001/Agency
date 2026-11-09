import assert from "node:assert/strict";
import { test } from "node:test";

import { OFFLINE_ERROR, clientFetch } from "./client-fetch.ts";

test("clientFetch convierte un fallo de red en una respuesta 503 con error", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  try {
    const response = await clientFetch("/api/x");
    assert.equal(response.ok, false);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: OFFLINE_ERROR });
  } finally {
    globalThis.fetch = original;
  }
});

test("clientFetch deja pasar una cancelación", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new DOMException("cancelado", "AbortError");
  };
  try {
    await assert.rejects(clientFetch("/api/x"), { name: "AbortError" });
  } finally {
    globalThis.fetch = original;
  }
});
