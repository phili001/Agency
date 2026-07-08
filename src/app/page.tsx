import {
  Activity,
  AlertCircle,
  Bot,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  Headphones,
  MessageSquareText,
  Mic,
  PlugZap,
  ShieldCheck,
  UsersRound,
  WalletCards,
  LogOut,
} from "lucide-react";
import { redirect } from "next/navigation";

import { signOut } from "./actions";
import { AgentSettings } from "@/components/agent-settings";
import { InboxPanel } from "@/components/inbox-panel";
import { WorkspaceSettings } from "@/components/workspace-settings";
import { createClient } from "@/lib/supabase/server";

const conversations = [
  {
    name: "Sofia Ramirez",
    business: "Clinica Dental Norte",
    contactId: null,
    contactPhone: "+57 300 000 0000",
    id: "mock-sofia",
    status: "IA activa",
    summary: "Quiere limpieza dental y envio un audio con disponibilidad.",
    time: "09:42",
    workspaceId: null,
  },
  {
    name: "Carlos Medina",
    business: "Inmobiliaria Delta",
    contactId: null,
    contactPhone: "+57 311 111 1111",
    id: "mock-carlos",
    status: "Handoff",
    summary: "Pide hablar con asesor por credito hipotecario.",
    time: "09:31",
    workspaceId: null,
  },
  {
    name: "Laura Prieto",
    business: "Academia FitPro",
    contactId: null,
    contactPhone: "+57 322 222 2222",
    id: "mock-laura",
    status: "Agendada",
    summary: "Cita guardada en GHL para clase de prueba.",
    time: "09:18",
    workspaceId: null,
  },
];

const modules = [
  { name: "Inbox WhatsApp Web", state: "Operable", icon: MessageSquareText },
  { name: "IA + humano con handoff", state: "Activo", icon: Headphones },
  { name: "Buffer inteligente", state: "Cron listo", icon: Clock3 },
  { name: "Audios transcritos", state: "Pendiente", icon: Mic },
  { name: "Supabase multi-tenant", state: "Schema listo", icon: Database },
  { name: "YCloud oficial", state: "Webhook listo", icon: PlugZap },
];

const roadmap = [
  "Base Next.js + Tailwind creada",
  "Dashboard operativo inicial",
  "Modelo de datos multi-tenant",
  "Inbox operable con handoff",
  "Contacto y observabilidad",
  "Agente IA con OpenAI",
  "Webhook YCloud + buffer cron",
  "Agenda y leads en GoHighLevel",
];

const deployChecks = [
  {
    description: "Cliente y service role disponibles",
    envKeys: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
    label: "Supabase",
  },
  {
    description: "Prueba de prompt y buffer IA",
    envKeys: ["OPENAI_API_KEY"],
    label: "OpenAI",
  },
  {
    description: "Envio saliente de WhatsApp",
    envKeys: ["YCLOUD_API_KEY"],
    label: "YCloud API",
  },
  {
    description: "Validacion de webhooks inbound",
    envKeys: ["YCLOUD_WEBHOOK_SECRET"],
    label: "Webhook secret",
  },
  {
    description: "Proteccion de cron buffer/deliver",
    envKeys: ["CRON_SECRET"],
    label: "Cron secret",
  },
  {
    description: "Dominio publico para webhooks",
    envKeys: ["NEXT_PUBLIC_APP_URL"],
    label: "App URL",
  },
  {
    description: "Sincronizacion de contactos/leads",
    envKeys: ["GHL_API_KEY"],
    label: "GoHighLevel",
  },
];

function getContactMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  return {
    ai_summary:
      typeof record.ai_summary === "string" ? record.ai_summary : undefined,
    ai_tags: Array.isArray(record.ai_tags)
      ? record.ai_tags.filter((tag: unknown): tag is string => typeof tag === "string")
      : undefined,
    ghl_contact_id:
      typeof record.ghl_contact_id === "string" ? record.ghl_contact_id : undefined,
    ghl_last_error:
      typeof record.ghl_last_error === "string" ? record.ghl_last_error : undefined,
    ghl_synced_at:
      typeof record.ghl_synced_at === "string" ? record.ghl_synced_at : undefined,
  };
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const visibleMemberships = memberships?.length ? memberships : membership ? [membership] : [];
  const workspaceIds = visibleMemberships.map((item) => item.workspace_id);
  const workspaceId = visibleMemberships[0]?.workspace_id;
  const [
    workspaceResult,
    contactsResult,
    agentsResult,
    conversationsResult,
    usageResult,
    integrationsResult,
    membersResult,
    assetsResult,
    webhookEventsResult,
    agencyWorkspacesResult,
    agencyConversationsResult,
    agencyIntegrationsResult,
    agencyMembersResult,
  ] = workspaceId
    ? await Promise.all([
        supabase
          .from("workspaces")
          .select("id, name, slug, status")
          .eq("id", workspaceId)
          .single(),
        supabase
          .from("contacts")
          .select("id, full_name, phone_e164, email, metadata, created_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("agents")
          .select(
            "id, workspace_id, name, type, is_active, model, system_prompt, temperature",
          )
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false }),
        supabase
          .from("conversations")
          .select("id, contact_id, status, ai_enabled, last_message_at, created_at")
          .eq("workspace_id", workspaceId)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(10),
        supabase
          .from("usage_events")
          .select(
            "id, conversation_id, provider, model, input_tokens, output_tokens, total_tokens, cost_usd, created_at",
          )
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("integrations")
          .select("id, workspace_id, provider, status, config, secret_ref, last_error")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false }),
        supabase
          .from("workspace_members")
          .select("id, workspace_id, user_id, role, created_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: true }),
        supabase
          .from("workspace_assets")
          .select("id, workspace_id, kind, title, content, status")
          .eq("workspace_id", workspaceId)
          .order("updated_at", { ascending: false }),
        supabase
          .from("webhook_events")
          .select("id, provider, event_type, status, error, created_at")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(20),
        workspaceIds.length > 0
          ? supabase
              .from("workspaces")
              .select("id, name, slug, status")
              .in("id", workspaceIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        workspaceIds.length > 0
          ? supabase
              .from("conversations")
              .select("id, workspace_id, status, ai_enabled")
              .in("workspace_id", workspaceIds)
          : Promise.resolve({ data: [], error: null }),
        workspaceIds.length > 0
          ? supabase
              .from("integrations")
              .select("id, workspace_id, provider, status")
              .in("workspace_id", workspaceIds)
          : Promise.resolve({ data: [], error: null }),
        workspaceIds.length > 0
          ? supabase
              .from("workspace_members")
              .select("id, workspace_id, role")
              .in("workspace_id", workspaceIds)
          : Promise.resolve({ data: [], error: null }),
      ])
    : [
        { data: null, error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  const workspace = workspaceResult.data;
  const contacts = contactsResult.data ?? [];
  const agents = agentsResult.data ?? [];
  const realConversations = conversationsResult.data ?? [];
  const integrations = integrationsResult.data ?? [];
  const members = membersResult.data ?? [];
  const workspaceAssets = assetsResult.data ?? [];
  const webhookEvents = webhookEventsResult.data ?? [];
  const agencyWorkspaces = agencyWorkspacesResult.data ?? [];
  const agencyConversations = agencyConversationsResult.data ?? [];
  const agencyIntegrations = agencyIntegrationsResult.data ?? [];
  const agencyMembers = agencyMembersResult.data ?? [];
  const membershipRoleByWorkspaceId = new Map(
    visibleMemberships.map((item) => [item.workspace_id, item.role]),
  );
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const conversationIds = realConversations.map((conversation) => conversation.id);
  const { data: conversationMessages } =
    workspaceId && conversationIds.length > 0
      ? await supabase
          .from("messages")
          .select("id, conversation_id, body, direction, role, message_type, created_at")
          .eq("workspace_id", workspaceId)
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: true })
      : { data: [] };
  const usageEvents = usageResult.data ?? [];
  const totalCost = usageEvents.reduce(
    (sum, event) => sum + Number(event.cost_usd ?? 0),
    0,
  );
  const dashboardConversations =
    realConversations.length > 0
      ? realConversations.map((conversation) => {
          const contact = contactById.get(conversation.contact_id);
          return {
            aiEnabled: conversation.ai_enabled,
            business: workspace?.name ?? "Workspace",
            contactId: conversation.contact_id,
            contactMetadata: getContactMetadata(contact?.metadata),
            contactPhone: contact?.phone_e164,
            name: contact?.full_name ?? contact?.phone_e164 ?? "Contacto",
            id: conversation.id,
            rawStatus: conversation.status,
            status: conversation.ai_enabled ? "IA activa" : "Handoff",
            summary:
              conversation.status === "pending_handoff"
                ? "Conversacion esperando atencion humana."
                : "Conversacion sincronizada desde Supabase.",
            time: conversation.last_message_at
              ? new Date(conversation.last_message_at).toLocaleTimeString("es-CO", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Nueva",
            workspaceId,
          };
        })
      : contacts.slice(0, 3).map((contact) => ({
          aiEnabled: false,
          business: workspace?.name ?? "Workspace",
          contactId: contact.id,
          contactMetadata: getContactMetadata(contact.metadata),
          contactPhone: contact.phone_e164,
          id: contact.id,
          name: contact.full_name ?? contact.phone_e164,
          rawStatus: "open",
          status: "Contacto listo",
          summary: "Contacto creado en Supabase; falta abrir conversacion.",
          time: "Seed",
          workspaceId,
        }));

  const visibleConversations =
    dashboardConversations.length > 0 ? dashboardConversations : conversations;
  const agencyCards = agencyWorkspaces.map((agencyWorkspace) => {
    const workspaceConversations = agencyConversations.filter(
      (conversation) => conversation.workspace_id === agencyWorkspace.id,
    );
    const workspaceIntegrations = agencyIntegrations.filter(
      (integration) => integration.workspace_id === agencyWorkspace.id,
    );
    const workspaceMembers = agencyMembers.filter(
      (member) => member.workspace_id === agencyWorkspace.id,
    );
    const activeProviders = workspaceIntegrations
      .filter((integration) => integration.status === "active")
      .map((integration) => integration.provider);

    return {
      activeAi: workspaceConversations.filter((conversation) => conversation.ai_enabled)
        .length,
      activeProviders,
      conversationCount: workspaceConversations.length,
      handoffCount: workspaceConversations.filter(
        (conversation) => conversation.status === "pending_handoff",
      ).length,
      id: agencyWorkspace.id,
      memberCount: workspaceMembers.length,
      name: agencyWorkspace.name,
      role: membershipRoleByWorkspaceId.get(agencyWorkspace.id) ?? "viewer",
      slug: agencyWorkspace.slug,
      status: agencyWorkspace.status,
    };
  });
  const dashboardMetrics = [
    {
      label: "Workspaces",
      value: workspace ? "1" : "0",
      detail: membership?.role ? `rol ${membership.role}` : "sin membresia",
      icon: UsersRound,
    },
    {
      label: "Conversaciones",
      value: String(realConversations.length),
      detail: "desde Supabase",
      icon: MessageSquareText,
    },
    {
      label: "Contactos",
      value: String(contacts.length),
      detail: "leads cargados",
      icon: CalendarCheck,
    },
    {
      label: "Costo IA",
      value: `$${totalCost.toFixed(2)}`,
      detail: "usage_events",
      icon: WalletCards,
    },
  ];
  const deployReadiness = deployChecks.map((check) => ({
    ...check,
    ready: check.envKeys.every((key) => Boolean(process.env[key])),
  }));
  const readyDeployChecks = deployReadiness.filter((check) => check.ready).length;

  return (
    <main className="min-h-screen bg-[#f6f7f3] text-[#20231f]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-[#d9ded3] bg-[#10231c] p-5 text-white lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#d2f36b] text-[#10231c]">
              <Bot size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold">WhatsApp SaaS</p>
              <p className="text-xs text-[#b7c4bd]">Imperio Agentico</p>
            </div>
          </div>

          <nav className="mt-8 grid gap-1 text-sm">
            {[
              ["Inbox", MessageSquareText],
              ["Agentes", Bot],
              ["Clientes", UsersRound],
              ["Integraciones", PlugZap],
              ["Observabilidad", Activity],
            ].map(([label, Icon]) => (
              <button
                className="flex h-10 items-center gap-3 rounded-lg px-3 text-left text-[#dbe5df] transition hover:bg-white/10"
                key={label as string}
                type="button"
              >
                <Icon size={17} />
                <span>{label as string}</span>
              </button>
            ))}
          </nav>

          <div className="mt-8 border-t border-white/10 pt-5">
            <p className="text-xs font-medium uppercase text-[#94a39a]">
              Workspace activo
            </p>
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-sm font-semibold">
                {workspace?.name ?? "Sin workspace"}
              </p>
              <p className="mt-1 text-xs text-[#b7c4bd]">
                {contacts[0]?.phone_e164 ?? user.email}
              </p>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="border-b border-[#d9ded3] bg-white px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-[#647067]">
                  Paso 2 del curso
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal">
                  Dashboard de agentes de WhatsApp
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm font-medium">
                  <GitBranch size={16} />
                  Git listo
                </button>
                <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white">
                  <ShieldCheck size={16} />
                  Supabase conectado
                </button>
                <form action={signOut}>
                  <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm font-medium">
                    <LogOut size={16} />
                    Salir
                  </button>
                </form>
              </div>
            </div>
          </header>

          <div className="grid gap-5 p-5 xl:grid-cols-[1fr_360px]">
            <div className="grid gap-5">
              {!workspace || membershipError ? (
                <section className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 shrink-0" size={18} />
                  <div>
                    <p className="font-semibold">Falta enlazar tu usuario.</p>
                    <p className="mt-1">
                      No encontre un workspace visible para {user.email}. Revisa
                      que `workspace_members.user_id` sea el UUID exacto de este
                      usuario y que el rol sea `owner`.
                    </p>
                  </div>
                </section>
              ) : null}

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {dashboardMetrics.map((item) => (
                  <div
                    className="rounded-lg border border-[#d9ded3] bg-white p-4"
                    key={item.label}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-[#647067]">{item.label}</p>
                      <item.icon className="text-[#35735b]" size={18} />
                    </div>
                    <p className="mt-3 text-2xl font-semibold">{item.value}</p>
                    <p className="mt-1 text-xs text-[#7a847c]">{item.detail}</p>
                  </div>
                ))}
              </section>

              <section className="rounded-lg border border-[#d9ded3] bg-white">
                <div className="flex items-center justify-between border-b border-[#e2e6df] px-4 py-3">
                  <div>
                    <h2 className="text-base font-semibold">Inbox vivo</h2>
                    <p className="text-sm text-[#647067]">
                      Conversaciones y mensajes leidos desde Supabase.
                    </p>
                  </div>
                  <span className="rounded-lg bg-[#e7f6ce] px-2.5 py-1 text-xs font-semibold text-[#31521d]">
                    {realConversations.length > 0 ? "Supabase" : "Contactos"}
                  </span>
                </div>
                <InboxPanel
                  conversations={visibleConversations}
                  messages={conversationMessages ?? []}
                  usageEvents={usageEvents}
                  webhookEvents={webhookEvents}
                />
              </section>

              <AgentSettings agents={agents} workspaceId={workspaceId ?? null} />

              <WorkspaceSettings
                appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}
                assets={workspaceAssets}
                integrations={integrations}
                members={members}
                workspaceId={workspaceId ?? null}
                workspaceName={workspace?.name ?? "Workspace"}
              />
            </div>

            <aside className="grid content-start gap-5">
              <section className="rounded-lg border border-[#d9ded3] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Deploy readiness</h2>
                    <p className="mt-1 text-sm text-[#647067]">
                      Variables necesarias para produccion.
                    </p>
                  </div>
                  <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
                    {readyDeployChecks}/{deployReadiness.length}
                  </span>
                </div>
                <div className="mt-4 grid gap-2">
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
                <a
                  className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-[#cbd2c6] px-3 text-sm font-medium text-[#20231f]"
                  href="/api/health/readiness"
                  target="_blank"
                >
                  Abrir preflight JSON
                </a>
              </section>

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
                              {agencyWorkspace.slug} - {agencyWorkspace.role}
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
                      No hay workspaces visibles todavia.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-[#d9ded3] bg-white p-4">
                <h2 className="text-base font-semibold">Modulos del sistema</h2>
                <div className="mt-4 grid gap-3">
                  {modules.map((module) => (
                    <div
                      className="flex items-center justify-between gap-3"
                      key={module.name}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#eef2eb] text-[#35735b]">
                          <module.icon size={17} />
                        </div>
                        <p className="truncate text-sm font-medium">
                          {module.name}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-[#f3f4ef] px-2 py-1 text-xs text-[#647067]">
                        {module.state}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-[#d9ded3] bg-white p-4">
                <h2 className="text-base font-semibold">Ruta paso a paso</h2>
                <ol className="mt-4 grid gap-3">
                  {roadmap.map((step, index) => (
                    <li className="flex gap-3 text-sm" key={step}>
                      <CheckCircle2
                        className={index < 3 ? "text-[#35735b]" : "text-[#a8b0aa]"}
                        size={18}
                      />
                      <span className={index < 3 ? "font-medium" : "text-[#647067]"}>
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
