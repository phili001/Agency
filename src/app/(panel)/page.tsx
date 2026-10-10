import { Bot, CalendarCheck, Hand, MessageSquareText } from "lucide-react";

import { InboxPanel } from "@/components/inbox-panel";
import { OnboardingProgressCard } from "@/components/onboarding-progress-card";
import { PanelPage } from "@/components/panel/panel-header";
import {
  BUSINESS_METRICS_WINDOW_DAYS,
  getBusinessMetrics,
} from "@/lib/business-metrics";
import { getConversationHandoffInfo } from "@/lib/handoff";
import { getPanelContext } from "@/lib/panel-context";
import {
  getContactMetadata,
  getDeployReadiness,
  stableNumber,
  stableTime,
  syncDefaultAgentPrompts,
} from "@/lib/panel-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOnboardingChecklist } from "@/lib/workspaces";

const emptyResult = { data: [], error: null };

export default async function Home() {
  const {
    activeRole,
    platformAdmin,
    roleByWorkspaceId,
    supabase,
    user,
    workspace,
    workspaceId,
    workspaceIds,
    workspaces: agencyWorkspaces,
  } = await getPanelContext();
  // Recordatorio de configuracion pendiente: solo en la bandeja, solo para
  // quien puede configurar y solo hasta que el wizard se cierre.
  const onboardingPending =
    ["owner", "admin"].includes(activeRole) &&
    workspace &&
    "onboarding_completed_at" in workspace &&
    !workspace.onboarding_completed_at;

  // Primer lote: todo lo que solo depende de la empresa activa.
  const [
    ,
    contactsResult,
    conversationsResult,
    usageResult,
    webhookEventsResult,
    agencyIntegrationsResult,
    agencyMembersResult,
    agencyConversationCounts,
  ] = workspaceId
    ? await Promise.all([
        // Mantiene al dia los prompts por defecto sin bloquear la carga.
        syncDefaultAgentPrompts(supabase, workspaceId),
        supabase
          .from("contacts")
          .select("id, full_name, phone_e164, email, metadata, automation_labels, messaging_status, created_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("conversations")
          .select("id, contact_id, status, ai_enabled, last_message_at, created_at")
          .eq("workspace_id", workspaceId)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(100),
        supabase
          .from("usage_events")
          .select(
            "id, conversation_id, provider, model, input_tokens, output_tokens, total_tokens, cost_usd, created_at",
          )
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("webhook_events")
          .select("id, provider, event_type, status, error, created_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("integrations")
          .select("id, workspace_id, provider, status")
          .in("workspace_id", workspaceIds),
        supabase
          .from("workspace_members")
          .select("id, workspace_id, role")
          .in("workspace_id", workspaceIds),
        // Antes se bajaban todas las conversaciones de todas las empresas solo
        // para contarlas (y PostgREST corta en 1.000 filas). Ahora son conteos.
        Promise.all(
          workspaceIds.map(async (id) => {
            const [total, handoff] = await Promise.all([
              supabase
                .from("conversations")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", id),
              supabase
                .from("conversations")
                .select("id", { count: "exact", head: true })
                .eq("workspace_id", id)
                .eq("status", "pending_handoff"),
            ]);

            return [id, { handoff: handoff.count ?? 0, total: total.count ?? 0 }] as const;
          }),
        ),
      ])
    : [0, emptyResult, emptyResult, emptyResult, emptyResult, emptyResult, emptyResult, []];

  const contacts = contactsResult.data ?? [];
  const realConversations = conversationsResult.data ?? [];
  const usageEvents = usageResult.data ?? [];
  const webhookEvents = webhookEventsResult.data ?? [];
  const agencyIntegrations = agencyIntegrationsResult.data ?? [];
  const agencyMembers = agencyMembersResult.data ?? [];
  const conversationCountsByWorkspace = new Map(agencyConversationCounts);
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const conversationIds = realConversations.map((conversation) => conversation.id);
  const hasConversations = Boolean(workspaceId) && conversationIds.length > 0;

  // Segundo lote: lo que depende de las conversaciones visibles. Antes eran
  // siete viajes a Supabase uno detras de otro.
  const [
    { data: pendingReviews },
    handoffByConversation,
    { data: conversationFlowRuns },
    { data: latestMessages },
    businessMetrics,
    onboardingChecklist,
  ] = await Promise.all([
    hasConversations
      ? supabase
          .from("flow_answer_reviews")
          .select(
            "id, contact_id, conversation_id, question, original_answer, validation_reason, attempt_count, created_at",
          )
          .eq("workspace_id", workspaceId)
          .eq("status", "pending_human")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    hasConversations
      ? getConversationHandoffInfo(createAdminClient(), workspaceId!, conversationIds)
      : Promise.resolve(new Map()),
    hasConversations
      ? supabase
          .from("flow_runs")
          .select(
            "id, flow_id, contact_id, conversation_id, current_step_id, status, updated_at",
          )
          .eq("workspace_id", workspaceId)
          .in("conversation_id", conversationIds)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    // Carga inicial: solo la primera conversacion, y sus mensajes mas RECIENTES.
    // El resto los pide el inbox al abrir cada chat. Pidiendolos ascendentes el
    // limite recortaba por el final y los mensajes nuevos no llegaban nunca.
    hasConversations
      ? supabase
          .from("messages")
          .select("id, conversation_id, body, direction, role, message_type, media_url, created_at, metadata")
          .eq("workspace_id", workspaceId)
          .eq("conversation_id", conversationIds[0])
          .order("created_at", { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [] }),
    workspaceId ? getBusinessMetrics(supabase, workspaceId) : Promise.resolve(null),
    onboardingPending && workspaceId
      ? getOnboardingChecklist(workspaceId)
      : Promise.resolve(null),
  ]);

  const pendingReviewByConversation = new Map(
    (pendingReviews ?? []).map((review) => [review.conversation_id, review]),
  );
  const latestFlowRunByConversation = new Map<
    string,
    NonNullable<typeof conversationFlowRuns>[number]
  >();
  (conversationFlowRuns ?? []).forEach((run) => {
    if (
      run.conversation_id &&
      !latestFlowRunByConversation.has(run.conversation_id)
    ) {
      latestFlowRunByConversation.set(run.conversation_id, run);
    }
  });
  const conversationMessages = [...(latestMessages ?? [])].reverse();
  const dashboardConversations =
    realConversations.length > 0
      ? realConversations.map((conversation) => {
          const contact = contactById.get(conversation.contact_id);
          const contactMetadata = getContactMetadata(
            contact?.metadata,
            contact?.automation_labels,
            contact?.messaging_status,
            pendingReviewByConversation.get(conversation.id),
          );
          const latestFlowRun = latestFlowRunByConversation.get(conversation.id);
          return {
            aiEnabled: conversation.ai_enabled,
            business: workspace?.name ?? "Workspace",
            contactId: conversation.contact_id,
            contactMetadata,
            contactPhone: contact?.phone_e164,
            name:
              contact?.full_name ??
              contactMetadata?.ycloud_contact_name ??
              contact?.phone_e164 ??
              "Contacto",
            onboarding: latestFlowRun
              ? {
                  completedSteps:
                    contactMetadata?.flow_progress?.completedSteps ?? 0,
                  currentStepId: latestFlowRun.current_step_id,
                  flowId: latestFlowRun.flow_id,
                  runId: latestFlowRun.id,
                  stageLabel:
                    contactMetadata?.flow_progress?.currentStageLabel ??
                    contactMetadata?.flow_progress?.currentStageKey ??
                    "Inicio",
                  status: latestFlowRun.status,
                  totalSteps: contactMetadata?.flow_progress?.totalSteps ?? 0,
                }
              : undefined,
            handoff: handoffByConversation.get(conversation.id) ?? undefined,
            id: conversation.id,
            rawStatus: conversation.status,
            status: conversation.ai_enabled ? "IA activa" : "Handoff",
            summary:
              conversation.status === "pending_handoff"
                ? "Conversación esperando atención humana."
                : "Conversación sincronizada desde WhatsApp.",
            time: conversation.last_message_at
              ? stableTime(conversation.last_message_at)
              : "Nueva",
            workspaceId,
          };
        })
      : contacts.slice(0, 3).map((contact) => ({
          aiEnabled: false,
          business: workspace?.name ?? "Workspace",
          contactId: contact.id,
          contactMetadata: getContactMetadata(
            contact.metadata,
            contact.automation_labels,
            contact.messaging_status,
          ),
          contactPhone: contact.phone_e164,
          id: contact.id,
          name:
            contact.full_name ??
            getContactMetadata(
              contact.metadata,
              contact.automation_labels,
              contact.messaging_status,
            )?.ycloud_contact_name ??
            contact.phone_e164,
          rawStatus: "open",
          status: "Handoff",
          summary: "Contacto sin conversación abierta todavía.",
          time: "",
          workspaceId,
        }));
  const displayMessages = conversationMessages.map((message) => ({
    ...message,
    displayTime: stableTime(message.created_at),
  }));
  const displayUsageEvents = usageEvents.map((event) => ({
    ...event,
    displayTokenTotal: stableNumber(
      Number(event.total_tokens ?? event.input_tokens + event.output_tokens),
    ),
  }));
  const displayWebhookEvents = webhookEvents.map((event) => ({
    ...event,
    displayTime: stableTime(event.created_at),
  }));
  const agencyCards = agencyWorkspaces.map((agencyWorkspace) => {
    const counts = conversationCountsByWorkspace.get(agencyWorkspace.id);
    const activeProviders = agencyIntegrations
      .filter(
        (integration) =>
          integration.workspace_id === agencyWorkspace.id &&
          integration.status === "active",
      )
      .map((integration) => integration.provider);

    return {
      activeProviders,
      companyCode:
        typeof agencyWorkspace.company_code === "string"
          ? agencyWorkspace.company_code
          : null,
      conversationCount: counts?.total ?? 0,
      handoffCount: counts?.handoff ?? 0,
      id: agencyWorkspace.id,
      memberCount: agencyMembers.filter(
        (member) => member.workspace_id === agencyWorkspace.id,
      ).length,
      name: agencyWorkspace.name,
      role: roleByWorkspaceId.get(agencyWorkspace.id) ?? "viewer",
      slug: agencyWorkspace.slug,
      status: agencyWorkspace.status,
    };
  });
  // Lo que mira el dueño del negocio. Tokens y coste están en Observabilidad.
  const dashboardMetrics = [
    {
      label: "Conversaciones activas",
      value: stableNumber(businessMetrics?.activeConversations ?? 0),
      detail: `con mensajes en ${BUSINESS_METRICS_WINDOW_DAYS} días`,
      icon: MessageSquareText,
    },
    {
      label: "Respuestas de la IA",
      value: stableNumber(businessMetrics?.aiReplies ?? 0),
      detail: `enviadas sin una persona, ${BUSINESS_METRICS_WINDOW_DAYS} días`,
      icon: Bot,
    },
    {
      label: "Esperando a una persona",
      value: stableNumber(businessMetrics?.pendingHandoffs ?? 0),
      detail: "conversaciones en handoff ahora",
      icon: Hand,
    },
    {
      label: "Contactos con cita",
      value: stableNumber(businessMetrics?.contactsWithAppointment ?? 0),
      detail: "agendadas en el calendario",
      icon: CalendarCheck,
    },
  ];
  const deployReadiness = getDeployReadiness();
  // Cuando ya no falta nada, el preflight solo ocupa sitio en el dashboard.
  // En Observabilidad se sigue mostrando siempre: ahi es el motivo de la pagina.
  const deployReadinessComplete =
    deployReadiness.ready === deployReadiness.checks.length;

  const aside = (
    <aside className="grid min-w-0 content-start gap-5">
      {/* Una tarjeta por fila: en columna estrecha la cifra va al lado
          del texto, no debajo, para no dejar la mitad derecha vacía. */}
      <section className="grid min-w-0 content-start gap-2">
        {dashboardMetrics.map((item) => (
          <div
            className="flex min-w-0 items-center gap-3 rounded-lg border border-[#d9ded3] bg-white px-4 py-3"
            key={item.label}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#eef2eb] text-[#35735b]">
              <item.icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[#647067]">{item.label}</p>
              <p className="truncate text-xs text-[#7a847c]">{item.detail}</p>
            </div>
            <p className="shrink-0 text-xl font-semibold tabular-nums">
              {item.value}
            </p>
          </div>
        ))}
      </section>

      {deployReadinessComplete ? null : (
        <section
          className="scroll-mt-5 rounded-lg border border-[#d9ded3] bg-white p-4"
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
              {deployReadiness.ready}/{deployReadiness.checks.length}
            </span>
          </div>
          <div className="mt-4 grid gap-2">
            {deployReadiness.checks.map((check) => (
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
      )}

      <section className="rounded-lg border border-[#d9ded3] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Vista agencia</h2>
            <p className="mt-1 text-sm text-[#647067]">
              Workspaces visibles para tu usuario.
            </p>
          </div>
          <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
            {agencyCards.length}
          </span>
        </div>
        <div className="mt-4 grid gap-3">
          {agencyCards.length > 0 ? (
            agencyCards.map((agencyWorkspace) => (
              <div
                className={`rounded-lg border p-3 ${
                  agencyWorkspace.id === workspaceId
                    ? "border-[#35735b] bg-[#eef6df]"
                    : "border-[#e2e6df]"
                }`}
                key={agencyWorkspace.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {agencyWorkspace.name}
                    </p>
                    <p className="mt-1 text-xs text-[#647067]">
                      {agencyWorkspace.companyCode ?? agencyWorkspace.slug} - {agencyWorkspace.role}
                    </p>
                  </div>
                  <span className="rounded-lg bg-white px-2 py-1 text-xs text-[#4d5a51]">
                    {agencyWorkspace.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-white p-2">
                    <p className="font-semibold">
                      {agencyWorkspace.conversationCount}
                    </p>
                    <p className="text-[#647067]">Chats</p>
                  </div>
                  <div className="rounded-lg bg-white p-2">
                    <p className="font-semibold">
                      {agencyWorkspace.memberCount}
                    </p>
                    <p className="text-[#647067]">Equipo</p>
                  </div>
                  <div className="rounded-lg bg-white p-2">
                    <p className="font-semibold">
                      {agencyWorkspace.handoffCount}
                    </p>
                    <p className="text-[#647067]">Handoff</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["ycloud", "openai", "gohighlevel"].map((provider) => (
                    <span
                      className={`rounded-lg px-2 py-1 text-xs ${
                        agencyWorkspace.activeProviders.includes(provider)
                          ? "bg-[#e7f6ce] text-[#31521d]"
                          : "bg-[#eef2eb] text-[#647067]"
                      }`}
                      key={provider}
                    >
                      {provider}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-[#d9ded3] p-3 text-sm text-[#647067]">
              No hay workspaces visibles todavía.
            </p>
          )}
        </div>
      </section>
    </aside>
  );

  return (
    <PanelPage
      aside={aside}
      hasWorkspace={Boolean(workspace)}
      section="dashboard"
      tourKey="inbox"
      userMetadata={user.user_metadata}
    >
      {onboardingChecklist ? (
        <OnboardingProgressCard
          checklist={onboardingChecklist}
          companyName={workspace?.name ?? "tu empresa"}
        />
      ) : null}

      <section
        className="scroll-mt-5 rounded-lg border border-[#d9ded3] bg-white"
        id="inbox"
      >
        <div className="flex items-center justify-between border-b border-[#e2e6df] px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Inbox vivo</h2>
            <p className="text-sm text-[#647067]">
              Conversaciones y mensajes del número conectado.
            </p>
          </div>
          <span className="rounded-lg bg-[#e7f6ce] px-2.5 py-1 text-xs font-semibold text-[#31521d]">
            {realConversations.length > 0 ? "En vivo" : "Contactos"}
          </span>
        </div>
        <InboxPanel
          activeRole={activeRole}
          conversations={dashboardConversations}
          messages={displayMessages}
          usageEvents={displayUsageEvents}
          webhookEvents={displayWebhookEvents}
          workspaceId={workspaceId ?? null}
        />
      </section>
    </PanelPage>
  );
}
