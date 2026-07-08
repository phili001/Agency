# WhatsApp SaaS - ruta del curso

## Paso 1: base de trabajo

- Next.js, TypeScript, Tailwind y ESLint instalados.
- Dashboard inicial creado con datos mock.
- Navegacion base: Inbox, Agentes, Clientes, Integraciones y Observabilidad.

## Paso 2: Supabase

- SQL multi-tenant preparado en `supabase/schema.sql`.
- RLS habilitado para todas las tablas publicas.
- Cliente Supabase instalado en la app.
- Endpoint de salud agregado en `/api/health/supabase`.

## Sistema objetivo

- Inbox tipo WhatsApp Web para cada workspace.
- Agente IA configurable por cliente.
- Handoff humano para apagar/prender IA por conversacion.
- Buffer de mensajes antes de responder.
- Despacho de mensajes en cola via YCloud.
- Transcripcion de audios.
- Multi-tenant con Supabase.
- Webhooks oficiales de YCloud.
- Modelos via OpenAI.
- Agenda y leads en GoHighLevel.

## Estado actual

El dashboard ya usa datos reales de Supabase, tiene auth, inbox, mensajes,
handoff, agentes, prueba de prompt con OpenAI, workspace settings,
webhook YCloud inicial, buffer cron, entrega de mensajes queued y vista
de agencia inicial. El buffer tambien actualiza resumen y etiquetas del
contacto para observabilidad comercial. GoHighLevel ya tiene cron base
para sincronizar contactos. El preflight de produccion esta en
`/api/health/readiness` y el runbook en `DEPLOY_RUNBOOK.md`.

## Siguiente paso

Completar el paso de produccion:

- pegar el SQL incremental en Supabase
- agregar `YCLOUD_WEBHOOK_SECRET`, `CRON_SECRET` y `YCLOUD_API_KEY`
- agregar `GHL_API_KEY` y `location_id` en Integraciones > GoHighLevel
- hacer deploy a Vercel
- configurar webhook URL en YCloud
- probar el primer mensaje real de ida y vuelta
- probar que el contacto aparezca/actualice en GoHighLevel
