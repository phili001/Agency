import {
  Activity,
  AlertCircle,
  BookOpenText,
  Bot,
  CalendarCheck,
  Check,
  ClipboardList,
  GitBranch,
  MessageSquareText,
  PlugZap,
  BriefcaseBusiness,
  ShieldCheck,
  UsersRound,
  WalletCards,
  LogOut,
  Wrench,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "./actions";
import { InboxPanel } from "@/components/inbox-panel";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { WorkspaceSettings } from "@/components/workspace-settings";
import { normalizeAppUrl } from "@/lib/app-url";
import {
  DEFAULT_AGENT_PROMPT_VERSION,
  buildDefaultAgentConfig,
  buildDefaultAgentPrompt,
  defaultAgentPresets,
} from "@/lib/default-agents";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { getActiveWorkspaceId } from "@/lib/workspaces";

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

const deployChecks = [
  {
    description: "Base de datos y autenticacion disponibles",
    envKeys: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ],
    label: "Datos",
  },
  {
    description: "Llave maestra para proteger API keys por empresa",
    envKeys: ["INTEGRATION_ENCRYPTION_KEY"],
    label: "OpenAI",
  },
  {
    description: "Endpoint publico para recibir mensajes",
    envKeys: ["NEXT_PUBLIC_APP_URL"],
    label: "YCloud API",
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
    description: "Sincronizacion de contactos/leads por empresa",
    envKeys: ["INTEGRATION_ENCRYPTION_KEY"],
    label: "GoHighLevel",
  },
];

const sidebarItems = [
  { href: "/", icon: MessageSquareText, label: "Inbox", section: "dashboard" },
  { href: "/agentes", icon: Bot, label: "Agentes", section: "agents" },
  { href: "/clientes", icon: UsersRound, label: "Clientes", section: "clients" },
  {
    href: "/integraciones",
    icon: PlugZap,
    label: "Integraciones",
    section: "integrations",
  },
  { href: "/negocio", icon: BriefcaseBusiness, label: "Negocio", section: "business" },
  { href: "/tools", icon: Wrench, label: "Tools", section: "tools" },
  { href: "/templates", icon: ClipboardList, label: "Templates", section: "templates" },
  {
    href: "/knowledge-base",
    icon: BookOpenText,
    label: "Knowledge Base",
    section: "knowledge",
  },
  { href: "/equipo", icon: UsersRound, label: "Equipo", section: "team" },
  {
    href: "/automatizaciones",
    icon: Check,
    label: "Automatizaciones",
    section: "automations",
  },
  {
    href: "/observabilidad",
    icon: Activity,
    label: "Observabilidad",
    section: "observability",
  },
];

type AppSection =
  | "agents"
  | "automations"
  | "business"
  | "clients"
  | "dashboard"
  | "integrations"
  | "knowledge"
  | "observability"
  | "team"
  | "templates"
  | "tools";

const workspaceTabs = [
  "agents",
  "automations",
  "business",
  "integrations",
  "knowledge",
  "team",
  "templates",
  "tools",
] as const;

const sectionTitles: Record<AppSection, { eyebrow: string; title: string }> = {
  agents: { eyebrow: "Workspace", title: "Agentes" },
  automations: { eyebrow: "Workspace", title: "Automatizaciones" },
  business: { eyebrow: "Workspace", title: "Negocio" },
  clients: { eyebrow: "CRM", title: "Clientes" },
  dashboard: { eyebrow: "Operaciones", title: "Dashboard de agentes de WhatsApp" },
  integrations: { eyebrow: "Workspace", title: "Integraciones" },
  knowledge: { eyebrow: "Workspace", title: "Knowledge Base" },
  observability: { eyebrow: "Sistema", title: "Observabilidad" },
  team: { eyebrow: "Workspace", title: "Equipo" },
  templates: { eyebrow: "Workspace", title: "Templates" },
  tools: { eyebrow: "Workspace", title: "Tools" },
};

function stableTime(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
    date.getUTCMinutes(),
  ).padStart(2, "0")} UTC`;
}

function stableNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

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

function getAuthDisplayName(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const metadataName = user.user_metadata?.full_name ?? user.user_metadata?.name;

  return typeof metadataName === "string" && metadataName.trim()
    ? metadataName.trim()
    : user.email ?? "Usuario";
}

async function getMemberProfiles(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, { email: string; name: string }>();
  }

  try {
    const admin = createAdminClient();
    const entries = await Promise.all(
      [...new Set(userIds)].map(async (userId) => {
        const { data } = await admin.auth.admin.getUserById(userId);
        const user = data.user;

        if (!user) {
          return null;
        }

        return [
          userId,
          {
            email: user.email ?? "",
            name: getAuthDisplayName({
              email: user.email ?? "",
              user_metadata: user.user_metadata,
            }),
          },
        ] as const;
      }),
    );

    return new Map(entries.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)));
  } catch {
    return new Map<string, { email: string; name: string }>();
  }
}

function getConfigRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function syncDefaultAgentPrompts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
) {
  const presetNames = defaultAgentPresets.map((preset) => preset.name);
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, config, system_prompt")
    .eq("workspace_id", workspaceId)
    .in("name", presetNames);

  if (!agents?.length) {
    return;
  }

  await Promise.all(
    agents.map((agent) => {
      const preset = defaultAgentPresets.find((item) => item.name === agent.name);
      const config = getConfigRecord(agent.config);
      const currentVersion = Number(config.default_agent_prompt_version ?? 0);
      const alreadyUsesBusinessVariables =
        typeof agent.system_prompt === "string" &&
        agent.system_prompt.includes("{company_name}") &&
        agent.system_prompt.includes("{business_hours}") &&
        agent.system_prompt.includes("{location}");

      if (!preset || (currentVersion >= DEFAULT_AGENT_PROMPT_VERSION && alreadyUsesBusinessVariables)) {
        return Promise.resolve();
      }

      return supabase
        .from("agents")
        .update({
          config: {
            ...config,
            ...buildDefaultAgentConfig(preset),
          },
          system_prompt: buildDefaultAgentPrompt(preset),
        })
        .eq("id", agent.id)
        .eq("workspace_id", workspaceId);
    }),
  );
}

export async function AppShell({ section }: { section: AppSection }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminClient();
  const platformAdmin = await isPlatformAdmin(user);
  const { data: memberships, error: membershipError } = await admin
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (membershipError || !memberships?.length) {
    if (platformAdmin) {
      redirect("/admin");
    }

    redirect(
      `/login?error=${encodeURIComponent(
        "Tu usuario aun no tiene una empresa asignada. Pide al administrador que cree o vincule tu empresa.",
      )}`,
    );
  }

  const visibleMemberships = memberships;
  const workspaceIds = visibleMemberships.map((item) => item.workspace_id);
  const workspaceId = await getActiveWorkspaceId(workspaceIds);
  if (workspaceId) {
    await syncDefaultAgentPrompts(supabase, workspaceId);
  }
  const isDashboard = section === "dashboard";
  const isClients = section === "clients";
  const isObservability = section === "observability";
  const isWorkspaceSection = workspaceTabs.includes(
    section as (typeof workspaceTabs)[number],
  );
  const needsContacts = isDashboard || isClients;
  const needsConversations = isDashboard;
  const needsUsage = isDashboard;
  const needsIntegrations = isWorkspaceSection || isDashboard;
  const needsMembers = section === "team" || isDashboard;
  const needsAssets = isWorkspaceSection;
  const needsAgents = isWorkspaceSection;
  const needsWebhooks = isDashboard || isObservability;
  const needsAgency = true;
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
          .select("*")
          .eq("id", workspaceId)
          .single(),
        needsContacts
          ? supabase
              .from("contacts")
              .select("id, full_name, phone_e164, email, metadata, created_at")
              .eq("workspace_id", workspaceId)
              .order("created_at", { ascending: false })
              .limit(isClients ? 200 : 200)
          : Promise.resolve({ data: [], error: null }),
        needsAgents
          ? supabase
              .from("agents")
              .select(
                "id, workspace_id, name, type, is_active, model, system_prompt, temperature, config",
              )
              .eq("workspace_id", workspaceId)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        needsConversations
          ? supabase
              .from("conversations")
              .select("id, contact_id, status, ai_enabled, last_message_at, created_at")
              .eq("workspace_id", workspaceId)
              .order("last_message_at", { ascending: false, nullsFirst: false })
              .limit(100)
          : Promise.resolve({ data: [], error: null }),
        needsUsage
          ? supabase
              .from("usage_events")
              .select(
                "id, conversation_id, provider, model, input_tokens, output_tokens, total_tokens, cost_usd, created_at",
              )
              .eq("workspace_id", workspaceId)
              .order("created_at", { ascending: false })
              .limit(500)
          : Promise.resolve({ data: [], error: null }),
        needsIntegrations
          ? supabase
              .from("integrations")
              .select("id, workspace_id, provider, status, config, secret_ref, last_error")
              .eq("workspace_id", workspaceId)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        needsMembers
          ? supabase
              .from("workspace_members")
              .select("id, workspace_id, user_id, role, created_at")
              .eq("workspace_id", workspaceId)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        needsAssets
          ? supabase
              .from("workspace_assets")
              .select("id, workspace_id, kind, title, content, status, metadata")
              .eq("workspace_id", workspaceId)
              .order("updated_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        needsWebhooks
          ? supabase
              .from("webhook_events")
              .select("id, provider, event_type, status, error, created_at")
              .eq("workspace_id", workspaceId)
              .order("created_at", { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [], error: null }),
        needsAgency && workspaceIds.length > 0
          ? supabase
              .from("workspaces")
              .select("*")
              .in("id", workspaceIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        needsAgency && workspaceIds.length > 0
          ? supabase
              .from("conversations")
              .select("id, workspace_id, status, ai_enabled")
              .in("workspace_id", workspaceIds)
          : Promise.resolve({ data: [], error: null }),
        needsAgency && workspaceIds.length > 0
          ? supabase
              .from("integrations")
              .select("id, workspace_id, provider, status")
              .in("workspace_id", workspaceIds)
          : Promise.resolve({ data: [], error: null }),
        needsAgency && workspaceIds.length > 0
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
  const memberProfiles = await getMemberProfiles(members.map((member) => member.user_id));
  const displayMembers = members.map((member) => {
    const profile = memberProfiles.get(member.user_id);

    return {
      ...member,
      display_email: profile?.email ?? "",
      display_name: profile?.name ?? member.user_id,
    };
  });
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
          .limit(2000)
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
                : "Conversacion sincronizada desde WhatsApp.",
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
          contactMetadata: getContactMetadata(contact.metadata),
          contactPhone: contact.phone_e164,
          id: contact.id,
          name: contact.full_name ?? contact.phone_e164,
          rawStatus: "open",
          status: "Handoff",
          summary: "Contacto creado; falta abrir conversacion.",
          time: "Seed",
          workspaceId,
        }));

  const visibleConversations =
    dashboardConversations.length > 0 ? dashboardConversations : conversations;
  const displayMessages =
    conversationMessages?.map((message) => ({
      ...message,
      displayTime: stableTime(message.created_at),
    })) ?? [];
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
      companyCode:
        "company_code" in agencyWorkspace && typeof agencyWorkspace.company_code === "string"
          ? agencyWorkspace.company_code
          : null,
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
  const workspaceOptions = agencyWorkspaces.map((agencyWorkspace) => ({
    companyCode:
      "company_code" in agencyWorkspace && typeof agencyWorkspace.company_code === "string"
        ? agencyWorkspace.company_code
        : null,
    id: agencyWorkspace.id,
    name: agencyWorkspace.name,
    role: membershipRoleByWorkspaceId.get(agencyWorkspace.id) ?? "viewer",
    slug: agencyWorkspace.slug,
  }));
  const activeRole = workspaceId
    ? membershipRoleByWorkspaceId.get(workspaceId) ?? "viewer"
    : "sin acceso";
  const dashboardMetrics = [
    {
      label: "Empresas",
      value: String(workspaceOptions.length),
      detail: `rol activo ${activeRole}`,
      icon: UsersRound,
    },
    {
      label: "Conversaciones",
      value: String(realConversations.length),
      detail: "chats del numero conectado",
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
  const header = sectionTitles[section];
  const workspaceTab = isWorkspaceSection
    ? (section as (typeof workspaceTabs)[number])
    : "agents";

  return (
    <main className="min-h-screen bg-[#f6f7f3] text-[#20231f]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        <aside className="border-b border-[#d9ded3] bg-[#10231c] p-5 text-white lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#d2f36b] text-[#10231c]">
              <Bot size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold">Levi</p>
              <p className="text-xs text-[#b7c4bd]">Panel de empresas</p>
            </div>
          </div>

          <nav className="mt-8 grid gap-1 text-sm">
            {platformAdmin ? (
              <Link
                className="flex h-10 items-center gap-3 rounded-lg px-3 text-left text-[#dbe5df] transition hover:bg-white/10"
                href="/admin"
                prefetch
              >
                <Shield size={17} />
                <span>Superadmin</span>
              </Link>
            ) : null}
            {sidebarItems.map((item) => (
              <Link
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-left transition ${
                  item.section === section
                    ? "bg-white/10 text-white"
                    : "text-[#dbe5df] hover:bg-white/10"
                }`}
                href={item.href}
                key={item.label}
                prefetch
              >
                <item.icon size={17} />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-8 border-t border-white/10 pt-5">
            <WorkspaceSwitcher
              activeWorkspaceId={workspaceId ?? null}
              workspaces={workspaceOptions}
            />
            <p className="mt-3 text-xs text-[#b7c4bd]">{user.email}</p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <header className="border-b border-[#d9ded3] bg-white px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-[#647067]">
                  {header.eyebrow}
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal">
                  {header.title}
                </h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#cbd2c6] bg-white px-3 text-sm font-medium">
                  <GitBranch size={16} />
                  Sistema listo
                </button>
                <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#10231c] px-3 text-sm font-medium text-white">
                  <ShieldCheck size={16} />
                  Datos protegidos
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

          <div
            className={`grid gap-5 p-5 ${
              section === "dashboard" ? "xl:grid-cols-[1fr_360px]" : ""
            }`}
          >
            <div className="grid content-start gap-5">
              {!workspace || membershipError ? (
                <section className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 shrink-0" size={18} />
                  <div>
                    <p className="font-semibold">Falta crear una empresa.</p>
                    <p className="mt-1">
                      Entra al onboarding para crear tu empresa y conectar el primer
                      numero de WhatsApp.
                    </p>
                  </div>
                </section>
              ) : null}

              {section === "dashboard" ? (
              <section
                className="scroll-mt-5 rounded-lg border border-[#d9ded3] bg-white"
                id="inbox"
              >
                <div className="flex items-center justify-between border-b border-[#e2e6df] px-4 py-3">
                  <div>
                    <h2 className="text-base font-semibold">Inbox vivo</h2>
                    <p className="text-sm text-[#647067]">
                      Conversaciones y mensajes del numero conectado.
                    </p>
                  </div>
                  <span className="rounded-lg bg-[#e7f6ce] px-2.5 py-1 text-xs font-semibold text-[#31521d]">
                    {realConversations.length > 0 ? "En vivo" : "Contactos"}
                  </span>
                </div>
                <InboxPanel
                  conversations={visibleConversations}
                  messages={displayMessages}
                  usageEvents={displayUsageEvents}
                  webhookEvents={displayWebhookEvents}
                />
              </section>
              ) : null}

              {section === "clients" ? (
              <section
                className="scroll-mt-5 rounded-lg border border-[#d9ded3] bg-white p-4"
                id="clients"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Clientes</h2>
                    <p className="mt-1 text-sm text-[#647067]">
                      Contactos guardados para esta empresa.
                    </p>
                  </div>
                  <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
                    {contacts.length}
                  </span>
                </div>
                <div className="mt-4 grid gap-2">
                  {contacts.map((contact) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-lg border border-[#e2e6df] p-3 text-sm"
                      key={contact.id}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {contact.full_name ?? "Sin nombre"}
                        </p>
                        <p className="mt-1 text-xs text-[#647067]">
                          {contact.phone_e164}
                        </p>
                      </div>
                      <span className="rounded-lg bg-[#eef2eb] px-2 py-1 text-xs text-[#4d5a51]">
                        {contact.email ?? "WhatsApp"}
                      </span>
                    </div>
                  ))}
                  {contacts.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[#d9ded3] p-3 text-sm text-[#647067]">
                      Aun no hay contactos. Cuando entren mensajes por YCloud van
                      a aparecer aqui.
                    </p>
                  ) : null}
                </div>
              </section>
              ) : null}

              {isWorkspaceSection ? (
              <WorkspaceSettings
                activeRole={activeRole}
                agents={agents}
                appUrl={normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL)}
                assets={workspaceAssets}
                initialTab={workspaceTab}
                integrations={integrations}
                members={displayMembers}
                showNavigation={false}
                workspaceCode={
                  workspace && "company_code" in workspace && typeof workspace.company_code === "string"
                    ? workspace.company_code
                    : null
                }
                workspaceId={workspaceId ?? null}
                workspaceName={workspace?.name ?? "Workspace"}
              />
              ) : null}

              {section === "observability" ? (
                <>
                  <section
                    className="rounded-lg border border-[#d9ded3] bg-white p-4"
                    id="observability"
                  >
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
                    <a
                      className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-[#cbd2c6] px-3 text-sm font-medium text-[#20231f]"
                      href="/api/health/readiness"
                      target="_blank"
                    >
                      Abrir preflight JSON
                    </a>
                  </section>
                </>
              ) : null}
            </div>

            {section === "dashboard" ? (
            <aside className="grid content-start gap-5">
              <section className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-2">
                {dashboardMetrics.map((item) => (
                  <div
                    className="min-h-28 self-start rounded-lg border border-[#d9ded3] bg-white p-4"
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

              <section
                className="scroll-mt-5 rounded-lg border border-[#d9ded3] bg-white p-4"
                id="observability"
              >
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
                      No hay workspaces visibles todavia.
                    </p>
                  )}
                </div>
              </section>

            </aside>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
