# Graph Report - Agency  (2026-10-21)

## Corpus Check
- 162 files · ~100,617 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .example 1, .ico 1)

## Summary
- 1179 nodes · 3202 edges · 53 communities (44 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `142ee10d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Herramientas de calendario GHL
- buffer/route.ts
- WorkspaceSettings
- Alta de clientes tras la compra
- Paso de negocio del onboarding
- Motor de flujos
- Constructor de flujos
- Documentación y despliegue
- Dependencias y ESLint
- Esquema base de Supabase
- members/route.ts
- Webhooks de YCloud
- wizard.tsx
- apiErrorResponse
- Bandeja de entrada
- createAdminClient
- agent-settings.tsx
- test-prompt/route.ts
- calendar-request.ts
- handoff.ts
- Páginas del panel
- Guía interactiva y sesión
- Configuración de TypeScript
- Datos y métricas del panel
- Tablas de flujos en SQL
- Envío de mensajes YCloud
- workspace-settings.tsx
- workspaces.ts
- Auditoría de rendimiento
- Migración de verificación
- SQL de onboarding self-service
- admin.ts
- business-profile.ts
- calendar-tools.ts
- Layout y navegación lateral
- panel-data.ts
- normalizeRoutingText
- Consola de empresas
- next
- Iconos del scaffold Next
- Snapshot de la bandeja
- cron/flows/route.ts
- ghl-sync/route.ts
- Una conversación abierta por contacto
- Índice de orden de la bandeja
- Crons de Vercel
- Configuración de PostCSS
- app/layout.tsx

## God Nodes (most connected - your core abstractions)
1. `createAdminClient()` - 89 edges
2. `next` - 54 edges
3. `apiErrorResponse()` - 42 edges
4. `createClient()` - 41 edges
5. `requireWorkspaceRole()` - 37 edges
6. `WorkspaceSettings()` - 37 edges
7. `StepBusiness()` - 34 edges
8. `lucide-react` - 30 edges
9. `InboxPanel()` - 25 edges
10. `WorkspaceSectionPage()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Vercel daily crons (flows, deliver, ghl-sync)` --semantically_similar_to--> `Deploy a Vercel workflow`  [INFERRED] [semantically similar]
  DEPLOY_RUNBOOK.md → .github/workflows/deploy.yml
- `Levy README` --semantically_similar_to--> `Next.js breaking changes notice (read node_modules/next/dist/docs)`  [INFERRED] [semantically similar]
  README.md → AGENTS.md
- `GET()` --calls--> `createClient()`  [EXTRACTED]
  src/app/auth/confirm/route.ts → src/lib/supabase/server.ts
- `saveMode()` --calls--> `readApiError()`  [EXTRACTED]
  src/components/onboarding/step-agents.tsx → src/components/onboarding/shared.tsx
- `File/Document Icon (gray 16x16, page with folded corner and text lines)` --conceptually_related_to--> `Default create-next-app Scaffold Assets`  [INFERRED]
  public/file.svg → public/next.svg

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Paid client auto-provisioning flow** — deploy_runbook_ghl_purchase_webhook, deploy_runbook_ghl_tags, deploy_runbook_auth_confirm, deploy_runbook_levy_purchase_webhook_secret [EXTRACTED 1.00]
- **Vercel Hobby plan workarounds** — _github_workflows_deploy, deploy_runbook_vercel_daily_crons, deploy_runbook_external_scheduler [INFERRED 0.75]
- **Inbound WhatsApp to AI reply pipeline** — deploy_runbook_ycloud_webhook_url, deploy_runbook_ai_buffer, deploy_runbook_vercel_daily_crons, deploy_runbook_cron_secret, readme_ycloud [INFERRED 0.85]
- **Next.js starter footer link icons (Learn/Examples/Go to nextjs.org)** — public_file_icon, public_window_icon, public_globe_icon [INFERRED 0.85]
- **Default create-next-app public/ icon set (likely unused leftovers)** — public_file_icon, public_globe_icon, public_next_logo, public_vercel_logo, public_window_icon [INFERRED 0.85]

## Communities (53 total, 9 thin omitted)

### Community 0 - "Herramientas de calendario GHL"
Cohesion: 0.07
Nodes (69): buildCalendarRuntime(), buildDirectAvailabilityAnswer(), runCalendarTool(), asRecord(), errorText(), POST(), readAppointmentStart(), readString() (+61 more)

### Community 1 - "buffer/route.ts"
Cohesion: 0.11
Nodes (34): AgentRow, buildCalendarContext(), buildCalendarToolDefinitions(), buildDirectBookingAnswer(), buildInstructions(), buildNoCalendarContext(), buildTimeContext(), buildTodayLine() (+26 more)

### Community 2 - "WorkspaceSettings"
Cohesion: 0.14
Nodes (14): stableDate(), WorkspaceSettings(), addBusinessCustomField(), assetEditor(), assetList(), businessProfileEditor(), deleteAsset(), editAsset() (+6 more)

### Community 3 - "Alta de clientes tras la compra"
Cohesion: 0.15
Nodes (28): fail(), POST(), readBody(), addAgencyContactTags(), AgencyContact, AgencyCustomField, agencyFetch(), findAgencyContactByEmail() (+20 more)

### Community 4 - "Paso de negocio del onboarding"
Cohesion: 0.09
Nodes (49): Chip(), OptionCard(), StepBusiness(), addLocation(), next(), patch(), removeLocation(), save() (+41 more)

### Community 5 - "Motor de flujos"
Cohesion: 0.11
Nodes (49): badRequest(), extractOutputText(), getRecord(), validateAnswerLocally(), VerificationResult, verifyFlowAnswer(), parseFlowSteps(), addMinutes() (+41 more)

### Community 6 - "Constructor de flujos"
Cohesion: 0.07
Nodes (41): emptyResult, FlujosPage(), AgentItem, asConfigRecord(), FlowBuilder(), addStage(), createEmptyFlow(), createTemplate() (+33 more)

### Community 7 - "Documentación y despliegue"
Cohesion: 0.05
Nodes (39): Deploy a Vercel workflow, deploy job (vercel pull + vercel deploy --prod), Vercel CLI, VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID secrets, AGENTS.md agent instructions, Alineacion con el curso, Gaps vs lesson 05 (Vercel deploy, real WhatsApp round-trip, GHL test), Recommended next steps (SQL, secrets, deploy, webhook, test) (+31 more)

### Community 8 - "Dependencias y ESLint"
Cohesion: 0.05
Nodes (39): eslintConfig, dependencies, lucide-react, next, react, react-dom, @supabase/ssr, @supabase/supabase-js (+31 more)

### Community 9 - "Esquema base de Supabase"
Cohesion: 0.12
Nodes (35): app_private.has_workspace_role(), app_private.is_workspace_member(), idx_agents_workspace_id, idx_contacts_automation_labels, idx_contacts_workspace_id, idx_conversations_contact_id, idx_conversations_workspace_id, idx_integration_secrets_workspace_provider (+27 more)

### Community 10 - "members/route.ts"
Cohesion: 0.36
Nodes (7): allowedRoles, DELETE(), findAuthUserByEmail(), getUserDisplayName(), PATCH(), POST(), TeamRole

### Community 11 - "Webhooks de YCloud"
Cohesion: 0.10
Nodes (31): maxDuration, POST(), maxDuration, POST(), findOrCreateOpenConversation(), OpenConversation, secretMatchesHash(), MEDIA_KINDS (+23 more)

### Community 12 - "wizard.tsx"
Cohesion: 0.08
Nodes (66): lucide-react, react, Company, OnboardingProgressCard(), ConnectedBanner(), CopyButton(), Field(), HelpBox() (+58 more)

### Community 13 - "apiErrorResponse"
Cohesion: 0.14
Nodes (25): deliverQueuedReviewMessages(), POST(), ReviewPayload, excludeExistingContacts(), FlowPayload, POST(), stringArray(), deliverFirstMessage() (+17 more)

### Community 14 - "Bandeja de entrada"
Cohesion: 0.09
Nodes (25): ConversationItem, handoffSourceLabel, InboxPanel(), handleInternalNote(), handleSend(), handleVisibilityChange(), insertMessage(), refreshNow() (+17 more)

### Community 15 - "createAdminClient"
Cohesion: 0.19
Nodes (23): server-only, POST(), webhookUrl(), POST(), GET(), POST(), bearerToken(), GhlWebhookPayload (+15 more)

### Community 16 - "agent-settings.tsx"
Cohesion: 0.10
Nodes (42): AgentConfig, AgentItem, AgentSettings(), createBaseAgent(), deleteAgent(), saveAgent(), selectAgent(), AgentSettingsProps (+34 more)

### Community 17 - "test-prompt/route.ts"
Cohesion: 0.24
Nodes (13): AgentLike, buildIdentityContext(), buildInstructions(), BusinessProfileAsset, getAgentIdentity(), getKnowledgeAssetIds(), getOpenAIModel(), getResponseText() (+5 more)

### Community 18 - "calendar-request.ts"
Cohesion: 0.15
Nodes (17): addDaysToDateKey(), CalendarRequestContext, CalendarRequestMessage, dateKeyInTimezone(), months, normalize(), parseDateKey(), ParsedTime (+9 more)

### Community 19 - "handoff.ts"
Cohesion: 0.16
Nodes (18): GET(), getKnowledgeAssetIds(), isAuthorized(), POST(), AdminClient, applyConversationHandoff(), buildHandoffNote(), ConversationHandoffInfo (+10 more)

### Community 20 - "Páginas del panel"
Cohesion: 0.17
Nodes (13): AgentsPage(), AutomationsPage(), TeamPage(), IntegrationsPage(), KnowledgeBasePage(), BusinessPage(), TemplatesPage(), ToolsPage() (+5 more)

### Community 21 - "Guía interactiva y sesión"
Cohesion: 0.17
Nodes (13): findTarget(), GuidedTour(), readSeenLocally(), Rect, START_TOUR_EVENT, storageKey(), TourLauncher(), AppSection (+5 more)

### Community 22 - "Configuración de TypeScript"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 23 - "Datos y métricas del panel"
Cohesion: 0.26
Nodes (13): ClientsPage(), ObservabilityPage(), emptyResult, Home(), PanelPage(), BUSINESS_METRICS_WINDOW_DAYS, BusinessMetrics, getBusinessMetrics() (+5 more)

### Community 24 - "Tablas de flujos en SQL"
Cohesion: 0.25
Nodes (13): idx_contacts_automation_labels, idx_flow_answer_reviews_workspace_status, idx_flow_events_workspace_created, idx_flow_runs_conversation_status, idx_flow_runs_workspace_contact_status, idx_flows_workspace_status, public.flow_answer_reviews, public.flow_events (+5 more)

### Community 25 - "Envío de mensajes YCloud"
Cohesion: 0.12
Nodes (22): configString(), ContactRow, GET(), getInteractiveOptions(), IntegrationRow, InteractiveOption, isAuthorized(), POST() (+14 more)

### Community 26 - "workspace-settings.tsx"
Cohesion: 0.12
Nodes (15): AgentItem, buildAssetDraft(), fieldHelp(), hashToTab, IntegrationItem, IntegrationTestResult, providers, singletonAssetKinds (+7 more)

### Community 27 - "workspaces.ts"
Cohesion: 0.17
Nodes (22): asStateRecord(), patchOnboardingState(), POST(), AdminClient, createCompanyWithOwner(), createDefaultAgentsForWorkspace(), linkOwnerToWorkspace(), withDefaultConversationMode() (+14 more)

### Community 28 - "Auditoría de rendimiento"
Cohesion: 0.17
Nodes (7): nextConfig, Auditoria de rendimiento 2026-10-09, AppShell monolith (1350 lines), Per-route client bundle split, idx_conversations_workspace_last_message index (not applied), Incremental inbox snapshot (pending), Shared (panel) layout

### Community 29 - "Migración de verificación"
Cohesion: 0.23
Nodes (5): idx_contacts_automation_labels, idx_flow_answer_reviews_run_step, idx_flow_answer_reviews_workspace_status, public.flow_answer_reviews, set_flow_answer_reviews_updated_at

### Community 30 - "SQL de onboarding self-service"
Cohesion: 0.23
Nodes (8): idx_integration_secrets_workspace_provider, idx_integrations_ycloud_workspace, idx_workspace_members_workspace_user, idx_workspaces_owner_id, public.integration_secrets, public.platform_admins, set_integration_secrets_updated_at, workspaces_company_code_key

### Community 31 - "admin.ts"
Cohesion: 0.15
Nodes (16): @supabase/supabase-js, Check, envCheck(), GET(), incrementalTables, recommendedEnv, requiredEnv, requiredTables (+8 more)

### Community 32 - "business-profile.ts"
Cohesion: 0.31
Nodes (7): BusinessProfileAsset, businessProfileFields, BusinessProfileMetadata, getBusinessVariables(), normalizeVariableKey(), Database, Json

### Community 33 - "calendar-tools.ts"
Cohesion: 0.21
Nodes (13): asRecord(), saveCalendarTool(), asRecord(), buildCalendarToolMetadata(), CALENDAR_TOOL_TYPE, CalendarTool, CalendarToolMetadata, CONTACT_CALENDAR_KEY (+5 more)

### Community 34 - "Layout y navegación lateral"
Cohesion: 0.31
Nodes (6): PanelLayout(), IntentLink(), sidebarItems, SidebarNav(), WorkspaceOption, WorkspaceSwitcher()

### Community 35 - "panel-data.ts"
Cohesion: 0.29
Nodes (8): DEFAULT_AGENT_PROMPT_VERSION, DefaultAgentPreset, defaultAgentPresets, deployChecks, getAuthDisplayName(), getConfigRecord(), getMemberProfiles(), syncDefaultAgentPrompts()

### Community 36 - "normalizeRoutingText"
Cohesion: 0.40
Nodes (10): getAgentIntentBoost(), getConfigRecord(), getEnabledToolIds(), getRouterDescription(), getRoutingKeywords(), getRoutingTokens(), isBookingAgent(), isContextualBookingFollowUp() (+2 more)

### Community 37 - "Consola de empresas"
Cohesion: 0.43
Nodes (8): AdminConsole(), addSuperadmin(), createCompany(), deleteJson(), linkOwner(), openCompany(), postJson(), removeSuperadmin()

### Community 38 - "next"
Cohesion: 0.10
Nodes (27): next, signOut(), AdminPage(), POST(), POST(), POST(), assertCurrentUserIsAdmin(), DELETE() (+19 more)

### Community 39 - "Iconos del scaffold Next"
Cohesion: 0.40
Nodes (6): File/Document Icon (gray 16x16, page with folded corner and text lines), Globe Icon (gray 16x16, world/web symbol), Next.js Wordmark Logo (black), Default create-next-app Scaffold Assets, Vercel Triangle Logo (white), Browser Window Icon (gray 16x16, window with three dots)

### Community 40 - "Snapshot de la bandeja"
Cohesion: 0.67
Nodes (5): GET(), getMetadataRecord(), getYCloudContactName(), stableTime(), getConversationHandoffInfo()

### Community 41 - "cron/flows/route.ts"
Cohesion: 0.70
Nodes (4): deliverQueuedMessages(), GET(), isAuthorized(), POST()

### Community 42 - "ghl-sync/route.ts"
Cohesion: 0.29
Nodes (10): configString(), ContactRow, GET(), HighLevelContactResponse, IntegrationRow, isAuthorized(), metadataTags(), POST() (+2 more)

### Community 52 - "app/layout.tsx"
Cohesion: 0.25
Nodes (5): appUrl, geistMono, geistSans, metadata, viewport

## Knowledge Gaps
- **30 isolated node(s):** `react-dom`, `tailwindcss`, `@tailwindcss/postcss`, `@types/node`, `@types/react` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 320 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createAdminClient()` connect `createAdminClient` to `Herramientas de calendario GHL`, `buffer/route.ts`, `Alta de clientes tras la compra`, `panel-data.ts`, `next`, `Snapshot de la bandeja`, `cron/flows/route.ts`, `ghl-sync/route.ts`, `members/route.ts`, `Webhooks de YCloud`, `apiErrorResponse`, `handoff.ts`, `Datos y métricas del panel`, `Envío de mensajes YCloud`, `workspaces.ts`, `admin.ts`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **What connects `react-dom`, `tailwindcss`, `@tailwindcss/postcss` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Herramientas de calendario GHL` be split into smaller, more focused modules?**
  _Cohesion score 0.06766917293233082 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `Herramientas de calendario GHL`, `buffer/route.ts`, `Alta de clientes tras la compra`, `Dependencias y ESLint`, `members/route.ts`, `Webhooks de YCloud`, `wizard.tsx`, `apiErrorResponse`, `createAdminClient`, `test-prompt/route.ts`, `Envío de mensajes YCloud`, `workspaces.ts`, `Auditoría de rendimiento`, `admin.ts`, `Layout y navegación lateral`, `Snapshot de la bandeja`, `cron/flows/route.ts`, `ghl-sync/route.ts`, `app/layout.tsx`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Should `buffer/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10756302521008404 - nodes in this community are weakly interconnected._
- **Why does `Onboarding kickoff meeting (step 3) on AAA001 calendar` connect `Documentación y despliegue` to `Herramientas de calendario GHL`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `WorkspaceSettings` be split into smaller, more focused modules?**
  _Cohesion score 0.13768115942028986 - nodes in this community are weakly interconnected._