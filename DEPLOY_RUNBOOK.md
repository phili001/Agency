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

## 5. Cron manual durante pruebas

During the first Vercel test, cron scheduling is not registered in
`vercel.json` because the Hobby/Free plan can reject frequent cron jobs.

Trigger these manually after receiving a WhatsApp message:

- `{NEXT_PUBLIC_APP_URL}/api/cron/buffer?secret={CRON_SECRET}`
- `{NEXT_PUBLIC_APP_URL}/api/cron/deliver?secret={CRON_SECRET}`
- `{NEXT_PUBLIC_APP_URL}/api/cron/ghl-sync?secret={CRON_SECRET}`

Each route requires `CRON_SECRET`. Later, move these to Vercel Cron,
GitHub Actions, QStash, or another scheduler according to the production plan.

## 6. GoHighLevel

In Workspace > Integraciones > GoHighLevel, save:

- `location_id`
- `api_key_ref` as a reference label only

The real token must live in `GHL_API_KEY`.
