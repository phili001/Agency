# Graph Report - Agency  (2026-11-02)

## Corpus Check
- 239 files · ~172,163 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .example 1, .ico 1)

## Summary
- 1778 nodes · 5399 edges · 82 communities (72 shown, 10 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 166 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `18397cd8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- shared.tsx
- buffer/route.ts
- FakeQuery
- ref_node_assert
- step-business.tsx
- shared.ts
- workspace-settings.tsx
- reminders.ts
- Dependencias y ESLint
- Esquema base de Supabase
- workspaces.ts
- ycloud-webhook.ts
- test-prompt/route.ts
- apiErrorResponse
- InboxPanel
- createAdminClient
- step-agents.tsx
- calendar-request.ts
- flow-engine.ts
- wizard.tsx
- (panel)/page.tsx
- import-export.ts
- Configuración de TypeScript
- dbFailure
- Tablas de flujos en SQL
- deliver/route.ts
- agendas.ts
- levy-calendar.ts
- google-calendar.ts
- Migración de verificación
- SQL de onboarding self-service
- executeRun
- WorkspaceSettings
- tasks.ts
- Layout y navegación lateral
- contacts.ts
- custom-fields.ts
- agent-agenda.ts
- AdminConsole
- Iconos del scaffold Next
- calendar-tools.ts
- invalid
- readApiError
- Una conversación abierta por contacto
- Índice de orden de la bandeja
- Crons de Vercel
- Configuración de PostCSS
- handleYCloudWebhook
- WorkspaceSectionPage
- agent-guards.ts
- flow-builder.tsx
- panel-header.tsx
- crm.test.ts
- Auditoria de rendimiento 2026-10-09
- crm-jobs.ts
- app/layout.tsx
- Decisiones tomadas
- ycloud-webhook.ts
- handoff.ts
- StepBusiness
- Runbook de despliegue
- snapshot/route.ts
- createClient
- createClient
- onboarding-progress-card.tsx
- FlowBuilder
- POST
- Tareas
- buildFieldsFromChoices
- slots.ts
- panel-data.ts
- dependencies
- scripts
- flow-answer-verifier.ts
- @supabase/supabase-js
- cron/flows/route.ts

## God Nodes (most connected - your core abstractions)
1. `createAdminClient()` - 132 edges
2. `apiErrorResponse()` - 80 edges
3. `dbFailure()` - 74 edges
4. `next` - 71 edges
5. `Decisiones tomadas` - 63 edges
6. `invalid()` - 49 edges
7. `createClient()` - 41 edges
8. `requireActiveWorkspaceRole()` - 40 edges
9. `requireWorkspaceRole()` - 38 edges
10. `WorkspaceSettings()` - 37 edges

## Surprising Connections (you probably didn't know these)
- `Vercel daily crons (flows, deliver, ghl-sync)` --semantically_similar_to--> `Deploy a Vercel workflow`  [INFERRED] [semantically similar]
  DEPLOY_RUNBOOK.md → .github/workflows/deploy.yml
- `Decisiones tomadas` --references--> `config()`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/agenda/slots.test.ts
- `F6 — Stripe y onboarding de Levy` --references--> `markAgencyContactActive()`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/integrations/ghl-agency.ts
- `Estado real vs. inventario (F0.1, 2026-11-02)` --references--> `createCompanyWithOwner()`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/admin-companies.ts
- `Estado real vs. inventario (F0.1, 2026-11-02)` --references--> `FlowTriggerType`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/flow-definitions.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Paid client auto-provisioning flow** — deploy_runbook_ghl_purchase_webhook, deploy_runbook_ghl_tags, deploy_runbook_auth_confirm, deploy_runbook_levy_purchase_webhook_secret [EXTRACTED 1.00]
- **Vercel Hobby plan workarounds** — _github_workflows_deploy, deploy_runbook_vercel_daily_crons, deploy_runbook_external_scheduler [INFERRED 0.75]
- **Inbound WhatsApp to AI reply pipeline** — deploy_runbook_ycloud_webhook_url, deploy_runbook_ai_buffer, deploy_runbook_vercel_daily_crons, deploy_runbook_cron_secret, readme_ycloud [INFERRED 0.85]
- **Next.js starter footer link icons (Learn/Examples/Go to nextjs.org)** — public_file_icon, public_window_icon, public_globe_icon [INFERRED 0.85]
- **Default create-next-app public/ icon set (likely unused leftovers)** — public_file_icon, public_globe_icon, public_next_logo, public_vercel_logo, public_window_icon [INFERRED 0.85]

## Communities (82 total, 10 thin omitted)

### Community 0 - "shared.tsx"
Cohesion: 0.20
Nodes (27): lucide-react, react, Company, ConnectedBanner(), CopyButton(), Field(), HelpBox(), HowTo() (+19 more)

### Community 1 - "buffer/route.ts"
Cohesion: 0.15
Nodes (24): AgentRow, buildInstructions(), buildTimeContext(), buildTodayLine(), buildTranscript(), BusinessProfileAsset, callResponsesApi(), ContactMetadata (+16 more)

### Community 2 - "FakeQuery"
Cohesion: 0.08
Nodes (4): compare(), FakeQuery, likeToRegExp(), parseOr()

### Community 3 - "ref_node_assert"
Cohesion: 0.13
Nodes (9): NOW, CascadeRule, createCrmFake(), fakeId(), FakeSupabase, FakeTables, Filter, Result (+1 more)

### Community 4 - "step-business.tsx"
Cohesion: 0.13
Nodes (22): Chip(), OptionCard(), toggle(), asString(), asStringArray(), AttendMode, attendModes, BusinessChoices (+14 more)

### Community 5 - "shared.ts"
Cohesion: 0.22
Nodes (11): CrmActorKind, CrmClient, SYSTEM_ACTOR, callbackRedirectPath(), CallbackResult, completeGoogleCallback(), INTEGRATIONS_PATH, deps (+3 more)

### Community 6 - "workspace-settings.tsx"
Cohesion: 0.10
Nodes (20): AgentItem, asRecord(), buildAssetDraft(), fieldHelp(), hashToTab, IntegrationItem, IntegrationTestResult, providers (+12 more)

### Community 7 - "reminders.ts"
Cohesion: 0.13
Nodes (21): AgendaNoticeConfig, CandidateRow, claim(), DEFAULT_MESSAGES, deliverNotice(), fillNotice(), firstName(), isMessagingWindowOpen() (+13 more)

### Community 8 - "Dependencias y ESLint"
Cohesion: 0.11
Nodes (23): eslintConfig, description, devDependencies, eslint@^9, eslint-config-next@16.2.10, server-only@^0.0.1, tailwindcss@^4, @tailwindcss/postcss@^4 (+15 more)

### Community 9 - "Esquema base de Supabase"
Cohesion: 0.12
Nodes (35): app_private.has_workspace_role(), app_private.is_workspace_member(), idx_agents_workspace_id, idx_contacts_automation_labels, idx_contacts_workspace_id, idx_conversations_contact_id, idx_conversations_workspace_id, idx_integration_secrets_workspace_provider (+27 more)

### Community 10 - "workspaces.ts"
Cohesion: 0.14
Nodes (25): assertCurrentUserIsAdmin(), DELETE(), POST(), GET(), asStateRecord(), patchOnboardingState(), POST(), AdminClient (+17 more)

### Community 11 - "ycloud-webhook.ts"
Cohesion: 0.10
Nodes (38): CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code, Código de referencia del CRM (portar, no copiar a ciegas), Inventario de GHL a eliminar, Modelo de datos (Supabase, esquema `public`), Objetivo, Onboarding de Levy, Panel, Stripe (Payment Link externo) (+30 more)

### Community 12 - "test-prompt/route.ts"
Cohesion: 0.17
Nodes (20): AgentLike, buildIdentityContext(), buildInstructions(), BusinessProfileAsset, getAgentIdentity(), getKnowledgeAssetIds(), getOpenAIModel(), getResponseText() (+12 more)

### Community 13 - "apiErrorResponse"
Cohesion: 0.11
Nodes (43): Reglas para cada iteración, POST(), Context, DELETE(), GET(), PATCH(), POST(), Context (+35 more)

### Community 14 - "InboxPanel"
Cohesion: 0.09
Nodes (25): ConversationItem, handoffSourceLabel, InboxPanel(), handleInternalNote(), handleSend(), handleVisibilityChange(), insertMessage(), refreshNow() (+17 more)

### Community 15 - "createAdminClient"
Cohesion: 0.16
Nodes (23): server-only, POST(), webhookUrl(), POST(), OpenAIResponsePayload, POST(), GET(), POST() (+15 more)

### Community 16 - "step-agents.tsx"
Cohesion: 0.10
Nodes (41): AgentConfig, AgentItem, AgentSettings(), createBaseAgent(), deleteAgent(), saveAgent(), selectAgent(), AgentSettingsProps (+33 more)

### Community 17 - "calendar-request.ts"
Cohesion: 0.18
Nodes (16): runGhlCalendarTool(), addDaysToDateKey(), CalendarRequestContext, dateKeyInTimezone(), months, normalize(), parseDateKey(), ParsedTime (+8 more)

### Community 18 - "flow-engine.ts"
Cohesion: 0.11
Nodes (23): contactAudienceLabels(), flowMatchesTags(), addMinutes(), AdminClient, calculateProcessImpact(), ContactRow, ConversationContext, FLOW_OPT_OUT_LABEL (+15 more)

### Community 19 - "wizard.tsx"
Cohesion: 0.14
Nodes (22): StepDone(), enter(), OnboardingWizard(), WizardAgent, WizardAsset, WizardIntegration, WizardProps, WizardWorkspace (+14 more)

### Community 20 - "(panel)/page.tsx"
Cohesion: 0.26
Nodes (11): ObservabilityPage(), emptyResult, Home(), BUSINESS_METRICS_WINDOW_DAYS, BusinessMetrics, getBusinessMetrics(), getConversationHandoffInfo(), getContactMetadata() (+3 more)

### Community 21 - "import-export.ts"
Cohesion: 0.23
Nodes (11): RFC-4180, csvSafe(), csvUnsafe(), FORMULA_STARTS, parseCsv(), parseCsvRecords(), quoteCell(), toCsv() (+3 more)

### Community 22 - "Configuración de TypeScript"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 23 - "dbFailure"
Cohesion: 0.09
Nodes (34): agent, MONDAY_10, NOW, operator, getAgenda(), setDefaultAgenda(), Appointment, AppointmentCreator (+26 more)

### Community 24 - "Tablas de flujos en SQL"
Cohesion: 0.25
Nodes (13): idx_contacts_automation_labels, idx_flow_answer_reviews_workspace_status, idx_flow_events_workspace_created, idx_flow_runs_conversation_status, idx_flow_runs_workspace_contact_status, idx_flows_workspace_status, public.flow_answer_reviews, public.flow_events (+5 more)

### Community 25 - "deliver/route.ts"
Cohesion: 0.12
Nodes (22): configString(), ContactRow, GET(), getInteractiveOptions(), IntegrationRow, InteractiveOption, isAuthorized(), POST() (+14 more)

### Community 26 - "agendas.ts"
Cohesion: 0.11
Nodes (18): seed(), Agenda, AGENDA_COLUMNS, AgendaInput, AgendaRow, createAgenda(), getDefaultAgenda(), GoogleSyncMode (+10 more)

### Community 27 - "levy-calendar.ts"
Cohesion: 0.06
Nodes (71): configString(), ContactRow, GET(), HighLevelContactResponse, IntegrationRow, isAuthorized(), metadataTags(), POST() (+63 more)

### Community 28 - "google-calendar.ts"
Cohesion: 0.11
Nodes (39): decryptSecret(), encryptSecret(), getKey(), buildAuthUrl(), buildEventBody(), calendarFetch(), createOAuthState(), deleteEvent() (+31 more)

### Community 29 - "Migración de verificación"
Cohesion: 0.23
Nodes (5): idx_contacts_automation_labels, idx_flow_answer_reviews_run_step, idx_flow_answer_reviews_workspace_status, public.flow_answer_reviews, set_flow_answer_reviews_updated_at

### Community 30 - "SQL de onboarding self-service"
Cohesion: 0.23
Nodes (8): idx_integration_secrets_workspace_provider, idx_integrations_ycloud_workspace, idx_workspace_members_workspace_user, idx_workspaces_owner_id, public.integration_secrets, public.platform_admins, set_integration_secrets_updated_at, workspaces_company_code_key

### Community 31 - "executeRun"
Cohesion: 0.24
Nodes (25): parseFlowSteps(), completeCheckpoint(), decideFlowAnswerReview(), executeRun(), findNextStep(), findStep(), getAnswers(), getFlowOptionMetadata() (+17 more)

### Community 32 - "WorkspaceSettings"
Cohesion: 0.15
Nodes (13): WorkspaceSettings(), addBusinessCustomField(), assetEditor(), assetList(), businessProfileEditor(), deleteAsset(), editAsset(), removeBusinessCustomField() (+5 more)

### Community 33 - "tasks.ts"
Cohesion: 0.26
Nodes (11): ActivityEntry, ActivityKind, optionalText(), CrmActor, assertMember(), createdByFor(), createTask(), CrmTask (+3 more)

### Community 34 - "Layout y navegación lateral"
Cohesion: 0.22
Nodes (9): emptyResult, FlujosPage(), PanelLayout(), IntentLink(), sidebarItems, SidebarNav(), WorkspaceOption, WorkspaceSwitcher() (+1 more)

### Community 35 - "contacts.ts"
Cohesion: 0.14
Nodes (23): ClientsPage(), listActivity(), CONTACT_SOURCES, ContactSearch, ContactSource, createContact(), CreateContactInput, CrmContact (+15 more)

### Community 36 - "custom-fields.ts"
Cohesion: 0.10
Nodes (35): Client, createCustomField(), CUSTOM_FIELD_TYPES, CustomFieldDefinition, CustomFieldDefinitionInput, CustomFieldType, CustomFieldValue, CustomFieldValues (+27 more)

### Community 37 - "agent-agenda.ts"
Cohesion: 0.22
Nodes (19): AgendaRuntimeCalendar, AgendaRuntimeDeps, alternativesFor(), failureWithAlternatives(), formatSlot(), pickUpcoming(), resolveStart(), runAgendaTool() (+11 more)

### Community 38 - "AdminConsole"
Cohesion: 0.43
Nodes (8): AdminConsole(), addSuperadmin(), createCompany(), deleteJson(), linkOwner(), openCompany(), postJson(), removeSuperadmin()

### Community 39 - "Iconos del scaffold Next"
Cohesion: 0.40
Nodes (6): File/Document Icon (gray 16x16, page with folded corner and text lines), Globe Icon (gray 16x16, world/web symbol), Next.js Wordmark Logo (black), Default create-next-app Scaffold Assets, Vercel Triangle Logo (white), Browser Window Icon (gray 16x16, window with three dots)

### Community 40 - "calendar-tools.ts"
Cohesion: 0.10
Nodes (34): Decisiones tomadas, F5 — Agente, flujos y panel sin GHL, Cambios en lo existente, buildCalendarRuntime(), buildGhlCalendarRuntime(), CalendarRuntime, CalendarRuntimeResult, CalendarToolCall (+26 more)

### Community 41 - "invalid"
Cohesion: 0.20
Nodes (20): agendaChanges(), intInRange(), updateAgenda(), conflict(), CrmError, CrmErrorCode, invalid(), isUniqueViolation() (+12 more)

### Community 42 - "readApiError"
Cohesion: 0.09
Nodes (34): ACTIVITY_LABELS, activityDetail(), ACTOR_LABELS, Block(), ContactDrawer(), call(), FieldInput(), Shell() (+26 more)

### Community 52 - "handleYCloudWebhook"
Cohesion: 0.13
Nodes (15): maxDuration, POST(), maxDuration, POST(), recordInboundMessage(), touchContactInbound(), cleanDisplayName(), getMetadataRecord() (+7 more)

### Community 53 - "WorkspaceSectionPage"
Cohesion: 0.17
Nodes (13): AgentsPage(), AutomationsPage(), TeamPage(), IntegrationsPage(), KnowledgeBasePage(), BusinessPage(), TemplatesPage(), ToolsPage() (+5 more)

### Community 54 - "agent-guards.ts"
Cohesion: 0.22
Nodes (17): buildCalendarContext(), buildCalendarToolDefinitions(), buildChangesContext(), buildDirectAvailabilityAnswer(), buildNoCalendarContext(), CalendarRuntimeView, hasAvailabilityLookup(), hasConfirmedAppointment() (+9 more)

### Community 55 - "flow-builder.tsx"
Cohesion: 0.08
Nodes (37): ActionsEditor(), convertLegacy(), patchAction(), replaceCrm(), AgentItem, asConfigRecord(), CrmActionFields(), FlowBuilderProps (+29 more)

### Community 56 - "panel-header.tsx"
Cohesion: 0.17
Nodes (14): findTarget(), GuidedTour(), readSeenLocally(), Rect, START_TOUR_EVENT, storageKey(), TourLauncher(), PanelPage() (+6 more)

### Community 57 - "crm.test.ts"
Cohesion: 0.16
Nodes (32): assertConversationInWorkspace(), logActivity(), updateContact(), eraseContact(), dbFailure(), notFound(), BASE_FIELDS, FLOW_ACTOR (+24 more)

### Community 58 - "Auditoria de rendimiento 2026-10-09"
Cohesion: 0.17
Nodes (7): nextConfig, Auditoria de rendimiento 2026-10-09, AppShell monolith (1350 lines), Per-route client bundle split, idx_conversations_workspace_last_message index (not applied), Incremental inbox snapshot (pending), Shared (panel) layout

### Community 59 - "crm-jobs.ts"
Cohesion: 0.23
Nodes (9): GET(), isAuthorized(), maxDuration, POST(), CrmJobDeps, CrmJobReport, CrmJobStep, runCrmJobs() (+1 more)

### Community 60 - "app/layout.tsx"
Cohesion: 0.25
Nodes (5): appUrl, geistMono, geistSans, metadata, viewport

### Community 61 - "Decisiones tomadas"
Cohesion: 0.12
Nodes (22): ACTIVE_STATUSES, AppointmentStatus, AgendaSync, clearPending(), connectedWorkspaces(), eventSummary(), googleBusyProvider(), processGoogleDeletions() (+14 more)

### Community 63 - "ycloud-webhook.ts"
Cohesion: 0.20
Nodes (15): MEDIA_KINDS, MESSAGE_WRAPPERS, normalizeMessageType(), readMediaFields(), readMessageType(), readPath(), YCloudMediaFields, YCloudMediaKind (+7 more)

### Community 64 - "handoff.ts"
Cohesion: 0.19
Nodes (14): AdminClient, applyConversationHandoff(), buildHandoffNote(), ConversationHandoffInfo, detectAnswerHandoff(), findHandoffKeyword(), getHandoffKeywords(), HANDOFF_CLIENT_NOTICE (+6 more)

### Community 65 - "StepBusiness"
Cohesion: 0.25
Nodes (15): Estado real vs. inventario (F0.1, 2026-11-02), StepBusiness(), addLocation(), patch(), removeLocation(), selectCountry(), selectSector(), updateLocation() (+7 more)

### Community 66 - "Runbook de despliegue"
Cohesion: 0.05
Nodes (39): Deploy a Vercel workflow, deploy job (vercel pull + vercel deploy --prod), Vercel CLI, VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID secrets, AGENTS.md agent instructions, Alineacion con el curso, Gaps vs lesson 05 (Vercel deploy, real WhatsApp round-trip, GHL test), Recommended next steps (SQL, secrets, deploy, webhook, test) (+31 more)

### Community 67 - "snapshot/route.ts"
Cohesion: 0.80
Nodes (4): GET(), getMetadataRecord(), getYCloudContactName(), stableTime()

### Community 68 - "createClient"
Cohesion: 0.12
Nodes (20): excludeExistingContacts(), FlowPayload, POST(), stringArray(), deliverFirstMessage(), POST(), StartFlowPayload, Check (+12 more)

### Community 69 - "createClient"
Cohesion: 0.09
Nodes (31): next, signOut(), AdminPage(), POST(), POST(), POST(), allowedRoles, DELETE() (+23 more)

### Community 70 - "onboarding-progress-card.tsx"
Cohesion: 0.24
Nodes (11): Lógica en Next.js, OnboardingProgressCard(), SupportContact(), StepMeeting(), book(), cancel(), OnboardingChecklist, buildSupportLink() (+3 more)

### Community 71 - "FlowBuilder"
Cohesion: 0.26
Nodes (13): FlowBuilder(), addStage(), createEmptyFlow(), createTemplate(), moveSelectedStep(), saveFlow(), updateDraft(), updateStage() (+5 more)

### Community 72 - "POST"
Cohesion: 0.24
Nodes (15): GET(), getAgentIntentBoost(), getConfigRecord(), getEnabledToolIds(), getKnowledgeAssetIds(), getRouterDescription(), getRoutingKeywords(), getRoutingTokens() (+7 more)

### Community 73 - "Tareas"
Cohesion: 0.14
Nodes (13): Decisiones pendientes (las responde el usuario; mientras, sigue con otras tareas), Entorno, F0 — Preparación, F1 — Modelo de datos del CRM (aditivo), F2 — Lógica del CRM y la Agenda, F3 — Google Calendar por workspace, F4 — Jobs y recordatorios, F6 — Stripe y onboarding de Levy (+5 more)

### Community 74 - "buildFieldsFromChoices"
Cohesion: 0.21
Nodes (13): next(), save(), buildAddressText(), buildDaysText(), buildFieldsFromChoices(), buildHoursText(), buildLocationText(), buildServicesText() (+5 more)

### Community 75 - "slots.ts"
Cohesion: 0.11
Nodes (41): Registro de iteraciones, toAgenda(), AgendaConfig, agendaConfigFromRow(), AgendaService, clampInt(), closedReason(), DAY_KEYS (+33 more)

### Community 76 - "panel-data.ts"
Cohesion: 0.29
Nodes (10): buildDefaultAgentConfig(), buildDefaultAgentPrompt(), DEFAULT_AGENT_PROMPT_VERSION, DefaultAgentPreset, defaultAgentPresets, deployChecks, getAuthDisplayName(), getConfigRecord() (+2 more)

### Community 77 - "dependencies"
Cohesion: 0.20
Nodes (10): dependencies, lucide-react@^1.23.0, next@16.2.10, react@19.2.4, react-dom@19.2.4, stripe@^19.3.0, @supabase/ssr@^0.12.0, react-dom (+2 more)

### Community 78 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 79 - "flow-answer-verifier.ts"
Cohesion: 0.60
Nodes (5): extractOutputText(), getRecord(), validateAnswerLocally(), VerificationResult, verifyFlowAnswer()

### Community 80 - "@supabase/supabase-js"
Cohesion: 0.40
Nodes (4): @supabase/supabase-js@^2.110.0, @supabase/supabase-js, findOrCreateOpenConversation(), OpenConversation

### Community 81 - "cron/flows/route.ts"
Cohesion: 0.70
Nodes (4): deliverQueuedMessages(), GET(), isAuthorized(), POST()

## Knowledge Gaps
- **24 isolated node(s):** `RFC-4180`, `LEVY_WORKSPACE_CODE / LEVY_MEETING_CALENDAR_ID`, `File/Document Icon (gray 16x16, page with folded corner and text lines)`, `Globe Icon (gray 16x16, world/web symbol)`, `Browser Window Icon (gray 16x16, window with three dots)` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 479 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createAdminClient()` connect `apiErrorResponse` to `buffer/route.ts`, `workspaces.ts`, `ycloud-webhook.ts`, `createAdminClient`, `calendar-request.ts`, `(panel)/page.tsx`, `deliver/route.ts`, `levy-calendar.ts`, `Layout y navegación lateral`, `contacts.ts`, `calendar-tools.ts`, `handleYCloudWebhook`, `crm-jobs.ts`, `ycloud-webhook.ts`, `snapshot/route.ts`, `createClient`, `createClient`, `POST`, `panel-data.ts`, `cron/flows/route.ts`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `createAdminClient()` (e.g. with `Decisiones tomadas` and `Reglas para cada iteración`) actually correct?**
  _`createAdminClient()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-4180`, `LEVY_WORKSPACE_CODE / LEVY_MEETING_CALENDAR_ID`, `File/Document Icon (gray 16x16, page with folded corner and text lines)` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FakeQuery` be split into smaller, more focused modules?**
  _Cohesion score 0.08172043010752689 - nodes in this community are weakly interconnected._
- **Why does `next` connect `createClient` to `shared.tsx`, `buffer/route.ts`, `Dependencias y ESLint`, `workspaces.ts`, `ycloud-webhook.ts`, `test-prompt/route.ts`, `apiErrorResponse`, `createAdminClient`, `deliver/route.ts`, `levy-calendar.ts`, `Layout y navegación lateral`, `calendar-tools.ts`, `handleYCloudWebhook`, `Auditoria de rendimiento 2026-10-09`, `crm-jobs.ts`, `app/layout.tsx`, `not-found.tsx`, `ycloud-webhook.ts`, `snapshot/route.ts`, `createClient`, `onboarding-progress-card.tsx`, `dependencies`, `cron/flows/route.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `apiErrorResponse()` (e.g. with `Decisiones tomadas` and `Registro de iteraciones`) actually correct?**
  _`apiErrorResponse()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `ref_node_assert` be split into smaller, more focused modules?**
  _Cohesion score 0.1341991341991342 - nodes in this community are weakly interconnected._