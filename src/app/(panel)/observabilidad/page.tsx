import { WalletCards } from "lucide-react";

import { PanelPage } from "@/components/panel/panel-header";
import { getPanelContext } from "@/lib/panel-context";
import { getDeployReadiness, stableNumber } from "@/lib/panel-data";

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
        <section className="rounded-lg border border-[#d9ded3] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Consumo de IA</h2>
              <p className="mt-1 text-sm text-[#647067]">
                Últimos {stableNumber(usageEvents.length)} eventos registrados.
              </p>
            </div>
            <WalletCards className="text-[#35735b]" size={20} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-[#e2e6df] p-3">
              <p className="text-xs text-[#647067]">Coste acumulado</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                ${totalCost.toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-[#e2e6df] p-3">
              <p className="text-xs text-[#647067]">Tokens</p>
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
          className="rounded-lg border border-[#d9ded3] bg-white p-4"
          id="observability"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Deploy readiness</h2>
              <p className="mt-1 text-sm text-[#647067]">
                Variables necesarias para producción.
              </p>
            </div>
            <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
              {readyDeployChecks}/{deployReadiness.length}
            </span>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {deployReadiness.map((check) => (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border border-[#e2e6df] p-3"
                key={check.label}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{check.label}</p>
                  <p className="mt-1 text-xs text-[#647067]">
                    {check.description}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-lg px-2 py-1 text-xs ${
                    check.ready
                      ? "bg-[#e7f6ce] text-[#31521d]"
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
              className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-[#cbd2c6] px-3 text-sm font-medium text-[#20231f]"
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
