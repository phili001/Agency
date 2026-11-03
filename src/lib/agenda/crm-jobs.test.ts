import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import type { CrmClient } from "../crm/shared.ts";
import { createCrmFake, type FakeSupabase } from "../testing/fake-supabase.ts";
import { runCrmJobs } from "./crm-jobs.ts";

const A = "workspace-a";
const B = "workspace-b";
const NOW = new Date("2026-09-07T10:00:00Z"); // 12:00 en Madrid

let fake: FakeSupabase;
let client: CrmClient;

function seedNotice(workspaceId: string, suffix: string) {
  fake.table("agendas").push({
    id: `agenda-${suffix}`,
    no_show_enabled: false,
    reminder_enabled: true,
    reminder_hours_before: 24,
    timezone: "Europe/Madrid",
    workspace_id: workspaceId,
  });
  fake.table("contacts").push({ automation_labels: [], full_name: "Ana", id: `contact-${suffix}`, messaging_status: "active", workspace_id: workspaceId });
  fake.table("conversations").push({ contact_id: `contact-${suffix}`, id: `conv-${suffix}`, last_message_at: "2026-09-07T09:00:00Z", workspace_id: workspaceId });
  fake.table("messages").push({ contact_id: `contact-${suffix}`, created_at: "2026-09-07T09:00:00Z", direction: "inbound", id: `in-${suffix}`, workspace_id: workspaceId });
  fake.table("appointments").push({
    agenda_id: `agenda-${suffix}`,
    contact_id: `contact-${suffix}`,
    conversation_id: `conv-${suffix}`,
    created_at: "2026-09-01T00:00:00Z",
    id: `appt-${suffix}`,
    notices: [],
    reminder_sent_at: null,
    service: "Consulta",
    starts_at: "2026-09-08T08:00:00Z",
    status: "scheduled",
    updated_at: "2026-09-01T00:00:00Z",
    workspace_id: workspaceId,
  });
}

beforeEach(() => {
  fake = createCrmFake({ workspaces: [{ id: A, name: "A" }, { id: B, name: "B" }] });
  client = fake as unknown as CrmClient;
});

describe("crm-jobs", () => {
  it("corre los pasos, purga ofertas viejas y avisa a deliver", async () => {
    seedNotice(A, "a");
    fake.table("offered_slots").push(
      { agenda_id: "x", conversation_id: "c", offered_at: "2026-09-05T00:00:00Z", starts_at: "s1" },
      { agenda_id: "x", conversation_id: "c", offered_at: "2026-09-07T09:50:00Z", starts_at: "s2" },
    );
    const delivered: string[] = [];
    const report = await runCrmJobs(client, {
      deliver: async (targets) => {
        delivered.push(...targets.map((target) => `${target.workspaceId}:${target.conversationId}`));
      },
      google: { env: {} },
      now: () => NOW,
    });

    assert.deepEqual(Object.keys(report.steps), ["billing", "offers", "google", "notices"]);
    assert.ok(Object.values(report.steps).every((step) => step?.ok));
    assert.deepEqual(report.steps.offers?.result, { purged: 1 });
    assert.deepEqual(report.steps.notices?.result, { queued: 1, skipped: 0, waiting: 0 });
    assert.deepEqual(delivered, [`${A}:conv-a`]);
  });

  it("las empresas bloqueadas por facturación no reciben avisos", async () => {
    seedNotice(A, "a");
    seedNotice(B, "b");
    const delivered: string[] = [];
    await runCrmJobs(client, {
      billing: async () => ({ blockedWorkspaceIds: [B] }),
      deliver: async (targets) => {
        delivered.push(...targets.map((target) => target.workspaceId));
      },
      google: { env: {} },
      now: () => NOW,
    });
    assert.deepEqual(delivered, [A]);
    assert.equal(fake.table("messages").filter((row) => row.status === "queued" && row.workspace_id === B).length, 0);
  });

  it("si falla la facturación no se manda nada; un paso roto no para a los demás", async () => {
    seedNotice(A, "a");
    fake.table("offered_slots").push({ agenda_id: "x", conversation_id: "c", offered_at: "2026-09-01T00:00:00Z", starts_at: "s" });
    const report = await runCrmJobs(client, {
      billing: async () => {
        throw new Error("Stripe caído");
      },
      google: { env: {} },
      now: () => NOW,
    });
    assert.equal(report.steps.billing?.ok, false);
    assert.equal(report.steps.billing?.error, "Stripe caído");
    assert.equal(report.steps.offers?.ok, true);
    assert.equal(report.steps.notices, undefined);
    assert.equal(fake.table("messages").filter((row) => row.status === "queued").length, 0);
  });

  it("se puede pedir solo un paso", async () => {
    const report = await runCrmJobs(client, { google: { env: {} }, now: () => NOW, only: ["offers"] });
    assert.deepEqual(Object.keys(report.steps), ["offers"]);
  });
});
