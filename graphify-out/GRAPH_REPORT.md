# Graph Report - Agency  (2026-11-19)

## Corpus Check
- 304 files · ~200,600 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .example 1, .ico 1)

## Summary
- 2179 nodes · 6822 edges · 112 communities (93 shown, 19 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 188 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0f81f5cd`
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
- inicio/page.tsx
- panel-data.ts
- levy-meeting-email.ts
- billing.test.ts
- Configuración de TypeScript
- crm-jobs/route.ts
- public.conversations
- StepBusiness
- 20261102200000_crm_core.sql
- public-shell.tsx
- webhook.test.ts
- google-calendar.ts
- public.workspaces
- agenda-panel.tsx
- WorkspaceSettings
- workspace-settings.tsx
- steps
- test-prompt/route.ts
- panel-header.tsx
- agent-agenda.ts
- AdminConsole
- Iconos del scaffold Next
- calendar-tools.ts
- webhook.ts
- lucide-react
- onboarding/page.tsx
- invalid
- Crons de Vercel
- Configuración de PostCSS
- workspaces.ts
- app_private.book_appointment
- flow-answer-verifier.ts
- welcome-page.ts
- flow-engine.ts
- import-export.test.ts
- 20261102210000_agenda_core.sql
- Decisiones tomadas
- wizard.tsx
- Auditoria de rendimiento 2026-10-09
- api-error.ts
- meeting/route.ts
- ycloud-webhook.ts
- invalid
- agency-crm.ts
- readiness/route.ts
- server.ts
- Per-workspace integrations encrypted AES-256-GCM
- platform-admin.ts
- Tareas
- next
- Levy multi-tenant WhatsApp AI agent panel
- shared.ts
- google-calendar.test.ts
- timezones.ts
- 20261103020000_billing.sql
- bienvenida/page.tsx
- app_private.invoke_crm_jobs
- next
- Alineacion con el curso
- app/layout.tsx
- ref_node_test
- secrets.ts
- server-only
- Levy README
- CLAUDE.md
- (panel)/layout.tsx
- deploy job (vercel pull + vercel deploy --prod)
- clientFetch
- (panel)/page.tsx
- GHL purchase webhook auto-provisioning (/api/webhooks/ghl/purchase)
- shared.tsx
- generateReply
- cookies/page.tsx
- step-agents.tsx
- buildFieldsFromChoices
- send/route.ts
- panel-context.ts
- members/route.ts
- welcome-view.tsx

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
- `Decisiones tomadas` --references--> `Row`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/testing/fake-supabase.ts
- `Registro de iteraciones` --references--> `IntegrationProvider`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/integrations/secrets.ts
- `Verificación final` --references--> `test()`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/components/onboarding/step-whatsapp.tsx
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

## Communities (112 total, 19 thin omitted)

### Community 0 - "shared.tsx"
Cohesion: 0.22
Nodes (28): ConnectedBanner(), CopyButton(), Field(), HelpBox(), HowTo(), inputClass, Notice(), NumberedSteps() (+20 more)

### Community 1 - "buffer/route.ts"
Cohesion: 0.17
Nodes (26): AgentRow, BusinessProfileAsset, ContactMetadata, ensureAgentIntroduction(), GET(), getAgentIdentity(), getAgentIntentBoost(), getAgentIntroduction() (+18 more)

### Community 2 - "FakeQuery"
Cohesion: 0.06
Nodes (12): CascadeRule, compare(), fakeId(), FakeQuery, FakeSupabase, FakeTables, Filter, likeToRegExp() (+4 more)

### Community 3 - "custom-fields.ts"
Cohesion: 0.16
Nodes (18): Client, CUSTOM_FIELD_TYPES, CustomFieldDefinitionInput, CustomFieldType, CustomFieldValue, CustomFieldValues, describeAiReadableFields(), formatValue() (+10 more)

### Community 4 - "step-business.tsx"
Cohesion: 0.14
Nodes (21): Chip(), toggle(), asString(), asStringArray(), AttendMode, attendModes, BusinessChoices, BusinessLocation (+13 more)

### Community 5 - "crm.test.ts"
Cohesion: 0.14
Nodes (31): logActivity(), recordInboundMessage(), touchContactInbound(), operator, seed(), STAGE_NAMES, eraseContact(), dbFailure() (+23 more)

### Community 6 - "slots.ts"
Cohesion: 0.12
Nodes (24): AgendaConfig, agendaConfigFromRow(), clampInt(), DAY_KEYS, DEFAULT_SERVICE_MINUTES, DEFAULT_WEEKLY_SCHEDULE, distributeSlots(), Interval (+16 more)

### Community 7 - "reminders.ts"
Cohesion: 0.12
Nodes (23): ACTIVE_STATUSES, AgendaNoticeConfig, CandidateRow, claim(), DEFAULT_MESSAGES, deliverNotice(), fillNotice(), firstName() (+15 more)

### Community 8 - "Dependencias y ESLint"
Cohesion: 0.06
Nodes (42): eslintConfig, dependencies, lucide-react@^1.23.0, next@16.2.10, nodemailer@^10.3.1, react@19.2.4, react-dom@19.2.4, @supabase/ssr@^0.12.0 (+34 more)

### Community 9 - "schema.sql"
Cohesion: 0.06
Nodes (51): app_private.check_agenda_slot(), app_private.reschedule_appointment(), app_private.seed_crm_pipeline_stages(), idx_agents_workspace_id, idx_appointments_no_show_due, idx_billing_events_workspace, idx_integration_secrets_workspace_provider, idx_messages_conversation_id_created_at (+43 more)

### Community 10 - "google-sync.ts"
Cohesion: 0.09
Nodes (25): AppointmentStatus, CrmJobDeps, CrmJobReport, CrmJobStep, runCrmJobs(), NOW, AgendaSync, clearPending() (+17 more)

### Community 11 - "CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code"
Cohesion: 0.17
Nodes (11): CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code, Código de referencia del CRM (portar, no copiar a ciegas), Inventario de GHL a eliminar, Modelo de datos (Supabase, esquema `public`), Objetivo, Onboarding de Levy, Panel, Stripe (Payment Link externo) (+3 more)

### Community 12 - "InboxPanel"
Cohesion: 0.09
Nodes (30): ContactCrmSummary(), nextAppointment(), ConversationItem, handoffSourceLabel, InboxPanel(), handleAddToFlow(), handleInternalNote(), handleRemoveFromFlow() (+22 more)

### Community 13 - "createAdminClient"
Cohesion: 0.12
Nodes (41): PATCH(), GET(), POST(), DELETE(), POST(), POST(), Context, DELETE() (+33 more)

### Community 14 - "import-export.ts"
Cohesion: 0.12
Nodes (37): ClientsPage(), metadata, findContactId(), CONTACT_SOURCES, ContactSearch, ContactSource, createContact(), CreateContactInput (+29 more)

### Community 15 - "agent-agenda.test.ts"
Cohesion: 0.14
Nodes (21): ACTIVE, deps, NOW, setup(), buildCalendarContext(), buildChangesContext(), buildDirectBookingAnswer(), buildDirectCancelAnswer() (+13 more)

### Community 16 - "agent-settings.tsx"
Cohesion: 0.14
Nodes (30): AgentConfig, AgentItem, AgentSettings(), createBaseAgent(), deleteAgent(), saveAgent(), saveDefaultConversationMode(), selectAgent() (+22 more)

### Community 17 - "calendar-request.ts"
Cohesion: 0.16
Nodes (15): addDaysToDateKey(), CalendarRequestContext, dateKeyInTimezone(), months, normalize(), parseDateKey(), ParsedTime, parseTime() (+7 more)

### Community 18 - "inicio/page.tsx"
Cohesion: 0.09
Nodes (35): chat, Check(), faqs, growth, included, LandingPage(), metadata, steps (+27 more)

### Community 19 - "panel-data.ts"
Cohesion: 0.13
Nodes (23): AgentsPage(), metadata, AutomationsPage(), metadata, metadata, TeamPage(), IntegrationsPage(), metadata (+15 more)

### Community 20 - "levy-meeting-email.ts"
Cohesion: 0.09
Nodes (26): buildMeetingEmail(), ChangedAppointment, MeetingEmailInput, MeetingEmailKind, MeetingEmailResult, sendMeetingEmail(), NOW, buildWelcomeEmail() (+18 more)

### Community 21 - "billing.test.ts"
Cohesion: 0.16
Nodes (23): BillingCard(), STATUS_LABELS, BillingNotice(), formatDate(), readState(), daysAgo(), fake(), NOW (+15 more)

### Community 22 - "Configuración de TypeScript"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 23 - "crm-jobs/route.ts"
Cohesion: 0.48
Nodes (5): GET(), isAuthorized(), maxDuration, POST(), triggerDeliver()

### Community 24 - "public.conversations"
Cohesion: 0.13
Nodes (23): idx_flow_answer_reviews_workspace_status, idx_flow_events_workspace_created, idx_flow_runs_conversation_status, idx_flow_runs_workspace_contact_status, idx_flows_workspace_status, public.flow_answer_reviews, public.flow_events, public.flow_runs (+15 more)

### Community 25 - "StepBusiness"
Cohesion: 0.25
Nodes (15): Estado real vs. inventario (F0.1, 2026-11-02), StepBusiness(), addLocation(), patch(), removeLocation(), selectCountry(), selectSector(), updateLocation() (+7 more)

### Community 26 - "20261102200000_crm_core.sql"
Cohesion: 0.10
Nodes (34): idx_contacts_automation_labels, app_private.seed_crm_pipeline_stages(), app_private.seed_crm_pipeline_stages_trigger(), idx_contacts_workspace_last_message, idx_contacts_workspace_stage, idx_crm_contact_activity_actor_user, idx_crm_contact_activity_workspace_contact, idx_crm_contact_notes_author (+26 more)

### Community 27 - "public-shell.tsx"
Cohesion: 0.19
Nodes (18): GlobalError(), LoginPage(), metadata, NotFound(), metadata, RecuperarPage(), metadata, ResetPasswordPage() (+10 more)

### Community 28 - "webhook.test.ts"
Cohesion: 0.15
Nodes (8): stripe@^19.3.0, stripe, StripeWebhookDeps, config, deps(), NOW, signedEvent(), stripeSdk

### Community 29 - "google-calendar.ts"
Cohesion: 0.14
Nodes (30): buildAuthUrl(), callbackRedirectPath(), CallbackResult, completeGoogleCallback(), INTEGRATIONS_PATH, deps, ENV, createOAuthState() (+22 more)

### Community 30 - "public.workspaces"
Cohesion: 0.15
Nodes (17): app_private.has_workspace_role(), app_private.is_workspace_member(), idx_integrations_workspace_id, idx_workspace_members_user_id, public.integrations, public.workspace_members, public.workspaces, seed_crm_pipeline_stages_on_workspace (+9 more)

### Community 31 - "agenda-panel.tsx"
Cohesion: 0.12
Nodes (20): AgendaPage(), metadata, AgendaPanel(), deleteBlock(), load(), dayLabel(), STATUS_STYLES, timeIn() (+12 more)

### Community 32 - "WorkspaceSettings"
Cohesion: 0.14
Nodes (22): fieldHelp(), WorkspaceSettings(), addBusinessCustomField(), addMember(), assetEditor(), assetList(), businessProfileEditor(), changeOwnPassword() (+14 more)

### Community 33 - "workspace-settings.tsx"
Cohesion: 0.11
Nodes (19): AgendaOption, AgentItem, asRecord(), buildAssetDraft(), hashToTab, IntegrationItem, IntegrationTestResult, providers (+11 more)

### Community 34 - "steps"
Cohesion: 0.08
Nodes (23): concurrency, cancel-in-progress, group, env, runs-on, steps, timeout-minutes, VERCEL_ORG_ID (+15 more)

### Community 35 - "test-prompt/route.ts"
Cohesion: 0.15
Nodes (23): AgentLike, buildIdentityContext(), buildInstructions(), BusinessProfileAsset, getAgentIdentity(), getKnowledgeAssetIds(), getOpenAIModel(), getResponseText() (+15 more)

### Community 36 - "panel-header.tsx"
Cohesion: 0.17
Nodes (14): findTarget(), GuidedTour(), readSeenLocally(), Rect, START_TOUR_EVENT, storageKey(), TourLauncher(), PanelPage() (+6 more)

### Community 37 - "agent-agenda.ts"
Cohesion: 0.14
Nodes (23): AgendaCalendarRuntime, AgendaRuntimeCalendar, AgendaRuntimeDeps, alternativesFor(), buildAgendaRuntime(), failureWithAlternatives(), formatSlot(), pickUpcoming() (+15 more)

### Community 38 - "AdminConsole"
Cohesion: 0.33
Nodes (10): AdminConsole(), addSuperadmin(), createCompany(), deleteCompany(), deleteJson(), linkOwner(), openCompany(), postJson() (+2 more)

### Community 39 - "Iconos del scaffold Next"
Cohesion: 0.40
Nodes (6): File/Document Icon (gray 16x16, page with folded corner and text lines), Globe Icon (gray 16x16, world/web symbol), Next.js Wordmark Logo (black), Default create-next-app Scaffold Assets, Vercel Triangle Logo (white), Browser Window Icon (gray 16x16, window with three dots)

### Community 40 - "calendar-tools.ts"
Cohesion: 0.25
Nodes (12): asRecord(), buildCalendarToolMetadata(), CALENDAR_TOOL_TYPE, CalendarTool, CalendarToolMetadata, CONTACT_CALENDAR_KEY, getPinnedCalendar(), parseCalendarTool() (+4 more)

### Community 41 - "webhook.ts"
Cohesion: 0.18
Nodes (17): AgencyContactInput, AgencyContactResult, BillingRow, billingRowBy(), customFieldValue(), handleSubscriptionChange(), invoiceSubscriptionId(), periodEnd() (+9 more)

### Community 42 - "lucide-react"
Cohesion: 0.11
Nodes (28): lucide-react, react, Company, Summary, ACTIVITY_LABELS, activityDetail(), ACTOR_LABELS, Block() (+20 more)

### Community 43 - "onboarding/page.tsx"
Cohesion: 0.20
Nodes (15): asStateRecord(), patchOnboardingState(), POST(), metadata, OnboardingPage(), DefaultConversationMode, getDefaultConversationMode(), withDefaultConversationMode() (+7 more)

### Community 44 - "invalid"
Cohesion: 0.23
Nodes (15): Agenda, AGENDA_COLUMNS, agendaChanges(), AgendaInput, AgendaRow, createAgenda(), getDefaultAgenda(), GoogleSyncMode (+7 more)

### Community 51 - "workspaces.ts"
Cohesion: 0.21
Nodes (17): AdminClient, createCompanyWithOwner(), createDefaultAgentsForWorkspace(), LIVE_SUBSCRIPTION_STATUSES, buildDefaultAgentConfig(), buildDefaultAgentPrompt(), DEFAULT_AGENT_PROMPT_VERSION, DefaultAgentPreset (+9 more)

### Community 52 - "app_private.book_appointment"
Cohesion: 0.17
Nodes (6): app_private.book_appointment(), app_private.check_agenda_slot(), app_private.reschedule_appointment(), idx_appointments_no_show_due, app_private.book_appointment(), public.crm_contact_activity

### Community 53 - "flow-answer-verifier.ts"
Cohesion: 0.52
Nodes (6): extractOutputText(), getRecord(), validateAnswerLocally(), VerificationResult, verifyFlowAnswer(), getWorkspaceOpenAIKey()

### Community 54 - "welcome-page.ts"
Cohesion: 0.18
Nodes (16): isLevyPurchase(), handleCheckout(), idOf(), ownedWorkspaceId(), workspaceInfo(), billingWorkspace(), getWelcomeState(), isCheckoutSessionId() (+8 more)

### Community 55 - "flow-engine.ts"
Cohesion: 0.05
Nodes (92): ActionsEditor(), patchAction(), replaceCrm(), AgentItem, CrmActionFields(), FlowBuilder(), addStage(), archiveFlow() (+84 more)

### Community 56 - "import-export.test.ts"
Cohesion: 0.22
Nodes (10): RFC-4180, csvSafe(), csvUnsafe(), FORMULA_STARTS, parseCsv(), parseCsvRecords(), quoteCell(), toCsv() (+2 more)

### Community 57 - "20261102210000_agenda_core.sql"
Cohesion: 0.29
Nodes (9): public.agendas, public.appointments, public.google_event_deletions, public.offered_slots, public.schedule_blocks, set_agendas_updated_at, set_appointments_updated_at, set_google_event_deletions_updated_at (+1 more)

### Community 58 - "Decisiones tomadas"
Cohesion: 0.09
Nodes (46): Decisiones tomadas, agent, MONDAY_10, NOW, operator, seed(), getAgenda(), AppointmentCreator (+38 more)

### Community 59 - "wizard.tsx"
Cohesion: 0.15
Nodes (19): StepDone(), WizardAgent, WizardAsset, WizardIntegration, WizardProps, WizardWorkspace, BookedMeeting, MeetingDay (+11 more)

### Community 60 - "Auditoria de rendimiento 2026-10-09"
Cohesion: 0.22
Nodes (6): Auditoria de rendimiento 2026-10-09, AppShell monolith (1350 lines), Per-route client bundle split, idx_conversations_workspace_last_message index (not applied), Incremental inbox snapshot (pending), Shared (panel) layout

### Community 61 - "api-error.ts"
Cohesion: 0.10
Nodes (30): Reglas para cada iteración, deliverQueuedReviewMessages(), POST(), ReviewPayload, excludeExistingContacts(), FlowPayload, POST(), stringArray() (+22 more)

### Community 62 - "meeting/route.ts"
Cohesion: 0.18
Nodes (18): PATCH(), dateParam(), GET(), POST(), cancelExisting(), emailAfterResponse(), GET(), meetingEngine() (+10 more)

### Community 63 - "ycloud-webhook.ts"
Cohesion: 0.06
Nodes (51): configString(), ContactRow, GET(), getInteractiveOptions(), IntegrationRow, InteractiveOption, isAuthorized(), POST() (+43 more)

### Community 64 - "invalid"
Cohesion: 0.20
Nodes (17): CustomFieldDefinition, conflict(), isUniqueViolation(), normalizeColor(), sanitizeSearchTerm(), createStage(), CrmStage, normalizeKind() (+9 more)

### Community 65 - "agency-crm.ts"
Cohesion: 0.17
Nodes (21): bucket(), ensureFields(), ensureTag(), FIELDS, LEVY_ACTIVE_TAG, LEVY_TAGS, STAGES, STRIPE_ACTOR (+13 more)

### Community 66 - "readiness/route.ts"
Cohesion: 0.28
Nodes (8): Check, envCheck(), GET(), incrementalTables, recommendedEnv, requiredEnv, requiredTables, tableCheck()

### Community 67 - "server.ts"
Cohesion: 0.20
Nodes (12): @supabase/ssr, GET(), isOperatorRequest(), hasSessionCookie(), createClient(), assertSupabaseAdminEnv(), assertSupabaseBrowserEnv(), getSupabaseBrowserEnv() (+4 more)

### Community 68 - "Per-workspace integrations encrypted AES-256-GCM"
Cohesion: 0.29
Nodes (5): Required environment variables, INTEGRATION_ENCRYPTION_KEY, LEVY_WORKSPACE_CODE / LEVY_MEETING_CALENDAR_ID, GoHighLevel, OpenAI

### Community 69 - "platform-admin.ts"
Cohesion: 0.20
Nodes (16): AdminPage(), PATCH(), POST(), DELETE(), POST(), assertCurrentUserIsAdmin(), DELETE(), POST() (+8 more)

### Community 70 - "Tareas"
Cohesion: 0.12
Nodes (16): Decisiones pendientes (las responde el usuario; mientras, sigue con otras tareas), Entorno, F0 — Preparación, F1 — Modelo de datos del CRM (aditivo), F3 — Google Calendar por workspace, F4 — Jobs y recordatorios, F6 — Stripe y onboarding de Levy, F7 — Migración de datos y limpieza (+8 more)

### Community 71 - "next"
Cohesion: 0.18
Nodes (10): next, POST(), GET(), POST(), Context, DELETE(), POST(), POST() (+2 more)

### Community 72 - "Levy multi-tenant WhatsApp AI agent panel"
Cohesion: 0.24
Nodes (6): Conversational flow builder with human review, Inbox por empresa (IA / handoff / onboarding views), Levy multi-tenant WhatsApp AI agent panel, Next.js 16 App Router, Supabase (Postgres + Auth + RLS), Workspace (empresa / tenant)

### Community 73 - "shared.ts"
Cohesion: 0.13
Nodes (13): AgendaErrorCode, DEFAULT_MESSAGES, SQLSTATE_CODES, STATUS, ActivityEntry, ActivityKind, listActivity(), CrmErrorCode (+5 more)

### Community 74 - "google-calendar.test.ts"
Cohesion: 0.18
Nodes (14): Lógica en Next.js, buildEventBody(), calendarFetch(), deleteEvent(), eventIdForAppointment(), failure(), freeBusy(), GoogleTokens (+6 more)

### Community 75 - "timezones.ts"
Cohesion: 0.28
Nodes (19): F2 — Lógica del CRM y la Agenda, Registro de iteraciones, closedReason(), daySlots(), freeSlots(), isOpenAt(), addDaysToDateKey(), dateKeyInTimeZone() (+11 more)

### Community 76 - "20261103020000_billing.sql"
Cohesion: 0.48
Nodes (6): idx_billing_events_workspace, idx_workspace_billing_status, public.billing_events, public.workspace_billing, set_billing_events_updated_at, set_workspace_billing_updated_at

### Community 77 - "bienvenida/page.tsx"
Cohesion: 0.22
Nodes (12): FAILURES, POST(), POST(), loadState(), metadata, WelcomePage(), BillingConfig, DEFAULT_COMPANY_FIELD (+4 more)

### Community 79 - "next"
Cohesion: 0.17
Nodes (13): signOut(), POST(), GET(), ALLOWED_TYPES, GET(), redirectAfterAuth(), requestPasswordReset(), signIn() (+5 more)

### Community 84 - "Alineacion con el curso"
Cohesion: 0.19
Nodes (15): Alineacion con el curso, Gaps vs lesson 05 (Vercel deploy, real WhatsApp round-trip, GHL test), Recommended next steps (SQL, secrets, deploy, webhook, test), Video 05 - La App por Dentro + Deploy a Vercel, Carlos-Dominguez-faber/whatsapp-saas reference repo, WhatsApp SaaS - ruta del curso, Production step checklist, Target system (inbox, configurable AI agent, handoff, buffer, YCloud dispatch, audio transcription, GHL) (+7 more)

### Community 85 - "app/layout.tsx"
Cohesion: 0.25
Nodes (5): appUrl, figtree, inter, metadata, viewport

### Community 86 - "ref_node_test"
Cohesion: 0.18
Nodes (15): AdminClient, applyConversationHandoff(), buildHandoffContext(), buildHandoffNote(), ConversationHandoffInfo, detectAnswerHandoff(), findHandoffKeyword(), getHandoffKeywords() (+7 more)

### Community 90 - "secrets.ts"
Cohesion: 0.42
Nodes (7): POST(), GET(), POST(), generateWebhookSecret(), hashSecret(), maskSecret(), saveIntegrationSecret()

### Community 95 - "server-only"
Cohesion: 0.24
Nodes (10): server-only, connect(), decryptSecret(), encryptSecret(), getKey(), saveTokens(), storeTokens(), getIntegrationSecret() (+2 more)

### Community 96 - "Levy README"
Cohesion: 0.29
Nodes (5): AGENTS.md agent instructions, graphify, Levy README, Supabase schema apply order, Superadmin /admin account creation (SUPERADMIN_EMAILS)

### Community 98 - "(panel)/layout.tsx"
Cohesion: 0.29
Nodes (6): nextConfig, PanelLayout(), BrandMark(), IntentLink(), sidebarItems, SidebarNav()

### Community 99 - "deploy job (vercel pull + vercel deploy --prod)"
Cohesion: 0.33
Nodes (5): Deploy a Vercel workflow, deploy job (vercel pull + vercel deploy --prod), Vercel CLI, VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID secrets, External scheduler (cron-job.org / QStash) every 5 min

### Community 100 - "clientFetch"
Cohesion: 0.11
Nodes (38): AppointmentDialog(), act(), BlockDialog(), save(), Modal(), NewAppointmentDialog(), save(), SlotPicker() (+30 more)

### Community 101 - "(panel)/page.tsx"
Cohesion: 0.18
Nodes (14): @supabase/supabase-js, metadata, ObservabilityPage(), emptyResult, Home(), metadata, BUSINESS_METRICS_WINDOW_DAYS, BusinessMetrics (+6 more)

### Community 102 - "GHL purchase webhook auto-provisioning (/api/webhooks/ghl/purchase)"
Cohesion: 0.50
Nodes (4): /auth/confirm create-password flow, GHL purchase webhook auto-provisioning (/api/webhooks/ghl/purchase), GHL tags cliente-levy / levy-acceso-listo / levy-activo, LEVY_PURCHASE_WEBHOOK_SECRET

### Community 103 - "shared.tsx"
Cohesion: 0.32
Nodes (9): OnboardingProgressCard(), linkButton, Question(), secondaryButton, SupportContact(), buildSupportLink(), buildSupportMessage(), SUPPORT_PHONE_DISPLAY (+1 more)

### Community 104 - "generateReply"
Cohesion: 0.20
Nodes (14): F5 — Agente, flujos y panel sin GHL, Cambios en lo existente, buildTodayLine(), buildTranscript(), callResponsesApi(), describeMedia(), generateContactInsights(), generateReply() (+6 more)

### Community 105 - "cookies/page.tsx"
Cohesion: 0.29
Nodes (11): cookies, CookiesPage(), metadata, metadata, PrivacyPage(), metadata, TermsPage(), legalMail (+3 more)

### Community 106 - "step-agents.tsx"
Cohesion: 0.26
Nodes (12): OptionCard(), ToggleSwitch(), AgentDraft, createDraft(), getAgentName(), getConfig(), getHandoffKeywords(), getJobTitle() (+4 more)

### Community 107 - "buildFieldsFromChoices"
Cohesion: 0.21
Nodes (13): next(), save(), buildAddressText(), buildDaysText(), buildFieldsFromChoices(), buildHoursText(), buildLocationText(), buildServicesText() (+5 more)

### Community 108 - "send/route.ts"
Cohesion: 0.22
Nodes (11): POST(), readResponsePayload(), YCloudErrorPayload, configString(), ContactRow, ConversationRow, IntegrationRow, POST() (+3 more)

### Community 109 - "panel-context.ts"
Cohesion: 0.27
Nodes (8): emptyResult, FlujosPage(), metadata, BusinessPage(), metadata, getPanelContext, PanelContext, syncDefaultAgentPrompts()

### Community 110 - "members/route.ts"
Cohesion: 0.36
Nodes (7): allowedRoles, DELETE(), findAuthUserByEmail(), getUserDisplayName(), PATCH(), POST(), TeamRole

### Community 111 - "welcome-view.tsx"
Cohesion: 0.38
Nodes (6): WelcomeAutoRefresh(), Hero(), preparation, WelcomeView(), WelcomeViewState, WelcomeState

## Knowledge Gaps
- **24 isolated node(s):** `RFC-4180`, `/auth/confirm create-password flow`, `GHL tags cliente-levy / levy-acceso-listo / levy-activo`, `LEVY_PURCHASE_WEBHOOK_SECRET`, `File/Document Icon (gray 16x16, page with folded corner and text lines)` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 570 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `buffer/route.ts`, `Dependencias y ESLint`, `createAdminClient`, `import-export.ts`, `inicio/page.tsx`, `panel-data.ts`, `billing.test.ts`, `crm-jobs/route.ts`, `public-shell.tsx`, `agenda-panel.tsx`, `test-prompt/route.ts`, `agent-agenda.ts`, `lucide-react`, `onboarding/page.tsx`, `workspaces.ts`, `api-error.ts`, `meeting/route.ts`, `ycloud-webhook.ts`, `readiness/route.ts`, `server.ts`, `platform-admin.ts`, `bienvenida/page.tsx`, `next`, `app/layout.tsx`, `secrets.ts`, `(panel)/layout.tsx`, `clientFetch`, `(panel)/page.tsx`, `shared.tsx`, `cookies/page.tsx`, `send/route.ts`, `panel-context.ts`, `members/route.ts`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `createAdminClient()` (e.g. with `Decisiones tomadas` and `Reglas para cada iteración`) actually correct?**
  _`createAdminClient()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-4180`, `/auth/confirm create-password flow`, `GHL tags cliente-levy / levy-acceso-listo / levy-activo` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FakeQuery` be split into smaller, more focused modules?**
  _Cohesion score 0.060129509713228495 - nodes in this community are weakly interconnected._
- **Why does `createAdminClient()` connect `createAdminClient` to `buffer/route.ts`, `import-export.ts`, `panel-data.ts`, `billing.test.ts`, `crm-jobs/route.ts`, `agenda-panel.tsx`, `agent-agenda.ts`, `onboarding/page.tsx`, `workspaces.ts`, `Decisiones tomadas`, `api-error.ts`, `meeting/route.ts`, `ycloud-webhook.ts`, `readiness/route.ts`, `server.ts`, `platform-admin.ts`, `next`, `bienvenida/page.tsx`, `next`, `secrets.ts`, `server-only`, `(panel)/page.tsx`, `generateReply`, `send/route.ts`, `panel-context.ts`, `members/route.ts`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `apiErrorResponse()` (e.g. with `Decisiones tomadas` and `Registro de iteraciones`) actually correct?**
  _`apiErrorResponse()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `step-business.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1383399209486166 - nodes in this community are weakly interconnected._