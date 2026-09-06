# Levy

Panel multi-tenant de agentes de WhatsApp con IA. Cada empresa (workspace) tiene
su propio número, sus agentes, su base de conocimiento y su bandeja de entrada,
con traspaso a una persona cuando la IA no debe seguir.

## Qué hace

- **Inbox por empresa.** Conversaciones de WhatsApp en tres vistas: las que
  responde la IA, las que esperan a una persona (handoff) y las que están dentro
  de un flujo de onboarding.
- **Agentes IA con roles.** Un router reparte cada mensaje entre el agente de
  información, el de ventas (setter) y el de citas. Cada uno con su prompt,
  reglas, restricciones y herramientas.
- **Flujos conversacionales.** Constructor de pasos (mensaje, pregunta con
  validación por IA, opciones, espera, acción en GoHighLevel, webhook, traspaso)
  con revisión humana de las respuestas que la IA marca como dudosas.
- **Integraciones por empresa.** YCloud (WhatsApp), OpenAI y GoHighLevel, con las
  claves cifradas en base de datos (AES-256-GCM), nunca en variables globales.
- **Handoff automático.** Si el contacto lo pide, si la IA no sabe responder o si
  promete un humano, la conversación pasa sola a la bandeja de personas.

## Stack

Next.js 16 (App Router, Server Components) · React 19 · Tailwind v4 ·
Supabase (Postgres + Auth + RLS) · OpenAI · YCloud · GoHighLevel.

> Esta versión de Next.js trae cambios de API respecto a versiones anteriores.
> Antes de tocar código, lee la guía correspondiente en
> `node_modules/next/dist/docs/`.

## Arrancar en local

```bash
npm install
cp .env.example .env.local   # rellena los valores
npm run dev
```

La app queda en `http://localhost:3000`. Las cuentas no se crean solas: un
superadmin (`SUPERADMIN_EMAILS`) crea la empresa y el usuario desde `/admin`.

## Base de datos

El esquema vive en `supabase/`. Aplícalo en este orden sobre un proyecto nuevo:

1. `schema.sql` — tablas base, RLS y políticas.
2. `next_workspace_assets_and_webhooks.sql` — assets de workspace y eventos.
3. `flow_builder.sql` — flujos, ejecuciones y eventos de flujo.
4. `self_service_onboarding.sql` y `set_default_handoff.sql`.
5. Todo lo de `supabase/migrations/`, por orden de nombre.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir |

## Despliegue

Ver [DEPLOY_RUNBOOK.md](DEPLOY_RUNBOOK.md): variables de entorno, crons de
Vercel, URL del webhook de YCloud y comprobación previa.

## Estructura

```
src/app/            Rutas (App Router) y endpoints de API
  api/cron/         Procesos periódicos: buffer IA, entrega, flujos, GHL
  api/webhooks/     Entrada de YCloud y GoHighLevel
src/components/     UI de cliente (inbox, constructor de flujos, ajustes)
src/lib/            Dominio: motor de flujos, handoff, integraciones, auth
supabase/           Esquema SQL y migraciones
```
