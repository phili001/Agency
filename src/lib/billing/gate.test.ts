import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CrmClient } from "../crm/shared.ts";
import { createCrmFake } from "../testing/fake-supabase.ts";
import { blockedWorkspaceIdsOrNone, isWorkspaceBlockedOrNot, notInWorkspaces } from "./gate.ts";

const BLOCKED = "0b9a5b8e-0000-4000-8000-000000000001";
const OK = "0b9a5b8e-0000-4000-8000-000000000002";

function client() {
  return createCrmFake({
    workspace_billing: [
      { billing_exempt: false, cancel_at_period_end: false, current_period_end: null, past_due_since: null, status: "canceled", workspace_id: BLOCKED },
      { billing_exempt: false, cancel_at_period_end: false, current_period_end: null, past_due_since: null, status: "active", workspace_id: OK },
    ],
  }) as unknown as CrmClient;
}

/** Cliente cuya consulta a la base falla. */
const broken = {
  from: () => {
    throw new Error("base caída");
  },
} as unknown as CrmClient;

describe("corte por impago", () => {
  it("bloquea solo a la empresa impagada", async () => {
    assert.deepEqual(await blockedWorkspaceIdsOrNone(client()), [BLOCKED]);
    assert.equal(await isWorkspaceBlockedOrNot(client(), BLOCKED), true);
    assert.equal(await isWorkspaceBlockedOrNot(client(), OK), false);
  });

  it("si la facturación no se puede leer, no corta a nadie", async () => {
    const original = console.error;
    console.error = () => {};
    try {
      assert.deepEqual(await blockedWorkspaceIdsOrNone(broken), []);
      assert.equal(await isWorkspaceBlockedOrNot(broken, BLOCKED), false);
    } finally {
      console.error = original;
    }
  });

  it("arma el filtro de PostgREST solo con ids válidos", () => {
    assert.equal(notInWorkspaces([]), null);
    assert.equal(notInWorkspaces([BLOCKED, OK]), `(${BLOCKED},${OK})`);
    assert.equal(notInWorkspaces(["x),workspace_id.eq.(y", BLOCKED]), `(${BLOCKED})`);
  });
});
