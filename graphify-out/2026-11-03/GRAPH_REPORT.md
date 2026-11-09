# Graph Report - Agency  (2026-11-03)

## Corpus Check
- 308 files · ~212,694 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .example 1, .ico 1)

## Summary
- 2251 nodes · 7097 edges · 95 communities (77 shown, 18 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 198 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d15092db`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- shared.tsx
- buffer/route.ts
- FakeQuery
- custom-fields.ts
- step-business.tsx
- migrate-ghl-to-crm.ts
- slots.ts
- reminders.ts
- Dependencias y ESLint
- schema.sql
- agent-tools.ts
- purchase/route.ts
- google-sync.ts
- apiErrorResponse
- InboxPanel
- requireWorkspaceRole
- step-agents.tsx
- calendar-request.ts
- api-error.ts
- panel-data.ts
- (panel)/layout.tsx
- billing.test.ts
- Configuración de TypeScript
- dbFailure
- public.conversations
- send/route.ts
- 20261102200000_crm_core.sql
- fake-supabase.ts
- google-calendar.ts
- gmail.ts
- public.workspaces
- executeRun
- WorkspaceSettings
- crm-jobs/route.ts
- steps
- test-prompt/route.ts
- dbFailure
- agent-agenda.ts
- AdminConsole
- Iconos del scaffold Next
- calendar-tools.ts
- webhook.ts
- lucide-react
- InboxPanel
- Tareas
- Crons de Vercel
- Configuración de PostCSS
- step-agents.tsx
- app_private.book_appointment
- welcome-page.ts
- lucide-react
- flow-builder.tsx
- import-export.ts
- 20261102210000_agenda_core.sql
- invalid
- wizard.tsx
- contacts.ts
- agent-guards.ts
- workspaces.ts
- ycloud-webhook.ts
- gmail.test.ts
- agency-crm.ts
- Runbook de despliegue
- convertGhlActionToCrm
- readiness/route.ts
- createClient
- agent-prompt.ts
- FlowBuilder
- handoff.ts
- createClient
- webhook.test.ts
- agenda-panel.tsx
- 20261103020000_billing.sql
- stripe/route.ts
- app_private.invoke_crm_jobs
- badRequest
- server-only
- timezones.ts
- snapshot/route.ts
- flow-answer-verifier.ts

## God Nodes (most connected - your core abstractions)
1. `createAdminClient()` - 191 edges
2. `apiErrorResponse()` - 128 edges
3. `next` - 98 edges
4. `requireActiveWorkspaceRole()` - 84 edges
5. `Decisiones tomadas` - 81 edges
6. `dbFailure()` - 77 edges
7. `readApiError()` - 60 edges
8. `invalid()` - 51 edges
9. `CrmClient` - 48 edges
10. `createClient()` - 43 edges

## Surprising Connections (you probably didn't know these)
- `Vercel daily crons (flows, deliver, ghl-sync)` --semantically_similar_to--> `Deploy a Vercel workflow`  [INFERRED] [semantically similar]
  DEPLOY_RUNBOOK.md → .github/workflows/deploy.yml
- `Decisiones tomadas` --references--> `agenda()`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/agenda/reminders.test.ts
- `Decisiones tomadas` --references--> `config()`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/agenda/slots.test.ts
- `Registro de iteraciones` --references--> `IntegrationProvider`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/integrations/secrets.ts
- `Decisiones tomadas` --references--> `Row`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/testing/fake-supabase.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Paid client auto-provisioning flow** — deploy_runbook_ghl_purchase_webhook, deploy_runbook_ghl_tags, deploy_runbook_auth_confirm, deploy_runbook_levy_purchase_webhook_secret [EXTRACTED 1.00]
- **Vercel Hobby plan workarounds** — _github_workflows_deploy, deploy_runbook_vercel_daily_crons, deploy_runbook_external_scheduler [INFERRED 0.75]
- **Inbound WhatsApp to AI reply pipeline** — deploy_runbook_ycloud_webhook_url, deploy_runbook_ai_buffer, deploy_runbook_vercel_daily_crons, deploy_runbook_cron_secret, readme_ycloud [INFERRED 0.85]
- **Next.js starter footer link icons (Learn/Examples/Go to nextjs.org)** — public_file_icon, public_window_icon, public_globe_icon [INFERRED 0.85]
- **Default create-next-app public/ icon set (likely unused leftovers)** — public_file_icon, public_globe_icon, public_next_logo, public_vercel_logo, public_window_icon [INFERRED 0.85]

## Communities (95 total, 18 thin omitted)

### Community 0 - "shared.tsx"
Cohesion: 0.21
Nodes (28): ConnectedBanner(), CopyButton(), Field(), HelpBox(), HowTo(), inputClass, linkButton, Notice() (+20 more)

### Community 1 - "buffer/route.ts"
Cohesion: 0.14
Nodes (31): AgentRow, buildInstructions(), buildTimeContext(), buildTodayLine(), buildTranscript(), BusinessProfileAsset, callResponsesApi(), ContactMetadata (+23 more)

### Community 2 - "FakeQuery"
Cohesion: 0.06
Nodes (12): CascadeRule, compare(), fakeId(), FakeQuery, FakeSupabase, FakeTables, Filter, likeToRegExp() (+4 more)

### Community 3 - "custom-fields.ts"
Cohesion: 0.14
Nodes (20): Client, createCustomField(), CUSTOM_FIELD_TYPES, CustomFieldDefinition, CustomFieldDefinitionInput, CustomFieldType, CustomFieldValue, CustomFieldValues (+12 more)

### Community 4 - "step-business.tsx"
Cohesion: 0.10
Nodes (46): Chip(), StepBusiness(), addLocation(), next(), patch(), removeLocation(), save(), selectCountry() (+38 more)

### Community 5 - "migrate-ghl-to-crm.ts"
Cohesion: 0.12
Nodes (30): ACTOR, API, APPLY, asRecord(), ghl(), GhlContext, LIMIT, main() (+22 more)

### Community 6 - "slots.ts"
Cohesion: 0.13
Nodes (21): AgendaConfig, agendaConfigFromRow(), clampInt(), DAY_KEYS, DEFAULT_SERVICE_MINUTES, DEFAULT_WEEKLY_SCHEDULE, Interval, normalizeText() (+13 more)

### Community 7 - "reminders.ts"
Cohesion: 0.12
Nodes (23): ACTIVE_STATUSES, AgendaNoticeConfig, CandidateRow, claim(), DEFAULT_MESSAGES, deliverNotice(), fillNotice(), firstName() (+15 more)

### Community 8 - "Dependencias y ESLint"
Cohesion: 0.06
Nodes (42): eslintConfig, dependencies, lucide-react@^1.23.0, next@16.2.10, react@19.2.4, react-dom@19.2.4, stripe@^19.3.0, @supabase/ssr@^0.12.0 (+34 more)

### Community 9 - "schema.sql"
Cohesion: 0.06
Nodes (51): app_private.check_agenda_slot(), app_private.reschedule_appointment(), app_private.seed_crm_pipeline_stages(), idx_agents_workspace_id, idx_appointments_no_show_due, idx_billing_events_workspace, idx_integration_secrets_workspace_provider, idx_messages_conversation_id_created_at (+43 more)

### Community 10 - "agent-tools.ts"
Cohesion: 0.05
Nodes (82): configString(), ContactRow, GET(), HighLevelContactResponse, IntegrationRow, isAuthorized(), metadataTags(), POST() (+74 more)

### Community 11 - "purchase/route.ts"
Cohesion: 0.10
Nodes (37): CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code, Código de referencia del CRM (portar, no copiar a ciegas), Inventario de GHL a eliminar, Modelo de datos (Supabase, esquema `public`), Objetivo, Onboarding de Levy, Panel, Stripe (Payment Link externo) (+29 more)

### Community 12 - "google-sync.ts"
Cohesion: 0.18
Nodes (19): Decisiones tomadas, AppointmentStatus, ExternalBusyProvider, runCrmJobs(), AgendaSync, clearPending(), connectedWorkspaces(), eventSummary() (+11 more)

### Community 13 - "apiErrorResponse"
Cohesion: 0.09
Nodes (52): PATCH(), GET(), POST(), DELETE(), POST(), GET(), POST(), POST() (+44 more)

### Community 14 - "InboxPanel"
Cohesion: 0.12
Nodes (17): ContactCrmSummary(), nextAppointment(), Summary, ContactCard, ConversationItem, handoffSourceLabel, InboxPanelProps, InboxView (+9 more)

### Community 15 - "requireWorkspaceRole"
Cohesion: 0.10
Nodes (28): POST(), POST(), webhookUrl(), POST(), OpenAIResponsePayload, POST(), GET(), POST() (+20 more)

### Community 16 - "step-agents.tsx"
Cohesion: 0.17
Nodes (23): AgentConfig, AgentItem, AgentSettings(), createBaseAgent(), deleteAgent(), saveAgent(), selectAgent(), AgentSettingsProps (+15 more)

### Community 17 - "calendar-request.ts"
Cohesion: 0.18
Nodes (16): addDaysToDateKey(), CalendarRequestContext, CalendarRequestMessage, dateKeyInTimezone(), months, normalize(), parseDateKey(), ParsedTime (+8 more)

### Community 18 - "api-error.ts"
Cohesion: 0.09
Nodes (31): Reglas para cada iteración, deliverQueuedReviewMessages(), POST(), ReviewPayload, excludeExistingContacts(), FlowPayload, POST(), stringArray() (+23 more)

### Community 19 - "panel-data.ts"
Cohesion: 0.05
Nodes (53): nextConfig, Auditoria de rendimiento 2026-10-09, AppShell monolith (1350 lines), Per-route client bundle split, idx_conversations_workspace_last_message index (not applied), Incremental inbox snapshot (pending), Shared (panel) layout, AgendaPage() (+45 more)

### Community 20 - "(panel)/layout.tsx"
Cohesion: 0.26
Nodes (8): PanelLayout(), BillingNotice(), formatDate(), IntentLink(), sidebarItems, SidebarNav(), WorkspaceOption, WorkspaceSwitcher()

### Community 21 - "billing.test.ts"
Cohesion: 0.17
Nodes (20): BillingActions(), openPortal(), BillingCard(), STATUS_LABELS, readState(), daysAgo(), fake(), NOW (+12 more)

### Community 22 - "Configuración de TypeScript"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 23 - "dbFailure"
Cohesion: 0.08
Nodes (39): agent, MONDAY_10, NOW, operator, seed(), Agenda, getAgenda(), AppointmentCreator (+31 more)

### Community 24 - "public.conversations"
Cohesion: 0.13
Nodes (23): idx_flow_answer_reviews_workspace_status, idx_flow_events_workspace_created, idx_flow_runs_conversation_status, idx_flow_runs_workspace_contact_status, idx_flows_workspace_status, public.flow_answer_reviews, public.flow_events, public.flow_runs (+15 more)

### Community 25 - "send/route.ts"
Cohesion: 0.32
Nodes (7): configString(), ContactRow, ConversationRow, IntegrationRow, POST(), sendYCloudText(), YCloudSendResult

### Community 26 - "20261102200000_crm_core.sql"
Cohesion: 0.10
Nodes (34): idx_contacts_automation_labels, app_private.seed_crm_pipeline_stages(), app_private.seed_crm_pipeline_stages_trigger(), idx_contacts_workspace_last_message, idx_contacts_workspace_stage, idx_crm_contact_activity_actor_user, idx_crm_contact_activity_workspace_contact, idx_crm_contact_notes_author (+26 more)

### Community 27 - "fake-supabase.ts"
Cohesion: 0.21
Nodes (8): NOW, assertWorkspace(), BillingAdminError, client(), updateWorkspaceBillingAdmin(), buildPaymentLinkUrl(), normalizeStripeCustomerId(), createCrmFake()

### Community 28 - "google-calendar.ts"
Cohesion: 0.10
Nodes (28): buildEventBody(), calendarFetch(), callbackRedirectPath(), deps, ENV, createOAuthState(), eventIdForAppointment(), failure() (+20 more)

### Community 29 - "gmail.ts"
Cohesion: 0.15
Nodes (29): RFC-2047, bodyPart(), buildRawMessage(), disconnectGmail(), encodeHeaderText(), exchangeGmailCode(), GMAIL_SCOPES, gmailConnectUrl() (+21 more)

### Community 30 - "public.workspaces"
Cohesion: 0.15
Nodes (17): app_private.has_workspace_role(), app_private.is_workspace_member(), idx_integrations_workspace_id, idx_workspace_members_user_id, public.integrations, public.workspace_members, public.workspaces, seed_crm_pipeline_stages_on_workspace (+9 more)

### Community 31 - "executeRun"
Cohesion: 0.12
Nodes (47): contactAudienceLabels(), parseFlowSteps(), addMinutes(), AdminClient, calculateProcessImpact(), completeCheckpoint(), ContactRow, ConversationContext (+39 more)

### Community 32 - "WorkspaceSettings"
Cohesion: 0.07
Nodes (32): AgentItem, asRecord(), buildAssetDraft(), fieldHelp(), hashToTab, IntegrationItem, IntegrationTestResult, providers (+24 more)

### Community 33 - "crm-jobs/route.ts"
Cohesion: 0.43
Nodes (6): GET(), isAuthorized(), maxDuration, POST(), listBlockedWorkspaceIds(), triggerDeliver()

### Community 34 - "steps"
Cohesion: 0.08
Nodes (23): concurrency, cancel-in-progress, group, env, runs-on, steps, timeout-minutes, VERCEL_ORG_ID (+15 more)

### Community 35 - "test-prompt/route.ts"
Cohesion: 0.19
Nodes (18): AgentLike, buildIdentityContext(), buildInstructions(), BusinessProfileAsset, getAgentIdentity(), getKnowledgeAssetIds(), getOpenAIModel(), getResponseText() (+10 more)

### Community 36 - "dbFailure"
Cohesion: 0.12
Nodes (41): ClientsPage(), assertConversationInWorkspace(), upcomingAppointmentsForContact(), listActivity(), getContactCard(), searchContacts(), operator, seed() (+33 more)

### Community 37 - "agent-agenda.ts"
Cohesion: 0.20
Nodes (18): AgendaRuntimeCalendar, AgendaRuntimeDeps, alternativesFor(), failureWithAlternatives(), formatSlot(), pickUpcoming(), resolveStart(), runAgendaTool() (+10 more)

### Community 38 - "AdminConsole"
Cohesion: 0.36
Nodes (8): AdminConsole(), addSuperadmin(), createCompany(), deleteJson(), linkOwner(), openCompany(), postJson(), removeSuperadmin()

### Community 39 - "Iconos del scaffold Next"
Cohesion: 0.40
Nodes (6): File/Document Icon (gray 16x16, page with folded corner and text lines), Globe Icon (gray 16x16, world/web symbol), Next.js Wordmark Logo (black), Default create-next-app Scaffold Assets, Vercel Triangle Logo (white), Browser Window Icon (gray 16x16, window with three dots)

### Community 40 - "calendar-tools.ts"
Cohesion: 0.11
Nodes (32): F5 — Agente, flujos y panel sin GHL, Cambios en lo existente, AgendaCalendarRuntime, buildAgendaRuntime(), setup(), upcomingFor(), buildCalendarRuntime(), buildGhlCalendarRuntime() (+24 more)

### Community 41 - "webhook.ts"
Cohesion: 0.19
Nodes (21): AgencyContactInput, AgencyContactResult, StripeSubscriptionStatus, BillingRow, billingRowBy(), customFieldValue(), handleCheckout(), handleSubscriptionChange() (+13 more)

### Community 42 - "lucide-react"
Cohesion: 0.07
Nodes (45): Verificación final, ACTIVITY_LABELS, activityDetail(), ACTOR_LABELS, Block(), ContactDrawer(), call(), FieldInput() (+37 more)

### Community 43 - "InboxPanel"
Cohesion: 0.16
Nodes (12): save(), InboxPanel(), handleInternalNote(), handleSend(), handleVisibilityChange(), insertMessage(), refreshNow(), refreshSnapshot() (+4 more)

### Community 44 - "Tareas"
Cohesion: 0.12
Nodes (16): Decisiones pendientes (las responde el usuario; mientras, sigue con otras tareas), Entorno, F0 — Preparación, F1 — Modelo de datos del CRM (aditivo), F2 — Lógica del CRM y la Agenda, F3 — Google Calendar por workspace, F4 — Jobs y recordatorios, F6 — Stripe y onboarding de Levy (+8 more)

### Community 51 - "step-agents.tsx"
Cohesion: 0.23
Nodes (13): OptionCard(), ToggleSwitch(), AgentDraft, createDraft(), getAgentName(), getConfig(), getHandoffKeywords(), getJobTitle() (+5 more)

### Community 52 - "app_private.book_appointment"
Cohesion: 0.17
Nodes (6): app_private.book_appointment(), app_private.check_agenda_slot(), app_private.reschedule_appointment(), idx_appointments_no_show_due, app_private.book_appointment(), public.crm_contact_activity

### Community 53 - "welcome-page.ts"
Cohesion: 0.12
Nodes (23): figtree, loadState(), metadata, WelcomeContent(), WelcomePage(), WelcomeAutoRefresh(), WelcomeResendButton(), resend() (+15 more)

### Community 54 - "lucide-react"
Cohesion: 0.24
Nodes (4): lucide-react, react, Company, Status

### Community 55 - "flow-builder.tsx"
Cohesion: 0.09
Nodes (30): AgentItem, FlowBuilderProps, FlowCrmOptions, FlowRunItem, getFlowCounts(), IntegrationItem, statuses, TriggerConfigEditor() (+22 more)

### Community 56 - "import-export.ts"
Cohesion: 0.16
Nodes (13): RFC-4180, ActivityEntry, ActivityKind, csvSafe(), csvUnsafe(), FORMULA_STARTS, parseCsv(), parseCsvRecords() (+5 more)

### Community 57 - "20261102210000_agenda_core.sql"
Cohesion: 0.29
Nodes (9): public.agendas, public.appointments, public.google_event_deletions, public.offered_slots, public.schedule_blocks, set_agendas_updated_at, set_appointments_updated_at, set_google_event_deletions_updated_at (+1 more)

### Community 58 - "invalid"
Cohesion: 0.15
Nodes (27): AGENDA_COLUMNS, agendaChanges(), AgendaInput, AgendaRow, createAgenda(), getDefaultAgenda(), GoogleSyncMode, intInRange() (+19 more)

### Community 59 - "wizard.tsx"
Cohesion: 0.12
Nodes (26): OnboardingProgressCard(), SupportContact(), WizardAgent, WizardAsset, WizardIntegration, WizardProps, WizardWorkspace, BookedMeeting (+18 more)

### Community 60 - "contacts.ts"
Cohesion: 0.13
Nodes (31): findContactId(), logActivity(), CONTACT_SOURCES, ContactSearch, ContactSource, createContact(), CreateContactInput, CrmContact (+23 more)

### Community 61 - "agent-guards.ts"
Cohesion: 0.14
Nodes (22): ACTIVE, deps, NOW, buildCalendarContext(), buildCalendarToolDefinitions(), buildChangesContext(), buildDirectAvailabilityAnswer(), buildDirectBookingAnswer() (+14 more)

### Community 62 - "workspaces.ts"
Cohesion: 0.14
Nodes (26): GET(), asStateRecord(), patchOnboardingState(), POST(), AdminClient, createCompanyWithOwner(), createDefaultAgentsForWorkspace(), linkOwnerToWorkspace() (+18 more)

### Community 63 - "ycloud-webhook.ts"
Cohesion: 0.06
Nodes (50): configString(), ContactRow, GET(), getInteractiveOptions(), IntegrationRow, InteractiveOption, isAuthorized(), POST() (+42 more)

### Community 64 - "gmail.test.ts"
Cohesion: 0.14
Nodes (15): EmailError, EmailMessage, isEmailConfigured(), sendSystemEmail(), sendViaResend(), ENV, getGmailStatus(), GMAIL_SEND_SCOPE (+7 more)

### Community 65 - "agency-crm.ts"
Cohesion: 0.13
Nodes (32): agencyWorkspaceCode(), bucket(), ensureFields(), ensureTag(), FIELDS, LEVY_ACTIVE_TAG, LEVY_TAGS, markAgencyContactActiveInCrm() (+24 more)

### Community 66 - "Runbook de despliegue"
Cohesion: 0.05
Nodes (40): Deploy a Vercel workflow, deploy job (vercel pull + vercel deploy --prod), Vercel CLI, VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID secrets, AGENTS.md agent instructions, graphify, Alineacion con el curso, Gaps vs lesson 05 (Vercel deploy, real WhatsApp round-trip, GHL test) (+32 more)

### Community 67 - "convertGhlActionToCrm"
Cohesion: 0.28
Nodes (9): ActionsEditor(), convertLegacy(), patchAction(), replaceCrm(), CrmActionFields(), getStageLabel(), StepEditor(), convertGhlActionToCrm() (+1 more)

### Community 68 - "readiness/route.ts"
Cohesion: 0.28
Nodes (8): Check, envCheck(), GET(), incrementalTables, recommendedEnv, requiredEnv, requiredTables, tableCheck()

### Community 69 - "createClient"
Cohesion: 0.08
Nodes (38): next, signOut(), AdminPage(), POST(), PATCH(), POST(), POST(), assertCurrentUserIsAdmin() (+30 more)

### Community 70 - "agent-prompt.ts"
Cohesion: 0.38
Nodes (5): AgentPromptParts, agentTones, AgentToneValue, buildAgentPrompt(), getSharedTone()

### Community 71 - "FlowBuilder"
Cohesion: 0.24
Nodes (14): asConfigRecord(), FlowBuilder(), addStage(), createEmptyFlow(), createTemplate(), moveSelectedStep(), saveFlow(), updateDraft() (+6 more)

### Community 72 - "handoff.ts"
Cohesion: 0.14
Nodes (20): GET(), getEnabledToolIds(), getKnowledgeAssetIds(), isAuthorized(), POST(), AdminClient, applyConversationHandoff(), buildHandoffContext() (+12 more)

### Community 73 - "createClient"
Cohesion: 0.52
Nodes (5): createClient(), assertSupabaseAdminEnv(), assertSupabaseBrowserEnv(), getSupabaseBrowserEnv(), getSupabaseServerEnv()

### Community 74 - "webhook.test.ts"
Cohesion: 0.17
Nodes (8): stripe, StripeWebhookDeps, config, deps(), NOW, signedEvent(), stripeSdk, verifyStripeEvent()

### Community 75 - "agenda-panel.tsx"
Cohesion: 0.11
Nodes (29): Estado real vs. inventario (F0.1, 2026-11-02), AppointmentDialog(), act(), BlockDialog(), save(), Modal(), NewAppointmentDialog(), save() (+21 more)

### Community 76 - "20261103020000_billing.sql"
Cohesion: 0.48
Nodes (6): idx_billing_events_workspace, idx_workspace_billing_status, public.billing_events, public.workspace_billing, set_billing_events_updated_at, set_workspace_billing_updated_at

### Community 77 - "stripe/route.ts"
Cohesion: 0.26
Nodes (9): POST(), BillingConfig, DEFAULT_COMPANY_FIELD, DEFAULT_GRACE_DAYS, getBillingConfig(), getStripe(), sendWelcomeAccess(), buildWelcomeEmail() (+1 more)

### Community 79 - "badRequest"
Cohesion: 0.36
Nodes (7): PATCH(), dateParam(), GET(), POST(), syncAfterResponse(), listAppointments(), listBlocks()

### Community 84 - "server-only"
Cohesion: 0.17
Nodes (12): server-only, agendaWithCalendar(), Call, connect(), deps, ENV, Route, decryptSecret() (+4 more)

### Community 85 - "timezones.ts"
Cohesion: 0.23
Nodes (23): Registro de iteraciones, Lógica en Next.js, dayLabel(), getAgendaFreeSlots(), closedReason(), daySlots(), distributeSlots(), freeSlots() (+15 more)

### Community 86 - "snapshot/route.ts"
Cohesion: 0.80
Nodes (4): GET(), getMetadataRecord(), getYCloudContactName(), stableTime()

### Community 90 - "flow-answer-verifier.ts"
Cohesion: 0.60
Nodes (5): extractOutputText(), getRecord(), validateAnswerLocally(), VerificationResult, verifyFlowAnswer()

## Knowledge Gaps
- **25 isolated node(s):** `RFC-4180`, `RFC-2047`, `File/Document Icon (gray 16x16, page with folded corner and text lines)`, `Globe Icon (gray 16x16, world/web symbol)`, `Browser Window Icon (gray 16x16, window with three dots)` (+20 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 591 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createAdminClient()` connect `apiErrorResponse` to `buffer/route.ts`, `agent-tools.ts`, `purchase/route.ts`, `google-sync.ts`, `requireWorkspaceRole`, `api-error.ts`, `panel-data.ts`, `billing.test.ts`, `send/route.ts`, `crm-jobs/route.ts`, `dbFailure`, `agent-agenda.ts`, `calendar-tools.ts`, `welcome-page.ts`, `workspaces.ts`, `ycloud-webhook.ts`, `readiness/route.ts`, `createClient`, `handoff.ts`, `createClient`, `stripe/route.ts`, `badRequest`, `snapshot/route.ts`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `createAdminClient()` (e.g. with `Decisiones tomadas` and `Reglas para cada iteración`) actually correct?**
  _`createAdminClient()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-4180`, `RFC-2047`, `File/Document Icon (gray 16x16, page with folded corner and text lines)` to the rest of the system?**
  _25 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `buffer/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14112903225806453 - nodes in this community are weakly interconnected._
- **Why does `next` connect `createClient` to `buffer/route.ts`, `Dependencias y ESLint`, `agent-tools.ts`, `purchase/route.ts`, `apiErrorResponse`, `InboxPanel`, `requireWorkspaceRole`, `api-error.ts`, `panel-data.ts`, `(panel)/layout.tsx`, `billing.test.ts`, `send/route.ts`, `crm-jobs/route.ts`, `test-prompt/route.ts`, `calendar-tools.ts`, `lucide-react`, `welcome-page.ts`, `lucide-react`, `wizard.tsx`, `workspaces.ts`, `ycloud-webhook.ts`, `readiness/route.ts`, `stripe/route.ts`, `badRequest`, `snapshot/route.ts`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `apiErrorResponse()` (e.g. with `Decisiones tomadas` and `Registro de iteraciones`) actually correct?**
  _`apiErrorResponse()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `FakeQuery` be split into smaller, more focused modules?**
  _Cohesion score 0.060129509713228495 - nodes in this community are weakly interconnected._