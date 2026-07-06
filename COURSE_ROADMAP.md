# WhatsApp SaaS - ruta del curso

## Paso 1: base de trabajo

- Next.js, TypeScript, Tailwind y ESLint instalados.
- Dashboard inicial creado con datos mock.
- Navegacion base: Inbox, Agentes, Clientes, Integraciones y Observabilidad.

## Sistema objetivo

- Inbox tipo WhatsApp Web para cada workspace.
- Agente IA configurable por cliente.
- Handoff humano para apagar/prender IA por conversacion.
- Buffer de mensajes antes de responder.
- Transcripcion de audios.
- Multi-tenant con Supabase.
- Webhooks oficiales de YCloud.
- Modelos via OpenRouter.
- Agenda y leads en GoHighLevel.

## Siguiente paso

Disenar e implementar el modelo de datos multi-tenant:

- `workspaces`
- `workspace_members`
- `contacts`
- `conversations`
- `messages`
- `agents`
- `integrations`
- `usage_events`

Cada tabla debe quedar con RLS desde el inicio.
