# Graph Report - Agency  (2026-11-08)

## Corpus Check
- 301 files · ~198,767 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .example 1, .ico 1)

## Summary
- 2157 nodes · 6765 edges · 111 communities (92 shown, 19 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 190 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dee395ea`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- shared.tsx
- buffer/route.ts
- FakeQuery
- custom-fields.ts
- step-business.tsx
- invalid
- slots.ts
- reminders.ts
- Dependencias y ESLint
- schema.sql
- google-sync.ts
- CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code
- InboxPanel
- createAdminClient
- timezones.ts
- agent-agenda.test.ts
- agent-settings.tsx
- calendar-request.ts
- panel-data.ts
- WorkspaceSectionPage
- levy-meeting-email.ts
- billing.test.ts
- Configuración de TypeScript
- crm-jobs.ts
- public.conversations
- panel-header.tsx
- 20261102200000_crm_core.sql
- inicio/page.tsx
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
- ref_node_assert
- webhook.ts
- lucide-react
- admin-companies.ts
- invalid
- Crons de Vercel
- Configuración de PostCSS
- step-agents.tsx
- app_private.book_appointment
- flow-answer-verifier.ts
- welcome-page.ts
- flow-builder.tsx
- import-export.ts
- 20261102210000_agenda_core.sql
- agendas.ts
- wizard.tsx
- Auditoria de rendimiento 2026-10-09
- appointments/route.ts
- workspaces.ts
- ycloud-webhook.ts
- StepBusiness
- agency-crm.ts
- onboarding/page.tsx
- contacts.ts
- Runbook de despliegue
- next
- Tareas
- FlowBuilder
- deliver/route.ts
- Levy multi-tenant WhatsApp AI agent panel
- config.ts
- agenda-panel.tsx
- 20261103020000_billing.sql
- bienvenida/page.tsx
- app_private.invoke_crm_jobs
- login/actions.ts
- public-shell.tsx
- routeAgent
- ref_node_test
- requireWorkspaceRole
- Levy README
- Per-workspace integrations encrypted AES-256-GCM
- CLAUDE.md
- Vercel daily crons (flows, deliver, ghl-sync)
- agency-crm.ts
- clientFetch
- google-sync.test.ts
- createClient
- GHL purchase webhook auto-provisioning (/api/webhooks/ghl/purchase)
- legal-page.tsx
- secrets.ts
- panel-context.ts
- buildFieldsFromChoices
- admin.test.ts
- (panel)/layout.tsx
- welcome-view.tsx

## God Nodes (most connected - your core abstractions)
1. `createAdminClient()` - 166 edges
2. `apiErrorResponse()` - 116 edges
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
- `Decisiones tomadas` --references--> `agenda()`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/agenda/reminders.test.ts
- `Decisiones tomadas` --references--> `Row`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/testing/fake-supabase.ts
- `F6 — Stripe y onboarding de Levy` --references--> `getWorkspaceBillingState()`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/billing/workspace-billing.ts
- `Registro de iteraciones` --references--> `IntegrationProvider`  [INFERRED]
  PROGRESO_CRM_SUPABASE.md → src/lib/integrations/secrets.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Paid client auto-provisioning flow** — deploy_runbook_ghl_purchase_webhook, deploy_runbook_ghl_tags, deploy_runbook_auth_confirm, deploy_runbook_levy_purchase_webhook_secret [EXTRACTED 1.00]
- **Vercel Hobby plan workarounds** — _github_workflows_deploy, deploy_runbook_vercel_daily_crons, deploy_runbook_external_scheduler [INFERRED 0.75]
- **Inbound WhatsApp to AI reply pipeline** — deploy_runbook_ycloud_webhook_url, deploy_runbook_ai_buffer, deploy_runbook_vercel_daily_crons, deploy_runbook_cron_secret, readme_ycloud [INFERRED 0.85]
- **Next.js starter footer link icons (Learn/Examples/Go to nextjs.org)** — public_file_icon, public_window_icon, public_globe_icon [INFERRED 0.85]
- **Default create-next-app public/ icon set (likely unused leftovers)** — public_file_icon, public_globe_icon, public_next_logo, public_vercel_logo, public_window_icon [INFERRED 0.85]

## Communities (111 total, 19 thin omitted)

### Community 0 - "shared.tsx"
Cohesion: 0.25
Nodes (27): ConnectedBanner(), CopyButton(), Field(), HelpBox(), HowTo(), inputClass, linkButton, Notice() (+19 more)

### Community 1 - "buffer/route.ts"
Cohesion: 0.14
Nodes (26): AgentRow, buildTodayLine(), buildTranscript(), BusinessProfileAsset, callResponsesApi(), ContactMetadata, describeMedia(), ensureAgentIntroduction() (+18 more)

### Community 2 - "FakeQuery"
Cohesion: 0.06
Nodes (12): CascadeRule, compare(), fakeId(), FakeQuery, FakeSupabase, FakeTables, Filter, likeToRegExp() (+4 more)

### Community 3 - "custom-fields.ts"
Cohesion: 0.13
Nodes (21): Client, CUSTOM_FIELD_TYPES, CustomFieldDefinition, CustomFieldDefinitionInput, CustomFieldType, CustomFieldValue, CustomFieldValues, describeAiReadableFields() (+13 more)

### Community 4 - "step-business.tsx"
Cohesion: 0.14
Nodes (24): Chip(), toggle(), asString(), asStringArray(), AttendMode, attendModes, BusinessChoices, BusinessLocation (+16 more)

### Community 5 - "invalid"
Cohesion: 0.38
Nodes (11): optionalEmail(), updateContact(), invalid(), optionalText(), assertMember(), createdByFor(), createTask(), CrmTask (+3 more)

### Community 6 - "slots.ts"
Cohesion: 0.13
Nodes (23): AgendaConfig, agendaConfigFromRow(), clampInt(), DAY_KEYS, DEFAULT_SERVICE_MINUTES, DEFAULT_WEEKLY_SCHEDULE, distributeSlots(), Interval (+15 more)

### Community 7 - "reminders.ts"
Cohesion: 0.12
Nodes (22): ACTIVE_STATUSES, AgendaNoticeConfig, CandidateRow, claim(), DEFAULT_MESSAGES, deliverNotice(), fillNotice(), firstName() (+14 more)

### Community 8 - "Dependencias y ESLint"
Cohesion: 0.06
Nodes (43): eslintConfig, dependencies, lucide-react@^1.23.0, next@16.2.10, nodemailer@^10.3.1, react@19.2.4, react-dom@19.2.4, @supabase/ssr@^0.12.0 (+35 more)

### Community 9 - "schema.sql"
Cohesion: 0.06
Nodes (51): app_private.check_agenda_slot(), app_private.reschedule_appointment(), app_private.seed_crm_pipeline_stages(), idx_agents_workspace_id, idx_appointments_no_show_due, idx_billing_events_workspace, idx_integration_secrets_workspace_provider, idx_messages_conversation_id_created_at (+43 more)

### Community 10 - "google-sync.ts"
Cohesion: 0.13
Nodes (26): Decisiones tomadas, F5 — Agente, flujos y panel sin GHL, Cambios en lo existente, server-only, buildCalendarToolDefinitions(), buildCalendarRuntime(), CalendarRuntime, CalendarRuntimeResult (+18 more)

### Community 11 - "CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code"
Cohesion: 0.22
Nodes (8): CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code, Código de referencia del CRM (portar, no copiar a ciegas), Inventario de GHL a eliminar, Modelo de datos (Supabase, esquema `public`), Objetivo, Onboarding de Levy, Panel, Verificación final (la última tarea del progreso)

### Community 12 - "InboxPanel"
Cohesion: 0.09
Nodes (30): ContactCrmSummary(), nextAppointment(), ConversationItem, handoffSourceLabel, InboxPanel(), handleAddToFlow(), handleInternalNote(), handleRemoveFromFlow() (+22 more)

### Community 13 - "createAdminClient"
Cohesion: 0.10
Nodes (56): PATCH(), GET(), POST(), PATCH(), POST(), DELETE(), POST(), GET() (+48 more)

### Community 14 - "timezones.ts"
Cohesion: 0.27
Nodes (20): F2 — Lógica del CRM y la Agenda, Registro de iteraciones, getAgendaFreeSlots(), closedReason(), daySlots(), freeSlots(), isOpenAt(), addDaysToDateKey() (+12 more)

### Community 15 - "agent-agenda.test.ts"
Cohesion: 0.22
Nodes (17): buildCalendarContext(), buildChangesContext(), buildDirectAvailabilityAnswer(), buildDirectBookingAnswer(), buildNoCalendarContext(), CalendarRuntimeView, hasAvailabilityLookup(), hasConfirmedAppointment() (+9 more)

### Community 16 - "agent-settings.tsx"
Cohesion: 0.14
Nodes (30): AgentConfig, AgentItem, AgentSettings(), createBaseAgent(), deleteAgent(), saveAgent(), saveDefaultConversationMode(), selectAgent() (+22 more)

### Community 17 - "calendar-request.ts"
Cohesion: 0.19
Nodes (15): addDaysToDateKey(), CalendarRequestContext, dateKeyInTimezone(), months, normalize(), parseDateKey(), ParsedTime, parseTime() (+7 more)

### Community 18 - "panel-data.ts"
Cohesion: 0.22
Nodes (14): metadata, ObservabilityPage(), emptyResult, Home(), metadata, PanelPage(), BUSINESS_METRICS_WINDOW_DAYS, BusinessMetrics (+6 more)

### Community 19 - "WorkspaceSectionPage"
Cohesion: 0.14
Nodes (22): AgentsPage(), metadata, AutomationsPage(), metadata, metadata, TeamPage(), IntegrationsPage(), metadata (+14 more)

### Community 20 - "levy-meeting-email.ts"
Cohesion: 0.08
Nodes (38): cancelExisting(), emailAfterResponse(), GET(), meetingEngine(), POST(), readWorkspace(), readWorkspaceCode(), saveMeeting() (+30 more)

### Community 21 - "billing.test.ts"
Cohesion: 0.16
Nodes (22): BillingCard(), STATUS_LABELS, BillingNotice(), formatDate(), readState(), daysAgo(), fake(), NOW (+14 more)

### Community 22 - "Configuración de TypeScript"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 23 - "crm-jobs.ts"
Cohesion: 0.22
Nodes (10): GET(), isAuthorized(), maxDuration, POST(), CrmJobDeps, CrmJobReport, CrmJobStep, runCrmJobs() (+2 more)

### Community 24 - "public.conversations"
Cohesion: 0.13
Nodes (23): idx_flow_answer_reviews_workspace_status, idx_flow_events_workspace_created, idx_flow_runs_conversation_status, idx_flow_runs_workspace_contact_status, idx_flows_workspace_status, public.flow_answer_reviews, public.flow_events, public.flow_runs (+15 more)

### Community 25 - "panel-header.tsx"
Cohesion: 0.16
Nodes (14): Per-route client bundle split, findTarget(), GuidedTour(), readSeenLocally(), Rect, START_TOUR_EVENT, storageKey(), TourLauncher() (+6 more)

### Community 26 - "20261102200000_crm_core.sql"
Cohesion: 0.10
Nodes (34): idx_contacts_automation_labels, app_private.seed_crm_pipeline_stages(), app_private.seed_crm_pipeline_stages_trigger(), idx_contacts_workspace_last_message, idx_contacts_workspace_stage, idx_crm_contact_activity_actor_user, idx_crm_contact_activity_workspace_contact, idx_crm_contact_notes_author (+26 more)

### Community 27 - "inicio/page.tsx"
Cohesion: 0.14
Nodes (15): chat, Check(), faqs, growth, included, LandingPage(), metadata, steps (+7 more)

### Community 28 - "webhook.test.ts"
Cohesion: 0.15
Nodes (9): stripe@^19.3.0, stripe, StripeWebhookDeps, config, deps(), NOW, signedEvent(), stripeSdk (+1 more)

### Community 29 - "google-calendar.ts"
Cohesion: 0.10
Nodes (44): Lógica en Next.js, buildAuthUrl(), buildEventBody(), calendarFetch(), callbackRedirectPath(), CallbackResult, completeGoogleCallback(), INTEGRATIONS_PATH (+36 more)

### Community 30 - "public.workspaces"
Cohesion: 0.15
Nodes (17): app_private.has_workspace_role(), app_private.is_workspace_member(), idx_integrations_workspace_id, idx_workspace_members_user_id, public.integrations, public.workspace_members, public.workspaces, seed_crm_pipeline_stages_on_workspace (+9 more)

### Community 31 - "flow-engine.ts"
Cohesion: 0.12
Nodes (20): contactAudienceLabels(), addMinutes(), AdminClient, calculateProcessImpact(), ContactRow, ConversationContext, FLOW_OPT_OUT_LABEL, FlowRow (+12 more)

### Community 32 - "WorkspaceSettings"
Cohesion: 0.13
Nodes (23): buildAssetDraft(), fieldHelp(), WorkspaceSettings(), addBusinessCustomField(), addMember(), assetEditor(), assetList(), businessProfileEditor() (+15 more)

### Community 33 - "workspace-settings.tsx"
Cohesion: 0.11
Nodes (18): AgendaOption, AgentItem, asRecord(), hashToTab, IntegrationItem, IntegrationTestResult, providers, singletonAssetKinds (+10 more)

### Community 34 - "steps"
Cohesion: 0.08
Nodes (23): concurrency, cancel-in-progress, group, env, runs-on, steps, timeout-minutes, VERCEL_ORG_ID (+15 more)

### Community 35 - "test-prompt/route.ts"
Cohesion: 0.16
Nodes (21): AgentLike, buildIdentityContext(), buildInstructions(), BusinessProfileAsset, getAgentIdentity(), getKnowledgeAssetIds(), getOpenAIModel(), getResponseText() (+13 more)

### Community 36 - "executeRun"
Cohesion: 0.23
Nodes (26): parseFlowSteps(), completeCheckpoint(), decideFlowAnswerReview(), executeRun(), findNextStep(), findStep(), getAnswers(), getFlowOptionMetadata() (+18 more)

### Community 37 - "agent-agenda.ts"
Cohesion: 0.20
Nodes (18): AgendaRuntimeCalendar, AgendaRuntimeDeps, alternativesFor(), failureWithAlternatives(), formatSlot(), pickUpcoming(), resolveStart(), runAgendaTool() (+10 more)

### Community 38 - "AdminConsole"
Cohesion: 0.36
Nodes (9): AdminConsole(), addSuperadmin(), createCompany(), deleteJson(), linkOwner(), openCompany(), postJson(), removeSuperadmin() (+1 more)

### Community 39 - "Iconos del scaffold Next"
Cohesion: 0.40
Nodes (6): File/Document Icon (gray 16x16, page with folded corner and text lines), Globe Icon (gray 16x16, world/web symbol), Next.js Wordmark Logo (black), Default create-next-app Scaffold Assets, Vercel Triangle Logo (white), Browser Window Icon (gray 16x16, window with three dots)

### Community 40 - "ref_node_assert"
Cohesion: 0.10
Nodes (24): saveCalendarTool(), AgendaCalendarRuntime, buildAgendaRuntime(), ACTIVE, deps, NOW, setup(), NOW (+16 more)

### Community 41 - "webhook.ts"
Cohesion: 0.18
Nodes (17): AgencyContactInput, AgencyContactResult, BillingRow, billingRowBy(), customFieldValue(), handleSubscriptionChange(), invoiceSubscriptionId(), periodEnd() (+9 more)

### Community 42 - "lucide-react"
Cohesion: 0.09
Nodes (32): lucide-react, react, Company, Summary, ACTIVITY_LABELS, activityDetail(), ACTOR_LABELS, Block() (+24 more)

### Community 43 - "admin-companies.ts"
Cohesion: 0.20
Nodes (18): AdminClient, createCompanyWithOwner(), createDefaultAgentsForWorkspace(), buildDefaultAgentConfig(), buildDefaultAgentPrompt(), DEFAULT_AGENT_PROMPT_VERSION, DefaultAgentPreset, defaultAgentPresets (+10 more)

### Community 44 - "invalid"
Cohesion: 0.13
Nodes (27): AGENDA_COLUMNS, agendaChanges(), AgendaInput, AgendaRow, createAgenda(), getDefaultAgenda(), GoogleSyncMode, intInRange() (+19 more)

### Community 51 - "step-agents.tsx"
Cohesion: 0.25
Nodes (13): OptionCard(), Question(), ToggleSwitch(), AgentDraft, createDraft(), getAgentName(), getConfig(), getHandoffKeywords() (+5 more)

### Community 52 - "app_private.book_appointment"
Cohesion: 0.17
Nodes (6): app_private.book_appointment(), app_private.check_agenda_slot(), app_private.reschedule_appointment(), idx_appointments_no_show_due, app_private.book_appointment(), public.crm_contact_activity

### Community 53 - "flow-answer-verifier.ts"
Cohesion: 0.46
Nodes (6): extractOutputText(), getRecord(), validateAnswerLocally(), VerificationResult, verifyFlowAnswer(), getWorkspaceOpenAIKey()

### Community 54 - "welcome-page.ts"
Cohesion: 0.15
Nodes (18): Stripe (Payment Link externo), isLevyPurchase(), handleCheckout(), idOf(), ownedWorkspaceId(), workspaceInfo(), billingWorkspace(), getWelcomeState() (+10 more)

### Community 55 - "flow-builder.tsx"
Cohesion: 0.08
Nodes (35): ActionsEditor(), patchAction(), replaceCrm(), AgentItem, CrmActionFields(), FlowBuilderProps, FlowCrmOptions, FlowRunItem (+27 more)

### Community 56 - "import-export.ts"
Cohesion: 0.13
Nodes (21): RFC-4180, csvSafe(), csvUnsafe(), FORMULA_STARTS, parseCsv(), parseCsvRecords(), quoteCell(), toCsv() (+13 more)

### Community 57 - "20261102210000_agenda_core.sql"
Cohesion: 0.29
Nodes (9): public.agendas, public.appointments, public.google_event_deletions, public.offered_slots, public.schedule_blocks, set_agendas_updated_at, set_appointments_updated_at, set_google_event_deletions_updated_at (+1 more)

### Community 58 - "agendas.ts"
Cohesion: 0.08
Nodes (39): agent, MONDAY_10, NOW, operator, seed(), Agenda, getAgenda(), setDefaultAgenda() (+31 more)

### Community 59 - "wizard.tsx"
Cohesion: 0.12
Nodes (26): OnboardingProgressCard(), SupportContact(), StepDone(), enter(), WizardAgent, WizardAsset, WizardIntegration, WizardProps (+18 more)

### Community 60 - "Auditoria de rendimiento 2026-10-09"
Cohesion: 0.25
Nodes (5): Auditoria de rendimiento 2026-10-09, AppShell monolith (1350 lines), idx_conversations_workspace_last_message index (not applied), Incremental inbox snapshot (pending), Shared (panel) layout

### Community 61 - "appointments/route.ts"
Cohesion: 0.70
Nodes (4): dateParam(), GET(), listAppointments(), listBlocks()

### Community 62 - "workspaces.ts"
Cohesion: 0.30
Nodes (9): GET(), asStateRecord(), patchOnboardingState(), POST(), requireUser(), DefaultConversationMode, withDefaultConversationMode(), isChecklistComplete() (+1 more)

### Community 63 - "ycloud-webhook.ts"
Cohesion: 0.10
Nodes (30): maxDuration, POST(), maxDuration, POST(), findOrCreateOpenConversation(), OpenConversation, MEDIA_KINDS, MESSAGE_WRAPPERS (+22 more)

### Community 64 - "StepBusiness"
Cohesion: 0.26
Nodes (14): Estado real vs. inventario (F0.1, 2026-11-02), StepBusiness(), addLocation(), patch(), removeLocation(), selectCountry(), selectSector(), updateLocation() (+6 more)

### Community 65 - "agency-crm.ts"
Cohesion: 0.11
Nodes (37): assertConversationInWorkspace(), ActivityEntry, ActivityKind, logActivity(), operator, seed(), STAGE_NAMES, eraseContact() (+29 more)

### Community 66 - "onboarding/page.tsx"
Cohesion: 0.13
Nodes (21): POST(), readResponsePayload(), YCloudErrorPayload, GET(), configString(), ContactRow, ConversationRow, IntegrationRow (+13 more)

### Community 67 - "contacts.ts"
Cohesion: 0.16
Nodes (28): ClientsPage(), metadata, loadBusyIntervals(), listActivity(), CONTACT_SOURCES, ContactSearch, ContactSource, createContact() (+20 more)

### Community 68 - "Runbook de despliegue"
Cohesion: 0.19
Nodes (15): Alineacion con el curso, Gaps vs lesson 05 (Vercel deploy, real WhatsApp round-trip, GHL test), Recommended next steps (SQL, secrets, deploy, webhook, test), Video 05 - La App por Dentro + Deploy a Vercel, Carlos-Dominguez-faber/whatsapp-saas reference repo, WhatsApp SaaS - ruta del curso, Production step checklist, Target system (inbox, configurable AI agent, handoff, buffer, YCloud dispatch, audio transcription, GHL) (+7 more)

### Community 69 - "next"
Cohesion: 0.11
Nodes (28): next, @supabase/supabase-js, signOut(), AdminPage(), POST(), PATCH(), POST(), POST() (+20 more)

### Community 70 - "Tareas"
Cohesion: 0.12
Nodes (16): Decisiones pendientes (las responde el usuario; mientras, sigue con otras tareas), Entorno, F0 — Preparación, F1 — Modelo de datos del CRM (aditivo), F3 — Google Calendar por workspace, F4 — Jobs y recordatorios, F6 — Stripe y onboarding de Levy, F7 — Migración de datos y limpieza (+8 more)

### Community 71 - "FlowBuilder"
Cohesion: 0.26
Nodes (14): FlowBuilder(), addStage(), archiveFlow(), createEmptyFlow(), createTemplate(), moveSelectedStep(), saveFlow(), updateDraft() (+6 more)

### Community 72 - "deliver/route.ts"
Cohesion: 0.15
Nodes (20): configString(), ContactRow, GET(), getInteractiveOptions(), IntegrationRow, InteractiveOption, isAuthorized(), POST() (+12 more)

### Community 73 - "Levy multi-tenant WhatsApp AI agent panel"
Cohesion: 0.24
Nodes (6): Conversational flow builder with human review, Inbox por empresa (IA / handoff / onboarding views), Levy multi-tenant WhatsApp AI agent panel, Next.js 16 App Router, Supabase (Postgres + Auth + RLS), Workspace (empresa / tenant)

### Community 74 - "config.ts"
Cohesion: 0.40
Nodes (3): BillingConfig, DEFAULT_COMPANY_FIELD, DEFAULT_GRACE_DAYS

### Community 75 - "agenda-panel.tsx"
Cohesion: 0.11
Nodes (27): AgendaPage(), metadata, AppointmentDialog(), BlockDialog(), Modal(), NewAppointmentDialog(), SlotPicker(), STATUS_LABELS (+19 more)

### Community 76 - "20261103020000_billing.sql"
Cohesion: 0.48
Nodes (6): idx_billing_events_workspace, idx_workspace_billing_status, public.billing_events, public.workspace_billing, set_billing_events_updated_at, set_workspace_billing_updated_at

### Community 77 - "bienvenida/page.tsx"
Cohesion: 0.32
Nodes (11): FAILURES, POST(), POST(), loadState(), metadata, WelcomePage(), findAuthUserByEmail(), getBillingConfig() (+3 more)

### Community 79 - "login/actions.ts"
Cohesion: 0.15
Nodes (14): POST(), appUrl, figtree, inter, metadata, viewport, redirectAfterAuth(), requestPasswordReset() (+6 more)

### Community 84 - "public-shell.tsx"
Cohesion: 0.24
Nodes (15): GlobalError(), LoginPage(), metadata, NotFound(), metadata, RecuperarPage(), metadata, ResetPasswordPage() (+7 more)

### Community 85 - "routeAgent"
Cohesion: 0.47
Nodes (9): getAgentIntentBoost(), getConfigRecord(), getRouterDescription(), getRoutingKeywords(), getRoutingTokens(), isBookingAgent(), isContextualBookingFollowUp(), normalizeRoutingText() (+1 more)

### Community 86 - "ref_node_test"
Cohesion: 0.18
Nodes (14): AdminClient, applyConversationHandoff(), buildHandoffContext(), buildHandoffNote(), ConversationHandoffInfo, detectAnswerHandoff(), findHandoffKeyword(), HANDOFF_CLIENT_NOTICE (+6 more)

### Community 90 - "requireWorkspaceRole"
Cohesion: 0.11
Nodes (21): Reglas para cada iteración, deliverQueuedReviewMessages(), POST(), ReviewPayload, excludeExistingContacts(), FlowPayload, POST(), stringArray() (+13 more)

### Community 95 - "Levy README"
Cohesion: 0.29
Nodes (5): AGENTS.md agent instructions, graphify, Levy README, Supabase schema apply order, Superadmin /admin account creation (SUPERADMIN_EMAILS)

### Community 96 - "Per-workspace integrations encrypted AES-256-GCM"
Cohesion: 0.29
Nodes (5): Required environment variables, INTEGRATION_ENCRYPTION_KEY, LEVY_WORKSPACE_CODE / LEVY_MEETING_CALENDAR_ID, GoHighLevel, OpenAI

### Community 98 - "Vercel daily crons (flows, deliver, ghl-sync)"
Cohesion: 0.33
Nodes (5): Deploy a Vercel workflow, deploy job (vercel pull + vercel deploy --prod), Vercel CLI, VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID secrets, External scheduler (cron-job.org / QStash) every 5 min

### Community 99 - "agency-crm.ts"
Cohesion: 0.21
Nodes (16): agencyWorkspaceCode(), bucket(), ensureFields(), ensureTag(), FIELDS, findContactId(), LEVY_ACTIVE_TAG, LEVY_TAGS (+8 more)

### Community 100 - "clientFetch"
Cohesion: 0.15
Nodes (29): act(), save(), save(), BillingActions(), openPortal(), WelcomeResendButton(), resend(), ContactsPanel() (+21 more)

### Community 101 - "google-sync.test.ts"
Cohesion: 0.17
Nodes (12): agendaWithCalendar(), Call, connect(), deps, ENV, Route, decryptSecret(), encryptSecret() (+4 more)

### Community 102 - "createClient"
Cohesion: 0.14
Nodes (17): Check, envCheck(), GET(), incrementalTables, recommendedEnv, requiredEnv, requiredTables, tableCheck() (+9 more)

### Community 103 - "GHL purchase webhook auto-provisioning (/api/webhooks/ghl/purchase)"
Cohesion: 0.50
Nodes (4): /auth/confirm create-password flow, GHL purchase webhook auto-provisioning (/api/webhooks/ghl/purchase), GHL tags cliente-levy / levy-acceso-listo / levy-activo, LEVY_PURCHASE_WEBHOOK_SECRET

### Community 104 - "legal-page.tsx"
Cohesion: 0.31
Nodes (11): cookies, CookiesPage(), metadata, metadata, PrivacyPage(), metadata, TermsPage(), legalMail (+3 more)

### Community 105 - "secrets.ts"
Cohesion: 0.29
Nodes (10): POST(), GET(), POST(), generateWebhookSecret(), hashSecret(), IntegrationProvider, maskSecret(), saveIntegrationSecret() (+2 more)

### Community 106 - "panel-context.ts"
Cohesion: 0.24
Nodes (9): emptyResult, FlujosPage(), metadata, BusinessPage(), metadata, getPanelContext, PanelContext, getConfigRecord() (+1 more)

### Community 107 - "buildFieldsFromChoices"
Cohesion: 0.24
Nodes (11): next(), save(), buildAddressText(), buildDaysText(), buildFieldsFromChoices(), buildHoursText(), buildLocationText(), buildServicesText() (+3 more)

### Community 108 - "admin.test.ts"
Cohesion: 0.42
Nodes (7): assertWorkspace(), BillingAdminError, updateWorkspaceBillingAdmin(), buildPaymentLinkUrl(), normalizeStripeCustomerId(), parsePaymentLink(), publicPaymentLinkUrl()

### Community 109 - "(panel)/layout.tsx"
Cohesion: 0.29
Nodes (6): nextConfig, PanelLayout(), BrandMark(), IntentLink(), sidebarItems, SidebarNav()

### Community 110 - "welcome-view.tsx"
Cohesion: 0.32
Nodes (7): WelcomeAutoRefresh(), Hero(), preparation, WelcomeView(), WelcomeViewState, brandEyebrow, WelcomeState

## Knowledge Gaps
- **24 isolated node(s):** `RFC-4180`, `/auth/confirm create-password flow`, `GHL tags cliente-levy / levy-acceso-listo / levy-activo`, `LEVY_PURCHASE_WEBHOOK_SECRET`, `File/Document Icon (gray 16x16, page with folded corner and text lines)` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 565 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `buffer/route.ts`, `Dependencias y ESLint`, `google-sync.ts`, `createAdminClient`, `panel-data.ts`, `WorkspaceSectionPage`, `levy-meeting-email.ts`, `billing.test.ts`, `crm-jobs.ts`, `inicio/page.tsx`, `test-prompt/route.ts`, `lucide-react`, `admin-companies.ts`, `wizard.tsx`, `appointments/route.ts`, `workspaces.ts`, `ycloud-webhook.ts`, `onboarding/page.tsx`, `contacts.ts`, `deliver/route.ts`, `agenda-panel.tsx`, `bienvenida/page.tsx`, `login/actions.ts`, `public-shell.tsx`, `requireWorkspaceRole`, `createClient`, `legal-page.tsx`, `secrets.ts`, `panel-context.ts`, `(panel)/layout.tsx`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `createAdminClient()` (e.g. with `Decisiones tomadas` and `Reglas para cada iteración`) actually correct?**
  _`createAdminClient()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-4180`, `/auth/confirm create-password flow`, `GHL tags cliente-levy / levy-acceso-listo / levy-activo` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `buffer/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13675213675213677 - nodes in this community are weakly interconnected._
- **Why does `createAdminClient()` connect `createAdminClient` to `buffer/route.ts`, `google-sync.ts`, `panel-data.ts`, `WorkspaceSectionPage`, `levy-meeting-email.ts`, `billing.test.ts`, `crm-jobs.ts`, `admin-companies.ts`, `appointments/route.ts`, `workspaces.ts`, `ycloud-webhook.ts`, `onboarding/page.tsx`, `contacts.ts`, `next`, `deliver/route.ts`, `agenda-panel.tsx`, `bienvenida/page.tsx`, `login/actions.ts`, `requireWorkspaceRole`, `createClient`, `secrets.ts`, `panel-context.ts`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `apiErrorResponse()` (e.g. with `Decisiones tomadas` and `Registro de iteraciones`) actually correct?**
  _`apiErrorResponse()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `FakeQuery` be split into smaller, more focused modules?**
  _Cohesion score 0.060129509713228495 - nodes in this community are weakly interconnected._