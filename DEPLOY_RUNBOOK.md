# Deploy runbook

## 1. Supabase

Run the incremental SQL in:

`supabase/next_workspace_assets_and_webhooks.sql`

This adds:

- `workspace_assets`
- `webhook_events`
- OpenAI provider defaults
- RLS policies for the new tables

## 2. Environment variables

Set these locally and in Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
YCLOUD_API_KEY=
YCLOUD_API_BASE=https://api.ycloud.com/v2
YCLOUD_WEBHOOK_SECRET=
CRON_SECRET=
GHL_API_KEY=
GHL_API_BASE=https://services.leadconnectorhq.com
```

Do not expose server-only keys as `NEXT_PUBLIC_`.

## 3. Preflight

Open:

`/api/health/readiness`

Required checks must be green before testing production. Recommended checks
cover YCloud and GoHighLevel.

## 4. YCloud

Use this webhook URL:

`{NEXT_PUBLIC_APP_URL}/api/webhooks/ycloud?secret={YCLOUD_WEBHOOK_SECRET}`

Enable inbound/outbound WhatsApp message events. If a custom domain is added
later, update the webhook URL in YCloud.

## 5. Buffer IA sin cron

La IA no depende de Vercel Cron. Cuando entra el primer mensaje de una racha
por WhatsApp, el webhook arranca un buffer por conversacion:

- Espera 20 segundos.
- Agrupa los mensajes que lleguen en esa ventana para ese usuario.
- Llama internamente a `/api/cron/buffer` para generar la respuesta.
- Llama internamente a `/api/cron/deliver` para enviarla por YCloud.

These internal routes still require `CRON_SECRET`. Keep `CRON_SECRET`
configured in Vercel so the delayed webhook task can authorize them.

Manual debug, only if you need to force a pending conversation:

- `{NEXT_PUBLIC_APP_URL}/api/cron/buffer?secret={CRON_SECRET}&conversationId={CONVERSATION_ID}&workspaceId={WORKSPACE_ID}`
- `{NEXT_PUBLIC_APP_URL}/api/cron/deliver?secret={CRON_SECRET}&conversationId={CONVERSATION_ID}&workspaceId={WORKSPACE_ID}`
- `{NEXT_PUBLIC_APP_URL}/api/cron/ghl-sync?secret={CRON_SECRET}`

If Vercel ever stops allowing the delayed background task, move only the two
internal calls above to QStash, Supabase Edge Functions, or another scheduler.

## 6. GoHighLevel

In Workspace > Integraciones > GoHighLevel, save:

- `location_id`
- `api_key_ref` as a reference label only

The real token must live in `GHL_API_KEY`.
