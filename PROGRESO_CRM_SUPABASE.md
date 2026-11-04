# Progreso — CRM y Agenda en Supabase (sin GHL)

Especificación: `PROMPT_CRM_SUPABASE.md`. Cada iteración del `/loop` toma **la primera tarea `[ ]` cuyas dependencias estén `[x]`**, la termina con pruebas en verde, la marca y hace commit en la rama `crm-supabase`.

Leyenda: `[ ]` pendiente · `[x]` hecha · `[!]` bloqueada (con motivo) · **[STOP]** no se hace sin mi aprobación explícita en el chat: detén el loop y pregúntame.

## Entorno
- Proyecto Supabase: `fvvgjqwvcqttxkpzydpc` (Agencia-dashboard-agentes-whatsapp), **producción con datos reales** (AAA001 atiende WhatsApp).
- Rama de desarrollo de Supabase: _ninguna_ (si se crea, apuntar aquí su id y aplicar las migraciones primero ahí).
- Rama git: `crm-supabase`.
- Copia de seguridad previa: `~/Backups/levy/levy_20261102_1951.dump` (2026-11-02, pg_dump completo: 167 contactos, 3.565 mensajes, 6 usuarios). Se restaura con `pg_restore` sobre una base nueva, nunca encima de producción.
- Verificación por tarea: `npm run typecheck && npm run lint && npm test` (+ `npm run build` si toca UI/rutas).
- Historial de migraciones de Supabase: **vacío** a 2026-11-02 (`list_migrations` → `[]`). Los archivos antiguos de `supabase/migrations/` y los `.sql` sueltos (`flow_builder.sql`, `self_service_onboarding.sql`, `next_workspace_assets_and_webhooks.sql`, `set_default_handoff.sql`) ya están aplicados a mano: **no volver a aplicarlos**. El primer `apply_migration` de este plan abre el historial.
- Extensiones a 2026-11-02: instaladas `supabase_vault` (esquema `vault`), `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `btree_gist` (esquema `extensions`, F1.3); `pg_cron` (pg_catalog) y `pg_net` (esquema `extensions`, funciones en `net`) instalados en F4.3.

## Estado real vs. inventario (F0.1, 2026-11-02)
- `src/lib/timezones.ts` **ya existe** (utilidades de navegador: `getTimeZoneOptions`, `getBrowserTimeZone`, `getZoneOffsetLabel`). F2.1 lo amplía con las funciones puras de `ghl-calendar.ts`; no debe meter dependencias de servidor (lo importan componentes cliente).
- El grep encuentra además del inventario: `app/api/webhooks/ghl/purchase` + `lib/levy-purchase.ts` (+ test) — **es la vía de venta actual**; `lib/onboarding-steps.test.ts`; `lib/supabase/database.types.ts` (generado).
- Ya existe `app/api/flows/start` (panel, con sesión). La ruta nueva `webhooks/flows/start` de la especificación se confundiría con ella (ver F5.4).
- Disparo de flujos `tag`: el tipo existe en `FlowTriggerType`, pero `flow-engine.ts` **no lo implementa** (solo `first_inbound`, `keyword`, `manual`, `webhook`). GHL lanzaba flujos vía `webhook` + `flowKey`. F5.3 lo crea desde cero.
- Workspaces se crean en dos sitios: `lib/workspaces.ts` y `lib/admin-companies.ts` (`createCompanyWithOwner`). `workspaces` solo tiene el trigger `set_workspaces_updated_at`.
- Datos reales (AAA001): 160/167 contactos con `metadata.ghl_contact_id`; integración `gohighlevel` activa; **3 tools** que nombran GHL (no 1): «Consultoría Levi» (`ghl_calendar`, por defecto) y dos tools de texto, «Agendar en GoHighLevel» y «Consultar disponibilidad»; **1 flujo** con paso `ghl_action`. Único flujo en la base, trigger `manual`.
- `automation_labels` en uso: solo marcas del sistema (`flow_opt_out`, `onboarding_eligible`, `onboarding_completed`). `metadata.ai_tags`: 2 contactos.
- `cron/buffer/route.ts` mide 2.093 líneas; `buffer` no está en `vercel.json` (lo llama `ycloud-webhook`). `vercel.json` tiene crons diarios de `flows`, `deliver` y `ghl-sync`.
- CRM de referencia: tiene festivos (`calendar.holidays` en `schedule_config.py`, test `test_huecos_respetan_bloqueos_y_festivos.py`), que la especificación no recogía → añadidos en F1.3/F2.3.

## Decisiones pendientes (las responde el usuario; mientras, sigue con otras tareas)
- ~~**D1**~~ **Resuelta (2026-11-03):** `agentelevi.com` es **esta app** (el panel), y `/bienvenida` vive aquí. La landing es aparte, en `activa.agentelevi.com`, y no se toca. El Payment Link redirige a `https://agentelevi.com/bienvenida?session_id={CHECKOUT_SESSION_ID}`. Ojo: el dominio es `agentelevi.com` (con i), como en `src/lib/app-url.ts`; corregir donde la documentación ponga `agentelevy.com`.
- **D2** Precios (mensual/anual), prueba gratis y días de gracia → por defecto: sin prueba, 7 días de gracia; los ids de precio van por variable de entorno.
- ~~**D4**~~ **Resuelta (2026-11-03):** «Agenda» va como **sección nueva en el menú lateral**, igual que Flujos o Automatizaciones (respuesta del usuario). F5.6 la añade al menú.
- **D3** Plantilla de WhatsApp aprobada para recordatorios fuera de la ventana de 24 h (nombre por workspace) → mientras, se registran como omitidos.

## Decisiones tomadas
- **Sin Gmail (2026-11-04, decisión del usuario):** «no tiene sentido enviar sin poder leer», y leer Gmail exige permisos restringidos con evaluación de seguridad anual de pago. Se quita lo de F6.8: conexión de correo, «Enviar correo» en la ficha y acción `send_email` en flujos. El correo de acceso y los avisos de la reunión salen por **SMTP de un Gmail de la plataforma** (`GMAIL_USER`, `GMAIL_APP_PASSWORD` en el servidor), sin Resend (decisión del usuario). El permiso de Google de las empresas se queda solo en Calendar. El proveedor `gmail` sigue admitido en los checks de la base (sin filas); se retira en F7.4.
- **Sin GoHighLevel (2026-11-03, decisión del usuario):** «Ya no vamos a usar GHL». No habrá token nuevo, así que **no se migran datos desde GHL**: etiquetas y etapas de los 160 contactos de AAA001 que solo existían en GHL y sus citas futuras se pierden (los contactos, conversaciones y mensajes ya están en Supabase). F7.1 se cierra así; F7.2 pasa a ser la parte que no necesita GHL. F7.3 y F7.4 siguen siendo [STOP].
- **F1.1 Etiquetas (2026-11-02).** Tres cosas distintas, cada una en su sitio:
  1. `crm_tags` + `crm_contact_tags`: **las etiquetas del CRM**, las que ve y gestiona el operador (con color). Se ponen/quitan desde panel, flujo (`crm_action`) o agente (solo etiquetas que ya existan en el workspace: el agente no crea etiquetas). Las de GHL se importan aquí en F7.1.
  2. `contacts.automation_labels`: **marcas internas del sistema** (`flow_opt_out`, `onboarding_eligible`, `onboarding_completed`, `onboarding_excluded_existing`). No se tocan, no se migran y no se muestran como etiquetas en Contactos (la bandeja puede seguir enseñándolas como estado). Nombres reservados: `crm_tags.name` no puede coincidir con ellos (validación en `src/lib/crm` y `check` en la tabla con la lista fija).
  3. `metadata.ai_tags`: **sugerencias de la IA** que escribe `cron/buffer` (`insights.tags`). Se sigue escribiendo igual; en la ficha y la bandeja se muestran como «Sugeridas» con un clic para convertirlas en etiqueta. Nunca se crean etiquetas automáticamente desde aquí. Deja de enviarse a GHL cuando muera `cron/ghl-sync` (F7.3).
  - **Flujos sin romper**: el filtro de audiencia (`requiredLabels` / `excludedLabels`, audiencia `labels`) pasa a comparar contra la **unión** de `automation_labels` y los nombres de `crm_tags` del contacto (sin distinguir mayúsculas), así los flujos guardados siguen funcionando y además aceptan etiquetas del CRM. Se implementa en F5.3 junto con el disparo `tag` (que solo mira `crm_contact_tags`).
  - Para F1.2: `crm_tags.name` único por workspace sin distinguir mayúsculas (`unique (workspace_id, lower(name))`).
- **F1.2 Modelo del CRM (2026-11-02).**
  - Aislamiento en la base, no solo en el código: todas las referencias a contacto, etapa y etiqueta son **FK compuestas `(workspace_id, id)`** (se añadió `contacts_workspace_id_id_key`, redundante con la pk). `crm_contact_tags` lleva `workspace_id` además de `contact_id`/`tag_id`. `contacts.stage_id` usa `on delete set null (stage_id)` (PG 17) para no anular `workspace_id`.
  - Contactos existentes **no se reescriben**: `stage_id` null se interpreta en el código como «primera etapa abierta» (`position` mínima con `kind = 'open'`); `source` y `last_message_at` se rellenan desde el código en adelante (F5.4). Si se quiere rellenar el histórico, es una tarea aparte que reescribe datos → pedir aprobación.
  - Siembra: `app_private.seed_crm_pipeline_stages(uuid)` (idempotente) + trigger `seed_crm_pipeline_stages_on_workspace` (after insert on workspaces). 30 etapas sembradas (5 × 6).
  - RLS: configuración (etapas, etiquetas, campos) la cambian owner/admin; etiquetas puestas, notas y tareas también agent; actividad solo select/insert. Una política por operación (sin `for all`) para no generar avisos `multiple_permissive_policies`.
  - Tipos: `database.types.ts` **está escrito a mano** (solo `Row`, con uniones de los `check`, y los clientes no usan `Database` como genérico). Sustituirlo por la salida de `generate_typescript_types` cambiaría los tipos de todo el proyecto, así que se amplía a mano con el mismo estilo, columna a columna según la base. Aplicar lo mismo en las siguientes migraciones.
  - Permisos: Supabase dejó de conceder permisos del Data API a tablas nuevas el 2026-10-30 en proyectos nuevos (en este aún los da). Cada migración con tablas nuevas lleva su `grant ... to authenticated, service_role` explícito.
  - Pruebas SQL repetibles en `supabase/tests/crm_core_checks.sql` (bloques `do` que terminan en `raise` → no dejan datos).

- **F1.3 Agenda (2026-11-02).**
  - `agendas.schedule`: objeto por día ISO (`"1"` = lunes … `"7"` = domingo) → lista de tramos `{start, end}` en hora local `HH:MM`; día ausente o vacío = cerrado. Default lunes-viernes 09:00-18:00. `services`: `[{name, duration_minutes}]`. `timezone` es obligatorio y **sin default** (se valida en código con `isValidTimeZone`, F2.1). Festivos en `closed_dates date[]`.
  - Una sola agenda por defecto por empresa (índice único parcial) y nombre único sin mayúsculas.
  - `appointments`: anti-solape `appointments_no_overlap` (exclusion, SQLSTATE `23P01`) solo entre citas `scheduled|rescheduled` de la **misma agenda**. La FK a la agenda **no** tiene `on delete`: una agenda con citas no se borra (el panel la desactiva con `active = false`); al borrar la empresa entera la cascada se lleva todo. Conversación borrada → `conversation_id` a null (la cita se queda); contacto borrado → sus citas se borran (F2.5 debe apuntar antes sus eventos de Google en `google_event_deletions`).
  - Se añadió `conversations_workspace_id_id_key` para las FK compuestas.
  - `offered_slots` y `google_event_deletions` solo los escribe el servidor (sin políticas de escritura); el panel solo lee (owner/admin en los borrados pendientes).
  - Pruebas SQL repetibles en `supabase/tests/agenda_core_checks.sql`.

- **F1.4 Agendar/reagendar en SQL (2026-11-02).**
  - Lógica en `app_private.book_appointment` / `reschedule_appointment` / `check_agenda_slot` (security definer, `search_path = ''`). Envoltorios `public.book_appointment` / `public.reschedule_appointment` (security invoker) para RPC; **solo `service_role` puede ejecutarlos** (revocado a `anon`/`authenticated`): el servidor comprueba el rol y saca `workspace_id` de la sesión antes de llamar. Se dio `usage` de `app_private` a `service_role`.
  - Validación según `created_by`: `agent` exige hora ofrecida a esa conversación en los últimos 30 min + horario/festivo/antelación/límite de días/bloqueos; `flow` lo mismo sin la oferta; `operator` e `import` solo comprueban empresa, agenda activa y solape (el operador puede agendar fuera de horario). El solape lo decide siempre la restricción.
  - Errores: `LVS01` slot_taken, `LVN01` not_offered, `LVH01` outside_hours (incluye pasado, antelación, límite de días, festivo, cruzar medianoche), `LVB01` blocked, `LVW01` wrong_workspace, `LVA01` agenda_inactive, `LVX01` not_active. F2.4 los traduce.
  - Ambas funciones apuntan la actividad (`appointment_booked` / `appointment_rescheduled`) en la misma transacción y marcan `google_sync_pending` (nueva si la agenda sincroniza; vieja si tenía evento). Reagendar mantiene servicio, notas, contacto y conversación; enlaza vieja y nueva en `notices`.
  - Pruebas SQL repetibles en `supabase/tests/agenda_booking_checks.sql` (16 casos).

- **F2.2 Lógica del CRM (2026-11-02).**
  - `src/lib/crm/` recibe el cliente como parámetro (`CrmClient`, en producción `createAdminClient()`) y el `workspaceId` de la sesión; **cada consulta filtra por `workspace_id`** y, antes de escribir sobre un contacto/etiqueta/etapa, comprueba que es de la empresa (404 si no, sin revelar de quién es).
  - Patrón para que se pueda probar con `node --test`: solo `import type` para rutas `@/…`, imports relativos con `.ts`, sin propiedades en constructores (Node solo quita tipos). Errores de usuario con `CrmError` (`invalid` 400, `not_found` 404, `conflict` 409); `apiErrorResponse` los reconoce por `userFacing` sin importar el módulo.
  - Doble de Supabase en memoria reutilizable: `src/lib/testing/fake-supabase.ts` (`createCrmFake`), con únicas y cascadas del esquema. No aplica defaults de columnas: el código inserta explícitamente lo que la lógica luego filtra (p. ej. `active: true`).
  - `addTagToContact` devuelve `added` (false si ya la tenía) para que F5.3 dispare flujos `tag` solo cuando cambia algo. `contactAudienceLabels` = unión de marcas internas y etiquetas (F1.1).
  - `upsertContactByPhone` (Stripe/onboarding) no pisa nombre, correo ni empresa; solo rellena vacíos. `touchContactInbound` queda listo para F5.4.

- **F2.4 Operaciones de agenda (2026-11-02).**
  - `src/lib/agenda/agendas.ts` (CRUD, por defecto única, validación con `slots.ts`) y `appointments.ts`: `getAgendaFreeSlots` (citas activas + bloqueos + ocupado externo inyectado como `ExternalBusyProvider`, que solo cuenta en `push_and_busy`; F3.3 lo implementa con Google), `offerSlots` (upsert, refresca `offered_at`), `bookAppointment`/`rescheduleAppointment` por RPC (duración desde el servicio; reagendar mantiene la duración), `cancelAppointment` (el agente solo cancela citas futuras de su conversación; marca `google_sync_pending` si había evento), `confirmAppointment`, `markAppointment` (solo citas ya empezadas), bloqueos, `upcomingAppointmentsForContact`, `purgeOfferedSlots`.
  - `errors.ts`: SQLSTATE → `AgendaError` (`slot_taken` 409, `not_offered`, `outside_hours`, `blocked`, `agenda_inactive`, `not_active`, `not_found` 404). Usa el mensaje en español de la función SQL; para `23P01` crudo pone el propio. Otros errores de la base no se muestran al usuario.
  - Una cita de otra empresa responde `not_active` (no revela que existe).
  - Doble: compara timestamps ISO como instantes (como Postgres) y `createAgenda` inserta explícitamente el horario por defecto (`DEFAULT_WEEKLY_SCHEDULE`, igual que el default de la columna).

- **F2.5 CSV y RGPD (2026-11-02).**
  - CSV sin dependencias (`crm/csv.ts`): separador `,` o `;` detectado, BOM, comillas y saltos de línea; anti-fórmulas al exportar y su inversa al importar (exportar → Excel → importar no duplica). Columnas: `nombre, telefono, email, empresa, origen, etapa, etiquetas (;), creado, ultimo_mensaje, cf_<clave>`; admite alias (`teléfono`, `phone`, `whatsapp`, `name`, `tags`…).
  - Importar: máx. 5 MB / 5.000 filas; existente por teléfono → actualiza lo que trae la fila (lo vacío no borra); etiquetas que no existen se crean; etapa por nombre (si no existe, la fila salta con motivo); hasta 50 líneas de error devueltas.
  - Borrado RGPD (`crm/erasure.ts`): en la base, `messages.contact_id` y `flow_events.contact_id` son `on delete set null`, así que se borran antes; los eventos de Google de sus citas (de agendas con calendario) se apuntan en `google_event_deletions`; luego se borra el contacto (cascada del resto). `webhook_events` no se toca (payload crudo; se purgará por antigüedad, pendiente de decidir dónde).

- **F3.1 Google Calendar (2026-11-02).**
  - `src/lib/integrations/google-calendar.ts` con `fetch` directo (sin librería de Google). Dependencias inyectables (`fetch`, cliente, `env`, `now`).
  - `state` OAuth = payload base64url `{w: workspace, u: usuario, exp: +10 min, n: nonce}` + HMAC-SHA256 con clave derivada de `INTEGRATION_ENCRYPTION_KEY`; el callback exige el mismo usuario de la sesión (F3.2 debe pasar `user.id`).
  - Tokens: JSON cifrado en `integration_secrets` (provider `google_calendar`, kind `oauth_tokens`). La integración guarda en `config` `account_email` (id del calendario principal, sin pedir scope de perfil), `scopes` y `connected_at`. Se exigen `calendar.events` + `calendar.readonly` y refresh token (`prompt=consent`).
  - Renovación con 60 s de margen; `400/401` de Google o credenciales ilegibles → integración `error` con mensaje en `last_error` y `GoogleCalendarError("reconnect_required")`; red/5xx/429 → `temporary` sin desconectar. Un 401 en la API fuerza una renovación y un reintento.
  - Evento con id = uuid de la cita sin guiones (alfabeto válido de Google). `upsertEvent`: POST con id; 409 → PUT. `deleteEvent`: 404/410 cuentan como borrado. `sendUpdates=none` siempre (no se mandan invitaciones).
  - `GoogleCalendarError` es `userFacing` (sale tal cual por `apiErrorResponse`).

- **F3.2 Rutas de Google (2026-11-02).**
  - Nuevo `requireActiveWorkspaceRole(roles)` en `lib/authz.ts`: empresa activa desde la cookie `active_workspace_id` validada contra las membresías del usuario. **Usarlo en todas las rutas nuevas del CRM/agenda**: el `workspaceId` no viaja en el cuerpo ni la query.
  - `connect` (GET → redirige a Google), `callback` (GET; empresa sacada del `state` firmado; mismo usuario y rol owner/admin; siempre redirige a `/integraciones?google=conectado` o `?google=error&motivo=…`), `status` (GET), `calendars` (GET, solo calendarios escribibles), `disconnect` (POST). Todas owner/admin.
  - Desconectar no toca las agendas (conservan calendario y modo); sin conexión, la copia simplemente no se hace (F3.3).
  - La página `/integraciones` todavía no lee `?google=…`: lo hace F5.7.

- **F3.3 Copia a Google (2026-11-02).**
  - `src/lib/agenda/google-sync.ts`: `syncAppointment` (activa → crea/actualiza evento con id fijo; cancelada con evento → lo borra; completada/no asistió → deja el evento; agenda sin calendario o en `off` → solo baja la marca). La marca `google_sync_pending` se baja con `.eq("updated_at", …)`: si la cita cambió durante la copia, sigue pendiente; si se borró, el evento recién creado se apunta en `google_event_deletions`.
  - `sweepGoogleSync` (para crm-jobs): solo empresas con la integración `active`; por empresa, primero `processGoogleDeletions` (máx. 10 intentos por evento, registra `last_error`) y luego hasta 50 citas pendientes; un fallo de Google corta esa empresa, no las demás. Sin `GOOGLE_CLIENT_ID/SECRET` no hace nada.
  - `googleBusyProvider(client, workspaceId)` es el `ExternalBusyProvider` de F2.4: freeBusy del calendario de la agenda solo si la empresa está conectada; si Google falla, devuelve vacío (se ofrece igual, como en crm-levy).
  - Pendiente para quien use la agenda (F5.2/F5.6): pasar `externalBusy: googleBusyProvider(...)` a `getAgendaFreeSlots` y, tras agendar/mover/cancelar, llamar a `syncAppointment` en `after()` para no esperar a la barrida.

- **F4.1 Recordatorios (2026-11-03).**
  - Configuración **por agenda** (migración `agenda_reminders`, aditiva): `reminder_enabled` (apagado de fábrica), `reminder_hours_before` (24), `reminder_message`, `reminder_template`, y lo mismo `no_show_*` (1 h después). Es un superconjunto de «por empresa»: cada agenda puede tener su texto. `agendaChanges` ya acepta estos campos para el panel (F5.6).
  - Envío: dentro de la ventana de 24 h (último mensaje entrante del contacto, con 30 min de margen) se encola un mensaje `outbound/queued` en `messages` que manda `cron/deliver`; fuera de la ventana se **omite con motivo** (en `appointments.notices` y en la actividad `reminder_skipped`/`no_show_skipped`), porque `deliver` aún no manda plantillas (D3). Cuando se decida D3 hay que añadir el envío de plantillas a `deliver` y usar `*_template`.
  - Reglas de crm-levy: recordatorio solo si la cita se agendó antes del momento del aviso y quedan > 30 min; inasistencia solo si se marcó a mano, han pasado `no_show_hours_after` horas (se toma `updated_at` como momento del marcado) y la cita es de los últimos 7 días; solo se escribe de 08:00 a 21:00 en la zona de la agenda; contactos bloqueados o con `flow_opt_out` se omiten.
  - Idempotencia: `update … set reminder_sent_at = now() where reminder_sent_at is null` antes de encolar; si encolar falla se suelta. `runAppointmentNotices({ excludeWorkspaceIds })` deja fuera a las empresas bloqueadas por impago (F6.4).

- **F4.2 crm-jobs (2026-11-03).**
  - `src/lib/agenda/crm-jobs.ts` (`runCrmJobs`) con pasos aislados en orden `billing → offers → google → notices`; el informe dice cuál falló (la ruta responde 500 si alguno falla). Si `billing` falla, **no se mandan avisos** (mejor no escribir que escribir a quien no paga).
  - El paso `billing` recibe un callback que devuelve `blockedWorkspaceIds`: **F6.4 tiene que pasarlo** en la ruta (hoy no hay ninguna empresa bloqueada).
  - Tras encolar avisos se llama a `cron/deliver?workspaceId&conversationId` por cada conversación (máx. 50 por vuelta), igual que hace `ycloud-webhook`: el cron de `deliver` en Vercel es diario y sin parámetros solo manda 10.
  - Ruta `POST|GET /api/cron/crm-jobs`, `maxDuration = 60`, solo `Authorization: Bearer <CRON_SECRET>` (no acepta el secreto por query, a diferencia de los otros cron, para que no quede en logs).

- **F4.3 Cron en la base (2026-11-03).**
  - Job `levy-crm-jobs` (`*/5 * * * *`) que llama a `app_private.invoke_crm_jobs()`: lee `crm_jobs_url` y `crm_jobs_cron_secret` de Vault y hace `net.http_post` con `Authorization: Bearer …` (timeout 55 s). Sin los dos secretos no llama a nada (solo deja un `raise log`).
  - **Creado desactivado** y **sin secretos en Vault** (a 2026-11-03): los mete una persona y se activa en F7.5. Instrucciones (crear secretos, activar, pausar, ver `cron.job_run_details` y `net._http_response`) en `DEPLOY_RUNBOOK.md` → «Trabajos del CRM».

- **F5.0 Calendario del agente fuera de `buffer` (2026-11-03).**
  - En dos módulos (no uno, como decía la tarea, para poder probar sin red): `src/lib/agenda/agent-guards.ts` (puro: `buildCalendarToolDefinitions`, `buildCalendarContext`/`buildNoCalendarContext`, `buildDirectBookingAnswer`/`buildDirectAvailabilityAnswer`, `textLooksLike*`, `has*`, `sanitizeCalendarAnswer`) y `src/lib/agenda/agent-tools.ts` (servidor, aún GHL: `buildCalendarRuntime`, `runCalendarTool`, tipo `CalendarRuntime`).
  - Código movido literal (comprobado línea a línea contra el commit anterior): solo cambian las firmas. `buildCalendarRuntime` recibe `agentName`, `isBookingAgent` y `enabledToolIds` en vez del agente entero (el enrutado sigue en `buffer`); `runCalendarTool` recibe `{ name, arguments }` y mensajes `CalendarRequestMessage`. `buffer/route.ts` pasa de 2.093 a ~1.330 líneas.

- **F5.1 Tools de calendario → agendas (2026-11-03).**
  - `CALENDAR_TOOL_TYPE = "agenda"` con metadata `{ type, agenda_id, agenda_name, is_default }` (`buildCalendarToolMetadata`). El formato viejo `ghl_calendar` se sigue leyendo (`LEGACY_GHL_CALENDAR_TOOL_TYPE`, `buildGhlCalendarToolMetadata` solo para la tarjeta de GHL). `CalendarTool` lleva `kind: "agenda" | "ghl"`.
  - Contacto: `CONTACT_CALENDAR_KEY = "booking_agenda_id"`; la vieja `booking_calendar_id` (`LEGACY_CONTACT_CALENDAR_KEY`, la escribe aún `gohighlevel.ts`) se lee si no hay la nueva. `resolveCalendarForContact` devuelve `{ calendarId, kind }`.
  - Sin cambio para el agente todavía: el runtime de GHL (`agent-tools.ts`) y la prueba de GHL filtran `kind === "ghl"`. `hasLegacyGhlCalendarTools(tools)` es lo que usará F5.2 para la coexistencia.

- **F5.2 Agente sobre la agenda propia (2026-11-03).**
  - `agent-tools.ts` tiene dos motores (`runtime.engine`): `agenda` (`agent-agenda.ts`) y `ghl` (el de antes). **Coexistencia**: si el workspace tiene alguna tool de calendario de GHL (`hasLegacyGhlCalendarTools`), sigue con GHL; si no, agenda propia. AAA001 seguirá en GHL hasta F7.2 (que convierte su tool).
  - Agenda propia: el agente elige entre sus tools de agenda asignadas; si el workspace no tiene ninguna tool de agenda, usa la agenda por defecto. `consultar_disponibilidad` (con `servicio`, que decide la duración) devuelve hasta 6 huecos repartidos (+ el pedido) y **los apunta en `offered_slots`**; `agendar_cita`/`reagendar_cita` con fecha y hora en el mensaje calculan el hueco real en el servidor y lo ofrecen antes de agendar; con un ISO del modelo, la base exige que se ofreciera (si no, `not_offered` con alternativas). Nuevas tools `reagendar_cita` y `cancelar_cita` (`cita_actual_inicio` si tiene varias; cancelar solo citas de esa conversación).
  - Barreras conservadas y ampliadas: `reagendar_cita` confirmado cuenta como prueba; decir «cancelada» sin `cancelar_cita` confirmada se bloquea. El contexto lista las citas próximas del contacto. Textos de error sin «GHL».
  - Tras crear/mover/cancelar, `syncAppointment` corre en `after()` (copia a Google sin hacer esperar al cliente; la barrida de crm-jobs reintenta). El ocupado de Google entra vía `googleBusyProvider`.

- **F5.3 Flujos con acciones del CRM (2026-11-03).**
  - Paso `crm_action` y acciones `{ engine: "crm", type: add_tag|remove_tag|set_stage|update_contact_field|create_task|add_note|set_booking_agenda, … }` (`flow-definitions.ts`); ejecución en `src/lib/crm/flow-actions.ts` (cada acción aislada; `{{respuesta}}` en valores; `add_tag` por id o nombre y crea la etiqueta si no existe; campos base `full_name`/`email`/`company` o personalizados).
  - **Coexistencia**: las acciones viejas de GHL (pasos `ghl_action` o acciones sin `engine`) se ejecutan en GHL si el workspace tiene `gohighlevel` activo; si no, se convierten con `convertGhlActionToCrm` (etiquetas, campos y tareas; oportunidad y calendario de GHL no tienen equivalente y se omiten, contados en el evento). El constructor no las borra: las muestra con aviso y botón «Convertir a acciones del CRM».
  - **Disparo `tag` implementado** (`startTagFlows` en `flow-engine.ts`, regla pura `flowMatchesTags`): solo con etiquetas recién puestas (`addedTagIds`), en la conversación más reciente, sin opt-out, y sin relanzar si el flujo ya está en marcha o arrancó hace < 10 min (contra bucles). Quien la llame desde el panel o el agente (F5.5) tiene que pedir luego a `deliver` que mande lo encolado.
  - Audiencias de flujo comparan contra marcas internas + etiquetas del CRM, sin mayúsculas.
  - Constructor: editor de acciones con desplegables (etiquetas, etapas, campos, agendas) cargados en `flujos/page.tsx`; disparador por etiqueta con selector (guarda `tagId` y `tag`). Se quitó la carga de calendarios de GHL. **No verificado en el navegador** (el panel exige iniciar sesión).

- **F5.4 Webhook de YCloud y CRM (2026-11-03).**
  - Al llegar un mensaje, `recordInboundMessage` (`crm/contacts.ts`) pone `last_message_at`, fija `source = whatsapp` si estaba vacío y apunta actividad solo en los hitos (`contact_created` si el contacto es nuevo, `message_received` si abre conversación nueva). Va en try/catch: un fallo del CRM no frena el mensaje ni la IA.
  - `syncContactToGoHighLevel` **se queda marcado como legado** (coexistencia, como F5.2/F5.3): sin GHL activo ya no hace nada; quitarlo ahora rompería la automatización de GHL de AAA001 antes de F7.2. Se borra con el módulo en F7.3.
  - **Decisión sobre `webhooks/ghl/send-message`: no se crea sustituto.** En producción (2026-11-03) hay 0 flujos con trigger `webhook` y 0 eventos `flow_started_from_webhook` en toda la historia; solo lo llamaría GHL. El disparo por etiqueta (F5.3) cubre lo que hacía. Se borra en F7.3. Si algún día un sistema externo necesita lanzar flujos, se crea entonces con otro nombre que no choque con `api/flows/start`.

- **F5.5 Panel de Clientes (2026-11-03).**
  - **Se amplía `/clientes` y no se crea `/contactos`**, sin tocar el menú lateral: el usuario pidió (2026-09-13) no cambiar nombres ni orden del menú, y la especificación dice «amplíala si es lo mismo». ⚠️ **F5.6 (Agenda) sí necesita una entrada nueva en el menú: preguntar al usuario antes** (o colgarla de una página existente).
  - API `src/app/api/crm/**` con `requireActiveWorkspaceRole` (el `workspaceId` sale de la sesión): ver = todos los miembros; editar = owner/admin/agent; borrar (RGPD), importar y exportar = owner/admin. Poner etiqueta lanza `startTagFlows` y `triggerDeliver` (`src/lib/deliver-trigger.ts`, también lo usa crm-jobs).
  - UI `src/components/crm/`: lista con búsqueda, filtros (etapa, etiqueta, origen) y paginación; vista por etapas con «Mover a»; ficha lateral con etapa, etiquetas, datos y campos personalizados por tipo, citas, tareas, notas, actividad, enlace a la conversación y borrado RGPD con confirmación; alta manual; import/export CSV.
  - Bandeja: `/?conversacion=<id>` abre esa conversación (lo usa la ficha).
  - Verificado: las rutas nuevas responden 401 sin sesión (dev server) y compila. **La interfaz no se ha visto con sesión** (el panel exige iniciar sesión).

- **F5.7 Ajustes del CRM y Google Calendar (2026-11-03).**
  - Ajustes del CRM dentro de **Clientes** (botón «Ajustes del CRM», owner/admin): etapas (nombre, color, tipo, orden, borrar), etiquetas (crear con color, borrar) y campos personalizados (crear por tipo con opciones, «La IA lo puede leer», activar/desactivar). API `api/crm/{stages,tags,fields}/**`, todo owner/admin salvo leer etapas.
  - Integraciones: tarjeta **Google Calendar** (`components/crm/google-calendar-card.tsx`): estado, cuenta, conectar/volver a conectar, desconectar, y lee `?google=conectado|error&motivo=` de la vuelta de Google. La tarjeta de GoHighLevel **solo aparece si el workspace ya tiene la integración** (AAA001 hasta F7.2).
  - Verificado: rutas nuevas 401 sin sesión en dev; build. **La interfaz no se ha visto con sesión.**
- **F5.6 Panel Agenda (2026-11-03).**
  - Entrada **«Agenda»** en el menú lateral justo después de Clientes (D4) y página `/agenda`: selector de agenda, vista semana/día en la zona horaria de la agenda, «Ver canceladas», bloqueos visibles y borrables.
  - Diálogos: nueva cita (buscador de contacto, servicio, día, huecos libres o hora a mano), detalle de cita (confirmar, completada, no asistió, mover, cancelar con motivo), bloqueo (día entero o tramo) y configuración de agenda (horario por día con tramos, servicios, días cerrados, calendario de Google y modo, recordatorio y «no asistió», activa, por defecto).
  - API `api/agenda/{agendas,appointments,blocks,slots}/**`: leer cualquier rol; citas y bloqueos owner/admin/agent; agendas owner/admin. `workspace_id` siempre de la sesión. Los huecos usan `googleBusyProvider`; tras agendar/mover/cancelar se llama a `syncAppointment` dentro de `after()` (`lib/agenda/after-change.ts`) — queda resuelto el pendiente de F2.4/F3.2.
  - `withoutConfig` en `lib/agenda/agendas.ts` quita el `config` interno antes de mandar la agenda al navegador.
  - Verificado: rutas nuevas 401 sin sesión en dev; build. **La interfaz no se ha visto con sesión.**
- **F5.8 Métricas, Chats, portada y readiness sin GHL (2026-11-03).**
  - `business-metrics`: «Contactos con cita» (contaba `metadata.ghl_appointment_id`) pasa a **«Citas agendadas»**: citas de `appointments` creadas en los últimos 7 días, sin canceladas. ⚠️ Mientras AAA001 siga agendando en GHL (hasta F7.2) su cifra saldrá baja.
  - Chats: el bloque «GoHighLevel» del lateral se sustituye por `ContactCrmSummary` (etapa, etiquetas y próxima cita, leídos de la ficha `GET /api/crm/contacts/[id]`, con enlace a Clientes). `panel-data` ya no lee `ghl_*` del metadata.
  - Portada: el chequeo de despliegue «GoHighLevel» pasa a «Google Calendar» (`GOOGLE_CLIENT_ID/SECRET`); en la consola de agencia el proveedor `gohighlevel` pasa a `google_calendar`.
  - `health/readiness`: Google y Stripe como variables recomendadas (no bloquean el 200), tablas del CRM y la Agenda en las comprobaciones, y la ruta `cron/ghl-sync` sustituida por `cron/crm-jobs`.
  - Verificado: prueba de aislamiento de la métrica; build. **La interfaz no se ha visto con sesión.**
- **F6.1 Tablas de facturación (2026-11-03).**
  - Migración `20261103020000_billing` (aplicada; en remoto `20261103143915`): `workspace_billing` (pk `workspace_id`, cliente y suscripción de Stripe únicos, `status` de Stripe o null, `current_period_end`, `cancel_at_period_end`, `billing_exempt`) y `billing_events` (pk `stripe_event_id`, `type`, `workspace_id` opcional, `result` processed/ignored/failed, `error`, `processed_at`).
  - Añadido a la especificación: `past_due_since` (inicio del impago, para contar los días de gracia en F6.2 sin depender de la hora del evento).
  - Las 5 empresas actuales tienen fila con `billing_exempt = true`. Una empresa sin fila (alta nueva antes del webhook) la tratará F6.2.
  - RLS: solo lectura para owner/admin de la empresa; escribe únicamente el servidor (`service_role`).
  - Comprobaciones `supabase/tests/billing_checks.sql`: exentas, cliente único, estado válido, dedupe de eventos y RLS del owner (DRYRUN_OK). El caso «agent no ve nada» se salta: hoy no hay ningún miembro que solo sea agent/viewer.
  - Advisors: solo los 3 avisos previos.
- **F6.2 Librería de facturación y correo (2026-11-03).**
  - `src/lib/billing/`: `config.ts` (variables de Stripe; gracia por defecto 7 días según D2, `isLevyPurchase` por Payment Link o precio), `state.ts` (reglas puras `computeBillingState` y textos del panel), `workspace-billing.ts` (`getWorkspaceBillingState`, `isWorkspaceBlocked`, `listBlockedWorkspaceIds` para el paso `billing` de `crm-jobs`, que conecta F6.4) y `stripe.ts` (cliente del SDK, solo servidor).
  - Reglas: exenta → ok; **sin fila o sin suscripción → aviso, no bloqueo** (para no cortar a nadie por un registro que falte; las altas por Stripe tendrán fila desde el webhook); active/trialing → ok (aviso si se cancela al final del periodo); incomplete → aviso; past_due → aviso hasta `past_due_since` + gracia, luego bloqueado; canceled/unpaid/paused/incomplete_expired → bloqueado. ⚠️ Revisar: si se prefiere bloquear a las empresas sin suscripción, es cambiar una línea.
  - `src/lib/email.ts`: Resend por `fetch` a su API (sin librería nueva), `buildWelcomeEmail` con el nombre del negocio escapado; los errores no incluyen la clave.
  - Pruebas: configuración, todas las reglas, aislamiento por empresa en la base y envío de correo con `fetch` simulado (15 nuevas).
- **F6.3 Webhook de Stripe (2026-11-03).**
  - Ruta `api/webhooks/stripe` (cuerpo crudo + `constructEvent`); lógica en `lib/billing/webhook.ts` (`processStripeEvent`, `verifyStripeEvent`) con dependencias inyectadas. 400 con firma mala; 500 solo si el evento falla (Stripe reintenta); ignorado o repetido → 200.
  - Dedupe en `billing_events`: lo `processed`/`ignored` no se repite; lo `failed` sí.
  - `checkout.session.completed` (y `async_payment_succeeded`): relee la sesión con `line_items`; solo Payment Link o precio de Levy; pagado o suscripción en `trialing`. Empresa: `client_reference_id` solo si existe y el correo del pago es el del owner → si no, la del usuario con ese correo → si no, `createCompanyWithOwner` (contraseña aleatoria, nombre del campo `STRIPE_FIELD_COMPANY_NAME`). Guarda `workspace_billing`, pone `metadata.workspace_id` en customer y subscription, manda el correo de acceso (un fallo de correo no tumba el evento: queda en el detalle) y sincroniza AAA001. Un `stripe_customer_id` que ya es de otra empresa → `failed`.
  - `customer.subscription.*` e `invoice.paid|payment_failed`: siempre releen la suscripción. La empresa sale de los ids guardados; `metadata.workspace_id` solo vale si esa empresa no tiene otro cliente de Stripe. `past_due_since` se pone la primera vez que se ve el impago y se borra al pagar.
  - CRM de AAA001 (`lib/billing/agency-crm.ts`): contacto por correo y, si no hay, por teléfono (`source = stripe`); **sin teléfono ni contacto con ese correo no se crea** (la tabla exige teléfono) y queda anotado → pedir el teléfono en el Payment Link (anotado en `DEPLOY_RUNBOOK.md`). Etiquetas `cliente-levy` / `levy-impago` / `levy-cancelado` (al pagar se quitan las otras dos), etapa Cliente/Perdido si existen, campos `levy_company_code`, `levy_workspace_id`, `levy_plan` (se crean si faltan). Estas etiquetas **no disparan flujos** de AAA001.
  - `resolveCompanyName` y `buildWelcomeLink` pasan a `lib/welcome.ts` (`levy-purchase.ts` los reexporta) para que sobrevivan al borrado de GHL en F7.3.
  - Pruebas (10) con eventos firmados por el SDK real (`generateTestHeaderString`): pago correcto, duplicado, firma inválida/otro secreto/cuerpo alterado, otro producto, sin pagar, `client_reference_id` ajeno y propio, impago y vuelta a pagar, cancelación, metadata de otra empresa.
  - **Sin verificar con Stripe real** (F7.3 exige un pago de prueba real antes de borrar GHL). `DEPLOY_RUNBOOK.md`: endpoint y eventos a suscribir.
- **F6.4 Corte por impago (2026-11-03).**
  - `lib/billing/gate.ts`: en `cron/buffer`, `cron/flows` y `cron/deliver` las empresas bloqueadas se **excluyen en la consulta** (`.not("workspace_id", "in", …)`), así no ocupan el lote; en `ycloud-webhook` lo entrante se guarda igual (y cuenta en el CRM) pero no se arrancan flujos ni IA. `crm-jobs` recibe ya `listBlockedWorkspaceIds` en su paso `billing` (sin avisos ni recordatorios).
  - Si la lectura de facturación falla, en esos cuatro caminos **no se bloquea** (se registra el error); en `crm-jobs` sí se paran los avisos, como ya estaba.
  - Lo encolado de una empresa bloqueada **se queda en cola** y los flujos en espera siguen esperando: salen al reactivar. ⚠️ Tras un bloqueo largo, la IA contestará a mensajes antiguos al volver: si molesta, se puede limitar la ventana del buffer.
  - Los mensajes que escribe el equipo a mano también se quedan sin enviar mientras dure el bloqueo (`deliver` no envía).
  - Panel: `components/panel/billing-notice.tsx` en el layout, solo para owner/admin: «Reactiva tu suscripción» (rojo) si está bloqueada, banner ámbar en aviso (con fecha de fin de la gracia). «Sin suscripción» no se muestra hasta que exista el botón de pago (F6.6). No se borra ningún dato.
  - Pruebas: `gate.test.ts` (solo la impagada, fallo de lectura no corta, filtro con ids válidos); la exclusión en `crm-jobs` ya estaba probada.
- **F6.6 Facturación en el panel y consola (2026-11-03).**
  - Tarjeta **Facturación** encima de los ajustes de **Negocio** (owner/admin la ven; solo el owner actúa): estado de la suscripción y renovación, «Pagar / reactivar» (Payment Link con `client_reference_id` = empresa y `prefilled_email` = correo del owner) cuando no está pagada, y «Gestionar suscripción» → `POST /api/billing/portal` (solo owner, Customer Portal con vuelta a `/negocio`). Sin menú nuevo.
  - Variable nueva **`STRIPE_PAYMENT_LINK_URL`** (URL pública del Payment Link; los ids siguen en `STRIPE_PAYMENT_LINK_IDS`) en `.env.example` y `DEPLOY_RUNBOOK.md`, que también pide activar el Customer Portal en Stripe.
  - El aviso del layout enlaza a Facturación y ahora también avisa de «sin suscripción» si hay `STRIPE_PAYMENT_LINK_URL` (las 5 empresas actuales son exentas: no lo ven).
  - Consola de empresas (`/admin`): etiqueta con el estado de Stripe o «Exenta», casilla «Exenta de pago» y campo para enlazar un `cus_…` → `PATCH /api/admin/companies/billing` (superadmin; `lib/billing/admin.ts` crea la fila si falta y rechaza un cliente ya enlazado a otra empresa). El estado se rellena con el siguiente evento de Stripe de ese cliente.
  - Pruebas: enlace de pago, ids de cliente, exención aislada por empresa, alta de fila, cliente duplicado/raro/empresa inexistente (6). En dev: portal 401 y consola 403 sin sesión. **La interfaz no se ha visto con sesión** y el portal no se ha probado contra Stripe.
- **F6.7 Onboarding sin GHL (2026-11-03).**
  - Reunión de puesta en marcha en la **agenda propia de AAA001** (`lib/agenda/levy-meeting.ts`): huecos libres de la agenda `LEVY_MEETING_AGENDA_ID` (respeta lo ocupado en Google si la agenda está en `push_and_busy`), el cliente queda como contacto de AAA001 por su teléfono personal (pide prefijo `+`), la cita lleva el nombre y código de la empresa en las notas y se copia a Google en `after()`. Solo vale una agenda **activa de AAA001**; si no, se usa el calendario de GHL como antes (coexistencia hasta F7.2). Cada reunión guarda `engine` (`agenda`/`ghl`; las antiguas son GHL) para cancelarla donde está.
  - Fin del onboarding: `markAgencyContactActiveInCrm` pone `levy-activo` al contacto de AAA001 con el correo del owner (no crea contactos); la llamada a GHL sigue hasta F7.3.
  - Asistente: el paso Extras cambia «Conectar GoHighLevel» por «Conectar Google Calendar (opcional)» (`GoogleCalendarCard`) y el resumen final cuenta Google Calendar en vez de GHL. Tour de Chats sin GHL.
  - Pendiente del usuario: crear en AAA001 la agenda de la reunión (horario del equipo, servicio de la duración que quieras) y poner su id en `LEVY_MEETING_AGENDA_ID`.
  - Pruebas (5): agenda solo de AAA001 y activa, agrupación por día en la zona del cliente, reservar/ocupado/cancelar sin tocar el CRM del cliente, hora no ofrecida, `levy-activo` sin crear contactos.
- **F6.5 `/bienvenida` (2026-11-03).**
  - Página pública `/bienvenida?session_id=…` y `POST /api/billing/welcome-resend`; lógica en `lib/billing/welcome-page.ts`. Solo lee: **la cuenta la crea siempre el webhook**. El enlace de acceso solo viaja por correo y se envía a la dirección del pago. Estados: lista, preparando (se refresca sola, hasta 1 min), pago en proceso, no encontrado y Stripe no disponible.
  - «Lista» exige que el webhook ya haya guardado la facturación y que el correo del pago sea el del owner de esa empresa.
  - Reenviar: máx. 3/hora **por empresa**, atómico en la base (`claim_welcome_resend` + 2 columnas en `workspace_billing`). Un correo fallido gasta intento. El correo automático del webhook no cuenta.
  - `sendWelcomeAccess` es ahora el envío común del webhook y de «Reenviar»; F6.8 cambiará el remitente en `email.ts`.
  - Aspecto de la landing: Figtree servida por la app, colores `#F5E46B`/`#111111`/`#F7F6F1`, logo copiado a `public/levy-logo.png`, contacto `hola@agentelevi.com`, sin scripts ni recursos de terceros. `referrer: no-referrer` porque la URL lleva el id de la sesión.
  - Migración `welcome_resend` aplicada con aprobación del usuario (el primer intento lo denegó el clasificador de permisos): 6 comprobaciones de `supabase/tests/welcome_resend_checks.sql` en verde antes y después, contadores a 0 en las 5 empresas y advisors sin avisos nuevos.
  - Verificado en dev: los estados con datos de prueba temporales (ya quitados), móvil, y que sin `STRIPE_SECRET_KEY` la página no se rompe. **Sin probar con Stripe real.**
- **F6.8 Correo por Gmail (2026-11-03).**
  - Conexión aparte de Calendar: proveedor **`gmail`** con sus tokens cifrados y su fila en `integrations` (cuenta, scopes, fecha). `lib/integrations/gmail.ts`; `google-calendar.ts` recibe el proveedor por parámetro. Scopes: `gmail.send` + `openid` + `email`, porque `gmail.send` no deja leer la dirección de la cuenta. Rutas `api/integrations/gmail/{connect,status,disconnect}`; **vuelve por el mismo callback** (el `state` firmado lleva el destino), así que no hace falta otra URI en Google Cloud. Tarjeta «Correo de Google» en Integraciones.
  - **Revocar en Google quita a la app todo el acceso de esa cuenta**: al desconectar uno, si el otro sigue activo, solo se borran los tokens y no se revoca; el último sí revoca.
  - Remitente (`email.ts`): `sendSystemEmail` usa el Gmail de AAA001; si no está conectado o falla, Resend si hay `RESEND_API_KEY`; si no, error claro. `sendEmail` pasa a llamarse `sendViaResend`.
  - **Arreglo de paso:** un correo de acceso fallido se perdía (F6.3 lo dejaba en `detail`, que no se guarda). Ahora queda en `billing_events.error` con `result = processed`. Y `getAccessToken` conserva los scopes si Google renueva sin repetirlos.
  - A contactos (`crm/contact-email.ts`): «Enviar correo» en la ficha (`POST api/crm/contacts/[id]/email`, owner/admin/agent) y acción `send_email` en flujos, con `{{nombre}}`, `{{empresa}}`, `{{email}}`, `{{telefono}}` y las respuestas. Siempre el Gmail de esa empresa, nunca Resend ni el de otra. Bloqueada por impago → no envía. Actividad `email_sent` / `email_failed` (asunto y destinatario, no el cuerpo). El texto va escapado y sin saltos de línea en las cabeceras.
  - Migración `integrations_gmail` aplicada con aprobación del usuario (el primer intento lo denegó el clasificador de permisos): `gmail` admitido, otro proveedor rechazado, checks validados, sin filas de prueba y advisors sin avisos nuevos. Falta conectar el correo en Google Cloud y en AAA001 para usarlo.
  - Verificado: pruebas con `fetch` simulado (MIME/base64url con UTF-8, renovación, scope no concedido, aislamiento A/B, respaldo a Resend); rutas 401 sin sesión en dev; build. **Sin probar con Google real ni la interfaz con sesión.**
- **F7.1 Script de migración de GHL (2026-11-03) — `[!]` bloqueada por el token de GHL.**
  - `scripts/migrate-ghl-to-crm.ts` (solo AAA001, **dry-run por defecto**, `--apply` para F7.2, `--limit N` para probar). Uso: `node --conditions=react-server --env-file=.env scripts/migrate-ghl-to-crm.ts`. Lee la conexión de GHL de AAA001 (token cifrado en `integration_secrets`, descifrado con `INTEGRATION_ENCRYPTION_KEY`) y reutiliza las funciones del CRM y la Agenda para escribir. No imprime tokens ni datos personales.
  - Reglas puras en `src/lib/migration/ghl-to-crm.ts` (8 pruebas): etiquetas limpias, etapa por nombre de la etapa de la oportunidad (prefiere el pipeline por defecto; ganada → Cliente, perdida → Perdido), `openHours` de GHL → horario semanal, duración del hueco, marca `[ghl:<id>]` para no duplicar citas, flujos con mapeos propios (`upsert_opportunity` → `set_stage`, `set_booking_calendar` → `set_booking_agenda`) e idempotentes, propuesta de texto sin GHL.
  - Todo idempotente: etiquetas y etapa solo si faltan o cambian, agenda reutilizada por nombre, citas con marca, flujos ya convertidos no cambian. Con `--apply`, la tool «Consultoría Levi» pasa a `type: "agenda"` (el agente deja de usar GHL) y `booking_calendar_id` → `booking_agenda_id`. La agenda nueva se crea con Google en `off` (si el calendario de GHL ya sincronizaba con Google, no se duplican eventos).
  - **Resultado del dry-run (2026-11-03):** la clave de cifrado de `.env` descifra el token, pero **GHL responde 401 a todas las llamadas** (pipelines, calendario, location, contactos y citas): el token guardado está revocado o caducado. Sin él no se pueden leer etiquetas, etapas, horario ni citas. Lo que sí sale sin GHL:
    - Flujo «LEVY - Diagnóstico y agenda» (en pausa): **2 acciones** convertibles a `crm_action`, ninguna sin equivalente.
    - Agenda «Consultoría Levi»: no existe aún; sin GHL se crearía con L-V 9-18, 30 min, Europe/Madrid (**revisar**).
    - Propuesta para las tools de texto: «Agendar en GoHighLevel» → **«Agendar cita»**: «Accion: crea una cita directamente en la agenda. Inputs: nombre, telefono, fecha, hora y notas.»; «Consultar disponibilidad» → «Accion: consulta horarios disponibles en la agenda antes de reservar. Inputs: rango de fechas.» (no se aplican solas; revísalas).
  - **Qué necesito:** un Private Integration Token nuevo de la subcuenta de AAA001 con permisos de contactos, oportunidades (pipelines) y calendarios/eventos, pegado en Integraciones → GoHighLevel de AAA001 (queda cifrado). Luego repito el dry-run y apunto aquí los números.
- **F7.2 Migración de AAA001 sin GHL (2026-11-03, aprobada).**
  - Antes: dry-run `--sin-ghl` revisado y copia de las 3 tools y del flujo tomada (en la conversación). Comando: `node --conditions=react-server --env-file=.env scripts/migrate-ghl-to-crm.ts --sin-ghl --apply`.
  - Escrito en producción (AAA001):
    - agenda **«Consultoría Levi»** (por defecto, activa, L-V 9-18, 30 min, Europe/Madrid, Google en `off`);
    - la tool «Consultoría Levi» pasa a `type: "agenda"` → **el agente ya agenda en la Agenda propia** (no quedan tools `ghl_calendar`);
    - tools de texto: «Agendar en GoHighLevel» → «Agendar cita» y «Consultar disponibilidad» con el texto nuevo;
    - flujo «LEVY - Diagnóstico y agenda» (sigue **en pausa**): su paso de GHL pasa a «CRM: diagnóstico completado» (`crm_action`) con 2 acciones del CRM;
    - campo de texto **`cuello_de_botella_principal`** creado (la acción lo necesita; la IA no lo lee).
  - Comprobado en la base, y una segunda pasada no cambia nada (idempotente).
  - **Arreglo encontrado de paso:** el motor de flujos solo ejecutaba las acciones de los pasos `ghl_action`; los pasos «Acción CRM» (`crm_action`, los que crean el editor y las plantillas) se saltaban. Ahora se ejecutan los dos. En producción no había ningún flujo con pasos `crm_action`, así que no hubo efecto. Sin prueba propia del motor (no hay `flow-engine.test`); la conversión sí está probada.
  - Revisa en el panel: horario y duración de la agenda (Agenda → Configurar) y, si quieres, conecta su Google Calendar.
  - Sigue activa la integración de GHL de AAA001 con un token que da 401: sus llamadas fallan sin bloquear nada. La borra F7.4.
  - Producción (`master`) no reconoce tools `type: "agenda"`: hasta desplegar la rama, el agente de AAA001 no ofrece citas (con GHL en 401 tampoco podía). **El usuario decidió dejarlo así** (2026-11-03) en vez de revertir la tool.
- **Rearme de tools y reunión en AAA001 (2026-11-04, aprobado).**
  - Borradas las tools de texto «Agendar cita» y «Consultar disponibilidad» y quitadas de las tools asignadas de Sofía (eran su única referencia). Sofía se queda con «Consultoría Levi». Su descripción sustituye al texto de ejemplo, aprobada por el usuario. La descripción de la agenda «Consultoría Levi» sigue con el texto de ejemplo, pero el agente lee primero la de la tool.
  - Agenda **«Puesta en marcha»** creada en AAA001 (`8c84ef58-d7f2-4d93-a7d4-88605d1a67e5`): activa, no es la de por defecto, L-V 9-18, 30 min, Europe/Madrid, Google en `off`. Sin tool, así que el agente no la ofrece.
  - Correos de la reunión (`lib/agenda/levy-meeting-email.ts`): confirmada, movida y cancelada, **solo por el Gmail de AAA001** (sin Resend, a petición del usuario), en `after()` y sin lanzar nunca: sin Gmail la reserva sigue. Mover es «movida» solo si de verdad se canceló la anterior; si no, «confirmada».
  - También cuando el equipo mueve o cancela desde el panel de Agenda (`handlePanelMeetingChange`): actualiza `onboarding_state.meeting` del cliente, que si no se quedaba con la hora vieja, y le avisa. Solo para citas guardadas como reunión de un cliente: las demás de esa agenda no mandan nada.
  - Zona horaria (decisión del usuario, 2026-11-04): las dos agendas de AAA001 se quedan en `Europe/Madrid`. El perfil de negocio de AAA001 sigue en `America/Bogota`.
  - Las agendas no comparten ocupación: una reunión y una consultoría pueden coincidir salvo que ambas usen el mismo Google Calendar en `push_and_busy`.
- **F7.3 Borrado de GHL (2026-11-04, aprobada).**
  - Comprobado antes en producción: 0 tools `ghl_calendar`, 0 flujos con acciones de GHL, 0 contactos con `booking_calendar_id`, 0 reuniones guardadas. Por eso se quita **toda la convivencia**, no solo los módulos: motor `ghl` del agente, `kind` de las tools, pasos `ghl_action`, conversión de acciones y `engine` de la reunión.
  - Borrados: `ghl-agency`, `ghl-calendar`, `gohighlevel`, `levy-calendar`, `levy-purchase`, `lib/migration`, `scripts/migrate-ghl-to-crm.ts`, `webhooks/ghl/**`, `integrations/gohighlevel/**`, `cron/ghl-sync` y su entrada de `vercel.json`, variables de `.env.example`.
  - **Arreglo necesario:** la lista de «Calendarios de agendamiento» en Tools salía de GHL; sin él no se podía habilitar ni describir ninguna agenda. Ahora sale de las agendas de la empresa (`/api/agenda/agendas`) y guarda tools `type: "agenda"`. También se quitan los dos preajustes de texto de GHL. **No visto con sesión.**
  - Se queda para F7.4: `gohighlevel` en `database.types.ts`, `schema.sql` y el check de la base, la fila y el secreto de AAA001 y las claves `ghl_*` de `contacts.metadata`. Las migraciones ya aplicadas no se reescriben. `PROMPT_CRM_SUPABASE.md` y `COURSE_*.md` no se tocan: son históricos.

## Tareas

### F0 — Preparación
- [x] F0.1 Crear rama `crm-supabase`; leer `AGENTS.md`, `PROMPT_CRM_SUPABASE.md` y el inventario de GHL con graphify; anotar aquí cualquier diferencia con el inventario.
- [x] F0.2 Instalar `stripe` y la librería mínima que haga falta para Google (preferir `fetch` directo a la API REST si basta). Añadir variables nuevas a `.env.example` y `DEPLOY_RUNBOOK.md`.
- ~~F0.3~~ Eliminada: `btree_gist` se instala en F1.3 y `pg_cron`/`pg_net` en F4.3 (no activar `pg_net`, que permite HTTP saliente desde la base, antes de usarla).

### F1 — Modelo de datos del CRM (aditivo)
- [x] F1.1 Decidir y anotar aquí cómo conviven `crm_tags` con `contacts.automation_labels` y `metadata.ai_tags` (sin romper triggers de flujo). Propuesta tras F0.1: `crm_tags` aparte; `automation_labels` sigue siendo marca interna del sistema (no se muestra como etiqueta); `ai_tags` se muestra como sugerencia que el operador puede convertir en etiqueta. (dep: F0.1)
- [x] F1.2 Migración: `crm_pipeline_stages` (+ siembra para los 5 workspaces y, para los nuevos, con **trigger `after insert on workspaces`** en la base, que cubre `workspaces.ts` y `admin-companies.ts`), columnas nuevas de `contacts`, `crm_tags`, `crm_contact_tags`, `crm_custom_fields`, `crm_contact_notes`, `crm_contact_tasks`, `crm_contact_activity`, con RLS. Tipos regenerados, advisors limpios. (dep: F1.1)
- [x] F1.3 Migración: extensión `btree_gist`; `agendas` (con `closed_dates date[] default '{}'` para festivos), `appointments` (con exclusión anti-solape), `schedule_blocks`, `offered_slots`, `google_event_deletions`, con RLS. (dep: F0.1)
- [x] F1.4 Migración: funciones `book_appointment` y `reschedule_appointment` + pruebas SQL (solape rechazado, hora no ofrecida rechazada, reagendar atómico, workspace ajeno rechazado) ejecutadas con `execute_sql` dentro de una transacción con `rollback`. Las funciones `security definer` llevan `set search_path = ''` y nombres calificados. (dep: F1.3)
- [x] F1.5 Migración: `integrations.provider` admite `google_calendar` (sin quitar `gohighlevel`). (dep: F0.1) — también `integration_secrets.provider` (ahí van los tokens cifrados de Google).

### F2 — Lógica del CRM y la Agenda
- [x] F2.1 **Ampliar** el `src/lib/timezones.ts` existente con las utilidades puras de `ghl-calendar.ts` (`isValidTimeZone`, `zonedStartOfDay`, …), que `ghl-calendar.ts` pasa a importar; sin romper los imports actuales del navegador; con pruebas. (dep: F0.1)
- [x] F2.2 `src/lib/crm/` contactos, etapas, etiquetas, campos (validación por tipo), notas, tareas, actividad + pruebas + prueba de aislamiento. (dep: F1.2)
- [x] F2.3 `src/lib/agenda/slots.ts` portado de `agenda.py` (horario, servicios, festivos `closed_dates`, bloqueos, citas, repartir/espaciar) — lógica pura con pruebas extensas (zonas horarias, cambio de horario de verano, bordes del día, aviso mínimo, festivos). (dep: F2.1)
- [x] F2.4 `src/lib/agenda/` ofrecer, agendar, reagendar, cancelar, confirmar, marcar, bloqueos (sobre las funciones SQL) + traducción de errores + pruebas. (dep: F1.4, F2.3)
- [x] F2.5 Import/export CSV y borrado RGPD de contacto (apunta eventos de Google por borrar). (dep: F2.2, F1.3)

### F3 — Google Calendar por workspace
- [x] F3.1 `src/lib/integrations/google-calendar.ts`: OAuth (state firmado con workspace y caducidad), tokens cifrados, refresco, error permanente, listCalendars, freeBusy, eventos con id determinista + pruebas con fetch simulado. (dep: F1.5)
- [x] F3.2 Rutas `app/api/integrations/google-calendar/{connect,callback,status,calendars,disconnect}` (owner/admin) + pruebas. (dep: F3.1)
- [x] F3.3 Copia a Google (`push`) y ocupado (`push_and_busy`) integrados en `src/lib/agenda` + cola de pendientes y borrados. (dep: F3.1, F2.4)

### F4 — Jobs y recordatorios
- [x] F4.1 `src/lib/agenda/reminders.ts` portado de `seguimientos.py` (idempotente, ventana 24 h, plantilla o «omitido») + pruebas. (dep: F2.4)
- [x] F4.2 `app/api/cron/crm-jobs` (lotes: Google pendiente, borrados, recordatorios, inasistencias, purga de ofertas, gracia de facturación) + pruebas. (dep: F3.3, F4.1)
- [x] F4.3 Migración: extensiones `pg_cron` y `pg_net`; job cada 5 min llamando a `crm-jobs`, con URL y secreto en Supabase Vault. **Se crea desactivado** (`cron.alter_job(..., active := false)`) y se activa en F7.5 tras desplegar. Documentar cómo pausarlo. (dep: F4.2)

### F5 — Agente, flujos y panel sin GHL
- [x] F5.0 Refactor **sin cambio de comportamiento**: sacar de `cron/buffer/route.ts` el runtime de calendario (`buildCalendarRuntime`, `runCalendarTool`, `buildCalendarToolDefinitions`, respuestas directas y saneado) a `src/lib/agenda/agent-tools.ts`, aún sobre GHL, con pruebas de las protecciones actuales (no afirmar cita sin confirmación de la tool, no inventar disponibilidad). (dep: F0.1)
- [x] F5.1 `lib/calendar-tools.ts` a agendas (lee formato viejo) + pruebas. (dep: F2.4)
- [x] F5.2 Calendario del agente sobre `src/lib/agenda`, `offered_slots` por conversación, tools `reagendar_cita` y `cancelar_cita`, protecciones conservadas + pruebas. **Coexistencia**: si el workspace aún tiene una tool `ghl_calendar` activa, el agente sigue usando GHL hasta F7.2 (si no, AAA001 se queda sin agenda al desplegar). (dep: F5.0, F5.1)
- [x] F5.3 Flujos: `crm_action` (+ conversión de `ghl_action`), flow-builder con desplegables, **implementar** el disparo `tag` en `flow-engine.ts` (hoy no existe) al etiquetar desde panel, flujo o agente + pruebas. (dep: F2.2)
- [x] F5.4 `ycloud-webhook` sin `syncContactToGoHighLevel`. Sustituto de `webhooks/ghl/send-message`: antes de crearlo, comprobar si alguien externo lo seguirá llamando sin GHL; si sí, crearlo con un nombre que no choque con la `api/flows/start` del panel (p. ej. `webhooks/flows/trigger`) y anotar la decisión; si no, solo se borra en F7.3. (dep: F2.2)
- [x] F5.5 Panel **Contactos** (lista, kanban, ficha, CSV, RGPD) + `sidebar-nav`. (dep: F2.2, F2.5)
- [x] F5.6 Panel **Agenda** (semana/día, citas, bloqueos, configuración de agendas). Entrada nueva «Agenda» en el menú lateral (D4). (dep: F2.4, F3.2)
- [x] F5.7 Ajustes del CRM (etapas, etiquetas, campos) e **Integraciones → Google Calendar** en lugar de GHL. (dep: F2.2, F3.2)
- [x] F5.8 Métricas, `panel-data`, `inbox-panel` (lateral con etapa, etiquetas y próxima cita), portada y `health/readiness` sin GHL. (dep: F5.2, F5.5)

### F6 — Stripe y onboarding de Levy
- [x] F6.1 Migración: `workspace_billing` (5 workspaces actuales con `billing_exempt = true`) y `billing_events`. (dep: F0.1)
- [x] F6.2 `src/lib/billing/` (cliente Stripe, `getWorkspaceBillingState`) + `src/lib/email.ts` (Resend) + pruebas. (dep: F6.1, F0.2)
- [x] F6.3 `app/api/webhooks/stripe` completo + contacto en el CRM de AAA001 + pruebas con eventos firmados. (dep: F6.2, F2.2)
- [x] F6.4 Bloqueo por impago en ycloud-webhook, buffer, flows, deliver y crm-jobs + pantalla «Reactiva tu suscripción» + banner de aviso. (dep: F6.2)
- [x] F6.5 Página `/bienvenida` con «Reenviar» en esta app (D1 resuelta). Que respete el aspecto de la landing `activa.agentelevi.com`: logo, colores y tono. Se pueden copiar de ella, pero sin traer scripts ni recursos de terceros. (dep: F6.3)
- [x] F6.8 **Correo con la cuenta de Google** (petición del usuario, 2026-11-03): los correos salen por **Gmail de la cuenta de Google conectada**, usando la API de Gmail por `fetch`, en lugar de Resend.
  - Scope `https://www.googleapis.com/auth/gmail.send` pedido **aparte y opcional**, con autorización incremental (botón «Conectar correo» en Integraciones → Google). Conectar el calendario no debe exigir Gmail, ni al revés.
  - Mismos tokens cifrados por workspace y mismo manejo de errores permanentes que Calendar. Se guarda qué scopes se concedieron y desde qué dirección se envía.
  - `src/lib/email.ts` elige el remitente: correos del sistema de Levy (acceso tras el pago, reenvío desde `/bienvenida`) por el Gmail conectado de **AAA001**; Resend solo como respaldo si `RESEND_API_KEY` existe; si no hay ninguno, error claro y el evento queda registrado.
  - Cada empresa puede enviar correos a sus contactos con su propio Gmail: botón «Enviar correo» en la ficha del contacto y acción `send_email` en `crm_action` de flujos (asunto y cuerpo con variables `{{...}}`). Todo queda en la actividad del contacto. Respeta el bloqueo por impago y nunca usa el Gmail de otra empresa.
  - Pruebas con `fetch` simulado: mensaje MIME/base64url correcto con UTF-8 en asunto, renovación de token, scope no concedido, aislamiento A/B, respaldo a Resend.
  - Documentar en `DEPLOY_RUNBOOK.md` que hay que añadir el scope en la pantalla de consentimiento de Google Cloud y activar la Gmail API (scope sensible: verificación de Google para producción).
  - (dep: F3.1, F6.2, F5.3)
- [x] F6.6 Facturación en el panel (Customer Portal, botón de pago con `client_reference_id`) y consola de empresas. (dep: F6.3)
- [x] F6.7 Reunión de puesta en marcha sobre la agenda de AAA001; wizard y tours sin GHL; `markAgencyContactActive` → etiqueta `levy-activo` en AAA001. (dep: F2.4, F2.2)

### F7 — Migración de datos y limpieza
- [x] F7.1 (cerrada sin datos de GHL por decisión del usuario; el script queda para la parte sin GHL) Script `scripts/migrate-ghl-to-crm.ts` (solo AAA001, idempotente, `--dry-run` por defecto): etiquetas y etapa desde GHL para los 160 contactos con `ghl_contact_id`, tool `ghl_calendar` «Consultoría Levi» → agenda, citas futuras del calendario GHL → `appointments`, el flujo con `ghl_action` → `crm_action`, y propuesta de texto nuevo para las tools «Agendar en GoHighLevel» y «Consultar disponibilidad». Ejecutar **solo en dry-run** y apuntar el resultado aquí. Necesita en local la clave de cifrado de `integration_secrets` y acceso a la API de GHL: si no están, marcar `[!]` y pedírmelas. (dep: F5.1, F2.4, F5.3)
- [x] **[STOP]** F7.2 (aprobada por el usuario el 2026-11-03, sin GHL) Ejecutar la migración real de AAA001 (escribe en producción). **Sin GHL:** crear la agenda «Consultoría Levi» (L-V 9-18, 30 min, Europe/Madrid, a ajustar en el panel), pasar su tool a `type: "agenda"` (el agente deja de usar GHL), convertir las 2 acciones del flujo «LEVY - Diagnóstico y agenda» y poner el texto nuevo de las tools «Agendar cita» y «Consultar disponibilidad».
- [x] **[STOP]** F7.3 (aprobada por el usuario el 2026-11-04, **sin el pago real de prueba** de F6.3: hacerlo antes de desplegar) Borrar código, rutas y variables de GHL (`ghl-agency.ts`, `webhooks/ghl/**` incluida `purchase` + `levy-purchase.ts`, `integrations/gohighlevel/**`, `cron/ghl-sync`, `vercel.json`). **Solo después de F6.3 verificada** con un pago real de prueba (hoy `webhooks/ghl/purchase` es la vía de venta). (dep: F6.3, F7.2)
- [ ] **[STOP]** F7.4 Migración destructiva: quitar `gohighlevel` y `gmail` del check de `integrations` e `integration_secrets`, borrar su fila y su secreto, limpiar claves `ghl_*` de `contacts.metadata`, convertir assets `ghl_calendar` restantes.
- [ ] **[STOP]** F7.5 Orden de salida (lo hago yo contigo): merge de `crm-supabase` → F7.2 → despliegue → variables en Vercel → activar el job de `pg_cron` de F4.3 → comprobar AAA001 por WhatsApp. El merge es todo o nada: no desplegar la rama sin F7.2 hecha o la coexistencia de F5.2 probada.

### F8 — Verificación final
- [!] F8.1 Ejecutar la «Verificación final» de `PROMPT_CRM_SUPABASE.md` y escribir el resumen abajo. Cuando esta tarea esté `[x]` (o solo queden tareas [STOP] o `[!]` que dependan del usuario), **detén el loop**.

## Registro de iteraciones
<!-- Una línea por iteración: fecha · tarea · resultado · commit -->
- 2026-11-02 · Revisión del plan (aprobada) · ajustes: F0.3 repartida en F1.3/F4.3, siembra de etapas por trigger, festivos, F2.1 amplía `timezones.ts`, nueva F5.0 (refactor de `buffer`), coexistencia GHL en F5.2, F5.3 implementa el disparo `tag`, F5.4 revisada, F7.1 ampliada, F7.3 tras F6.3, nueva F7.5 [STOP] · sin código.
- 2026-11-02 · F0.1 · rama `crm-supabase` creada; diferencias anotadas en «Estado real vs. inventario»; typecheck, lint y test (106/106) en verde · commit `crm: F0.1 rama y revisión del inventario`.
- 2026-11-02 · F0.2 · `stripe@19.3.0`; Google irá por `fetch` a la API REST (sin librería); variables nuevas en `.env.example` y `DEPLOY_RUNBOOK.md` (GHL marcadas como deprecadas, se borran en F7.3); typecheck, lint y test (106/106) en verde. Nota: `npm audit` avisa de vulnerabilidades previas en `next` (crítica), `postcss`, `sharp` y `nanoid`, ajenas a esta tarea: actualizar Next queda fuera de este plan y lo decide el usuario · commit `crm: F0.2 dependencias y variables`.
- 2026-11-02 · F1.1 · decisión de convivencia de etiquetas apuntada en «Decisiones tomadas» (sin código; typecheck, lint y test en verde) · commit `crm: F1.1 decisión de etiquetas`.
- 2026-11-02 · F1.2 · migraciones `crm_core` y `crm_core_grants` aplicadas a producción (aditivas; ensayo previo en transacción deshecha); 7 tablas con RLS, 5 columnas nuevas en `contacts`, 30 etapas sembradas, trigger de siembra; pruebas SQL de aislamiento (FK compuestas y RLS como usuario) en verde; advisors de seguridad sin avisos nuevos (siguen los 3 previos: `set_updated_at` search_path, protección de contraseñas filtradas, 2 tablas sin políticas a propósito); `schema.sql` y `database.types.ts` actualizados; typecheck, lint y test (106/106) en verde · commit `crm: F1.2 modelo de datos del CRM`.
- 2026-11-02 · F1.3 · migración `agenda_core` aplicada a producción (aditiva; ensayo previo en transacción deshecha): `btree_gist`, 5 tablas con RLS y grants explícitos, anti-solape por agenda; 13 comprobaciones SQL en verde antes y después de aplicar; advisors de seguridad sin avisos nuevos; `schema.sql` y `database.types.ts` actualizados; typecheck, lint y test (106/106) en verde · commit `crm: F1.3 agendas y citas`.
- 2026-11-02 · F1.4 · migración `agenda_booking_functions` aplicada a producción (ensayo previo en transacción deshecha): `book_appointment`, `reschedule_appointment` y `check_agenda_slot` con SQLSTATE propios; 16 comprobaciones SQL en verde antes y después (solape, no ofrecida, oferta caducada, fuera de horario, festivo, bloqueo, empresa/conversación ajena, reagendar atómico, cita inactiva, permisos); advisors sin avisos nuevos; `schema.sql` y tipos actualizados; typecheck, lint y test (106/106) en verde · commit `crm: F1.4 funciones de agendar y reagendar`.
- 2026-11-02 · F1.5 · migración `integrations_google_calendar` aplicada (ensayo previo deshecho): `google_calendar` admitido en `integrations` e `integration_secrets` (checks ampliados, validados, `gohighlevel` intacto); `IntegrationProvider`, tipos y `schema.sql` actualizados; advisors sin avisos nuevos; typecheck, lint y test (106/106) en verde · commit `crm: F1.5 proveedor google_calendar`.
- 2026-11-02 · F2.1 · `src/lib/timezones.ts` ampliado (sin imports, válido en servidor y navegador): `isValidTimeZone`, `zonedStartOfDay` (movidas de `ghl-calendar.ts`), `getZonedParts`, `zonedDateTime` (null en la hora que no existe al adelantar el reloj; primera ocurrencia al atrasarlo), `parseClockTime` (admite 24:00), `dateKeyInTimeZone`, `addDaysToDateKey`, `isoWeekdayOfDateKey`. Imports actualizados en `ghl-calendar.ts`, `levy-calendar.ts`, `cron/buffer`, `gohighlevel/test`, `onboarding/meeting` y `onboarding/page`. `calendar-request.ts` conserva sus `dateKeyInTimezone`/`addDaysToDateKey` (no se toca para no romper sus pruebas; F2.3 usa los de `timezones.ts`). 16 pruebas nuevas (cambio de hora en Madrid y Nueva York); typecheck, lint, test (122/122) y build en verde · commit `crm: F2.1 utilidades de zona horaria`.
- 2026-11-02 · F2.2 · `src/lib/crm/` (contactos, etapas, etiquetas, campos con validación por tipo, notas, tareas, actividad, normalización) + doble `src/lib/testing/fake-supabase.ts`; `apiErrorResponse` acepta errores `userFacing`; 30 pruebas nuevas (19 de validación, 11 con el doble, 3 de aislamiento A/B: lectura, escritura y que toda consulta lleva filtro); typecheck, lint, test (152/152) y build en verde · commit `crm: F2.2 lógica del CRM`.
- 2026-11-02 · F2.3 · `src/lib/agenda/slots.ts` puro, portado de `agenda.py`/`schedule_config.py`: `agendaConfigFromRow` (tolerante) y `validateAgendaSettings` (estricta, para el panel), `daySlots`/`freeSlots` (horario de pared por zona, ocupados, antelación, máximo de días contado desde ahora igual que `book_appointment`, festivos, hora inexistente del cambio de hora omitida), `isOpenAt`, `closedReason`, `spaced`/`distributeSlots` (= `_espaciados`/`repartir`), `resolveService` (= `resolver_servicio`), `formatSlotLabel` («lunes 7 de septiembre, 10:30»). 22 pruebas nuevas (Madrid en ambos cambios de hora, Bogotá, 24:00, tramos partidos); typecheck, lint y test (174/174) en verde · commit `crm: F2.3 cálculo de huecos`.
- 2026-11-02 · F2.4 · `src/lib/agenda/{agendas,appointments,errors,index}.ts` sobre las funciones SQL de F1.4; 13 pruebas nuevas con el doble (RPC simulada, traducción de los 7 SQLSTATE, duración, cancelar como agente, marcar, Google solo en push_and_busy, aislamiento A/B en 12 operaciones sin cambios en B); typecheck, lint y test (187/187) en verde · commit `crm: F2.4 operaciones de agenda`.
- 2026-11-02 · F2.5 · `crm/csv.ts`, `crm/import-export.ts` (importar/exportar) y `crm/erasure.ts` (borrado RGPD); 9 pruebas nuevas (CSV con `;`, BOM y comillas, anti-fórmulas, importación con 6 motivos de salto, exportar→importar sin duplicar, aislamiento A/B en importación y borrado, cola de borrado en Google); typecheck, lint y test (196/196) en verde · commit `crm: F2.5 CSV y borrado RGPD`.
- 2026-11-02 · F3.1 · `src/lib/integrations/google-calendar.ts` (OAuth con state firmado, tokens cifrados, renovación, error permanente vs. pasajero, calendarios, freeBusy, eventos con id fijo, desconectar con revocación); 15 pruebas con fetch simulado (state falsificado/caducado/de otro usuario, scopes, refresh conservado, 401→renovar, 409→actualizar, 410 en borrado, tokens por empresa); typecheck, lint y test (211/211) en verde · commit `crm: F3.1 cliente de Google Calendar`.
- 2026-11-02 · F3.2 · rutas `api/integrations/google-calendar/{connect,callback,status,calendars,disconnect}` + `requireActiveWorkspaceRole` + `google-calendar-callback.ts` (lógica del callback probable); 5 pruebas nuevas (state de otro usuario sin canjear código, agente sin permiso, empresa ajena, cancelación, mensajes); typecheck, lint, test (216/216) y build en verde. Sin probar contra Google real (faltan credenciales) · commit `crm: F3.2 rutas de Google Calendar`.
- 2026-11-02 · F3.3 · `src/lib/agenda/google-sync.ts` (copia por cita con control de concurrencia, barrida por empresa conectada, cola de borrados con intentos, ocupado de Google tolerante a fallos); 10 pruebas nuevas (evento con id/nombre/zona, cancelar borra, completada se queda, cambio y borrado durante la copia, barrida cortada por 503 sin tocar empresas no conectadas, intentos de borrado, ocupado solo en push_and_busy y degradado); typecheck, lint y test (226/226) en verde · commit `crm: F3.3 copia y ocupado de Google`.
- 2026-11-03 · F4.1 · migración `agenda_reminders` aplicada (ensayo previo deshecho; advisors sin avisos nuevos) + `src/lib/agenda/reminders.ts` (recordatorio e inasistencia, ventana de 24 h, horario de envío, omitidos con motivo, idempotente); `agendaChanges` acepta los ajustes de avisos; 11 pruebas nuevas (texto, ventana, horario, cuándo toca, encolar una vez, omitido sin plantilla, espera nocturna, opt-out, apagado/excluida, inasistencia, aislamiento por empresa); typecheck, lint y test (237/237) en verde · commit `crm: F4.1 recordatorios e inasistencias`.
- 2026-11-03 · F4.2 · `src/lib/agenda/crm-jobs.ts` + ruta `api/cron/crm-jobs`; `runAppointmentNotices` devuelve las conversaciones con avisos encolados; 4 pruebas nuevas (pasos y purga, avisar a deliver, empresas bloqueadas sin avisos, facturación caída no manda nada, paso suelto); typecheck, lint, test (241/241) y build en verde. Sin ejecutar contra producción (lo hará el cron de F4.3) · commit `crm: F4.2 crm-jobs`.
- 2026-11-03 · F4.3 · migración `crm_jobs_cron` aplicada (ensayo previo deshecho y comprobado): `pg_cron` + `pg_net`, `app_private.invoke_crm_jobs()` con secretos de Vault, job `levy-crm-jobs` cada 5 min **inactivo**; advisors sin avisos nuevos; runbook y `schema.sql` actualizados; typecheck, lint y test en verde · commit `crm: F4.3 cron de crm-jobs desactivado`.
- 2026-11-03 · F5.0 · calendario del agente movido de `cron/buffer` a `agenda/agent-guards.ts` + `agenda/agent-tools.ts` sin cambio de comportamiento; 13 pruebas nuevas de las protecciones (no afirmar cita sin `cita_id` confirmado, no inventar disponibilidad, sin calendario, tools con una/varias agendas, instrucciones, respuestas directas); typecheck, lint, test (254/254) y build en verde · commit `crm: F5.0 calendario del agente fuera de buffer`.
- 2026-11-03 · F5.1 · `lib/calendar-tools.ts` con tools de agenda (`agenda_id`, `booking_agenda_id`) y lectura del formato viejo de GHL (`kind`); runtime y prueba de GHL limitados a `kind = ghl`; tarjeta y flujos de GHL con las funciones/clave legacy; 4 pruebas nuevas; typecheck, lint, test (258/258) y build en verde · commit `crm: F5.1 tools de calendario a agendas`.
- 2026-11-03 · F5.2 · agente sobre la agenda propia (`agent-agenda.ts`), motor elegido por coexistencia en `agent-tools.ts`, tools `reagendar_cita`/`cancelar_cita`, barrera de cancelación y respuestas directas en `agent-guards.ts`, integrado en `cron/buffer`; 11 pruebas nuevas con la función SQL simulada (oferta y solape): huecos ofrecidos, ISO no ofrecido rechazado, hueco calculado por el servidor, ocupado con alternativas, hora ambigua, reagendar única/varias, cancelar solo de su conversación, tools/contexto/barreras; typecheck, lint, test (269/269) y build en verde. Sin probar con WhatsApp ni OpenAI reales · commit `crm: F5.2 agente sobre la agenda propia`.
- 2026-11-03 · F5.3 · flujos con `crm_action`, coexistencia con acciones de GHL, disparo de flujos por etiqueta, audiencias con etiquetas del CRM y constructor con desplegables; 9 pruebas nuevas (conversión, separación, plantilla Levy, disparo por id/nombre, las 7 acciones, etiqueta repetida no relanza, fallo aislado, aislamiento A/B); typecheck, lint, test (278/278) y build en verde · commit `crm: F5.3 flujos con acciones del CRM`.
- 2026-11-03 · F5.4 · `ycloud-webhook` actualiza el CRM (`recordInboundMessage`) y deja la sincronización con GHL como legado; sin sustituto para `webhooks/ghl/send-message` (comprobado que nadie lo usa); 2 pruebas nuevas; typecheck, lint, test (280/280) y build en verde · commit `crm: F5.4 webhook de YCloud al CRM`.
- 2026-11-03 · F5.5 · `/clientes` como CRM (lista, etapas, ficha, CSV, RGPD) + API `api/crm/**` + enlace directo a conversación en la bandeja; sin cambios en el menú lateral (decisión del usuario); typecheck, lint, test (280/280) y build en verde; rutas comprobadas en dev (401 sin sesión) · commit `crm: F5.5 panel de clientes`.
- 2026-11-03 · F5.7 · ajustes del CRM en Clientes (etapas, etiquetas, campos) + API `api/crm/{stages,tags,fields}` + tarjeta Google Calendar en Integraciones (GHL solo si ya existía); D4 resuelta por el usuario (Agenda como sección nueva del menú); typecheck, lint, test (280/280) y build en verde · commit `crm: F5.7 ajustes del CRM y Google Calendar`.
- 2026-11-03 · F5.6 · sección Agenda en el menú + página `/agenda` (semana/día, citas, bloqueos, configuración) + API `api/agenda/**` con sync a Google en `after()`; typecheck, lint, test (280/280) y build en verde · commit `crm: F5.6 panel de agenda`.
- 2026-11-03 · F5.8 · métrica «Citas agendadas» desde `appointments`, lateral de Chats con etapa/etiquetas/próxima cita, portada y readiness sin GHL (Google y Stripe recomendados); typecheck, lint, test (281/281) y build en verde · commit `crm: F5.8 métricas y paneles sin GHL`.
- 2026-11-03 · F6.1 · migración `billing` aplicada (dry-run previo en transacción deshecha): `workspace_billing` + `billing_events`, 5/5 empresas exentas, RLS solo lectura owner/admin; `schema.sql` y `database.types.ts` al día; checks SQL DRYRUN_OK; typecheck, lint y test (281/281) en verde · commit `crm: F6.1 tablas de facturación`.
- 2026-11-03 · F6.2 · `lib/billing` (config, reglas `ok|aviso|bloqueado`, lectura por empresa, lista de bloqueadas, cliente Stripe) + `lib/email.ts` (Resend por `fetch`); typecheck, lint y test (296/296) en verde · commit `crm: F6.2 librería de facturación y correo`.
- 2026-11-03 · F6.3 · webhook de Stripe (firma, dedupe, alta de empresa, estado de suscripción, correo de acceso, contacto en AAA001) + 10 pruebas con eventos firmados; eventos documentados en el runbook; typecheck, lint, test (306/306) y build en verde · commit `crm: F6.3 webhook de Stripe`.
- 2026-11-03 · F6.4 · corte por impago en ycloud-webhook, buffer, flows, deliver y crm-jobs (lo entrante se guarda) + aviso «Reactiva tu suscripción» y banner de gracia en el panel; typecheck, lint, test (309/309) y build en verde · commit `crm: F6.4 corte por impago`.
- 2026-11-03 · F6.6 · Facturación en Negocio (Pagar/reactivar + Customer Portal, solo owner), aviso con enlace, consola de empresas con exención y enlace de cliente de Stripe; variable `STRIPE_PAYMENT_LINK_URL`; typecheck, lint, test (315/315) y build en verde · commit `crm: F6.6 facturación en el panel`.
- 2026-11-03 · F6.7 · reunión de puesta en marcha sobre la agenda de AAA001 (GHL de respaldo sin `LEVY_MEETING_AGENDA_ID`), `levy-activo` en el CRM de AAA001, asistente y tours con Google Calendar en vez de GHL; typecheck, lint, test (320/320) y build en verde · commit `crm: F6.7 onboarding sin GHL`.
- 2026-11-03 · F7.1 · `[!]` script de migración (dry-run por defecto, idempotente) + reglas puras con 8 pruebas; dry-run ejecutado: **GHL responde 401** con el token guardado de AAA001 (revocado o caducado), solo salen la conversión del flujo (2 acciones) y la propuesta de texto de las tools; typecheck, lint y test (328/328) en verde · commit `crm: F7.1 script de migración de GHL (bloqueado por token)`.
- 2026-11-03 · F8.1 · `[!]` verificación final: typecheck, lint, test (328/328) y build en verde; advisors sin avisos nuevos y 14 tablas nuevas con RLS; GHL solo en lo que retiran F7.2–F7.4; **sin recorrido del panel con sesión** (necesita tu usuario); resumen final escrito · commit `crm: F8.1 verificación final y resumen`.
- 2026-11-03 · Decisión · el usuario deja GHL: F7.1 cerrada sin datos de GHL, F7.2 reescrita sin GHL (sigue [STOP]) · sin código.
- 2026-11-03 · F7.2 · aplicada sin GHL en AAA001 (agenda «Consultoría Levi», tool → agenda, textos de tools, flujo convertido, campo `cuello_de_botella_principal`); comprobada en la base e idempotente; arreglo del motor para ejecutar pasos `crm_action`; typecheck, lint y test en verde · commit `crm: F7.2 migración de AAA001 sin GHL`.
- 2026-11-03 · F6.5 · página `/bienvenida` + reenviar (3/hora) + logo y estilo de la landing; 15 pruebas nuevas; typecheck, lint, test (343/343) y build en verde; migración `welcome_resend` aplicada con aprobación del usuario (comprobaciones y advisors sin avisos nuevos). Sin probar con Stripe real · commits `crm: F6.5 página de bienvenida (migración pendiente)` y `crm: F6.5 migración aplicada`.
- 2026-11-03 · F6.8 · correo por Gmail (conexión aparte, remitente de AAA001 con respaldo de Resend, envío desde ficha y flujo con actividad); 30 pruebas nuevas; typecheck, lint, test (373/373) y build en verde; migración `integrations_gmail` aplicada con aprobación del usuario (comprobaciones y advisors sin avisos nuevos). Sin probar con Google real ni con sesión · commits `crm: F6.8 correo por Gmail (migración pendiente)` y `crm: F6.8 migración aplicada`.
- 2026-11-04 · Rearme de AAA001 y F7.3 · tools de texto borradas, agenda «Puesta en marcha» creada, correos de la reunión por Gmail con pruebas, panel de Tools sobre agendas y todo GHL fuera del código (código, rutas, variables, script y convivencia); typecheck, lint, test y build en verde. Sin push ni despliegue; F7.4 sin hacer · commit `crm: F7.3 sin GHL y correos de la reunión`.

- 2026-11-04 · Sin Gmail · revertida F6.8 salvo migración; correos de acceso y de la reunión por Resend; se conserva el aviso de correo fallido en `billing_events.error`; typecheck, lint, test y build en verde · commit `crm: quitar Gmail`.
- 2026-11-04 · Correo de la plataforma · Resend sustituido por SMTP de Gmail con `nodemailer` y contraseña de aplicación; sin probar contra Gmail real · commit `crm: correo de la plataforma por Gmail`.

## Resumen final
<!-- Lo escribe F8.1 -->
**Fecha:** 2026-11-03 · rama `crm-supabase` (sin push, sin merge, sin desplegar).

### Verificación final
1. `typecheck`, `lint`, `test` (**328/328**) y `build`: **en verde**.
2. `grep` de GHL: **530 líneas en 55 archivos**. Todas son la convivencia con GHL, que se retira en tareas [STOP] sin aprobar:
   - código y rutas que se borran en **F7.3** (`integrations/gohighlevel/**`, `webhooks/ghl/**`, `cron/ghl-sync`, `ghl-agency`, `ghl-calendar`, `gohighlevel`, `levy-calendar`, `levy-purchase`, `vercel.json`);
   - la convivencia de F5.2/F5.3/F6.7 (`calendar-tools`, `agent-*`, `flow-*`, `onboarding/meeting`);
   - el check `gohighlevel` y las claves `ghl_*` que limpia **F7.4**;
   - migraciones ya aplicadas, que no se reescriben;
   - el script de migración de F7.1.
3. `get_advisors`: **solo los 3 avisos previos** (`set_updated_at` sin `search_path`, protección de contraseñas filtradas apagada, `integration_secrets`/`platform_admins` sin políticas a propósito). Las **14 tablas nuevas** tienen RLS con políticas.
4. Aislamiento entre empresas automatizado:
   - `crm.test` (contactos, etapas, etiquetas, notas, tareas, campos);
   - `agenda.test` («A no ve ni toca agendas, citas, ofertas ni bloqueos de B»);
   - `google-calendar.test` (tokens propios por empresa);
   - `google-sync.test` (citas de otra empresa);
   - `flow-actions.test`, `billing.test`, `gate.test`, `webhook.test`, `levy-meeting.test`;
   - SQL: `supabase/tests/*_checks.sql` (FK compuestas y RLS).
5. **No hecho:** recorrer el panel con sesión (crear contacto, moverlo de etapa, crear agenda, ver huecos, agendar, mover y cancelar). El panel pide iniciar sesión y no introduzco contraseñas. Solo se comprobó que las rutas nuevas responden 401/403 sin sesión y que el build pasa. **Hazlo tú con tu usuario** en `npm run dev` antes del merge.
6. Este resumen.

### Qué quedó hecho
- **CRM propio** en `/clientes`:
  - etapas, etiquetas, campos personalizados, notas, tareas, actividad;
  - importar/exportar CSV y borrado GDPR;
  - ajustes del CRM;
  - el webhook de YCloud registra cada mensaje entrante.
- **Agenda propia:**
  - sección nueva en el menú (D4), vista semana/día, citas, bloqueos y configuración;
  - funciones SQL de reserva sin solapes;
  - huecos libres, recordatorios e inasistencias;
  - `crm-jobs` cada 5 min con pg_cron (job **apagado**).
- **Agente:** agenda con la Agenda propia (convive con GHL mientras exista una tool `ghl_calendar`).
- **Flujos:** acciones del CRM, disparo por etiqueta y conversión de acciones de GHL.
- **Google Calendar** por empresa: OAuth, copia de citas, ocupado de Google, borrados pendientes.
- **Stripe:**
  - tablas de facturación (5 empresas exentas);
  - webhook con dedupe y alta de empresa;
  - correo de acceso (Resend);
  - contacto en el CRM de AAA001;
  - corte por impago (lo entrante se guarda);
  - aviso «Reactiva tu suscripción»;
  - facturación en Negocio (Payment Link + Customer Portal) y consola de empresas.
- **Onboarding sin GHL:**
  - reunión sobre la agenda de AAA001;
  - `levy-activo` en su CRM;
  - Google Calendar en el asistente.
- **Script de migración de GHL** (dry-run por defecto).

### Qué no se pudo verificar
- **Google real:** OAuth, copia de eventos y ocupado. Probado con `fetch` simulado.
- **Stripe real:** webhook, Payment Link y Customer Portal. Probado con eventos firmados por el SDK, sin cuenta real.
- **Resend real.**
- **WhatsApp real:** recordatorios, corte por impago, agente agendando en la Agenda.
- **pg_cron → `crm-jobs`:** el job está creado pero apagado y faltan los secretos en Vault.
- **La interfaz con sesión** (paso 5).
- **Datos reales de GHL de AAA001:** el token guardado da 401 (F7.1 `[!]`).

### Lo que necesito de ti (pasos manuales)
1. ~~Token nuevo de GHL~~: descartado, no se usará GHL. Las etiquetas, etapas y citas que solo estaban en GHL no se migran.
2. ~~D1~~ resuelta: `agentelevi.com` es esta app; F6.5 hecha. Falta que el Payment Link redirija a `/bienvenida` (ver `DEPLOY_RUNBOOK.md`).
3. **D3:** plantilla aprobada de WhatsApp para recordatorios fuera de la ventana de 24 h. Sin ella, esos avisos se omiten. **D2** sigue con los valores por defecto: sin prueba gratis y 7 días de gracia.
4. **Variables en Vercel** (ver `DEPLOY_RUNBOOK.md`):
   - `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`, con la URI de redirección en Google Cloud;
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PAYMENT_LINK_IDS`, `STRIPE_PRICE_IDS`, `STRIPE_PAYMENT_LINK_URL`, `STRIPE_FIELD_COMPANY_NAME`, `BILLING_GRACE_DAYS`;
   - `RESEND_API_KEY` y `EMAIL_FROM`;
   - `LEVY_WORKSPACE_CODE` y `LEVY_MEETING_AGENDA_ID`.
5. **En Stripe:**
   - endpoint `/api/webhooks/stripe` con los eventos del runbook;
   - Customer Portal activado;
   - pedir el teléfono en el Payment Link;
   - un pago de prueba real antes de F7.3.
6. **En AAA001:** ~~crear la agenda de la reunión~~ hecho (2026-11-04). Falta poner `LEVY_MEETING_AGENDA_ID=8c84ef58-d7f2-4d93-a7d4-88605d1a67e5` en Vercel y en `.env`.
7. **Supabase Vault:** secretos `crm_jobs_url` y `crm_jobs_cron_secret`, y luego activar el job `levy-crm-jobs` (F7.5).
8. **Probar el panel** con tu sesión (paso 5) y revisar estas decisiones:
   - empresas sin suscripción quedan en «aviso», no bloqueadas;
   - lo encolado durante un bloqueo sale al reactivar;
   - textos propuestos para las tools de AAA001.
9. **Tareas [STOP] cuando tú digas:**
   - **F7.2:** migración real de AAA001;
   - **F7.3:** borrar GHL;
   - **F7.4:** migración destructiva;
   - **F7.5:** orden de salida (merge → F7.2 → despliegue → variables → job de pg_cron → prueba por WhatsApp).
10. **Google Cloud (F6.8):** activar la Gmail API y añadir el scope `gmail.send` (scope sensible: Google pide verificar la app en producción).
11. **Conectar el correo de AAA001** en Integraciones → Correo de Google: de ahí sale el correo de acceso.
12. Pendiente aparte, decisión tuya: `npm audit` avisa de vulnerabilidades en `next` y otras dependencias, anteriores a este trabajo.
