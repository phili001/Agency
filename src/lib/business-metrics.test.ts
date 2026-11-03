import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getBusinessMetrics } from "./business-metrics.ts";
import { createCrmFake } from "./testing/fake-supabase.ts";

const A = "workspace-a";
const B = "workspace-b";

function iso(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

describe("getBusinessMetrics", () => {
  it("cuenta las citas de la Agenda de la empresa en la ventana, sin canceladas ni otras empresas", async () => {
    const fake = createCrmFake({
      appointments: [
        { created_at: iso(1), id: "a1", status: "scheduled", workspace_id: A },
        { created_at: iso(2), id: "a2", status: "completed", workspace_id: A },
        { created_at: iso(1), id: "a3", status: "cancelled", workspace_id: A },
        { created_at: iso(20), id: "a4", status: "scheduled", workspace_id: A },
        { created_at: iso(1), id: "b1", status: "scheduled", workspace_id: B },
      ],
      contacts: [{ id: "c1", metadata: { ghl_appointment_id: "x" }, workspace_id: A }],
      conversations: [],
      messages: [],
    });

    const metrics = await getBusinessMetrics(fake as unknown as SupabaseClient, A);

    assert.equal(metrics.appointmentsBooked, 2);
    assert.equal((await getBusinessMetrics(fake as unknown as SupabaseClient, B)).appointmentsBooked, 1);
  });
});
