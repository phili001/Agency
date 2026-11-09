# Graph Report - Agency  (2026-11-04)

## Corpus Check
- 287 files · ~192,438 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .example 1, .ico 1)

## Summary
- 2077 nodes · 6396 edges · 93 communities (74 shown, 19 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 188 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e76b16f7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- shared.tsx
- buffer/route.ts
- FakeQuery
- custom-fields.ts
- step-business.tsx
- dbFailure
- slots.ts
- reminders.ts
- Dependencias y ESLint
- schema.sql
- Decisiones tomadas
- CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code
- InboxPanel
- apiErrorResponse
- tasks.ts
- agent-agenda.test.ts
- agent-settings.tsx
- calendar-request.ts
- secrets.ts
- WorkspaceSectionPage
- dbFailure
- billing.test.ts
- Configuración de TypeScript
- [contactId]/tags/route.ts
- public.conversations
- google-calendar.test.ts
- 20261102200000_crm_core.sql
- admin.test.ts
- webhook.test.ts
- google-calendar.ts
- public.workspaces
- flow-engine.ts
- WorkspaceSettings
- panel-header.tsx
- steps
- test-prompt/route.ts
- executeRun
- agent-agenda.ts
- AdminConsole
- Iconos del scaffold Next
- calendar-tools.ts
- webhook.ts
- lucide-react
- deliver/route.ts
- Tareas
- Crons de Vercel
- Configuración de PostCSS
- billing-card.tsx
- app_private.book_appointment
- flow-answer-verifier.ts
- timezones.ts
- flow-builder.tsx
- import-export.ts
- 20261102210000_agenda_core.sql
- agendas.ts
- wizard.tsx
- Auditoria de rendimiento 2026-10-09
- panel-context.ts
- workspaces.ts
- ycloud-webhook.ts
- meeting/route.ts
- agency-crm.ts
- Runbook de despliegue
- contacts.ts
- supabase/admin.ts
- next
- FlowBuilder
- (panel)/page.tsx
- panel-data.ts
- agenda-panel.tsx
- 20261103020000_billing.sql
- welcome-page.ts
- app_private.invoke_crm_jobs
- (panel)/layout.tsx
- ref_node_test
- requireWorkspaceRole
- ref_node_assert
- CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `createAdminClient()` - 166 edges
2. `apiErrorResponse()` - 116 edges
3. `next` - 88 edges
4. `Decisiones tomadas` - 77 edges
5. `requireActiveWorkspaceRole()` - 76 edges
6. `dbFailure()` - 74 edges
7. `readApiError()` - 57 edges
8. `invalid()` - 49 edges
9. `CrmClient` - 45 edges
10. `createClient()` - 43 edges

## Surprising Connections (you probably didn't know these)
- `Vercel daily crons (flows, deliver, ghl-sync)` --semantically_similar_to--> `Deploy a Vercel workflow`  [INFERRED] [semantically similar]
  DEPLOY_RUNBOOK.md → .github/workflows/deploy.yml
- `Decisiones tomadas` --references--> `Row`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/testing/fake-supabase.ts
- `F6 — Stripe y onboarding de Levy` --references--> `getWorkspaceBillingState()`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/billing/workspace-billing.ts
- `Registro de iteraciones` --references--> `IntegrationProvider`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/integrations/secrets.ts
- `Estado real vs. inventario (F0.1, 2026-11-02)` --references--> `createCompanyWithOwner()`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/admin-companies.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Paid client auto-provisioning flow** — deploy_runbook_ghl_purchase_webhook, deploy_runbook_ghl_tags, deploy_runbook_auth_confirm, deploy_runbook_levy_purchase_webhook_secret [EXTRACTED 1.00]
- **Vercel Hobby plan workarounds** — _github_workflows_deploy, deploy_runbook_vercel_daily_crons, deploy_runbook_external_scheduler [INFERRED 0.75]
- **Inbound WhatsApp to AI reply pipeline** — deploy_runbook_ycloud_webhook_url, deploy_runbook_ai_buffer, deploy_runbook_vercel_daily_crons, deploy_runbook_cron_secret, readme_ycloud [INFERRED 0.85]
- **Next.js starter footer link icons (Learn/Examples/Go to nextjs.org)** — public_file_icon, public_window_icon, public_globe_icon [INFERRED 0.85]
- **Default create-next-app public/ icon set (likely unused leftovers)** — public_file_icon, public_globe_icon, public_next_logo, public_vercel_logo, public_window_icon [INFERRED 0.85]

## Communities (93 total, 19 thin omitted)

### Community 0 - "shared.tsx"
Cohesion: 0.13
Nodes (38): lucide-react, react, Company, Status, ConnectedBanner(), CopyButton(), Field(), HelpBox() (+30 more)

### Community 1 - "buffer/route.ts"
Cohesion: 0.13
Nodes (34): AgentRow, buildTodayLine(), buildTranscript(), BusinessProfileAsset, callResponsesApi(), ContactMetadata, describeMedia(), ensureAgentIntroduction() (+26 more)

### Community 2 - "FakeQuery"
Cohesion: 0.06
Nodes (12): CascadeRule, compare(), fakeId(), FakeQuery, FakeSupabase, FakeTables, Filter, likeToRegExp() (+4 more)

### Community 3 - "custom-fields.ts"
Cohesion: 0.12
Nodes (30): PATCH(), GET(), POST(), PUT(), requireActiveWorkspaceRole(), Client, createCustomField(), CUSTOM_FIELD_TYPES (+22 more)

### Community 4 - "step-business.tsx"
Cohesion: 0.10
Nodes (46): Chip(), StepBusiness(), addLocation(), next(), patch(), removeLocation(), save(), selectCountry() (+38 more)

### Community 5 - "dbFailure"
Cohesion: 0.12
Nodes (34): POST(), ActivityEntry, ActivityKind, logActivity(), operator, seed(), STAGE_NAMES, CrmError (+26 more)

### Community 6 - "slots.ts"
Cohesion: 0.13
Nodes (30): Registro de iteraciones, AgendaConfig, agendaConfigFromRow(), clampInt(), closedReason(), DAY_KEYS, daySlots(), DEFAULT_SERVICE_MINUTES (+22 more)

### Community 7 - "reminders.ts"
Cohesion: 0.13
Nodes (21): AgendaNoticeConfig, CandidateRow, claim(), DEFAULT_MESSAGES, deliverNotice(), fillNotice(), firstName(), isMessagingWindowOpen() (+13 more)

### Community 8 - "Dependencias y ESLint"
Cohesion: 0.06
Nodes (44): eslintConfig, dependencies, lucide-react@^1.23.0, next@16.2.10, nodemailer@^10.3.1, react@19.2.4, react-dom@19.2.4, stripe@^19.3.0 (+36 more)

### Community 9 - "schema.sql"
Cohesion: 0.06
Nodes (51): app_private.check_agenda_slot(), app_private.reschedule_appointment(), app_private.seed_crm_pipeline_stages(), idx_agents_workspace_id, idx_appointments_no_show_due, idx_billing_events_workspace, idx_integration_secrets_workspace_provider, idx_messages_conversation_id_created_at (+43 more)

### Community 10 - "Decisiones tomadas"
Cohesion: 0.09
Nodes (32): Decisiones tomadas, GET(), runCalendarTool(), ACTIVE_STATUSES, AppointmentStatus, ExternalBusyProvider, CrmJobDeps, CrmJobReport (+24 more)

### Community 11 - "CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code"
Cohesion: 0.20
Nodes (9): CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code, Código de referencia del CRM (portar, no copiar a ciegas), Inventario de GHL a eliminar, Modelo de datos (Supabase, esquema `public`), Objetivo, Onboarding de Levy, Panel, Reglas para cada iteración (+1 more)

### Community 12 - "InboxPanel"
Cohesion: 0.08
Nodes (29): save(), ContactCrmSummary(), nextAppointment(), Summary, ContactCard, ConversationItem, handoffSourceLabel, InboxPanel() (+21 more)

### Community 13 - "apiErrorResponse"
Cohesion: 0.10
Nodes (41): dateParam(), GET(), POST(), DELETE(), POST(), POST(), POST(), DELETE() (+33 more)

### Community 14 - "tasks.ts"
Cohesion: 0.24
Nodes (14): POST(), Context, DELETE(), PATCH(), optionalText(), assertMember(), createdByFor(), createTask() (+6 more)

### Community 15 - "agent-agenda.test.ts"
Cohesion: 0.15
Nodes (21): ACTIVE, deps, NOW, buildCalendarContext(), buildCalendarToolDefinitions(), buildChangesContext(), buildDirectAvailabilityAnswer(), buildDirectBookingAnswer() (+13 more)

### Community 16 - "agent-settings.tsx"
Cohesion: 0.10
Nodes (42): AgentConfig, AgentItem, AgentSettings(), createBaseAgent(), deleteAgent(), saveAgent(), selectAgent(), AgentSettingsProps (+34 more)

### Community 17 - "calendar-request.ts"
Cohesion: 0.19
Nodes (15): addDaysToDateKey(), CalendarRequestContext, dateKeyInTimezone(), months, normalize(), parseDateKey(), ParsedTime, parseTime() (+7 more)

### Community 18 - "secrets.ts"
Cohesion: 0.14
Nodes (15): POST(), POST(), POST(), appUrl, geistMono, geistSans, metadata, viewport (+7 more)

### Community 19 - "WorkspaceSectionPage"
Cohesion: 0.19
Nodes (11): AgentsPage(), AutomationsPage(), TeamPage(), IntegrationsPage(), KnowledgeBasePage(), TemplatesPage(), ToolsPage(), emptyResult (+3 more)

### Community 20 - "dbFailure"
Cohesion: 0.27
Nodes (12): Context, DELETE(), GET(), PATCH(), listActivity(), getContactCard(), updateContact(), eraseContact() (+4 more)

### Community 21 - "billing.test.ts"
Cohesion: 0.18
Nodes (18): BillingNotice(), formatDate(), readState(), daysAgo(), fake(), NOW, row(), DEFAULT_GRACE_DAYS (+10 more)

### Community 22 - "Configuración de TypeScript"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 23 - "[contactId]/tags/route.ts"
Cohesion: 0.33
Nodes (7): Context, POST(), GET(), isAuthorized(), maxDuration, POST(), triggerDeliver()

### Community 24 - "public.conversations"
Cohesion: 0.13
Nodes (23): idx_flow_answer_reviews_workspace_status, idx_flow_events_workspace_created, idx_flow_runs_conversation_status, idx_flow_runs_workspace_contact_status, idx_flows_workspace_status, public.flow_answer_reviews, public.flow_events, public.flow_runs (+15 more)

### Community 25 - "google-calendar.test.ts"
Cohesion: 0.15
Nodes (18): Lógica en Next.js, decryptSecret(), encryptSecret(), getKey(), buildEventBody(), calendarFetch(), deleteEvent(), eventIdForAppointment() (+10 more)

### Community 26 - "20261102200000_crm_core.sql"
Cohesion: 0.10
Nodes (34): idx_contacts_automation_labels, app_private.seed_crm_pipeline_stages(), app_private.seed_crm_pipeline_stages_trigger(), idx_contacts_workspace_last_message, idx_contacts_workspace_stage, idx_crm_contact_activity_actor_user, idx_crm_contact_activity_workspace_contact, idx_crm_contact_notes_author (+26 more)

### Community 27 - "admin.test.ts"
Cohesion: 0.50
Nodes (5): assertWorkspace(), BillingAdminError, updateWorkspaceBillingAdmin(), buildPaymentLinkUrl(), normalizeStripeCustomerId()

### Community 28 - "webhook.test.ts"
Cohesion: 0.18
Nodes (7): StripeWebhookDeps, config, deps(), NOW, signedEvent(), stripeSdk, verifyStripeEvent()

### Community 29 - "google-calendar.ts"
Cohesion: 0.15
Nodes (27): GET(), POST(), buildAuthUrl(), CallbackResult, completeGoogleCallback(), INTEGRATIONS_PATH, createOAuthState(), depsOf() (+19 more)

### Community 30 - "public.workspaces"
Cohesion: 0.15
Nodes (17): app_private.has_workspace_role(), app_private.is_workspace_member(), idx_integrations_workspace_id, idx_workspace_members_user_id, public.integrations, public.workspace_members, public.workspaces, seed_crm_pipeline_stages_on_workspace (+9 more)

### Community 31 - "flow-engine.ts"
Cohesion: 0.11
Nodes (22): contactAudienceLabels(), flowMatchesTags(), addMinutes(), AdminClient, calculateProcessImpact(), ContactRow, ConversationContext, FLOW_OPT_OUT_LABEL (+14 more)

### Community 32 - "WorkspaceSettings"
Cohesion: 0.07
Nodes (34): AgendaOption, AgentItem, asRecord(), buildAssetDraft(), fieldHelp(), hashToTab, IntegrationItem, IntegrationTestResult (+26 more)

### Community 33 - "panel-header.tsx"
Cohesion: 0.17
Nodes (13): findTarget(), GuidedTour(), readSeenLocally(), Rect, START_TOUR_EVENT, storageKey(), TourLauncher(), AppSection (+5 more)

### Community 34 - "steps"
Cohesion: 0.08
Nodes (23): concurrency, cancel-in-progress, group, env, runs-on, steps, timeout-minutes, VERCEL_ORG_ID (+15 more)

### Community 35 - "test-prompt/route.ts"
Cohesion: 0.14
Nodes (22): AgentLike, buildIdentityContext(), buildInstructions(), BusinessProfileAsset, getAgentIdentity(), getKnowledgeAssetIds(), getOpenAIModel(), getResponseText() (+14 more)

### Community 36 - "executeRun"
Cohesion: 0.24
Nodes (25): parseFlowSteps(), completeCheckpoint(), decideFlowAnswerReview(), executeRun(), findNextStep(), findStep(), getAnswers(), getFlowOptionMetadata() (+17 more)

### Community 37 - "agent-agenda.ts"
Cohesion: 0.14
Nodes (24): AgendaCalendarRuntime, AgendaRuntimeCalendar, AgendaRuntimeDeps, alternativesFor(), buildAgendaRuntime(), failureWithAlternatives(), formatSlot(), pickUpcoming() (+16 more)

### Community 38 - "AdminConsole"
Cohesion: 0.36
Nodes (8): AdminConsole(), addSuperadmin(), createCompany(), deleteJson(), linkOwner(), openCompany(), postJson(), removeSuperadmin()

### Community 39 - "Iconos del scaffold Next"
Cohesion: 0.40
Nodes (6): File/Document Icon (gray 16x16, page with folded corner and text lines), Globe Icon (gray 16x16, world/web symbol), Next.js Wordmark Logo (black), Default create-next-app Scaffold Assets, Vercel Triangle Logo (white), Browser Window Icon (gray 16x16, window with three dots)

### Community 40 - "calendar-tools.ts"
Cohesion: 0.21
Nodes (16): F5 — Agente, flujos y panel sin GHL, Cambios en lo existente, buildCalendarRuntime(), asRecord(), CALENDAR_TOOL_TYPE, CalendarTool, CalendarToolMetadata, CONTACT_CALENDAR_KEY (+8 more)

### Community 41 - "webhook.ts"
Cohesion: 0.20
Nodes (20): BillingRow, billingRowBy(), customFieldValue(), handleCheckout(), handleSubscriptionChange(), idOf(), invoiceSubscriptionId(), ownedWorkspaceId() (+12 more)

### Community 42 - "lucide-react"
Cohesion: 0.07
Nodes (44): Verificación final, ACTIVITY_LABELS, activityDetail(), ACTOR_LABELS, Block(), ContactDrawer(), call(), FieldInput() (+36 more)

### Community 43 - "deliver/route.ts"
Cohesion: 0.16
Nodes (20): configString(), ContactRow, GET(), getInteractiveOptions(), IntegrationRow, InteractiveOption, isAuthorized(), POST() (+12 more)

### Community 44 - "Tareas"
Cohesion: 0.12
Nodes (15): Decisiones pendientes (las responde el usuario; mientras, sigue con otras tareas), Entorno, F0 — Preparación, F1 — Modelo de datos del CRM (aditivo), F3 — Google Calendar por workspace, F4 — Jobs y recordatorios, F6 — Stripe y onboarding de Levy, F7 — Migración de datos y limpieza (+7 more)

### Community 51 - "billing-card.tsx"
Cohesion: 0.39
Nodes (6): BusinessPage(), BillingActions(), openPortal(), BillingCard(), STATUS_LABELS, getWorkspaceBillingRow()

### Community 52 - "app_private.book_appointment"
Cohesion: 0.17
Nodes (6): app_private.book_appointment(), app_private.check_agenda_slot(), app_private.reschedule_appointment(), idx_appointments_no_show_due, app_private.book_appointment(), public.crm_contact_activity

### Community 53 - "flow-answer-verifier.ts"
Cohesion: 0.60
Nodes (5): extractOutputText(), getRecord(), validateAnswerLocally(), VerificationResult, verifyFlowAnswer()

### Community 54 - "timezones.ts"
Cohesion: 0.31
Nodes (14): F2 — Lógica del CRM y la Agenda, getAgendaFreeSlots(), freeSlots(), addDaysToDateKey(), dateKeyInTimeZone(), getZonedParts(), isValidTimeZone(), parseDateKey() (+6 more)

### Community 55 - "flow-builder.tsx"
Cohesion: 0.10
Nodes (30): ActionsEditor(), patchAction(), replaceCrm(), AgentItem, CrmActionFields(), FlowBuilderProps, FlowCrmOptions, FlowRunItem (+22 more)

### Community 56 - "import-export.ts"
Cohesion: 0.11
Nodes (23): RFC-4180, GET(), POST(), CrmContact, csvSafe(), csvUnsafe(), FORMULA_STARTS, parseCsv() (+15 more)

### Community 57 - "20261102210000_agenda_core.sql"
Cohesion: 0.29
Nodes (9): public.agendas, public.appointments, public.google_event_deletions, public.offered_slots, public.schedule_blocks, set_agendas_updated_at, set_appointments_updated_at, set_google_event_deletions_updated_at (+1 more)

### Community 58 - "agendas.ts"
Cohesion: 0.07
Nodes (45): PATCH(), GET(), POST(), agent, MONDAY_10, NOW, operator, seed() (+37 more)

### Community 59 - "wizard.tsx"
Cohesion: 0.17
Nodes (18): OnboardingProgressCard(), SupportContact(), getFirstPendingStep(), getOnboardingState(), getOnboardingStep(), getPendingSteps(), isStepDone(), OnboardingState (+10 more)

### Community 60 - "Auditoria de rendimiento 2026-10-09"
Cohesion: 0.17
Nodes (7): nextConfig, Auditoria de rendimiento 2026-10-09, AppShell monolith (1350 lines), Per-route client bundle split, idx_conversations_workspace_last_message index (not applied), Incremental inbox snapshot (pending), Shared (panel) layout

### Community 61 - "panel-context.ts"
Cohesion: 0.32
Nodes (9): AgendaPage(), emptyResult, FlujosPage(), ObservabilityPage(), PanelPage(), getPanelContext, PanelContext, getDeployReadiness() (+1 more)

### Community 62 - "workspaces.ts"
Cohesion: 0.16
Nodes (20): GET(), GET(), asStateRecord(), patchOnboardingState(), POST(), requireUser(), withDefaultConversationMode(), callbackRedirectPath() (+12 more)

### Community 63 - "ycloud-webhook.ts"
Cohesion: 0.09
Nodes (34): server-only, maxDuration, POST(), maxDuration, POST(), findOrCreateOpenConversation(), OpenConversation, recordInboundMessage() (+26 more)

### Community 64 - "meeting/route.ts"
Cohesion: 0.06
Nodes (57): PATCH(), cancelExisting(), emailAfterResponse(), GET(), meetingEngine(), POST(), readWorkspace(), readWorkspaceCode() (+49 more)

### Community 65 - "agency-crm.ts"
Cohesion: 0.17
Nodes (19): AgencyContactInput, AgencyContactResult, agencyWorkspaceCode(), bucket(), ensureFields(), ensureTag(), FIELDS, findContactId() (+11 more)

### Community 66 - "Runbook de despliegue"
Cohesion: 0.05
Nodes (40): Deploy a Vercel workflow, deploy job (vercel pull + vercel deploy --prod), Vercel CLI, VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID secrets, AGENTS.md agent instructions, graphify, Alineacion con el curso, Gaps vs lesson 05 (Vercel deploy, real WhatsApp round-trip, GHL test) (+32 more)

### Community 67 - "contacts.ts"
Cohesion: 0.14
Nodes (32): GET(), POST(), ClientsPage(), CONTACT_SOURCES, ContactSearch, ContactSource, createContact(), CreateContactInput (+24 more)

### Community 68 - "supabase/admin.ts"
Cohesion: 0.18
Nodes (14): Check, envCheck(), GET(), incrementalTables, recommendedEnv, requiredEnv, requiredTables, tableCheck() (+6 more)

### Community 69 - "next"
Cohesion: 0.09
Nodes (32): next, signOut(), AdminPage(), POST(), PATCH(), POST(), assertCurrentUserIsAdmin(), DELETE() (+24 more)

### Community 71 - "FlowBuilder"
Cohesion: 0.22
Nodes (15): FlowBuilder(), addStage(), createEmptyFlow(), createTemplate(), moveSelectedStep(), saveFlow(), updateDraft(), updateStage() (+7 more)

### Community 72 - "(panel)/page.tsx"
Cohesion: 0.27
Nodes (8): @supabase/supabase-js, emptyResult, Home(), BUSINESS_METRICS_WINDOW_DAYS, BusinessMetrics, getBusinessMetrics(), getContactMetadata(), stableTime()

### Community 74 - "panel-data.ts"
Cohesion: 0.29
Nodes (10): buildDefaultAgentConfig(), buildDefaultAgentPrompt(), DEFAULT_AGENT_PROMPT_VERSION, DefaultAgentPreset, defaultAgentPresets, deployChecks, getAuthDisplayName(), getConfigRecord() (+2 more)

### Community 75 - "agenda-panel.tsx"
Cohesion: 0.10
Nodes (30): Estado real vs. inventario (F0.1, 2026-11-02), AppointmentDialog(), act(), BlockDialog(), save(), Modal(), NewAppointmentDialog(), save() (+22 more)

### Community 76 - "20261103020000_billing.sql"
Cohesion: 0.48
Nodes (6): idx_billing_events_workspace, idx_workspace_billing_status, public.billing_events, public.workspace_billing, set_billing_events_updated_at, set_workspace_billing_updated_at

### Community 77 - "welcome-page.ts"
Cohesion: 0.09
Nodes (38): Stripe (Payment Link externo), stripe, POST(), FAILURES, POST(), POST(), figtree, loadState() (+30 more)

### Community 84 - "(panel)/layout.tsx"
Cohesion: 0.31
Nodes (6): PanelLayout(), IntentLink(), sidebarItems, SidebarNav(), WorkspaceOption, WorkspaceSwitcher()

### Community 86 - "ref_node_test"
Cohesion: 0.18
Nodes (15): AdminClient, applyConversationHandoff(), buildHandoffContext(), buildHandoffNote(), ConversationHandoffInfo, detectAnswerHandoff(), findHandoffKeyword(), getHandoffKeywords() (+7 more)

### Community 90 - "requireWorkspaceRole"
Cohesion: 0.10
Nodes (28): excludeExistingContacts(), FlowPayload, POST(), stringArray(), GET(), getMetadataRecord(), getYCloudContactName(), stableTime() (+20 more)

### Community 95 - "ref_node_assert"
Cohesion: 0.20
Nodes (7): NOW, client(), client(), deps, ENV, GOOGLE_SCOPES, createCrmFake()

## Knowledge Gaps
- **24 isolated node(s):** `RFC-4180`, `File/Document Icon (gray 16x16, page with folded corner and text lines)`, `Globe Icon (gray 16x16, world/web symbol)`, `Browser Window Icon (gray 16x16, window with three dots)`, `idx_conversations_workspace_last_message index (not applied)` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 554 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createAdminClient()` connect `apiErrorResponse` to `buffer/route.ts`, `custom-fields.ts`, `dbFailure`, `Decisiones tomadas`, `CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code`, `tasks.ts`, `secrets.ts`, `dbFailure`, `billing.test.ts`, `[contactId]/tags/route.ts`, `google-calendar.ts`, `agent-agenda.ts`, `calendar-tools.ts`, `deliver/route.ts`, `billing-card.tsx`, `import-export.ts`, `agendas.ts`, `panel-context.ts`, `workspaces.ts`, `ycloud-webhook.ts`, `meeting/route.ts`, `contacts.ts`, `supabase/admin.ts`, `next`, `(panel)/page.tsx`, `panel-data.ts`, `welcome-page.ts`, `requireWorkspaceRole`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `createAdminClient()` (e.g. with `Decisiones tomadas` and `Reglas para cada iteración`) actually correct?**
  _`createAdminClient()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-4180`, `File/Document Icon (gray 16x16, page with folded corner and text lines)`, `Globe Icon (gray 16x16, world/web symbol)` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `shared.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1336963097398669 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `shared.tsx`, `buffer/route.ts`, `custom-fields.ts`, `dbFailure`, `Dependencias y ESLint`, `Decisiones tomadas`, `InboxPanel`, `apiErrorResponse`, `tasks.ts`, `secrets.ts`, `dbFailure`, `billing.test.ts`, `[contactId]/tags/route.ts`, `google-calendar.ts`, `test-prompt/route.ts`, `agent-agenda.ts`, `lucide-react`, `deliver/route.ts`, `import-export.ts`, `agendas.ts`, `wizard.tsx`, `Auditoria de rendimiento 2026-10-09`, `panel-context.ts`, `workspaces.ts`, `ycloud-webhook.ts`, `meeting/route.ts`, `contacts.ts`, `supabase/admin.ts`, `welcome-page.ts`, `(panel)/layout.tsx`, `requireWorkspaceRole`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `apiErrorResponse()` (e.g. with `Decisiones tomadas` and `Registro de iteraciones`) actually correct?**
  _`apiErrorResponse()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `buffer/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12941176470588237 - nodes in this community are weakly interconnected._