import { WalletCards } from "lucide-react";

import { PanelPage } from "@/components/panel/panel-header";
import { getPanelContext } from "@/lib/panel-context";
import { getDeployReadiness, stableNumber } from "@/lib/panel-data";
import type { Metadata } from "next";
import { sectionTitles } from "@/lib/panel-data";

export const metadata: Metadata = { title: sectionTitles.observability.title };

export default async function ObservabilityPage() {
  const { platformAdmin, supabase, workspace, workspaceId } =
    await getPanelContext();
  const { data } = workspaceId
    ? await supabase
        .from("usage_events")
        .select("id, input_tokens, output_tokens, total_tokens, cost_usd")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(500)
    : { data: [] };
  const usageEvents = data ?? [];
  const totalCost = usageEvents.reduce(
    (sum, event) => sum + Number(event.cost_usd ?? 0),
    0,
  );
  const { checks: deployReadiness, ready: readyDeployChecks } =
    getDeployReadiness();

  return (
    <PanelPage hasWorkspace={Boolean(workspace)} section="observability">
      <>
        <section className="rounded-lg border border-line bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Consumo de IA</h2>
              <p className="mt-1 text-sm text-muted">
                Últimos {stableNumber(usageEvents.length)} eventos registrados.
              </p>
            </div>
            <WalletCards className="text-ink" size={20} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-line p-3">
              <p className="text-xs text-muted">Coste acumulado</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                ${totalCost.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-line p-3">
              <p className="text-xs text-muted">Tokens</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {stableNumber(
                  usageEvents.reduce(
                    (sum, event) =>
                      sum +
                      Number(
                        event.total_tokens ??
                          event.input_tokens + event.output_tokens,
                      ),
                    0,
                  ),
                )}
              </p>
            </div>
          </div>
        </section>

        <section
          className="rounded-lg border border-line bg-white p-4"
          id="observability"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Deploy readiness</h2>
              <p className="mt-1 text-sm text-muted">
                Variables necesarias para producción.
              </p>
            </div>
            <span className="rounded-lg bg-paper-2 px-2 py-1 text-xs text-ink-2">
              {readyDeployChecks}/{deployReadiness.length}
            </span>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {deployReadiness.map((check) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border border-line p-3"
                key={check.label}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{check.label}</p>
                  <p className="mt-1 text-xs text-muted">
                    {check.description}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-lg px-2 py-1 text-xs ${
                    check.ready
                      ? "bg-yellow-soft text-ink"
                      : "bg-amber-50 text-amber-800"
                  }`}
                >
                  {check.ready ? "Listo" : "Falta"}
                </span>
              </div>
            ))}
          </div>
          {platformAdmin ? (
            <a
              className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-line px-3 text-sm font-medium text-ink"
              href="/api/health/readiness"
              target="_blank"
            >
              Abrir preflight JSON
            </a>
          ) : null}
        </section>
      </>
    </PanelPage>
  );
}
