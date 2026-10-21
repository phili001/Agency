# Graph Report - Agency  (2026-10-19)

## Corpus Check
- 166 files · ~99,328 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: .example 1, (none) 1, .ico 1)

## Summary
- 1176 nodes · 3196 edges · 52 communities (42 shown, 10 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 43 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Herramientas de calendario GHL
- Buffer y respuesta de la IA
- Prompts y ajustes de agentes
- Alta de clientes tras la compra
- Paso de negocio del onboarding
- Motor de flujos
- Constructor de flujos
- Documentación y despliegue
- Dependencias y ESLint
- Esquema base de Supabase
- Auth, equipo y contraseñas
- Webhooks de YCloud
- Piezas compartidas del wizard
- Consola de superadmin
- Bandeja de entrada
- Guardado de integraciones
- Pantalla de agentes
- Paso de agentes del onboarding
- Pasos y progreso del onboarding
- Salud y clientes de Supabase
- Páginas del panel
- Guía interactiva y sesión
- Configuración de TypeScript
- Datos y métricas del panel
- Tablas de flujos en SQL
- Envío de mensajes YCloud
- Revisión humana y workspaces
- Pasos finales del onboarding
- Auditoría de rendimiento
- Migración de verificación
- SQL de onboarding self-service
- Cron de entrega
- Páginas de datos del panel
- Shell del wizard y soporte
- Layout y navegación lateral
- Webhook entrante de GHL
- Layout raíz y estilos
- Consola de empresas
- Páginas de error
- Iconos del scaffold Next
- Snapshot de la bandeja
- Cron de flujos
- API de flujos
- Una conversación abierta por contacto
- Índice de orden de la bandeja
- Crons de Vercel
- Configuración de PostCSS

## God Nodes (most connected - your core abstractions)
1. `createAdminClient()` - 89 edges
2. `next` - 54 edges
3. `apiErrorResponse()` - 42 edges
4. `createClient()` - 41 edges
5. `WorkspaceSettings()` - 37 edges
6. `requireWorkspaceRole()` - 37 edges
7. `StepBusiness()` - 34 edges
8. `lucide-react` - 30 edges
9. `InboxPanel()` - 25 edges
10. `WorkspaceSectionPage()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Vercel daily crons (flows, deliver, ghl-sync)` --semantically_similar_to--> `Deploy a Vercel workflow`  [INFERRED] [semantically similar]
  DEPLOY_RUNBOOK.md → .github/workflows/deploy.yml
- `Levy README` --semantically_similar_to--> `Next.js breaking changes notice (read node_modules/next/dist/docs)`  [INFERRED] [semantically similar]
  README.md → AGENTS.md
- `saveMode()` --calls--> `readApiError()`  [EXTRACTED]
  src/components/onboarding/step-agents.tsx → src/components/onboarding/shared.tsx
- `Production step checklist` --semantically_similar_to--> `Recommended next steps (SQL, secrets, deploy, webhook, test)`  [INFERRED] [semantically similar]
  COURSE_ROADMAP.md → COURSE_ALIGNMENT.md
- `Target system (inbox, configurable AI agent, handoff, buffer, YCloud dispatch, audio transcription, GHL)` --conceptually_related_to--> `Levy multi-tenant WhatsApp AI agent panel`  [INFERRED]
  COURSE_ROADMAP.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Inbound WhatsApp to AI reply pipeline** — deploy_runbook_ycloud_webhook_url, deploy_runbook_ai_buffer, deploy_runbook_vercel_daily_crons, deploy_runbook_cron_secret, readme_ycloud [INFERRED 0.85]
- **Paid client auto-provisioning flow** — deploy_runbook_ghl_purchase_webhook, deploy_runbook_ghl_tags, deploy_runbook_auth_confirm, deploy_runbook_levy_purchase_webhook_secret [EXTRACTED 1.00]
- **Vercel Hobby plan workarounds** — _github_workflows_deploy, deploy_runbook_vercel_daily_crons, deploy_runbook_external_scheduler [INFERRED 0.75]
- **Next.js starter footer link icons (Learn/Examples/Go to nextjs.org)** — public_file_icon, public_window_icon, public_globe_icon [INFERRED 0.85]
- **Default create-next-app public/ icon set (likely unused leftovers)** — public_file_icon, public_globe_icon, public_next_logo, public_vercel_logo, public_window_icon [INFERRED 0.85]

## Communities (52 total, 10 thin omitted)

### Community 0 - "Herramientas de calendario GHL"
Cohesion: 0.05
Nodes (85): buildCalendarRuntime(), buildDirectAvailabilityAnswer(), getEnabledToolIds(), runCalendarTool(), configString(), ContactRow, GET(), HighLevelContactResponse (+77 more)

### Community 1 - "Buffer y respuesta de la IA"
Cohesion: 0.05
Nodes (75): AgentRow, buildCalendarContext(), buildCalendarToolDefinitions(), buildDirectBookingAnswer(), buildNoCalendarContext(), buildTodayLine(), buildTranscript(), BusinessProfileAsset (+67 more)

### Community 2 - "Prompts y ajustes de agentes"
Cohesion: 0.05
Nodes (53): AgentLike, buildIdentityContext(), buildInstructions(), BusinessProfileAsset, getAgentIdentity(), getKnowledgeAssetIds(), getOpenAIModel(), getResponseText() (+45 more)

### Community 3 - "Alta de clientes tras la compra"
Cohesion: 0.08
Nodes (49): fail(), POST(), readBody(), AdminClient, createCompanyWithOwner(), createDefaultAgentsForWorkspace(), findAuthUserByEmail(), linkOwnerToWorkspace() (+41 more)

### Community 4 - "Paso de negocio del onboarding"
Cohesion: 0.09
Nodes (48): Chip(), StepBusiness(), addLocation(), next(), patch(), removeLocation(), save(), selectCountry() (+40 more)

### Community 5 - "Motor de flujos"
Cohesion: 0.11
Nodes (49): badRequest(), extractOutputText(), getRecord(), validateAnswerLocally(), VerificationResult, verifyFlowAnswer(), parseFlowSteps(), addMinutes() (+41 more)

### Community 6 - "Constructor de flujos"
Cohesion: 0.07
Nodes (41): AgentItem, asConfigRecord(), FlowBuilder(), addStage(), createEmptyFlow(), createTemplate(), moveSelectedStep(), saveFlow() (+33 more)

### Community 7 - "Documentación y despliegue"
Cohesion: 0.05
Nodes (39): Deploy a Vercel workflow, deploy job (vercel pull + vercel deploy --prod), Vercel CLI, VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID secrets, AGENTS.md agent instructions, Alineacion con el curso, Gaps vs lesson 05 (Vercel deploy, real WhatsApp round-trip, GHL test), Recommended next steps (SQL, secrets, deploy, webhook, test) (+31 more)

### Community 8 - "Dependencias y ESLint"
Cohesion: 0.05
Nodes (38): eslintConfig, dependencies, lucide-react, next, react, react-dom, @supabase/ssr, @supabase/supabase-js (+30 more)

### Community 9 - "Esquema base de Supabase"
Cohesion: 0.12
Nodes (35): app_private.has_workspace_role(), app_private.is_workspace_member(), idx_agents_workspace_id, idx_contacts_automation_labels, idx_contacts_workspace_id, idx_conversations_contact_id, idx_conversations_workspace_id, idx_integration_secrets_workspace_provider (+27 more)

### Community 10 - "Auth, equipo y contraseñas"
Cohesion: 0.11
Nodes (21): next, @supabase/supabase-js, POST(), allowedRoles, DELETE(), findAuthUserByEmail(), getUserDisplayName(), PATCH() (+13 more)

### Community 11 - "Webhooks de YCloud"
Cohesion: 0.11
Nodes (28): maxDuration, POST(), maxDuration, POST(), MEDIA_KINDS, MESSAGE_WRAPPERS, normalizeMessageType(), readMediaFields() (+20 more)

### Community 12 - "Piezas compartidas del wizard"
Cohesion: 0.24
Nodes (25): react, ConnectedBanner(), CopyButton(), Field(), HelpBox(), HowTo(), inputClass, linkButton (+17 more)

### Community 13 - "Consola de superadmin"
Cohesion: 0.15
Nodes (22): server-only, AdminPage(), POST(), POST(), assertCurrentUserIsAdmin(), DELETE(), POST(), deliverFirstMessage() (+14 more)

### Community 14 - "Bandeja de entrada"
Cohesion: 0.09
Nodes (25): ConversationItem, handoffSourceLabel, InboxPanel(), handleInternalNote(), handleSend(), handleVisibilityChange(), insertMessage(), refreshNow() (+17 more)

### Community 15 - "Guardado de integraciones"
Cohesion: 0.19
Nodes (20): POST(), webhookUrl(), POST(), OpenAIResponsePayload, POST(), GET(), POST(), normalizeAppUrl() (+12 more)

### Community 16 - "Pantalla de agentes"
Cohesion: 0.16
Nodes (22): AgentConfig, AgentItem, AgentSettings(), createBaseAgent(), deleteAgent(), saveAgent(), selectAgent(), AgentSettingsProps (+14 more)

### Community 17 - "Paso de agentes del onboarding"
Cohesion: 0.19
Nodes (20): OptionCard(), Question(), ToggleSwitch(), AgentDraft, createDraft(), getAgentName(), getConfig(), getHandoffKeywords() (+12 more)

### Community 18 - "Pasos y progreso del onboarding"
Cohesion: 0.18
Nodes (17): OnboardingProgressCard(), getFirstPendingStep(), getOnboardingState(), getPendingSteps(), isStepDone(), OnboardingChecklist, OnboardingState, OnboardingStep (+9 more)

### Community 19 - "Salud y clientes de Supabase"
Cohesion: 0.16
Nodes (16): @supabase/ssr, Check, envCheck(), GET(), incrementalTables, recommendedEnv, requiredEnv, requiredTables (+8 more)

### Community 20 - "Páginas del panel"
Cohesion: 0.18
Nodes (12): AgentsPage(), AutomationsPage(), TeamPage(), IntegrationsPage(), KnowledgeBasePage(), BusinessPage(), TemplatesPage(), ToolsPage() (+4 more)

### Community 21 - "Guía interactiva y sesión"
Cohesion: 0.16
Nodes (13): signOut(), findTarget(), GuidedTour(), readSeenLocally(), Rect, START_TOUR_EVENT, storageKey(), TourLauncher() (+5 more)

### Community 22 - "Configuración de TypeScript"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 23 - "Datos y métricas del panel"
Cohesion: 0.21
Nodes (15): emptyResult, Home(), BUSINESS_METRICS_WINDOW_DAYS, BusinessMetrics, getBusinessMetrics(), deployChecks, getAuthDisplayName(), getConfigRecord() (+7 more)

### Community 24 - "Tablas de flujos en SQL"
Cohesion: 0.25
Nodes (13): idx_contacts_automation_labels, idx_flow_answer_reviews_workspace_status, idx_flow_events_workspace_created, idx_flow_runs_conversation_status, idx_flow_runs_workspace_contact_status, idx_flows_workspace_status, public.flow_answer_reviews, public.flow_events (+5 more)

### Community 25 - "Envío de mensajes YCloud"
Cohesion: 0.19
Nodes (13): POST(), readResponsePayload(), YCloudErrorPayload, GET(), configString(), ContactRow, ConversationRow, IntegrationRow (+5 more)

### Community 26 - "Revisión humana y workspaces"
Cohesion: 0.27
Nodes (12): deliverQueuedReviewMessages(), POST(), ReviewPayload, GET(), asStateRecord(), patchOnboardingState(), POST(), requireUser() (+4 more)

### Community 27 - "Pasos finales del onboarding"
Cohesion: 0.18
Nodes (14): readApiError(), StepDone(), enter(), connectGhl(), invite(), StepMeeting(), book(), cancel() (+6 more)

### Community 28 - "Auditoría de rendimiento"
Cohesion: 0.17
Nodes (7): nextConfig, Auditoria de rendimiento 2026-10-09, AppShell monolith (1350 lines), Per-route client bundle split, idx_conversations_workspace_last_message index (not applied), Incremental inbox snapshot (pending), Shared (panel) layout

### Community 29 - "Migración de verificación"
Cohesion: 0.23
Nodes (5): idx_contacts_automation_labels, idx_flow_answer_reviews_run_step, idx_flow_answer_reviews_workspace_status, public.flow_answer_reviews, set_flow_answer_reviews_updated_at

### Community 30 - "SQL de onboarding self-service"
Cohesion: 0.23
Nodes (8): idx_integration_secrets_workspace_provider, idx_integrations_ycloud_workspace, idx_workspace_members_workspace_user, idx_workspaces_owner_id, public.integration_secrets, public.platform_admins, set_integration_secrets_updated_at, workspaces_company_code_key

### Community 31 - "Cron de entrega"
Cohesion: 0.24
Nodes (11): configString(), ContactRow, GET(), getInteractiveOptions(), IntegrationRow, InteractiveOption, isAuthorized(), POST() (+3 more)

### Community 32 - "Páginas de datos del panel"
Cohesion: 0.35
Nodes (8): ClientsPage(), emptyResult, FlujosPage(), ObservabilityPage(), PanelPage(), getPanelContext, PanelContext, getActiveWorkspaceId()

### Community 33 - "Shell del wizard y soporte"
Cohesion: 0.21
Nodes (11): SupportContact(), getMeetingPhone(), OnboardingWizard(), WizardAgent, WizardAsset, WizardIntegration, WizardProps, WizardWorkspace (+3 more)

### Community 34 - "Layout y navegación lateral"
Cohesion: 0.31
Nodes (6): PanelLayout(), IntentLink(), sidebarItems, SidebarNav(), WorkspaceOption, WorkspaceSwitcher()

### Community 35 - "Webhook entrante de GHL"
Cohesion: 0.36
Nodes (7): bearerToken(), GhlWebhookPayload, normalizePhone(), POST(), runDelivery(), findOrCreateOpenConversation(), OpenConversation

### Community 36 - "Layout raíz y estilos"
Cohesion: 0.25
Nodes (5): appUrl, geistMono, geistSans, metadata, viewport

### Community 37 - "Consola de empresas"
Cohesion: 0.43
Nodes (8): AdminConsole(), addSuperadmin(), createCompany(), deleteJson(), linkOwner(), openCompany(), postJson(), removeSuperadmin()

### Community 39 - "Iconos del scaffold Next"
Cohesion: 0.40
Nodes (6): File/Document Icon (gray 16x16, page with folded corner and text lines), Globe Icon (gray 16x16, world/web symbol), Next.js Wordmark Logo (black), Default create-next-app Scaffold Assets, Vercel Triangle Logo (white), Browser Window Icon (gray 16x16, window with three dots)

### Community 40 - "Snapshot de la bandeja"
Cohesion: 0.67
Nodes (5): GET(), getMetadataRecord(), getYCloudContactName(), stableTime(), getConversationHandoffInfo()

### Community 41 - "Cron de flujos"
Cohesion: 0.70
Nodes (4): deliverQueuedMessages(), GET(), isAuthorized(), POST()

### Community 42 - "API de flujos"
Cohesion: 0.60
Nodes (4): excludeExistingContacts(), FlowPayload, POST(), stringArray()

## Knowledge Gaps
- **30 isolated node(s):** `react-dom`, `@tailwindcss/postcss`, `@types/node`, `@types/react`, `@types/react-dom` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 319 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createAdminClient()` connect `Revisión humana y workspaces` to `Herramientas de calendario GHL`, `Buffer y respuesta de la IA`, `Páginas de datos del panel`, `Alta de clientes tras la compra`, `Webhook entrante de GHL`, `Snapshot de la bandeja`, `Cron de flujos`, `API de flujos`, `Auth, equipo y contraseñas`, `Webhooks de YCloud`, `Consola de superadmin`, `Guardado de integraciones`, `Salud y clientes de Supabase`, `Datos y métricas del panel`, `Envío de mensajes YCloud`, `Cron de entrega`?**
  _High betweenness centrality (0.129) - this node is a cross-community bridge._
- **What connects `react-dom`, `@tailwindcss/postcss`, `@types/node` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Herramientas de calendario GHL` be split into smaller, more focused modules?**
  _Cohesion score 0.05128779395296752 - nodes in this community are weakly interconnected._
- **Why does `next` connect `Auth, equipo y contraseñas` to `Herramientas de calendario GHL`, `Buffer y respuesta de la IA`, `Prompts y ajustes de agentes`, `Alta de clientes tras la compra`, `Dependencias y ESLint`, `Webhooks de YCloud`, `Consola de superadmin`, `Guardado de integraciones`, `Pasos y progreso del onboarding`, `Salud y clientes de Supabase`, `Guía interactiva y sesión`, `Envío de mensajes YCloud`, `Revisión humana y workspaces`, `Auditoría de rendimiento`, `Cron de entrega`, `Páginas de datos del panel`, `Layout y navegación lateral`, `Webhook entrante de GHL`, `Layout raíz y estilos`, `Páginas de error`, `Snapshot de la bandeja`, `Cron de flujos`, `API de flujos`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Should `Buffer y respuesta de la IA` be split into smaller, more focused modules?**
  _Cohesion score 0.050617283950617285 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Páginas de error` to `Páginas de datos del panel`, `Shell del wizard y soporte`, `Layout y navegación lateral`, `Prompts y ajustes de agentes`, `Paso de negocio del onboarding`, `Constructor de flujos`, `Dependencias y ESLint`, `Auth, equipo y contraseñas`, `Piezas compartidas del wizard`, `Bandeja de entrada`, `Pantalla de agentes`, `Paso de agentes del onboarding`, `Pasos y progreso del onboarding`, `Guía interactiva y sesión`, `Datos y métricas del panel`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `Prompts y ajustes de agentes` be split into smaller, more focused modules?**
  _Cohesion score 0.054274084124830396 - nodes in this community are weakly interconnected._