# Graph Report - Agency  (2026-11-18)

## Corpus Check
- 304 files · ~200,578 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .example 1, .ico 1)

## Summary
- 2181 nodes · 6826 edges · 103 communities (84 shown, 19 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 191 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ccf2e26a`
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
- badRequest
- public.conversations
- StepBusiness
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
- workspaces/route.ts
- agendas.ts
- Crons de Vercel
- Configuración de PostCSS
- ref_node_assert
- app_private.book_appointment
- flow-answer-verifier.ts
- welcome-page.ts
- flow-builder.tsx
- import-export.test.ts
- 20261102210000_agenda_core.sql
- agendas.ts
- wizard.tsx
- Auditoria de rendimiento 2026-10-09
- api-error.ts
- meeting/route.ts
- ycloud-webhook.ts
- invalid
- agency-crm.ts
- readiness/route.ts
- clientes/page.tsx
- Runbook de despliegue
- workspaces.ts
- Tareas
- FlowBuilder
- Levy multi-tenant WhatsApp AI agent panel
- shared.ts
- invalid
- timezones.ts
- 20261103020000_billing.sql
- bienvenida/page.tsx
- app_private.invoke_crm_jobs
- next
- Alineacion con el curso
- app/layout.tsx
- ref_node_test
- secrets.ts
- google-sync.test.ts
- Levy README
- CLAUDE.md
- (panel)/layout.tsx
- deploy job (vercel pull + vercel deploy --prod)
- clientFetch
- ref_node_assert
- GHL purchase webhook auto-provisioning (/api/webhooks/ghl/purchase)

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

## Communities (103 total, 19 thin omitted)

### Community 0 - "shared.tsx"
Cohesion: 0.23
Nodes (29): ConnectedBanner(), CopyButton(), Field(), HelpBox(), HowTo(), inputClass, linkButton, Notice() (+21 more)

### Community 1 - "buffer/route.ts"
Cohesion: 0.12
Nodes (38): AgentRow, buildInstructions(), buildTimeContext(), buildTodayLine(), buildTranscript(), BusinessProfileAsset, callResponsesApi(), ContactMetadata (+30 more)

### Community 2 - "FakeQuery"
Cohesion: 0.08
Nodes (4): compare(), fakeId(), FakeQuery, FakeSupabase

### Community 3 - "custom-fields.ts"
Cohesion: 0.13
Nodes (22): ensureFields(), Client, createCustomField(), CUSTOM_FIELD_TYPES, CustomFieldDefinition, CustomFieldDefinitionInput, CustomFieldType, CustomFieldValue (+14 more)

### Community 4 - "step-business.tsx"
Cohesion: 0.12
Nodes (31): asString(), asStringArray(), AttendMode, attendModes, buildAddressText(), buildDaysText(), buildFieldsFromChoices(), buildHoursText() (+23 more)

### Community 5 - "crm.test.ts"
Cohesion: 0.16
Nodes (30): assertConversationInWorkspace(), syncAgencyContact(), logActivity(), getContactCard(), recordInboundMessage(), touchContactInbound(), updateContact(), operator (+22 more)

### Community 6 - "slots.ts"
Cohesion: 0.15
Nodes (30): Registro de iteraciones, agendaConfigFromRow(), clampInt(), closedReason(), DAY_KEYS, daySlots(), DEFAULT_SERVICE_MINUTES, distributeSlots() (+22 more)

### Community 7 - "reminders.ts"
Cohesion: 0.13
Nodes (22): AgendaNoticeConfig, CandidateRow, claim(), DEFAULT_MESSAGES, deliverNotice(), fillNotice(), firstName(), isMessagingWindowOpen() (+14 more)

### Community 8 - "Dependencias y ESLint"
Cohesion: 0.05
Nodes (48): eslintConfig, dependencies, lucide-react@^1.23.0, next@16.2.10, nodemailer@^10.3.1, react@19.2.4, react-dom@19.2.4, stripe@^19.3.0 (+40 more)

### Community 9 - "schema.sql"
Cohesion: 0.06
Nodes (51): app_private.check_agenda_slot(), app_private.reschedule_appointment(), app_private.seed_crm_pipeline_stages(), idx_agents_workspace_id, idx_appointments_no_show_due, idx_billing_events_workspace, idx_integration_secrets_workspace_provider, idx_messages_conversation_id_created_at (+43 more)

### Community 10 - "google-sync.ts"
Cohesion: 0.13
Nodes (18): ACTIVE_STATUSES, AppointmentStatus, CrmJobDeps, CrmJobReport, CrmJobStep, runCrmJobs(), AgendaSync, clearPending() (+10 more)

### Community 11 - "CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code"
Cohesion: 0.22
Nodes (8): CRM y Agenda dentro de AgenteLevy (todo en Supabase) — instrucciones para Claude Code, Código de referencia del CRM (portar, no copiar a ciegas), Inventario de GHL a eliminar, Modelo de datos (Supabase, esquema `public`), Objetivo, Onboarding de Levy, Panel, Verificación final (la última tarea del progreso)

### Community 12 - "InboxPanel"
Cohesion: 0.09
Nodes (30): ContactCrmSummary(), nextAppointment(), ConversationItem, handoffSourceLabel, InboxPanel(), handleAddToFlow(), handleInternalNote(), handleRemoveFromFlow() (+22 more)

### Community 13 - "createAdminClient"
Cohesion: 0.10
Nodes (47): PATCH(), GET(), POST(), DELETE(), POST(), GET(), POST(), Context (+39 more)

### Community 14 - "import-export.ts"
Cohesion: 0.13
Nodes (27): findContactId(), CONTACT_SOURCES, ContactSearch, ContactSource, createContact(), CreateContactInput, CrmContact, normalizeSource() (+19 more)

### Community 15 - "agent-agenda.test.ts"
Cohesion: 0.14
Nodes (21): ACTIVE, deps, NOW, buildCalendarContext(), buildChangesContext(), buildDirectAvailabilityAnswer(), buildDirectBookingAnswer(), buildDirectCancelAnswer() (+13 more)

### Community 16 - "agent-settings.tsx"
Cohesion: 0.12
Nodes (39): AgentConfig, AgentItem, AgentSettings(), createBaseAgent(), deleteAgent(), saveAgent(), selectAgent(), AgentSettingsProps (+31 more)

### Community 17 - "calendar-request.ts"
Cohesion: 0.19
Nodes (15): addDaysToDateKey(), CalendarRequestContext, dateKeyInTimezone(), months, normalize(), parseDateKey(), ParsedTime, parseTime() (+7 more)

### Community 18 - "inicio/page.tsx"
Cohesion: 0.08
Nodes (37): chat, Check(), faqs, growth, included, LandingPage(), metadata, steps (+29 more)

### Community 19 - "panel-data.ts"
Cohesion: 0.05
Nodes (61): Per-route client bundle split, AgentsPage(), metadata, AutomationsPage(), metadata, metadata, TeamPage(), emptyResult (+53 more)

### Community 20 - "levy-meeting-email.ts"
Cohesion: 0.11
Nodes (20): buildMeetingEmail(), ChangedAppointment, MeetingEmailInput, MeetingEmailKind, MeetingEmailResult, sendMeetingEmail(), NOW, buildWelcomeEmail() (+12 more)

### Community 21 - "billing.test.ts"
Cohesion: 0.17
Nodes (21): BillingCard(), STATUS_LABELS, BillingNotice(), formatDate(), readState(), daysAgo(), fake(), NOW (+13 more)

### Community 22 - "Configuración de TypeScript"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 23 - "badRequest"
Cohesion: 0.20
Nodes (14): dateParam(), GET(), POST(), Context, DELETE(), POST(), GET(), isAuthorized() (+6 more)

### Community 24 - "public.conversations"
Cohesion: 0.13
Nodes (23): idx_flow_answer_reviews_workspace_status, idx_flow_events_workspace_created, idx_flow_runs_conversation_status, idx_flow_runs_workspace_contact_status, idx_flows_workspace_status, public.flow_answer_reviews, public.flow_events, public.flow_runs (+15 more)

### Community 25 - "StepBusiness"
Cohesion: 0.19
Nodes (18): Estado real vs. inventario (F0.1, 2026-11-02), Chip(), StepBusiness(), addLocation(), next(), patch(), removeLocation(), save() (+10 more)

### Community 26 - "20261102200000_crm_core.sql"
Cohesion: 0.10
Nodes (34): idx_contacts_automation_labels, app_private.seed_crm_pipeline_stages(), app_private.seed_crm_pipeline_stages_trigger(), idx_contacts_workspace_last_message, idx_contacts_workspace_stage, idx_crm_contact_activity_actor_user, idx_crm_contact_activity_workspace_contact, idx_crm_contact_notes_author (+26 more)

### Community 27 - "public-shell.tsx"
Cohesion: 0.10
Nodes (35): cookies, CookiesPage(), metadata, GlobalError(), LoginPage(), metadata, NotFound(), metadata (+27 more)

### Community 28 - "webhook.test.ts"
Cohesion: 0.17
Nodes (7): stripe, StripeWebhookDeps, config, deps(), NOW, signedEvent(), stripeSdk

### Community 29 - "google-calendar.ts"
Cohesion: 0.11
Nodes (42): Lógica en Next.js, buildAuthUrl(), buildEventBody(), calendarFetch(), CallbackResult, completeGoogleCallback(), INTEGRATIONS_PATH, createOAuthState() (+34 more)

### Community 30 - "public.workspaces"
Cohesion: 0.15
Nodes (17): app_private.has_workspace_role(), app_private.is_workspace_member(), idx_integrations_workspace_id, idx_workspace_members_user_id, public.integrations, public.workspace_members, public.workspaces, seed_crm_pipeline_stages_on_workspace (+9 more)

### Community 31 - "flow-engine.ts"
Cohesion: 0.12
Nodes (21): contactAudienceLabels(), addMinutes(), AdminClient, calculateProcessImpact(), ContactRow, ConversationContext, FLOW_OPT_OUT_LABEL, FlowRow (+13 more)

### Community 32 - "WorkspaceSettings"
Cohesion: 0.13
Nodes (23): asRecord(), buildAssetDraft(), WorkspaceSettings(), addBusinessCustomField(), addMember(), assetEditor(), assetList(), businessProfileEditor() (+15 more)

### Community 33 - "workspace-settings.tsx"
Cohesion: 0.11
Nodes (18): AgendaOption, AgentItem, fieldHelp(), hashToTab, IntegrationItem, IntegrationTestResult, providers, singletonAssetKinds (+10 more)

### Community 34 - "steps"
Cohesion: 0.08
Nodes (23): concurrency, cancel-in-progress, group, env, runs-on, steps, timeout-minutes, VERCEL_ORG_ID (+15 more)

### Community 35 - "test-prompt/route.ts"
Cohesion: 0.17
Nodes (19): AgentLike, buildIdentityContext(), buildInstructions(), BusinessProfileAsset, getAgentIdentity(), getKnowledgeAssetIds(), getOpenAIModel(), getResponseText() (+11 more)

### Community 36 - "executeRun"
Cohesion: 0.22
Nodes (27): flowMatchesTags(), parseFlowSteps(), completeCheckpoint(), decideFlowAnswerReview(), executeRun(), findNextStep(), findStep(), getAnswers() (+19 more)

### Community 37 - "agent-agenda.ts"
Cohesion: 0.20
Nodes (18): AgendaRuntimeCalendar, AgendaRuntimeDeps, alternativesFor(), failureWithAlternatives(), formatSlot(), pickUpcoming(), resolveStart(), runAgendaTool() (+10 more)

### Community 38 - "AdminConsole"
Cohesion: 0.33
Nodes (10): AdminConsole(), addSuperadmin(), createCompany(), deleteCompany(), deleteJson(), linkOwner(), openCompany(), postJson() (+2 more)

### Community 39 - "Iconos del scaffold Next"
Cohesion: 0.40
Nodes (6): File/Document Icon (gray 16x16, page with folded corner and text lines), Globe Icon (gray 16x16, world/web symbol), Next.js Wordmark Logo (black), Default create-next-app Scaffold Assets, Vercel Triangle Logo (white), Browser Window Icon (gray 16x16, window with three dots)

### Community 40 - "calendar-tools.ts"
Cohesion: 0.13
Nodes (25): F5 — Agente, flujos y panel sin GHL, Cambios en lo existente, saveCalendarTool(), AgendaCalendarRuntime, buildCalendarToolDefinitions(), buildCalendarRuntime(), CalendarRuntime, CalendarRuntimeResult (+17 more)

### Community 41 - "webhook.ts"
Cohesion: 0.18
Nodes (17): POST(), BillingRow, billingRowBy(), customFieldValue(), handleSubscriptionChange(), invoiceSubscriptionId(), periodEnd(), planOf() (+9 more)

### Community 42 - "lucide-react"
Cohesion: 0.09
Nodes (30): lucide-react, react, Company, Summary, ACTIVITY_LABELS, activityDetail(), ACTOR_LABELS, Block() (+22 more)

### Community 43 - "workspaces/route.ts"
Cohesion: 0.31
Nodes (9): GET(), asStateRecord(), patchOnboardingState(), POST(), withDefaultConversationMode(), getOnboardingChecklist(), isAgentConfiguredForOnboarding(), isChecklistComplete() (+1 more)

### Community 44 - "agendas.ts"
Cohesion: 0.10
Nodes (26): agent, MONDAY_10, NOW, operator, seed(), Agenda, AGENDA_COLUMNS, agendaChanges() (+18 more)

### Community 51 - "ref_node_assert"
Cohesion: 0.14
Nodes (14): ExternalBusyProvider, AgendaErrorCode, DEFAULT_MESSAGES, SQLSTATE_CODES, STATUS, ACTOR, bookMeeting(), getMeetingDays() (+6 more)

### Community 52 - "app_private.book_appointment"
Cohesion: 0.17
Nodes (6): app_private.book_appointment(), app_private.check_agenda_slot(), app_private.reschedule_appointment(), idx_appointments_no_show_due, app_private.book_appointment(), public.crm_contact_activity

### Community 53 - "flow-answer-verifier.ts"
Cohesion: 0.60
Nodes (5): extractOutputText(), getRecord(), validateAnswerLocally(), VerificationResult, verifyFlowAnswer()

### Community 54 - "welcome-page.ts"
Cohesion: 0.16
Nodes (17): Stripe (Payment Link externo), isLevyPurchase(), handleCheckout(), idOf(), ownedWorkspaceId(), workspaceInfo(), billingWorkspace(), getWelcomeState() (+9 more)

### Community 55 - "flow-builder.tsx"
Cohesion: 0.09
Nodes (32): ActionsEditor(), patchAction(), replaceCrm(), AgentItem, CrmActionFields(), FlowBuilderProps, FlowCrmOptions, FlowRunItem (+24 more)

### Community 56 - "import-export.test.ts"
Cohesion: 0.22
Nodes (10): RFC-4180, csvSafe(), csvUnsafe(), FORMULA_STARTS, parseCsv(), parseCsvRecords(), quoteCell(), toCsv() (+2 more)

### Community 57 - "20261102210000_agenda_core.sql"
Cohesion: 0.29
Nodes (9): public.agendas, public.appointments, public.google_event_deletions, public.offered_slots, public.schedule_blocks, set_agendas_updated_at, set_appointments_updated_at, set_google_event_deletions_updated_at (+1 more)

### Community 58 - "agendas.ts"
Cohesion: 0.22
Nodes (20): Decisiones tomadas, PATCH(), Appointment, AppointmentCreator, bookAppointment(), cancelAppointment(), confirmAppointment(), creatorFor() (+12 more)

### Community 59 - "wizard.tsx"
Cohesion: 0.10
Nodes (29): OnboardingProgressCard(), SupportContact(), WizardAgent, WizardAsset, WizardIntegration, WizardProps, WizardWorkspace, DefaultConversationMode (+21 more)

### Community 60 - "Auditoria de rendimiento 2026-10-09"
Cohesion: 0.18
Nodes (6): nextConfig, Auditoria de rendimiento 2026-10-09, AppShell monolith (1350 lines), idx_conversations_workspace_last_message index (not applied), Incremental inbox snapshot (pending), Shared (panel) layout

### Community 61 - "api-error.ts"
Cohesion: 0.08
Nodes (39): Reglas para cada iteración, deliverQueuedReviewMessages(), POST(), ReviewPayload, excludeExistingContacts(), FlowPayload, POST(), stringArray() (+31 more)

### Community 62 - "meeting/route.ts"
Cohesion: 0.17
Nodes (21): cancelExisting(), emailAfterResponse(), GET(), meetingEngine(), POST(), readWorkspace(), readWorkspaceCode(), saveMeeting() (+13 more)

### Community 63 - "ycloud-webhook.ts"
Cohesion: 0.06
Nodes (50): @supabase/supabase-js, configString(), ContactRow, GET(), getInteractiveOptions(), IntegrationRow, InteractiveOption, isAuthorized() (+42 more)

### Community 64 - "invalid"
Cohesion: 0.23
Nodes (16): updateAgenda(), conflict(), CrmErrorCode, isUniqueViolation(), STATUS, normalizeColor(), createStage(), normalizeKind() (+8 more)

### Community 65 - "agency-crm.ts"
Cohesion: 0.18
Nodes (12): AgencyContactInput, AgencyContactResult, agencyWorkspaceCode(), bucket(), ensureTag(), FIELDS, LEVY_ACTIVE_TAG, LEVY_TAGS (+4 more)

### Community 66 - "readiness/route.ts"
Cohesion: 0.22
Nodes (11): Check, envCheck(), GET(), incrementalTables, recommendedEnv, requiredEnv, requiredTables, tableCheck() (+3 more)

### Community 67 - "clientes/page.tsx"
Cohesion: 0.22
Nodes (14): ClientsPage(), metadata, searchContacts(), resolveTag(), dateOnly(), exportContacts(), sanitizeSearchTerm(), defaultStage() (+6 more)

### Community 68 - "Runbook de despliegue"
Cohesion: 0.17
Nodes (12): Runbook de despliegue, Supabase Auth URL configuration (/auth/callback), Pre-access client checklist, CRON_SECRET, Required environment variables, External scheduler (cron-job.org / QStash) every 5 min, INTEGRATION_ENCRYPTION_KEY, LEVY_WORKSPACE_CODE / LEVY_MEETING_CALENDAR_ID (+4 more)

### Community 69 - "workspaces.ts"
Cohesion: 0.10
Nodes (35): server-only, AdminPage(), PATCH(), POST(), DELETE(), POST(), assertCurrentUserIsAdmin(), DELETE() (+27 more)

### Community 70 - "Tareas"
Cohesion: 0.12
Nodes (16): Decisiones pendientes (las responde el usuario; mientras, sigue con otras tareas), Entorno, F0 — Preparación, F1 — Modelo de datos del CRM (aditivo), F3 — Google Calendar por workspace, F4 — Jobs y recordatorios, F6 — Stripe y onboarding de Levy, F7 — Migración de datos y limpieza (+8 more)

### Community 71 - "FlowBuilder"
Cohesion: 0.26
Nodes (14): FlowBuilder(), addStage(), archiveFlow(), createEmptyFlow(), createTemplate(), moveSelectedStep(), saveFlow(), updateDraft() (+6 more)

### Community 72 - "Levy multi-tenant WhatsApp AI agent panel"
Cohesion: 0.24
Nodes (6): Conversational flow builder with human review, Inbox por empresa (IA / handoff / onboarding views), Levy multi-tenant WhatsApp AI agent panel, Next.js 16 App Router, Supabase (Postgres + Auth + RLS), Workspace (empresa / tenant)

### Community 73 - "shared.ts"
Cohesion: 0.20
Nodes (11): ActivityEntry, ActivityKind, listActivity(), BASE_FIELDS, FLOW_ACTOR, FlowActionResult, renderFlowTemplate(), CrmActor (+3 more)

### Community 74 - "invalid"
Cohesion: 0.47
Nodes (9): invalid(), optionalText(), assertMember(), createdByFor(), createTask(), CrmTask, normalizeDueAt(), normalizeTitle() (+1 more)

### Community 75 - "timezones.ts"
Cohesion: 0.21
Nodes (16): F2 — Lógica del CRM y la Agenda, AgendaPanel(), deleteBlock(), load(), dayLabel(), getAgendaFreeSlots(), loadBusyIntervals(), freeSlots() (+8 more)

### Community 76 - "20261103020000_billing.sql"
Cohesion: 0.48
Nodes (6): idx_billing_events_workspace, idx_workspace_billing_status, public.billing_events, public.workspace_billing, set_billing_events_updated_at, set_workspace_billing_updated_at

### Community 77 - "bienvenida/page.tsx"
Cohesion: 0.22
Nodes (13): FAILURES, POST(), loadState(), metadata, WelcomePage(), BillingConfig, DEFAULT_COMPANY_FIELD, DEFAULT_GRACE_DAYS (+5 more)

### Community 79 - "next"
Cohesion: 0.11
Nodes (23): next, signOut(), POST(), POST(), allowedRoles, DELETE(), findAuthUserByEmail(), getUserDisplayName() (+15 more)

### Community 84 - "Alineacion con el curso"
Cohesion: 0.28
Nodes (9): Alineacion con el curso, Gaps vs lesson 05 (Vercel deploy, real WhatsApp round-trip, GHL test), Recommended next steps (SQL, secrets, deploy, webhook, test), Video 05 - La App por Dentro + Deploy a Vercel, Carlos-Dominguez-faber/whatsapp-saas reference repo, WhatsApp SaaS - ruta del curso, Production step checklist, Target system (inbox, configurable AI agent, handoff, buffer, YCloud dispatch, audio transcription, GHL) (+1 more)

### Community 85 - "app/layout.tsx"
Cohesion: 0.25
Nodes (5): appUrl, figtree, inter, metadata, viewport

### Community 86 - "ref_node_test"
Cohesion: 0.19
Nodes (14): AdminClient, applyConversationHandoff(), buildHandoffNote(), ConversationHandoffInfo, detectAnswerHandoff(), findHandoffKeyword(), getHandoffKeywords(), HANDOFF_CLIENT_NOTICE (+6 more)

### Community 90 - "secrets.ts"
Cohesion: 0.30
Nodes (10): POST(), GET(), POST(), generateWebhookSecret(), getIntegrationSecret(), hashSecret(), IntegrationProvider, maskSecret() (+2 more)

### Community 95 - "google-sync.test.ts"
Cohesion: 0.21
Nodes (10): agendaWithCalendar(), Call, connect(), deps, ENV, Route, decryptSecret(), encryptSecret() (+2 more)

### Community 96 - "Levy README"
Cohesion: 0.29
Nodes (5): AGENTS.md agent instructions, graphify, Levy README, Supabase schema apply order, Superadmin /admin account creation (SUPERADMIN_EMAILS)

### Community 98 - "(panel)/layout.tsx"
Cohesion: 0.48
Nodes (5): PanelLayout(), BrandMark(), IntentLink(), sidebarItems, SidebarNav()

### Community 99 - "deploy job (vercel pull + vercel deploy --prod)"
Cohesion: 0.50
Nodes (4): Deploy a Vercel workflow, deploy job (vercel pull + vercel deploy --prod), Vercel CLI, VERCEL_TOKEN / VERCEL_ORG_ID / VERCEL_PROJECT_ID secrets

### Community 100 - "clientFetch"
Cohesion: 0.07
Nodes (56): AppointmentDialog(), act(), BlockDialog(), save(), Modal(), NewAppointmentDialog(), save(), SlotPicker() (+48 more)

### Community 101 - "ref_node_assert"
Cohesion: 0.10
Nodes (16): NOW, broken, client(), callbackRedirectPath(), deps, ENV, GOOGLE_SCOPES, CascadeRule (+8 more)

### Community 102 - "GHL purchase webhook auto-provisioning (/api/webhooks/ghl/purchase)"
Cohesion: 0.50
Nodes (4): /auth/confirm create-password flow, GHL purchase webhook auto-provisioning (/api/webhooks/ghl/purchase), GHL tags cliente-levy / levy-acceso-listo / levy-activo, LEVY_PURCHASE_WEBHOOK_SECRET

## Knowledge Gaps
- **24 isolated node(s):** `RFC-4180`, `File/Document Icon (gray 16x16, page with folded corner and text lines)`, `Globe Icon (gray 16x16, world/web symbol)`, `Browser Window Icon (gray 16x16, window with three dots)`, `idx_conversations_workspace_last_message index (not applied)` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 570 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `buffer/route.ts`, `Dependencias y ESLint`, `createAdminClient`, `inicio/page.tsx`, `panel-data.ts`, `billing.test.ts`, `badRequest`, `public-shell.tsx`, `test-prompt/route.ts`, `calendar-tools.ts`, `webhook.ts`, `lucide-react`, `workspaces/route.ts`, `wizard.tsx`, `Auditoria de rendimiento 2026-10-09`, `api-error.ts`, `meeting/route.ts`, `ycloud-webhook.ts`, `readiness/route.ts`, `clientes/page.tsx`, `workspaces.ts`, `bienvenida/page.tsx`, `app/layout.tsx`, `secrets.ts`, `(panel)/layout.tsx`?**
  _High betweenness centrality (0.159) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `createAdminClient()` (e.g. with `Decisiones tomadas` and `Reglas para cada iteración`) actually correct?**
  _`createAdminClient()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-4180`, `File/Document Icon (gray 16x16, page with folded corner and text lines)`, `Globe Icon (gray 16x16, world/web symbol)` to the rest of the system?**
  _24 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `buffer/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12280701754385964 - nodes in this community are weakly interconnected._
- **Why does `createAdminClient()` connect `createAdminClient` to `buffer/route.ts`, `readiness/route.ts`, `clientes/page.tsx`, `workspaces.ts`, `secrets.ts`, `calendar-tools.ts`, `webhook.ts`, `workspaces/route.ts`, `bienvenida/page.tsx`, `next`, `panel-data.ts`, `billing.test.ts`, `badRequest`, `agendas.ts`, `api-error.ts`, `meeting/route.ts`, `ycloud-webhook.ts`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `apiErrorResponse()` (e.g. with `Decisiones tomadas` and `Registro de iteraciones`) actually correct?**
  _`apiErrorResponse()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `FakeQuery` be split into smaller, more focused modules?**
  _Cohesion score 0.0761904761904762 - nodes in this community are weakly interconnected._