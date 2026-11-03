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
- Extensiones a 2026-11-02: instaladas `supabase_vault` (esquema `vault`), `pgcrypto`, `uuid-ossp`, `pg_stat_statements`, `btree_gist` (esquema `extensions`, F1.3); disponibles sin instalar `pg_cron`, `pg_net` (F4.3).

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
- **D1** ¿`agentelevy.com` es esta app o una landing aparte? → afecta a F6.5 (`/bienvenida`).
- **D2** Precios (mensual/anual), prueba gratis y días de gracia → por defecto: sin prueba, 7 días de gracia; los ids de precio van por variable de entorno.
- **D3** Plantilla de WhatsApp aprobada para recordatorios fuera de la ventana de 24 h (nombre por workspace) → mientras, se registran como omitidos.

## Decisiones tomadas
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

## Tareas

### F0 — Preparación
- [x] F0.1 Crear rama `crm-supabase`; leer `AGENTS.md`, `PROMPT_CRM_SUPABASE.md` y el inventario de GHL con graphify; anotar aquí cualquier diferencia con el inventario.
- [x] F0.2 Instalar `stripe` y la librería mínima que haga falta para Google (preferir `fetch` directo a la API REST si basta). Añadir variables nuevas a `.env.example` y `DEPLOY_RUNBOOK.md`.
- ~~F0.3~~ Eliminada: `btree_gist` se instala en F1.3 y `pg_cron`/`pg_net` en F4.3 (no activar `pg_net`, que permite HTTP saliente desde la base, antes de usarla).

### F1 — Modelo de datos del CRM (aditivo)
- [x] F1.1 Decidir y anotar aquí cómo conviven `crm_tags` con `contacts.automation_labels` y `metadata.ai_tags` (sin romper triggers de flujo). Propuesta tras F0.1: `crm_tags` aparte; `automation_labels` sigue siendo marca interna del sistema (no se muestra como etiqueta); `ai_tags` se muestra como sugerencia que el operador puede convertir en etiqueta. (dep: F0.1)
- [x] F1.2 Migración: `crm_pipeline_stages` (+ siembra para los 5 workspaces y, para los nuevos, con **trigger `after insert on workspaces`** en la base, que cubre `workspaces.ts` y `admin-companies.ts`), columnas nuevas de `contacts`, `crm_tags`, `crm_contact_tags`, `crm_custom_fields`, `crm_contact_notes`, `crm_contact_tasks`, `crm_contact_activity`, con RLS. Tipos regenerados, advisors limpios. (dep: F1.1)
- [x] F1.3 Migración: extensión `btree_gist`; `agendas` (con `closed_dates date[] default '{}'` para festivos), `appointments` (con exclusión anti-solape), `schedule_blocks`, `offered_slots`, `google_event_deletions`, con RLS. (dep: F0.1)
- [ ] F1.4 Migración: funciones `book_appointment` y `reschedule_appointment` + pruebas SQL (solape rechazado, hora no ofrecida rechazada, reagendar atómico, workspace ajeno rechazado) ejecutadas con `execute_sql` dentro de una transacción con `rollback`. Las funciones `security definer` llevan `set search_path = ''` y nombres calificados. (dep: F1.3)
- [ ] F1.5 Migración: `integrations.provider` admite `google_calendar` (sin quitar `gohighlevel`). (dep: F0.1)

### F2 — Lógica del CRM y la Agenda
- [ ] F2.1 **Ampliar** el `src/lib/timezones.ts` existente con las utilidades puras de `ghl-calendar.ts` (`isValidTimeZone`, `zonedStartOfDay`, …), que `ghl-calendar.ts` pasa a importar; sin romper los imports actuales del navegador; con pruebas. (dep: F0.1)
- [ ] F2.2 `src/lib/crm/` contactos, etapas, etiquetas, campos (validación por tipo), notas, tareas, actividad + pruebas + prueba de aislamiento. (dep: F1.2)
- [ ] F2.3 `src/lib/agenda/slots.ts` portado de `agenda.py` (horario, servicios, festivos `closed_dates`, bloqueos, citas, repartir/espaciar) — lógica pura con pruebas extensas (zonas horarias, cambio de horario de verano, bordes del día, aviso mínimo, festivos). (dep: F2.1)
- [ ] F2.4 `src/lib/agenda/` ofrecer, agendar, reagendar, cancelar, confirmar, marcar, bloqueos (sobre las funciones SQL) + traducción de errores + pruebas. (dep: F1.4, F2.3)
- [ ] F2.5 Import/export CSV y borrado RGPD de contacto (apunta eventos de Google por borrar). (dep: F2.2, F1.3)

### F3 — Google Calendar por workspace
- [ ] F3.1 `src/lib/integrations/google-calendar.ts`: OAuth (state firmado con workspace y caducidad), tokens cifrados, refresco, error permanente, listCalendars, freeBusy, eventos con id determinista + pruebas con fetch simulado. (dep: F1.5)
- [ ] F3.2 Rutas `app/api/integrations/google-calendar/{connect,callback,status,calendars,disconnect}` (owner/admin) + pruebas. (dep: F3.1)
- [ ] F3.3 Copia a Google (`push`) y ocupado (`push_and_busy`) integrados en `src/lib/agenda` + cola de pendientes y borrados. (dep: F3.1, F2.4)

### F4 — Jobs y recordatorios
- [ ] F4.1 `src/lib/agenda/reminders.ts` portado de `seguimientos.py` (idempotente, ventana 24 h, plantilla o «omitido») + pruebas. (dep: F2.4)
- [ ] F4.2 `app/api/cron/crm-jobs` (lotes: Google pendiente, borrados, recordatorios, inasistencias, purga de ofertas, gracia de facturación) + pruebas. (dep: F3.3, F4.1)
- [ ] F4.3 Migración: extensiones `pg_cron` y `pg_net`; job cada 5 min llamando a `crm-jobs`, con URL y secreto en Supabase Vault. **Se crea desactivado** (`cron.alter_job(..., active := false)`) y se activa en F7.5 tras desplegar. Documentar cómo pausarlo. (dep: F4.2)

### F5 — Agente, flujos y panel sin GHL
- [ ] F5.0 Refactor **sin cambio de comportamiento**: sacar de `cron/buffer/route.ts` el runtime de calendario (`buildCalendarRuntime`, `runCalendarTool`, `buildCalendarToolDefinitions`, respuestas directas y saneado) a `src/lib/agenda/agent-tools.ts`, aún sobre GHL, con pruebas de las protecciones actuales (no afirmar cita sin confirmación de la tool, no inventar disponibilidad). (dep: F0.1)
- [ ] F5.1 `lib/calendar-tools.ts` a agendas (lee formato viejo) + pruebas. (dep: F2.4)
- [ ] F5.2 Calendario del agente sobre `src/lib/agenda`, `offered_slots` por conversación, tools `reagendar_cita` y `cancelar_cita`, protecciones conservadas + pruebas. **Coexistencia**: si el workspace aún tiene una tool `ghl_calendar` activa, el agente sigue usando GHL hasta F7.2 (si no, AAA001 se queda sin agenda al desplegar). (dep: F5.0, F5.1)
- [ ] F5.3 Flujos: `crm_action` (+ conversión de `ghl_action`), flow-builder con desplegables, **implementar** el disparo `tag` en `flow-engine.ts` (hoy no existe) al etiquetar desde panel, flujo o agente + pruebas. (dep: F2.2)
- [ ] F5.4 `ycloud-webhook` sin `syncContactToGoHighLevel`. Sustituto de `webhooks/ghl/send-message`: antes de crearlo, comprobar si alguien externo lo seguirá llamando sin GHL; si sí, crearlo con un nombre que no choque con la `api/flows/start` del panel (p. ej. `webhooks/flows/trigger`) y anotar la decisión; si no, solo se borra en F7.3. (dep: F2.2)
- [ ] F5.5 Panel **Contactos** (lista, kanban, ficha, CSV, RGPD) + `sidebar-nav`. (dep: F2.2, F2.5)
- [ ] F5.6 Panel **Agenda** (semana/día, citas, bloqueos, configuración de agendas). (dep: F2.4, F3.2)
- [ ] F5.7 Ajustes del CRM (etapas, etiquetas, campos) e **Integraciones → Google Calendar** en lugar de GHL. (dep: F2.2, F3.2)
- [ ] F5.8 Métricas, `panel-data`, `inbox-panel` (lateral con etapa, etiquetas y próxima cita), portada y `health/readiness` sin GHL. (dep: F5.2, F5.5)

### F6 — Stripe y onboarding de Levy
- [ ] F6.1 Migración: `workspace_billing` (5 workspaces actuales con `billing_exempt = true`) y `billing_events`. (dep: F0.1)
- [ ] F6.2 `src/lib/billing/` (cliente Stripe, `getWorkspaceBillingState`) + `src/lib/email.ts` (Resend) + pruebas. (dep: F6.1, F0.2)
- [ ] F6.3 `app/api/webhooks/stripe` completo + contacto en el CRM de AAA001 + pruebas con eventos firmados. (dep: F6.2, F2.2)
- [ ] F6.4 Bloqueo por impago en ycloud-webhook, buffer, flows, deliver y crm-jobs + pantalla «Reactiva tu suscripción» + banner de aviso. (dep: F6.2)
- [ ] F6.5 Página `/bienvenida` con «Reenviar». **Requiere D1.** (dep: F6.3)
- [ ] F6.6 Facturación en el panel (Customer Portal, botón de pago con `client_reference_id`) y consola de empresas. (dep: F6.3)
- [ ] F6.7 Reunión de puesta en marcha sobre la agenda de AAA001; wizard y tours sin GHL; `markAgencyContactActive` → etiqueta `levy-activo` en AAA001. (dep: F2.4, F2.2)

### F7 — Migración de datos y limpieza
- [ ] F7.1 Script `scripts/migrate-ghl-to-crm.ts` (solo AAA001, idempotente, `--dry-run` por defecto): etiquetas y etapa desde GHL para los 160 contactos con `ghl_contact_id`, tool `ghl_calendar` «Consultoría Levi» → agenda, citas futuras del calendario GHL → `appointments`, el flujo con `ghl_action` → `crm_action`, y propuesta de texto nuevo para las tools «Agendar en GoHighLevel» y «Consultar disponibilidad». Ejecutar **solo en dry-run** y apuntar el resultado aquí. Necesita en local la clave de cifrado de `integration_secrets` y acceso a la API de GHL: si no están, marcar `[!]` y pedírmelas. (dep: F5.1, F2.4, F5.3)
- [ ] **[STOP]** F7.2 Ejecutar la migración real de AAA001 (escribe en producción).
- [ ] **[STOP]** F7.3 Borrar código, rutas y variables de GHL (`ghl-agency.ts`, `webhooks/ghl/**` incluida `purchase` + `levy-purchase.ts`, `integrations/gohighlevel/**`, `cron/ghl-sync`, `vercel.json`). **Solo después de F6.3 verificada** con un pago real de prueba (hoy `webhooks/ghl/purchase` es la vía de venta). (dep: F6.3, F7.2)
- [ ] **[STOP]** F7.4 Migración destructiva: quitar `gohighlevel` del check de `integrations`, borrar su fila y su secreto, limpiar claves `ghl_*` de `contacts.metadata`, convertir assets `ghl_calendar` restantes.
- [ ] **[STOP]** F7.5 Orden de salida (lo hago yo contigo): merge de `crm-supabase` → F7.2 → despliegue → variables en Vercel → activar el job de `pg_cron` de F4.3 → comprobar AAA001 por WhatsApp. El merge es todo o nada: no desplegar la rama sin F7.2 hecha o la coexistencia de F5.2 probada.

### F8 — Verificación final
- [ ] F8.1 Ejecutar la «Verificación final» de `PROMPT_CRM_SUPABASE.md` y escribir el resumen abajo. Cuando esta tarea esté `[x]` (o solo queden tareas [STOP] o `[!]` que dependan del usuario), **detén el loop**.

## Registro de iteraciones
<!-- Una línea por iteración: fecha · tarea · resultado · commit -->
- 2026-11-02 · Revisión del plan (aprobada) · ajustes: F0.3 repartida en F1.3/F4.3, siembra de etapas por trigger, festivos, F2.1 amplía `timezones.ts`, nueva F5.0 (refactor de `buffer`), coexistencia GHL en F5.2, F5.3 implementa el disparo `tag`, F5.4 revisada, F7.1 ampliada, F7.3 tras F6.3, nueva F7.5 [STOP] · sin código.
- 2026-11-02 · F0.1 · rama `crm-supabase` creada; diferencias anotadas en «Estado real vs. inventario»; typecheck, lint y test (106/106) en verde · commit `crm: F0.1 rama y revisión del inventario`.
- 2026-11-02 · F0.2 · `stripe@19.3.0`; Google irá por `fetch` a la API REST (sin librería); variables nuevas en `.env.example` y `DEPLOY_RUNBOOK.md` (GHL marcadas como deprecadas, se borran en F7.3); typecheck, lint y test (106/106) en verde. Nota: `npm audit` avisa de vulnerabilidades previas en `next` (crítica), `postcss`, `sharp` y `nanoid`, ajenas a esta tarea: actualizar Next queda fuera de este plan y lo decide el usuario · commit `crm: F0.2 dependencias y variables`.
- 2026-11-02 · F1.1 · decisión de convivencia de etiquetas apuntada en «Decisiones tomadas» (sin código; typecheck, lint y test en verde) · commit `crm: F1.1 decisión de etiquetas`.
- 2026-11-02 · F1.2 · migraciones `crm_core` y `crm_core_grants` aplicadas a producción (aditivas; ensayo previo en transacción deshecha); 7 tablas con RLS, 5 columnas nuevas en `contacts`, 30 etapas sembradas, trigger de siembra; pruebas SQL de aislamiento (FK compuestas y RLS como usuario) en verde; advisors de seguridad sin avisos nuevos (siguen los 3 previos: `set_updated_at` search_path, protección de contraseñas filtradas, 2 tablas sin políticas a propósito); `schema.sql` y `database.types.ts` actualizados; typecheck, lint y test (106/106) en verde · commit `crm: F1.2 modelo de datos del CRM`.
- 2026-11-02 · F1.3 · migración `agenda_core` aplicada a producción (aditiva; ensayo previo en transacción deshecha): `btree_gist`, 5 tablas con RLS y grants explícitos, anti-solape por agenda; 13 comprobaciones SQL en verde antes y después de aplicar; advisors de seguridad sin avisos nuevos; `schema.sql` y `database.types.ts` actualizados; typecheck, lint y test (106/106) en verde · commit `crm: F1.3 agendas y citas`.

## Resumen final
<!-- Lo escribe F8.1 -->
