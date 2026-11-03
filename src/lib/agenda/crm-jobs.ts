import type { CrmClient } from "../crm/shared.ts";
import type { GoogleDeps } from "../integrations/google-calendar.ts";
import { purgeOfferedSlots } from "./appointments.ts";
import { sweepGoogleSync } from "./google-sync.ts";
import { runAppointmentNotices } from "./reminders.ts";

/**
 * Lo que corre cada 5 minutos (`/api/cron/crm-jobs`, lanzado por pg_cron, F4.3).
 * Cada paso va aislado: si uno falla (Google caído, una consulta rota), los
 * demás siguen y el informe dice cuál falló. Pasos, en este orden:
 *
 * 1. `billing`: gracia de facturación y lista de empresas bloqueadas (F6.4; hasta
 *    entonces no hay ninguna).
 * 2. `offers`: purga de horarios ofrecidos de hace más de un día.
 * 3. `google`: borrados pendientes y copias pendientes en Google.
 * 4. `notices`: recordatorios e inasistencias (sin las empresas bloqueadas) y
 *    aviso a `deliver` de las conversaciones con mensajes recién encolados.
 */

export type CrmJobStep = "billing" | "google" | "notices" | "offers";

export type CrmJobReport = {
  durationMs: number;
  steps: Partial<Record<CrmJobStep, { durationMs: number; error?: string; ok: boolean; result?: unknown }>>;
};

export type CrmJobDeps = {
  /** Pide a `deliver` que mande lo encolado en esas conversaciones. */
  deliver?: (targets: Array<{ conversationId: string; workspaceId: string }>) => Promise<void>;
  /** Comprueba la gracia de facturación y devuelve las empresas bloqueadas (F6.4). */
  billing?: (client: CrmClient, now: Date) => Promise<{ blockedWorkspaceIds: string[] }>;
  google?: GoogleDeps;
  now?: () => Date;
  only?: CrmJobStep[];
};

export async function runCrmJobs(client: CrmClient, deps: CrmJobDeps = {}): Promise<CrmJobReport> {
  const clock = deps.now ?? (() => new Date());
  const started = Date.now();
  const report: CrmJobReport = { durationMs: 0, steps: {} };
  const wanted = (step: CrmJobStep) => !deps.only || deps.only.includes(step);

  async function step<T>(name: CrmJobStep, run: () => Promise<T>) {
    if (!wanted(name)) {
      return undefined;
    }

    const stepStarted = Date.now();
    try {
      const result = await run();
      report.steps[name] = { durationMs: Date.now() - stepStarted, ok: true, result };
      return result;
    } catch (error) {
      console.error(`[crm-jobs:${name}]`, error);
      report.steps[name] = {
        durationMs: Date.now() - stepStarted,
        error: (error instanceof Error ? error.message : String(error)).slice(0, 300),
        ok: false,
      };
      return undefined;
    }
  }

  const billing = await step("billing", async () =>
    deps.billing ? deps.billing(client, clock()) : { blockedWorkspaceIds: [] as string[] },
  );
  // Si la facturación falla, mejor no mandar nada a nadie que escribir a quien no paga.
  const billingFailed = wanted("billing") && report.steps.billing?.ok === false;

  await step("offers", async () => ({ purged: await purgeOfferedSlots(client, clock()) }));
  await step("google", () => sweepGoogleSync(client, deps.google));

  if (!billingFailed) {
    await step("notices", async () => {
      const notices = await runAppointmentNotices(client, {
        excludeWorkspaceIds: billing?.blockedWorkspaceIds ?? [],
        now: clock(),
      });

      if (notices.conversations.length > 0 && deps.deliver) {
        await deps.deliver(notices.conversations);
      }

      return { queued: notices.queued, skipped: notices.skipped, waiting: notices.waiting };
    });
  }

  report.durationMs = Date.now() - started;
  return report;
}
