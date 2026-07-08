# Alineacion con el curso

## Leccion revisada

`Video 05 - La App por Dentro + Deploy a Vercel`

La leccion espera que la app ya tenga una version funcional del dashboard y luego avance a produccion:

- levantar la app local con `npm run dev`
- entrar con usuario real
- recorrer el inbox
- responder mensajes
- dejar notas internas
- hacer handoff humano
- ver observabilidad por contacto
- configurar agentes
- conectar integraciones del workspace
- preparar deploy a Vercel
- conectar GitHub con auto-deploy
- conectar YCloud con webhooks
- probar ida y vuelta real de WhatsApp

## Lo que ya tenemos

- App Next.js + React + TypeScript funcionando.
- Supabase conectado con `.env.local`.
- Auth con login/logout.
- Modelo multi-tenant base con RLS.
- Workspace, contactos, agentes, conversaciones y mensajes reales.
- Inbox con lista de conversaciones y panel de mensajes.
- Cambio de chat sin recargar la pagina.
- Composer para respuesta manual guardando en `public.messages`.
- Nota interna guardada como mensaje `internal`.
- Handoff humano actualizando `conversations.status`.
- Toggle IA actualizando `conversations.ai_enabled`.
- Panel lateral de contacto.
- Observabilidad inicial: mensajes, notas, eventos, tokens y costo.
- Configuracion de agentes: nombre, modelo, temperatura, prompt y activo/inactivo.
- Prueba de prompt via OpenAI desde API route segura.
- Seccion Workspace: Integraciones, negocio, tools, plantillas, base y equipo.
- Webhook YCloud inicial para guardar inbound en Supabase.
- Buffer manual/cron-ready para generar respuestas IA y dejarlas en cola.
- Entrega manual/cron-ready para enviar mensajes queued por YCloud.
- Vista de agencia inicial con workspaces, miembros, conversaciones e integraciones.
- Autoetiquetado y resumen automatico del contacto desde el buffer IA.
- Sincronizacion base de contactos a GoHighLevel con ruta protegida.
- Endpoint preflight `/api/health/readiness` para validar envs, tablas y rutas.
- Runbook de deploy en `DEPLOY_RUNBOOK.md`.
- Health check en `/api/health/supabase`.

## Diferencias contra el curso

Todavia nos faltan piezas antes de decir que estamos al nivel de la leccion 05 completa:

- deploy a Vercel
- GitHub conectado a Vercel
- primer mensaje real de WhatsApp de ida y vuelta
- confirmar payload exacto de YCloud con una prueba real de la cuenta
- probar GoHighLevel con token privado y location real

## Sobre el repo del curso

El repo `Carlos-Dominguez-faber/whatsapp-saas` sirve como referencia fuerte. No conviene clonarlo encima de este proyecto porque ya tenemos datos reales, Supabase conectado y cambios propios.

Uso recomendado:

- compararlo por modulos
- copiar ideas de estructura cuando aporten
- tomar sus migraciones/cron/scripts como referencia
- adaptar YCloud, OpenAI, buffer, handoff y settings paso a paso

No hacer:

- reemplazar este repo completo sin backup
- pegar secrets del curso o de otra cuenta
- mezclar migraciones sin revisar RLS y tablas existentes

## Siguiente paso recomendado

Completar deploy y prueba real:

1. pegar SQL incremental en Supabase
2. agregar secrets `YCLOUD_WEBHOOK_SECRET`, `CRON_SECRET` y `YCLOUD_API_KEY`
3. deploy a Vercel
4. configurar webhook URL en YCloud
5. probar primer mensaje real de ida y vuelta
6. probar sync de contacto en GoHighLevel

Despues de eso seguimos con agenda real y oportunidades en GoHighLevel.
