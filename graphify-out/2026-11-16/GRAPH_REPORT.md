# Graph Report - Agency  (2026-11-15)

## Corpus Check
- 301 files · ~199,497 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .example 1, .ico 1)

## Summary
- 2162 nodes · 6782 edges · 101 communities (82 shown, 19 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 188 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2e013381`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- shared.tsx
- buffer/route.ts
- FakeQuery
- custom-fields.ts
- step-business.tsx
- crm.test.ts
- slots.ts
- reminders.ts
- Dependencias y ESLint
- schema.sql
- google-sync.ts
- CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code
- InboxPanel
- createAdminClient
- import-export.ts
- agent-agenda.test.ts
- agent-settings.tsx
- calendar-request.ts
- panel-data.ts
- WorkspaceSectionPage
- levy-meeting-email.ts
- billing.test.ts
- Configuración de TypeScript
- [contactId]/tags/route.ts
- public.conversations
- panel-header.tsx
- 20261102200000_crm_core.sql
- public-shell.tsx
- webhook.test.ts
- google-calendar.ts
- public.workspaces
- flow-engine.ts
- WorkspaceSettings
- workspace-settings.tsx
- steps
- test-prompt/route.ts
- executeRun
- agent-agenda.ts
- AdminConsole
- Iconos del scaffold Next
- calendar-tools.ts
- webhook.ts
- lucide-react
- onboarding/page.tsx
- agendas.ts
- Crons de Vercel
- Configuración de PostCSS
- deliver/route.ts
- app_private.book_appointment
- flow-answer-verifier.ts
- welcome-page.ts
- flow-builder.tsx
- import-export.test.ts
- 20261102210000_agenda_core.sql
- agendas.ts
- wizard.tsx
- Auditoria de rendimiento 2026-10-09
- next
- meeting/route.ts
- ycloud-webhook.ts
- invalid
- agency-crm.ts
- send/route.ts
- dbFailure
- Runbook de despliegue
- createClient
- Tareas
- FlowBuilder
- ycloud-payload.ts
- shared.ts
- @supabase/supabase-js
- agenda-panel.tsx
- 20261103020000_billing.sql
- bienvenida/page.tsx
- app_private.invoke_crm_jobs
- login/actions.ts
- scripts
- crm-jobs.ts
- ref_node_test
- api-error.ts
- google-sync.test.ts
- panel-data.ts
- CLAUDE.md
- snapshot/route.ts
- clientFetch
- ref_node_assert

## God Nodes (most connected - your core abstractions)
1. `createAdminClient()` - 167 edges
2. `apiErrorResponse()` - 117 edges
3. `next` - 108 edges
4. `clientFetch()` - 97 edges
5. `Decisiones tomadas` - 77 edges
6. `requireActiveWorkspaceRole()` - 76 edges
7. `dbFailure()` - 74 edges
8. `readApiError()` - 62 edges
9. `invalid()` - 49 edges
10. `CrmClient` - 45 edges

## Surprising Connections (you probably didn't know these)
- `Vercel daily crons (flows, deliver, ghl-sync)` --semantically_similar_to--> `Deploy a Vercel workflow`  [INFERRED] [semantically similar]
  DEPLOY_RUNBOOK.md → .github/workflows/deploy.yml
- `Verificación final` --references--> `test()`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/components/onboarding/step-whatsapp.tsx
- `Decisiones tomadas` --references--> `agenda()`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/agenda/reminders.test.ts
- `Decisiones tomadas` --references--> `config()`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/agenda/slots.test.ts
- `F6 — Stripe y onboarding de Levy` --references--> `getWorkspaceBillingState()`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/billing/workspace-billing.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Paid client auto-provisioning flow** — deploy_runbook_ghl_purchase_webhook, deploy_runbook_ghl_tags, deploy_runbook_auth_confirm, deploy_runbook_levy_purchase_webhook_secret [EXTRACTED 1.00]
- **Vercel Hobby plan workarounds** — _github_workflows_deploy, deploy_runbook_vercel_daily_crons, deploy_runbook_external_scheduler [INFERRED 0.75]
- **Inbound WhatsApp to AI reply pipeline** — deploy_runbook_ycloud_webhook_url, deploy_runbook_ai_buffer, deploy_runbook_vercel_daily_crons, deploy_runbook_cron_secret, readme_ycloud [INFERRED 0.85]
- **Next.js starter footer link icons (Learn/Examples/Go to nextjs.org)** — public_file_icon, public_window_icon, public_globe_icon [INFERRED 0.85]
- **Default create-next-app public/ icon set (likely unused leftovers)** — public_file_icon, public_globe_icon, public_next_logo, public_vercel_logo, public_window_icon [INFERRED 0.85]

## Communities (101 total, 19 thin omitted)

### Community 0 - "shared.tsx"
Cohesion: 0.19
Nodes (35): ConnectedBanner(), CopyButton(), Field(), HelpBox(), HowTo(), inputClass, linkButton, Notice() (+27 more)

### Community 1 - "buffer/route.ts"
Cohesion: 0.14
Nodes (33): AgentRow, buildInstructions(), buildTimeContext(), buildTodayLine(), buildTranscript(), BusinessProfileAsset, callResponsesApi(), ContactMetadata (+25 more)

### Community 2 - "FakeQuery"
Cohesion: 0.08
Nodes (4): compare(), fakeId(), FakeQuery, FakeSupabase

### Community 3 - "custom-fields.ts"
Cohesion: 0.14
Nodes (22): ClientsPage(), metadata, ensureFields(), Client, createCustomField(), CUSTOM_FIELD_TYPES, CustomFieldDefinitionInput, CustomFieldType (+14 more)

### Community 4 - "step-business.tsx"
Cohesion: 0.09
Nodes (49): Estado real vs. inventario (F0.1, 2026-11-02), Chip(), StepBusiness(), addLocation(), next(), patch(), removeLocation(), save() (+41 more)

### Community 5 - "crm.test.ts"
Cohesion: 0.15
Nodes (27): logActivity(), createContact(), normalizeSource(), optionalEmail(), updateContact(), operator, seed(), STAGE_NAMES (+19 more)

### Community 6 - "slots.ts"
Cohesion: 0.10
Nodes (46): F2 — Lógica del CRM y la Agenda, Registro de iteraciones, getAgendaFreeSlots(), loadBusyIntervals(), AgendaConfig, agendaConfigFromRow(), clampInt(), closedReason() (+38 more)

### Community 7 - "reminders.ts"
Cohesion: 0.13
Nodes (21): ACTIVE_STATUSES, AgendaNoticeConfig, CandidateRow, claim(), DEFAULT_MESSAGES, deliverNotice(), fillNotice(), isMessagingWindowOpen() (+13 more)

### Community 8 - "Dependencias y ESLint"
Cohesion: 0.10
Nodes (25): eslintConfig, description, devDependencies, eslint@^9, eslint-config-next@16.2.10, server-only@^0.0.1, tailwindcss@^4, @tailwindcss/postcss@^4 (+17 more)

### Community 9 - "schema.sql"
Cohesion: 0.06
Nodes (51): app_private.check_agenda_slot(), app_private.reschedule_appointment(), app_private.seed_crm_pipeline_stages(), idx_agents_workspace_id, idx_appointments_no_show_due, idx_billing_events_workspace, idx_integration_secrets_workspace_provider, idx_messages_conversation_id_created_at (+43 more)

### Community 10 - "google-sync.ts"
Cohesion: 0.17
Nodes (22): Lógica en Next.js, AppointmentStatus, AgendaSync, clearPending(), connectedWorkspaces(), eventSummary(), googleBusyProvider(), processGoogleDeletions() (+14 more)

### Community 11 - "CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code"
Cohesion: 0.18
Nodes (10): CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code, Código de referencia del CRM (portar, no copiar a ciegas), Inventario de GHL a eliminar, Modelo de datos (Supabase, esquema `public`), Objetivo, Onboarding de Levy, Panel, Stripe (Payment Link externo) (+2 more)

### Community 12 - "InboxPanel"
Cohesion: 0.05
Nodes (50): @supabase/ssr@^0.12.0, @supabase/ssr, Check, envCheck(), GET(), incrementalTables, recommendedEnv, requiredEnv (+42 more)

### Community 13 - "createAdminClient"
Cohesion: 0.11
Nodes (50): Reglas para cada iteración, PATCH(), GET(), POST(), POST(), DELETE(), POST(), GET() (+42 more)

### Community 14 - "import-export.ts"
Cohesion: 0.15
Nodes (17): CustomFieldDefinition, mergeCustomFieldValues(), validateFieldValue(), CrmError, ALIASES, canonical(), contactsByPhone(), IMPORT_MAX_BYTES (+9 more)

### Community 15 - "agent-agenda.test.ts"
Cohesion: 0.15
Nodes (21): ACTIVE, deps, NOW, buildCalendarContext(), buildCalendarToolDefinitions(), buildChangesContext(), buildDirectAvailabilityAnswer(), buildDirectBookingAnswer() (+13 more)

### Community 16 - "agent-settings.tsx"
Cohesion: 0.11
Nodes (42): AgentConfig, AgentItem, AgentSettings(), createBaseAgent(), deleteAgent(), saveAgent(), selectAgent(), AgentSettingsProps (+34 more)

### Community 17 - "calendar-request.ts"
Cohesion: 0.19
Nodes (15): addDaysToDateKey(), CalendarRequestContext, dateKeyInTimezone(), months, normalize(), parseDateKey(), ParsedTime, parseTime() (+7 more)

### Community 18 - "panel-data.ts"
Cohesion: 0.18
Nodes (18): AgendaPage(), metadata, metadata, ObservabilityPage(), emptyResult, Home(), metadata, PanelPage() (+10 more)

### Community 19 - "WorkspaceSectionPage"
Cohesion: 0.13
Nodes (19): AgentsPage(), metadata, AutomationsPage(), metadata, metadata, TeamPage(), IntegrationsPage(), metadata (+11 more)

### Community 20 - "levy-meeting-email.ts"
Cohesion: 0.09
Nodes (26): buildMeetingEmail(), ChangedAppointment, MeetingEmailInput, MeetingEmailKind, MeetingEmailResult, sendMeetingEmail(), NOW, buildWelcomeEmail() (+18 more)

### Community 21 - "billing.test.ts"
Cohesion: 0.13
Nodes (25): BusinessPage(), metadata, BillingCard(), STATUS_LABELS, BillingNotice(), formatDate(), readState(), daysAgo() (+17 more)

### Community 22 - "Configuración de TypeScript"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 23 - "[contactId]/tags/route.ts"
Cohesion: 0.36
Nodes (6): Context, GET(), isAuthorized(), maxDuration, POST(), triggerDeliver()

### Community 24 - "public.conversations"
Cohesion: 0.13
Nodes (23): idx_flow_answer_reviews_workspace_status, idx_flow_events_workspace_created, idx_flow_runs_conversation_status, idx_flow_runs_workspace_contact_status, idx_flows_workspace_status, public.flow_answer_reviews, public.flow_events, public.flow_runs (+15 more)

### Community 25 - "panel-header.tsx"
Cohesion: 0.17
Nodes (13): findTarget(), GuidedTour(), readSeenLocally(), Rect, START_TOUR_EVENT, storageKey(), TourLauncher(), wideSections (+5 more)

### Community 26 - "20261102200000_crm_core.sql"
Cohesion: 0.10
Nodes (34): idx_contacts_automation_labels, app_private.seed_crm_pipeline_stages(), app_private.seed_crm_pipeline_stages_trigger(), idx_contacts_workspace_last_message, idx_contacts_workspace_stage, idx_crm_contact_activity_actor_user, idx_crm_contact_activity_workspace_contact, idx_crm_contact_notes_author (+26 more)

### Community 27 - "public-shell.tsx"
Cohesion: 0.07
Nodes (48): cookies, CookiesPage(), metadata, GlobalError(), chat, Check(), faqs, growth (+40 more)

### Community 28 - "webhook.test.ts"
Cohesion: 0.15
Nodes (9): stripe@^19.3.0, stripe, StripeWebhookDeps, config, deps(), NOW, signedEvent(), stripeSdk (+1 more)

### Community 29 - "google-calendar.ts"
Cohesion: 0.12
Nodes (33): buildAuthUrl(), CallbackResult, completeGoogleCallback(), INTEGRATIONS_PATH, createOAuthState(), depsOf(), disconnect(), eventIdForAppointment() (+25 more)

### Community 30 - "public.workspaces"
Cohesion: 0.15
Nodes (17): app_private.has_workspace_role(), app_private.is_workspace_member(), idx_integrations_workspace_id, idx_workspace_members_user_id, public.integrations, public.workspace_members, public.workspaces, seed_crm_pipeline_stages_on_workspace (+9 more)

### Community 31 - "flow-engine.ts"
Cohesion: 0.11
Nodes (23): contactAudienceLabels(), flowMatchesTags(), addMinutes(), AdminClient, calculateProcessImpact(), ContactRow, ConversationContext, FLOW_OPT_OUT_LABEL (+15 more)

### Community 32 - "WorkspaceSettings"
Cohesion: 0.14
Nodes (22): stableDate(), WorkspaceSettings(), addBusinessCustomField(), addMember(), assetEditor(), assetList(), businessProfileEditor(), changeOwnPassword() (+14 more)

### Community 33 - "workspace-settings.tsx"
Cohesion: 0.12
Nodes (16): AgendaOption, AgentItem, buildAssetDraft(), fieldHelp(), hashToTab, IntegrationItem, IntegrationTestResult, providers (+8 more)

### Community 34 - "steps"
Cohesion: 0.08
Nodes (23): concurrency, cancel-in-progress, group, env, runs-on, steps, timeout-minutes, VERCEL_ORG_ID (+15 more)

### Community 35 - "test-prompt/route.ts"
Cohesion: 0.19
Nodes (18): AgentLike, buildIdentityContext(), buildInstructions(), BusinessProfileAsset, getAgentIdentity(), getKnowledgeAssetIds(), getOpenAIModel(), getResponseText() (+10 more)

### Community 36 - "executeRun"
Cohesion: 0.24
Nodes (25): parseFlowSteps(), completeCheckpoint(), decideFlowAnswerReview(), executeRun(), findNextStep(), findStep(), getAnswers(), getFlowOptionMetadata() (+17 more)

### Community 37 - "agent-agenda.ts"
Cohesion: 0.11
Nodes (30): AgendaCalendarRuntime, AgendaRuntimeCalendar, AgendaRuntimeDeps, alternativesFor(), buildAgendaRuntime(), failureWithAlternatives(), formatSlot(), pickUpcoming() (+22 more)

### Community 38 - "AdminConsole"
Cohesion: 0.33
Nodes (10): AdminConsole(), addSuperadmin(), createCompany(), deleteCompany(), deleteJson(), linkOwner(), openCompany(), postJson() (+2 more)

### Community 39 - "Iconos del scaffold Next"
Cohesion: 0.40
Nodes (6): File/Document Icon (gray 16x16, page with folded corner and text lines), Globe Icon (gray 16x16, world/web symbol), Next.js Wordmark Logo (black), Default create-next-app Scaffold Assets, Vercel Triangle Logo (white), Browser Window Icon (gray 16x16, window with three dots)

### Community 40 - "calendar-tools.ts"
Cohesion: 0.20
Nodes (17): Cambios en lo existente, asRecord(), saveCalendarTool(), buildCalendarRuntime(), asRecord(), buildCalendarToolMetadata(), CALENDAR_TOOL_TYPE, CalendarToolMetadata (+9 more)

### Community 41 - "webhook.ts"
Cohesion: 0.18
Nodes (21): AgencyContactInput, AgencyContactResult, BillingRow, billingRowBy(), customFieldValue(), handleCheckout(), handleSubscriptionChange(), idOf() (+13 more)

### Community 42 - "lucide-react"
Cohesion: 0.10
Nodes (29): lucide-react, react, Company, Summary, ACTIVITY_LABELS, activityDetail(), ACTOR_LABELS, Block() (+21 more)

### Community 43 - "onboarding/page.tsx"
Cohesion: 0.13
Nodes (27): GET(), asStateRecord(), patchOnboardingState(), POST(), metadata, OnboardingPage(), AdminClient, createCompanyWithOwner() (+19 more)

### Community 44 - "agendas.ts"
Cohesion: 0.09
Nodes (30): seed(), Agenda, AGENDA_COLUMNS, agendaChanges(), AgendaInput, AgendaRow, createAgenda(), getAgenda() (+22 more)

### Community 51 - "deliver/route.ts"
Cohesion: 0.18
Nodes (17): configString(), ContactRow, GET(), getInteractiveOptions(), IntegrationRow, InteractiveOption, isAuthorized(), POST() (+9 more)

### Community 52 - "app_private.book_appointment"
Cohesion: 0.17
Nodes (6): app_private.book_appointment(), app_private.check_agenda_slot(), app_private.reschedule_appointment(), idx_appointments_no_show_due, app_private.book_appointment(), public.crm_contact_activity

### Community 53 - "flow-answer-verifier.ts"
Cohesion: 0.60
Nodes (5): extractOutputText(), getRecord(), validateAnswerLocally(), VerificationResult, verifyFlowAnswer()

### Community 54 - "welcome-page.ts"
Cohesion: 0.13
Nodes (21): loadState(), metadata, WelcomePage(), WelcomeAutoRefresh(), Hero(), preparation, WelcomeView(), WelcomeViewState (+13 more)

### Community 55 - "flow-builder.tsx"
Cohesion: 0.10
Nodes (31): ActionsEditor(), patchAction(), replaceCrm(), AgentItem, CrmActionFields(), FlowBuilderProps, FlowCrmOptions, FlowRunItem (+23 more)

### Community 56 - "import-export.test.ts"
Cohesion: 0.21
Nodes (12): RFC-4180, csvSafe(), csvUnsafe(), FORMULA_STARTS, parseCsv(), parseCsvRecords(), quoteCell(), toCsv() (+4 more)

### Community 57 - "20261102210000_agenda_core.sql"
Cohesion: 0.29
Nodes (9): public.agendas, public.appointments, public.google_event_deletions, public.offered_slots, public.schedule_blocks, set_agendas_updated_at, set_appointments_updated_at, set_google_event_deletions_updated_at (+1 more)

### Community 58 - "agendas.ts"
Cohesion: 0.14
Nodes (28): Decisiones tomadas, PATCH(), agent, MONDAY_10, NOW, operator, AppointmentCreator, bookAppointment() (+20 more)

### Community 59 - "wizard.tsx"
Cohesion: 0.18
Nodes (17): OnboardingProgressCard(), SupportContact(), getFirstPendingStep(), getOnboardingStep(), getPendingSteps(), isStepDone(), OnboardingChecklist, OnboardingState (+9 more)

### Community 60 - "Auditoria de rendimiento 2026-10-09"
Cohesion: 0.13
Nodes (12): nextConfig, Auditoria de rendimiento 2026-10-09, AppShell monolith (1350 lines), Per-route client bundle split, idx_conversations_workspace_last_message index (not applied), Incremental inbox snapshot (pending), Shared (panel) layout, PanelLayout() (+4 more)

### Community 61 - "next"
Cohesion: 0.13
Nodes (15): next, Context, deliverQueuedReviewMessages(), POST(), ReviewPayload, deliverFirstMessage(), POST(), StartFlowPayload (+7 more)

### Community 62 - "meeting/route.ts"
Cohesion: 0.20
Nodes (16): server-only, dateParam(), GET(), cancelExisting(), emailAfterResponse(), GET(), meetingEngine(), POST() (+8 more)

### Community 63 - "ycloud-webhook.ts"
Cohesion: 0.16
Nodes (17): maxDuration, POST(), maxDuration, POST(), cleanDisplayName(), getMetadataRecord(), getReceivedSecret(), handleYCloudWebhook() (+9 more)

### Community 64 - "invalid"
Cohesion: 0.27
Nodes (18): updateAgenda(), conflict(), invalid(), isUniqueViolation(), normalizeColor(), createStage(), deleteStage(), findStageByName() (+10 more)

### Community 65 - "agency-crm.ts"
Cohesion: 0.20
Nodes (16): agencyWorkspaceCode(), bucket(), ensureTag(), FIELDS, findContactId(), LEVY_ACTIVE_TAG, LEVY_TAGS, markAgencyContactActiveInCrm() (+8 more)

### Community 66 - "send/route.ts"
Cohesion: 0.32
Nodes (7): configString(), ContactRow, ConversationRow, IntegrationRow, POST(), sendYCloudText(), YCloudSendResult

### Community 67 - "dbFailure"
Cohesion: 0.21
Nodes (18): listActivity(), CONTACT_SOURCES, ContactSearch, ContactSource, CreateContactInput, CrmContact, getContactCard(), recordInboundMessage() (+10 more)

### Community 68 - "Runbook de despliegue"
Cohesion: 0.05
Nodes (40): Deploy a Vercel workflow, deploy job (vercel pull + vercel deploy --prod), Vercel CLI, VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID secrets, AGENTS.md agent instructions, graphify, Alineacion con el curso, Gaps vs lesson 05 (Vercel deploy, real WhatsApp round-trip, GHL test) (+32 more)

### Community 69 - "createClient"
Cohesion: 0.11
Nodes (30): signOut(), AdminPage(), POST(), PATCH(), POST(), DELETE(), POST(), assertCurrentUserIsAdmin() (+22 more)

### Community 70 - "Tareas"
Cohesion: 0.11
Nodes (17): Decisiones pendientes (las responde el usuario; mientras, sigue con otras tareas), Entorno, F0 — Preparación, F1 — Modelo de datos del CRM (aditivo), F3 — Google Calendar por workspace, F4 — Jobs y recordatorios, F5 — Agente, flujos y panel sin GHL, F6 — Stripe y onboarding de Levy (+9 more)

### Community 71 - "FlowBuilder"
Cohesion: 0.22
Nodes (16): FlowBuilder(), addStage(), archiveFlow(), createEmptyFlow(), createTemplate(), moveSelectedStep(), saveFlow(), updateDraft() (+8 more)

### Community 72 - "ycloud-payload.ts"
Cohesion: 0.24
Nodes (11): MEDIA_KINDS, MESSAGE_WRAPPERS, normalizeMessageType(), readMediaFields(), readMessageType(), readPath(), YCloudMediaFields, YCloudMediaKind (+3 more)

### Community 73 - "shared.ts"
Cohesion: 0.18
Nodes (17): ActivityEntry, ActivityKind, CrmErrorCode, STATUS, BASE_FIELDS, FLOW_ACTOR, FlowActionResult, renderFlowTemplate() (+9 more)

### Community 74 - "@supabase/supabase-js"
Cohesion: 0.15
Nodes (12): dependencies, lucide-react@^1.23.0, next@16.2.10, nodemailer@^10.3.1, react@19.2.4, react-dom@19.2.4, @supabase/supabase-js@^2.110.0, nodemailer (+4 more)

### Community 75 - "agenda-panel.tsx"
Cohesion: 0.12
Nodes (25): AppointmentDialog(), BlockDialog(), Modal(), NewAppointmentDialog(), SlotPicker(), STATUS_LABELS, when(), AgendaPanel() (+17 more)

### Community 76 - "20261103020000_billing.sql"
Cohesion: 0.48
Nodes (6): idx_billing_events_workspace, idx_workspace_billing_status, public.billing_events, public.workspace_billing, set_billing_events_updated_at, set_workspace_billing_updated_at

### Community 77 - "bienvenida/page.tsx"
Cohesion: 0.26
Nodes (11): FAILURES, POST(), POST(), findAuthUserByEmail(), BillingConfig, DEFAULT_COMPANY_FIELD, DEFAULT_GRACE_DAYS, getBillingConfig() (+3 more)

### Community 79 - "login/actions.ts"
Cohesion: 0.15
Nodes (14): POST(), appUrl, figtree, inter, metadata, viewport, redirectAfterAuth(), requestPasswordReset() (+6 more)

### Community 84 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test, typecheck

### Community 85 - "crm-jobs.ts"
Cohesion: 0.29
Nodes (5): CrmJobDeps, CrmJobReport, CrmJobStep, runCrmJobs(), GoogleDeps

### Community 86 - "ref_node_test"
Cohesion: 0.14
Nodes (20): GET(), getEnabledToolIds(), getKnowledgeAssetIds(), isAuthorized(), POST(), shouldIntroduceAgent(), AdminClient, applyConversationHandoff() (+12 more)

### Community 90 - "api-error.ts"
Cohesion: 0.14
Nodes (24): excludeExistingContacts(), FlowPayload, POST(), stringArray(), POST(), OpenAIResponsePayload, POST(), GET() (+16 more)

### Community 95 - "google-sync.test.ts"
Cohesion: 0.21
Nodes (9): Call, connect(), deps, ENV, Route, decryptSecret(), encryptSecret(), getKey() (+1 more)

### Community 96 - "panel-data.ts"
Cohesion: 0.21
Nodes (12): emptyResult, FlujosPage(), metadata, buildDefaultAgentConfig(), DEFAULT_AGENT_PROMPT_VERSION, DefaultAgentPreset, defaultAgentPresets, deployChecks (+4 more)

### Community 99 - "snapshot/route.ts"
Cohesion: 0.80
Nodes (4): GET(), getMetadataRecord(), getYCloudContactName(), stableTime()

### Community 100 - "clientFetch"
Cohesion: 0.11
Nodes (35): act(), save(), save(), saveDefaultConversationMode(), testPrompt(), BillingActions(), openPortal(), WelcomeResendButton() (+27 more)

### Community 101 - "ref_node_assert"
Cohesion: 0.10
Nodes (17): NOW, broken, client(), OFFLINE_ERROR, callbackRedirectPath(), deps, ENV, GOOGLE_SCOPES (+9 more)

## Knowledge Gaps
- **24 isolated node(s):** `RFC-4180`, `File/Document Icon (gray 16x16, page with folded corner and text lines)`, `Globe Icon (gray 16x16, world/web symbol)`, `Browser Window Icon (gray 16x16, window with three dots)`, `idx_conversations_workspace_last_message index (not applied)` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 566 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `buffer/route.ts`, `custom-fields.ts`, `Dependencias y ESLint`, `InboxPanel`, `createAdminClient`, `panel-data.ts`, `WorkspaceSectionPage`, `billing.test.ts`, `[contactId]/tags/route.ts`, `public-shell.tsx`, `test-prompt/route.ts`, `agent-agenda.ts`, `lucide-react`, `onboarding/page.tsx`, `deliver/route.ts`, `welcome-page.ts`, `agendas.ts`, `wizard.tsx`, `Auditoria de rendimiento 2026-10-09`, `meeting/route.ts`, `ycloud-webhook.ts`, `send/route.ts`, `createClient`, `@supabase/supabase-js`, `bienvenida/page.tsx`, `login/actions.ts`, `api-error.ts`, `panel-data.ts`, `snapshot/route.ts`, `clientFetch`?**
  _High betweenness centrality (0.150) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `createAdminClient()` (e.g. with `Decisiones tomadas` and `Reglas para cada iteración`) actually correct?**
  _`createAdminClient()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-4180`, `File/Document Icon (gray 16x16, page with folded corner and text lines)`, `Globe Icon (gray 16x16, world/web symbol)` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `buffer/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1354723707664884 - nodes in this community are weakly interconnected._
- **Why does `createAdminClient()` connect `createAdminClient` to `buffer/route.ts`, `custom-fields.ts`, `InboxPanel`, `panel-data.ts`, `billing.test.ts`, `[contactId]/tags/route.ts`, `agent-agenda.ts`, `calendar-tools.ts`, `onboarding/page.tsx`, `deliver/route.ts`, `welcome-page.ts`, `agendas.ts`, `next`, `meeting/route.ts`, `ycloud-webhook.ts`, `send/route.ts`, `createClient`, `bienvenida/page.tsx`, `login/actions.ts`, `ref_node_test`, `api-error.ts`, `panel-data.ts`, `snapshot/route.ts`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `apiErrorResponse()` (e.g. with `Decisiones tomadas` and `Registro de iteraciones`) actually correct?**
  _`apiErrorResponse()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `FakeQuery` be split into smaller, more focused modules?**
  _Cohesion score 0.0761904761904762 - nodes in this community are weakly interconnected._