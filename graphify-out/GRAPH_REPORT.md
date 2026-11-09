# Graph Report - Agency  (2026-11-09)

## Corpus Check
- 301 files · ~199,165 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .example 1, .ico 1)

## Summary
- 2161 nodes · 6777 edges · 105 communities (86 shown, 19 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 188 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `70f8ec88`
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
- calendar-tools.ts
- webhook.ts
- lucide-react
- onboarding/page.tsx
- invalid
- Crons de Vercel
- Configuración de PostCSS
- deliver/route.ts
- app_private.book_appointment
- flow-answer-verifier.ts
- welcome-page.ts
- flow-builder.tsx
- import-export.ts
- 20261102210000_agenda_core.sql
- agendas.ts
- wizard.tsx
- Auditoria de rendimiento 2026-10-09
- api-error.ts
- platform-admin.ts
- ycloud-webhook.ts
- legal-page.tsx
- agency-crm.ts
- send/route.ts
- contacts.ts
- Runbook de despliegue
- createClient
- Tareas
- FlowBuilder
- next
- shared.ts
- config.ts
- agenda-panel.tsx
- 20261103020000_billing.sql
- bienvenida/page.tsx
- app_private.invoke_crm_jobs
- login/actions.ts
- public-shell.tsx
- routeAgent
- ref_node_test
- api-error.ts
- google-sync.test.ts
- panel-data.ts
- CLAUDE.md
- readiness/route.ts
- snapshot/route.ts
- clientFetch
- ref_node_assert
- createClient
- welcome-view.tsx
- onboarding-progress-card.tsx

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

## Communities (105 total, 19 thin omitted)

### Community 0 - "shared.tsx"
Cohesion: 0.25
Nodes (26): lucide-react, ConnectedBanner(), CopyButton(), Field(), HelpBox(), HowTo(), inputClass, linkButton (+18 more)

### Community 1 - "buffer/route.ts"
Cohesion: 0.16
Nodes (23): AgentRow, buildInstructions(), buildTimeContext(), buildTodayLine(), buildTranscript(), BusinessProfileAsset, callResponsesApi(), ContactMetadata (+15 more)

### Community 2 - "FakeQuery"
Cohesion: 0.07
Nodes (6): compare(), fakeId(), FakeQuery, FakeSupabase, likeToRegExp(), parseOr()

### Community 3 - "custom-fields.ts"
Cohesion: 0.12
Nodes (26): ensureFields(), Client, createCustomField(), CUSTOM_FIELD_TYPES, CustomFieldDefinition, CustomFieldDefinitionInput, CustomFieldType, CustomFieldValue (+18 more)

### Community 4 - "step-business.tsx"
Cohesion: 0.09
Nodes (49): Estado real vs. inventario (F0.1, 2026-11-02), Chip(), StepBusiness(), addLocation(), next(), patch(), removeLocation(), save() (+41 more)

### Community 5 - "dbFailure"
Cohesion: 0.17
Nodes (21): assertConversationInWorkspace(), listActivity(), getContactCard(), operator, STAGE_NAMES, eraseContact(), dbFailure(), notFound() (+13 more)

### Community 6 - "slots.ts"
Cohesion: 0.12
Nodes (23): AgendaConfig, agendaConfigFromRow(), AgendaService, clampInt(), DAY_KEYS, DEFAULT_SERVICE_MINUTES, DEFAULT_WEEKLY_SCHEDULE, normalizeText() (+15 more)

### Community 7 - "reminders.ts"
Cohesion: 0.13
Nodes (21): AgendaNoticeConfig, CandidateRow, claim(), DEFAULT_MESSAGES, deliverNotice(), fillNotice(), firstName(), isMessagingWindowOpen() (+13 more)

### Community 8 - "Dependencias y ESLint"
Cohesion: 0.06
Nodes (43): eslintConfig, dependencies, lucide-react@^1.23.0, next@16.2.10, nodemailer@^10.3.1, react@19.2.4, react-dom@19.2.4, @supabase/ssr@^0.12.0 (+35 more)

### Community 9 - "schema.sql"
Cohesion: 0.06
Nodes (51): app_private.check_agenda_slot(), app_private.reschedule_appointment(), app_private.seed_crm_pipeline_stages(), idx_agents_workspace_id, idx_appointments_no_show_due, idx_billing_events_workspace, idx_integration_secrets_workspace_provider, idx_messages_conversation_id_created_at (+43 more)

### Community 10 - "google-sync.ts"
Cohesion: 0.14
Nodes (24): Decisiones tomadas, server-only, AgendaCalendarRuntime, CalendarRuntime, CalendarRuntimeResult, CalendarToolCall, runCalendarTool(), ACTIVE_STATUSES (+16 more)

### Community 11 - "CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code"
Cohesion: 0.22
Nodes (8): CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code, Código de referencia del CRM (portar, no copiar a ciegas), Inventario de GHL a eliminar, Modelo de datos (Supabase, esquema `public`), Objetivo, Onboarding de Levy, Panel, Verificación final (la última tarea del progreso)

### Community 12 - "InboxPanel"
Cohesion: 0.09
Nodes (30): ContactCrmSummary(), nextAppointment(), ConversationItem, handoffSourceLabel, InboxPanel(), handleAddToFlow(), handleInternalNote(), handleRemoveFromFlow() (+22 more)

### Community 13 - "createAdminClient"
Cohesion: 0.11
Nodes (42): PATCH(), GET(), POST(), DELETE(), POST(), POST(), Context, DELETE() (+34 more)

### Community 14 - "timezones.ts"
Cohesion: 0.18
Nodes (28): F2 — Lógica del CRM y la Agenda, Registro de iteraciones, BlockDialog(), save(), AgendaPanel(), deleteBlock(), load(), dayLabel() (+20 more)

### Community 15 - "agent-agenda.test.ts"
Cohesion: 0.13
Nodes (23): F5 — Agente, flujos y panel sin GHL, ACTIVE, deps, NOW, buildCalendarContext(), buildCalendarToolDefinitions(), buildChangesContext(), buildDirectAvailabilityAnswer() (+15 more)

### Community 16 - "agent-settings.tsx"
Cohesion: 0.11
Nodes (41): AgentConfig, AgentItem, AgentSettings(), createBaseAgent(), deleteAgent(), saveAgent(), selectAgent(), AgentSettingsProps (+33 more)

### Community 17 - "calendar-request.ts"
Cohesion: 0.19
Nodes (15): addDaysToDateKey(), CalendarRequestContext, dateKeyInTimezone(), months, normalize(), parseDateKey(), ParsedTime, parseTime() (+7 more)

### Community 18 - "panel-data.ts"
Cohesion: 0.22
Nodes (13): metadata, ObservabilityPage(), emptyResult, Home(), metadata, BUSINESS_METRICS_WINDOW_DAYS, BusinessMetrics, getBusinessMetrics() (+5 more)

### Community 19 - "WorkspaceSectionPage"
Cohesion: 0.12
Nodes (22): AgentsPage(), metadata, AutomationsPage(), metadata, metadata, TeamPage(), IntegrationsPage(), metadata (+14 more)

### Community 20 - "levy-meeting-email.ts"
Cohesion: 0.07
Nodes (47): cancelExisting(), emailAfterResponse(), GET(), meetingEngine(), POST(), readWorkspace(), readWorkspaceCode(), saveMeeting() (+39 more)

### Community 21 - "billing.test.ts"
Cohesion: 0.16
Nodes (22): BillingCard(), STATUS_LABELS, BillingNotice(), formatDate(), readState(), daysAgo(), fake(), NOW (+14 more)

### Community 22 - "Configuración de TypeScript"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 23 - "crm-jobs.ts"
Cohesion: 0.21
Nodes (11): GET(), isAuthorized(), maxDuration, POST(), purgeOfferedSlots(), CrmJobDeps, CrmJobReport, CrmJobStep (+3 more)

### Community 24 - "public.conversations"
Cohesion: 0.13
Nodes (23): idx_flow_answer_reviews_workspace_status, idx_flow_events_workspace_created, idx_flow_runs_conversation_status, idx_flow_runs_workspace_contact_status, idx_flows_workspace_status, public.flow_answer_reviews, public.flow_events, public.flow_runs (+15 more)

### Community 25 - "panel-header.tsx"
Cohesion: 0.15
Nodes (16): AgendaPage(), metadata, findTarget(), GuidedTour(), readSeenLocally(), Rect, START_TOUR_EVENT, storageKey() (+8 more)

### Community 26 - "20261102200000_crm_core.sql"
Cohesion: 0.10
Nodes (34): idx_contacts_automation_labels, app_private.seed_crm_pipeline_stages(), app_private.seed_crm_pipeline_stages_trigger(), idx_contacts_workspace_last_message, idx_contacts_workspace_stage, idx_crm_contact_activity_actor_user, idx_crm_contact_activity_workspace_contact, idx_crm_contact_notes_author (+26 more)

### Community 27 - "inicio/page.tsx"
Cohesion: 0.12
Nodes (20): chat, Check(), faqs, growth, included, LandingPage(), metadata, steps (+12 more)

### Community 28 - "webhook.test.ts"
Cohesion: 0.15
Nodes (9): stripe@^19.3.0, stripe, StripeWebhookDeps, config, deps(), NOW, signedEvent(), stripeSdk (+1 more)

### Community 29 - "google-calendar.ts"
Cohesion: 0.11
Nodes (42): Lógica en Next.js, buildAuthUrl(), buildEventBody(), calendarFetch(), CallbackResult, completeGoogleCallback(), INTEGRATIONS_PATH, createOAuthState() (+34 more)

### Community 30 - "public.workspaces"
Cohesion: 0.15
Nodes (17): app_private.has_workspace_role(), app_private.is_workspace_member(), idx_integrations_workspace_id, idx_workspace_members_user_id, public.integrations, public.workspace_members, public.workspaces, seed_crm_pipeline_stages_on_workspace (+9 more)

### Community 31 - "flow-engine.ts"
Cohesion: 0.11
Nodes (22): contactAudienceLabels(), flowMatchesTags(), addMinutes(), AdminClient, calculateProcessImpact(), ContactRow, ConversationContext, FLOW_OPT_OUT_LABEL (+14 more)

### Community 32 - "WorkspaceSettings"
Cohesion: 0.13
Nodes (23): buildAssetDraft(), stableDate(), WorkspaceSettings(), addBusinessCustomField(), addMember(), assetEditor(), assetList(), businessProfileEditor() (+15 more)

### Community 33 - "workspace-settings.tsx"
Cohesion: 0.12
Nodes (17): AgendaOption, AgentItem, fieldHelp(), hashToTab, IntegrationItem, IntegrationTestResult, providers, singletonAssetKinds (+9 more)

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
Cohesion: 0.21
Nodes (19): AgendaRuntimeCalendar, AgendaRuntimeDeps, alternativesFor(), buildAgendaRuntime(), failureWithAlternatives(), formatSlot(), pickUpcoming(), resolveStart() (+11 more)

### Community 38 - "AdminConsole"
Cohesion: 0.26
Nodes (11): AdminConsole(), addSuperadmin(), createCompany(), deleteCompany(), deleteJson(), linkOwner(), openCompany(), postJson() (+3 more)

### Community 39 - "Iconos del scaffold Next"
Cohesion: 0.40
Nodes (6): File/Document Icon (gray 16x16, page with folded corner and text lines), Globe Icon (gray 16x16, world/web symbol), Next.js Wordmark Logo (black), Default create-next-app Scaffold Assets, Vercel Triangle Logo (white), Browser Window Icon (gray 16x16, window with three dots)

### Community 40 - "calendar-tools.ts"
Cohesion: 0.20
Nodes (17): Cambios en lo existente, asRecord(), saveCalendarTool(), asRecord(), buildCalendarToolMetadata(), CALENDAR_TOOL_TYPE, CalendarTool, CalendarToolMetadata (+9 more)

### Community 41 - "webhook.ts"
Cohesion: 0.18
Nodes (17): AgencyContactInput, AgencyContactResult, BillingRow, billingRowBy(), customFieldValue(), handleSubscriptionChange(), invoiceSubscriptionId(), periodEnd() (+9 more)

### Community 42 - "lucide-react"
Cohesion: 0.12
Nodes (25): react, Summary, ACTIVITY_LABELS, activityDetail(), ACTOR_LABELS, Block(), ContactDrawer(), call() (+17 more)

### Community 43 - "onboarding/page.tsx"
Cohesion: 0.10
Nodes (35): DELETE(), POST(), GET(), asStateRecord(), patchOnboardingState(), POST(), metadata, OnboardingPage() (+27 more)

### Community 44 - "invalid"
Cohesion: 0.14
Nodes (29): AGENDA_COLUMNS, agendaChanges(), AgendaInput, AgendaRow, createAgenda(), getAgenda(), getDefaultAgenda(), GoogleSyncMode (+21 more)

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
Cohesion: 0.15
Nodes (18): Stripe (Payment Link externo), isLevyPurchase(), handleCheckout(), idOf(), ownedWorkspaceId(), workspaceInfo(), billingWorkspace(), getWelcomeState() (+10 more)

### Community 55 - "flow-builder.tsx"
Cohesion: 0.10
Nodes (30): ActionsEditor(), patchAction(), replaceCrm(), AgentItem, CrmActionFields(), FlowBuilderProps, FlowCrmOptions, FlowRunItem (+22 more)

### Community 56 - "import-export.ts"
Cohesion: 0.12
Nodes (30): RFC-4180, ClientsPage(), metadata, searchContacts(), csvSafe(), csvUnsafe(), FORMULA_STARTS, parseCsv() (+22 more)

### Community 57 - "20261102210000_agenda_core.sql"
Cohesion: 0.29
Nodes (9): public.agendas, public.appointments, public.google_event_deletions, public.offered_slots, public.schedule_blocks, set_agendas_updated_at, set_appointments_updated_at, set_google_event_deletions_updated_at (+1 more)

### Community 58 - "agendas.ts"
Cohesion: 0.09
Nodes (33): agent, MONDAY_10, NOW, operator, seed(), Agenda, Appointment, AppointmentCreator (+25 more)

### Community 59 - "wizard.tsx"
Cohesion: 0.15
Nodes (21): SupportContact(), StepDone(), enter(), OnboardingWizard(), WizardAsset, WizardIntegration, WizardProps, WizardWorkspace (+13 more)

### Community 60 - "Auditoria de rendimiento 2026-10-09"
Cohesion: 0.13
Nodes (12): nextConfig, Auditoria de rendimiento 2026-10-09, AppShell monolith (1350 lines), Per-route client bundle split, idx_conversations_workspace_last_message index (not applied), Incremental inbox snapshot (pending), Shared (panel) layout, PanelLayout() (+4 more)

### Community 61 - "api-error.ts"
Cohesion: 0.13
Nodes (20): PATCH(), dateParam(), GET(), POST(), POST(), GET(), POST(), Context (+12 more)

### Community 62 - "platform-admin.ts"
Cohesion: 0.24
Nodes (13): AdminPage(), PATCH(), POST(), assertCurrentUserIsAdmin(), DELETE(), POST(), linkOwnerToWorkspace(), forbidden() (+5 more)

### Community 63 - "ycloud-webhook.ts"
Cohesion: 0.07
Nodes (38): maxDuration, POST(), maxDuration, POST(), appUrl, figtree, inter, metadata (+30 more)

### Community 64 - "legal-page.tsx"
Cohesion: 0.25
Nodes (13): cookies, CookiesPage(), metadata, metadata, PrivacyPage(), metadata, TermsPage(), legalMail (+5 more)

### Community 65 - "agency-crm.ts"
Cohesion: 0.15
Nodes (29): agencyWorkspaceCode(), bucket(), ensureTag(), FIELDS, findContactId(), LEVY_ACTIVE_TAG, LEVY_TAGS, markAgencyContactActiveInCrm() (+21 more)

### Community 66 - "send/route.ts"
Cohesion: 0.19
Nodes (13): POST(), readResponsePayload(), YCloudErrorPayload, GET(), configString(), ContactRow, ConversationRow, IntegrationRow (+5 more)

### Community 67 - "contacts.ts"
Cohesion: 0.20
Nodes (13): CONTACT_SOURCES, ContactSearch, ContactSource, createContact(), CreateContactInput, CrmContact, normalizeSource(), recordInboundMessage() (+5 more)

### Community 68 - "Runbook de despliegue"
Cohesion: 0.05
Nodes (40): Deploy a Vercel workflow, deploy job (vercel pull + vercel deploy --prod), Vercel CLI, VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID secrets, AGENTS.md agent instructions, graphify, Alineacion con el curso, Gaps vs lesson 05 (Vercel deploy, real WhatsApp round-trip, GHL test) (+32 more)

### Community 69 - "createClient"
Cohesion: 0.18
Nodes (14): @supabase/supabase-js, signOut(), POST(), allowedRoles, DELETE(), findAuthUserByEmail(), getUserDisplayName(), PATCH() (+6 more)

### Community 70 - "Tareas"
Cohesion: 0.12
Nodes (16): Decisiones pendientes (las responde el usuario; mientras, sigue con otras tareas), Entorno, F0 — Preparación, F1 — Modelo de datos del CRM (aditivo), F3 — Google Calendar por workspace, F4 — Jobs y recordatorios, F6 — Stripe y onboarding de Levy, F7 — Migración de datos y limpieza (+8 more)

### Community 71 - "FlowBuilder"
Cohesion: 0.22
Nodes (16): FlowBuilder(), addStage(), archiveFlow(), createEmptyFlow(), createTemplate(), moveSelectedStep(), saveFlow(), updateDraft() (+8 more)

### Community 72 - "next"
Cohesion: 0.22
Nodes (6): next, excludeExistingContacts(), FlowPayload, POST(), stringArray(), GET()

### Community 73 - "shared.ts"
Cohesion: 0.22
Nodes (13): ActivityEntry, ActivityKind, optionalText(), CrmActor, CrmActorKind, SYSTEM_ACTOR, assertMember(), createdByFor() (+5 more)

### Community 74 - "config.ts"
Cohesion: 0.40
Nodes (3): BillingConfig, DEFAULT_COMPANY_FIELD, DEFAULT_GRACE_DAYS

### Community 75 - "agenda-panel.tsx"
Cohesion: 0.12
Nodes (20): AppointmentDialog(), act(), Modal(), NewAppointmentDialog(), save(), SlotPicker(), STATUS_LABELS, when() (+12 more)

### Community 76 - "20261103020000_billing.sql"
Cohesion: 0.48
Nodes (6): idx_billing_events_workspace, idx_workspace_billing_status, public.billing_events, public.workspace_billing, set_billing_events_updated_at, set_workspace_billing_updated_at

### Community 77 - "bienvenida/page.tsx"
Cohesion: 0.32
Nodes (11): FAILURES, POST(), POST(), loadState(), metadata, WelcomePage(), findAuthUserByEmail(), getBillingConfig() (+3 more)

### Community 79 - "login/actions.ts"
Cohesion: 0.33
Nodes (7): redirectAfterAuth(), requestPasswordReset(), signIn(), updatePassword(), authMessages, translateAuthError(), getOnboardingState()

### Community 84 - "public-shell.tsx"
Cohesion: 0.24
Nodes (15): GlobalError(), LoginPage(), metadata, NotFound(), metadata, RecuperarPage(), metadata, ResetPasswordPage() (+7 more)

### Community 85 - "routeAgent"
Cohesion: 0.40
Nodes (10): getAgentIntentBoost(), getConfigRecord(), getRouterDescription(), getRoutingKeywords(), getRoutingTokens(), isBookingAgent(), isContextualBookingFollowUp(), isExplicitBookingRequest() (+2 more)

### Community 86 - "ref_node_test"
Cohesion: 0.15
Nodes (19): GET(), getEnabledToolIds(), getKnowledgeAssetIds(), isAuthorized(), POST(), AdminClient, applyConversationHandoff(), buildHandoffNote() (+11 more)

### Community 90 - "api-error.ts"
Cohesion: 0.13
Nodes (22): Reglas para cada iteración, deliverQueuedReviewMessages(), POST(), ReviewPayload, deliverFirstMessage(), POST(), StartFlowPayload, POST() (+14 more)

### Community 95 - "google-sync.test.ts"
Cohesion: 0.21
Nodes (9): agendaWithCalendar(), Call, connect(), deps, ENV, Route, decryptSecret(), encryptSecret() (+1 more)

### Community 96 - "panel-data.ts"
Cohesion: 0.25
Nodes (9): emptyResult, FlujosPage(), metadata, deployChecks, getAuthDisplayName(), getConfigRecord(), getMemberProfiles(), syncDefaultAgentPrompts() (+1 more)

### Community 98 - "readiness/route.ts"
Cohesion: 0.28
Nodes (8): Check, envCheck(), GET(), incrementalTables, recommendedEnv, requiredEnv, requiredTables, tableCheck()

### Community 99 - "snapshot/route.ts"
Cohesion: 0.80
Nodes (4): GET(), getMetadataRecord(), getYCloudContactName(), stableTime()

### Community 100 - "clientFetch"
Cohesion: 0.10
Nodes (35): saveDefaultConversationMode(), testPrompt(), BillingActions(), openPortal(), WelcomeResendButton(), resend(), ContactsPanel(), importFile() (+27 more)

### Community 101 - "ref_node_assert"
Cohesion: 0.12
Nodes (17): NOW, ENV, NOW, client(), broken, client(), callbackRedirectPath(), deps (+9 more)

### Community 102 - "createClient"
Cohesion: 0.26
Nodes (9): GET(), isOperatorRequest(), hasSessionCookie(), assertSupabaseAdminEnv(), getSupabaseBrowserEnv(), getSupabaseServerEnv(), config, proxy() (+1 more)

### Community 103 - "welcome-view.tsx"
Cohesion: 0.32
Nodes (7): WelcomeAutoRefresh(), Hero(), preparation, WelcomeView(), WelcomeViewState, brandEyebrow, WelcomeState

### Community 104 - "onboarding-progress-card.tsx"
Cohesion: 0.54
Nodes (5): OnboardingProgressCard(), buildSupportLink(), buildSupportMessage(), SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_E164

## Knowledge Gaps
- **24 isolated node(s):** `RFC-4180`, `/auth/confirm create-password flow`, `GHL tags cliente-levy / levy-acceso-listo / levy-activo`, `LEVY_PURCHASE_WEBHOOK_SECRET`, `File/Document Icon (gray 16x16, page with folded corner and text lines)` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 566 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `buffer/route.ts`, `Dependencias y ESLint`, `google-sync.ts`, `createAdminClient`, `panel-data.ts`, `WorkspaceSectionPage`, `levy-meeting-email.ts`, `billing.test.ts`, `crm-jobs.ts`, `panel-header.tsx`, `inicio/page.tsx`, `test-prompt/route.ts`, `AdminConsole`, `lucide-react`, `onboarding/page.tsx`, `deliver/route.ts`, `import-export.ts`, `Auditoria de rendimiento 2026-10-09`, `api-error.ts`, `platform-admin.ts`, `ycloud-webhook.ts`, `legal-page.tsx`, `send/route.ts`, `createClient`, `bienvenida/page.tsx`, `login/actions.ts`, `public-shell.tsx`, `api-error.ts`, `panel-data.ts`, `readiness/route.ts`, `snapshot/route.ts`, `clientFetch`, `createClient`, `onboarding-progress-card.tsx`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `createAdminClient()` (e.g. with `Decisiones tomadas` and `Reglas para cada iteración`) actually correct?**
  _`createAdminClient()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-4180`, `/auth/confirm create-password flow`, `GHL tags cliente-levy / levy-acceso-listo / levy-activo` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `FakeQuery` be split into smaller, more focused modules?**
  _Cohesion score 0.06794871794871794 - nodes in this community are weakly interconnected._
- **Why does `createAdminClient()` connect `createAdminClient` to `buffer/route.ts`, `google-sync.ts`, `agent-agenda.test.ts`, `panel-data.ts`, `WorkspaceSectionPage`, `levy-meeting-email.ts`, `billing.test.ts`, `crm-jobs.ts`, `panel-header.tsx`, `onboarding/page.tsx`, `deliver/route.ts`, `import-export.ts`, `api-error.ts`, `platform-admin.ts`, `ycloud-webhook.ts`, `send/route.ts`, `createClient`, `next`, `bienvenida/page.tsx`, `login/actions.ts`, `ref_node_test`, `api-error.ts`, `panel-data.ts`, `readiness/route.ts`, `snapshot/route.ts`, `createClient`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `apiErrorResponse()` (e.g. with `Decisiones tomadas` and `Registro de iteraciones`) actually correct?**
  _`apiErrorResponse()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `custom-fields.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12413793103448276 - nodes in this community are weakly interconnected._