# Runbook de despliegue

## 1. Base de datos (Supabase)

Sobre un proyecto nuevo, ejecuta en el SQL editor y en este orden:

1. `supabase/schema.sql`
2. `supabase/next_workspace_assets_and_webhooks.sql`
3. `supabase/flow_builder.sql`
4. `supabase/self_service_onboarding.sql`
5. `supabase/set_default_handoff.sql`
6. Todo lo de `supabase/migrations/`, por orden de nombre

En **Authentication > URL Configuration** pon `NEXT_PUBLIC_APP_URL` como Site URL
y añade `{NEXT_PUBLIC_APP_URL}/auth/callback` a las Redirect URLs. Sin eso, el
enlace de recuperación de contraseña no vuelve a la app.

## 2. Variables de entorno

Copia `.env.example` y rellénalo en local y en Vercel. Son seis variables y
todas son obligatorias:

| Variable | Para qué |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente público con RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor. Nunca con prefijo `NEXT_PUBLIC_` |
| `INTEGRATION_ENCRYPTION_KEY` | Cifra las API keys de cada empresa |
| `CRON_SECRET` | Autoriza `/api/cron/*` y `/api/health/*` |
| `NEXT_PUBLIC_APP_URL` | Dominio público, sin barra final |
| `SUPERADMIN_EMAILS` | Correos con acceso a `/admin` |

Las claves de OpenAI, YCloud y GoHighLevel **no** son variables de entorno: se
guardan cifradas por empresa desde *Integraciones*, así cada cliente usa las
suyas.

> Si cambias `INTEGRATION_ENCRYPTION_KEY`, los secretos ya guardados dejan de
> poder descifrarse y hay que volver a introducirlos empresa por empresa.

## 3. Comprobación previa

Con el `CRON_SECRET` puesto:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://tudominio.com/api/health/readiness
```

Devuelve 200 cuando todo está listo y 503 si falta algo. También responde a un
superadmin con sesión abierta; para cualquier otro es 401 (expone qué variables
existen, así que no puede ser público).

## 4. Crons de Vercel

`vercel.json` declara tres. **Van una vez al día a propósito**: el plan Hobby
de Vercel rechaza el despliegue completo si cualquier cron corre más de una
vez al día (el build falla con "Hobby accounts are limited to daily cron
jobs"). Eso dejó producción congelada varios commits sin que se notara.

| Ruta | Frecuencia | Para qué |
| --- | --- | --- |
| `/api/cron/flows` | diario 07:00 | Reanuda pasos de espera de los flujos |
| `/api/cron/deliver` | diario 07:30 | Red de seguridad: envía lo que quedó en cola |
| `/api/cron/ghl-sync` | diario 08:00 | Sincroniza contactos con GoHighLevel |

Vercel manda el `CRON_SECRET` como `Authorization: Bearer` automáticamente si la
variable existe en el proyecto.

> **Una vez al día no sirve para vender seguimientos automáticos**: un paso
> "espera 2 horas" saldría al día siguiente. Dos formas de tener cadencia real:
>
> 1. **Plan Pro de Vercel** y cambiar los dos primeros a `*/5 * * * *`.
> 2. **Programador externo gratuito** (cron-job.org, QStash) que llame cada
>    5 minutos a estas dos URLs, sin tocar Vercel:
>    - `{NEXT_PUBLIC_APP_URL}/api/cron/flows?secret={CRON_SECRET}`
>    - `{NEXT_PUBLIC_APP_URL}/api/cron/deliver?secret={CRON_SECRET}`
>
> La respuesta de la IA no depende de esto: el webhook la dispara al momento.

## 5. YCloud

URL del webhook, una por empresa (el código sale de *Integraciones*):

```
{NEXT_PUBLIC_APP_URL}/api/webhooks/ycloud/{CODIGO_EMPRESA}/{SECRETO}
```

Activa los eventos de mensaje entrante y de estado. El secreto se genera al
conectar YCloud en el panel; si lo regeneras, actualiza la URL en YCloud.

## 6. Respuesta de la IA

La IA no espera al cron. Cuando entra el primer mensaje de una racha, el webhook
abre un buffer por conversación:

1. Espera 20 segundos y agrupa lo que llegue en esa ventana.
2. Llama a `/api/cron/buffer` para generar la respuesta.
3. Llama a `/api/cron/deliver` para enviarla por YCloud.

Ambas rutas exigen `CRON_SECRET`. El cron de `deliver` del punto 4 existe por si
esa llamada inmediata falla.

Para forzar una conversación a mano:

```
{NEXT_PUBLIC_APP_URL}/api/cron/buffer?secret={CRON_SECRET}&conversationId={ID}&workspaceId={ID}
{NEXT_PUBLIC_APP_URL}/api/cron/deliver?secret={CRON_SECRET}&conversationId={ID}&workspaceId={ID}
```

## 7. GoHighLevel

En *Workspace > Integraciones > GoHighLevel* se guardan el `location_id` y el
token de la empresa (cifrado). El botón de prueba crea un contacto y una cita
temporales y los borra al terminar; si el test se corta a la mitad, revisa que
no quede nada llamado `Prueba técnica Levy`.

### Alta automática tras el pago

Quien paga Levy en el funnel de la agencia recibe la cuenta solo:

1. El workflow **Crear cuenta** de GHL (formulario de bienvenida enviado) hace
   `POST {NEXT_PUBLIC_APP_URL}/api/webhooks/ghl/purchase` con
   `Authorization: Bearer {LEVY_PURCHASE_WEBHOOK_SECRET}` y, en *customData*,
   `ghlContactId`, `email`, `companyName`, `firstName` y `phone`.
2. La ruta lee el contacto en GHL y **solo sigue si tiene la etiqueta
   `cliente-levy`** (la pone el workflow de pago). Si el correo ya tiene
   empresa, no crea otra: solo genera un acceso nuevo.
3. Crea usuario (contraseña aleatoria que nadie conoce), empresa y agentes, y
   escribe en el contacto `levy_link_acceso` y `levy_workspace_id` y la
   etiqueta `levy-acceso-listo`, que dispara el correo de acceso en GHL.
4. El enlace pasa por `/auth/confirm` y abre **Crea tu contraseña**; al
   guardarla, el cliente entra directo a la configuración guiada.
5. Al terminar la configuración, Levy pone `levy-activo` en el contacto.

Requisitos: las tres variables de la sección *Alta automática* de
`.env.example`, los campos `levy_link_acceso`, `levy_workspace_id` y
`nombre_del_negocio` creados en GHL, y en Supabase *Auth > Email OTP
Expiration* a 86400 (24 h): el enlace de acceso usa esa caducidad.

### Reunión de puesta en marcha (paso 3 del onboarding)

Antes de pedirle las llaves, el cliente puede agendar 30 minutos con nosotros.
Ese calendario es **propio del onboarding**: no es el que AAA001 usa para
atender a sus clientes, así que hay que decir cuál es.

| Variable | Cuándo se pone |
| --- | --- |
| `LEVY_MEETING_CALENDAR_ID` | **Siempre.** Id del calendario de puesta en marcha. Sin él, el paso no ofrece horas. |
| `LEVY_MEETING_GHL_TOKEN` | Solo si ese calendario vive en otra subcuenta de GHL. |
| `LEVY_MEETING_GHL_LOCATION_ID` | Igual que el anterior: la location de esa subcuenta. |

Si no se ponen token y location, se heredan de `GHL_AGENCY_TOKEN` /
`GHL_AGENCY_LOCATION_ID` (el GoHighLevel del funnel de compra) y, si tampoco
están, de la conexión de GoHighLevel guardada en AAA001.

El id del calendario sale de GHL: *Calendars > el calendario > Settings*, o del
final de su enlace de reservas.

**Permisos del token.** El token tiene que ser de una *Private Integration* con
estos scopes, o GHL responde `The token is not authorized for this scope` y no
cargan las horas:

- View Calendars
- View Calendar Events y Edit Calendar Events
- View Contacts y Edit Contacts (la cita se crea sobre un contacto)
- View Locations

Ojo: `GHL_AGENCY_TOKEN` se creó para el funnel de compra (contactos y campos
personalizados) y **no suele tener los de calendario**. Si al heredarlo falla,
añádeselos en GHL o crea un token aparte y ponlo en `LEVY_MEETING_GHL_TOKEN`.
Cuando GHL rechaza por permisos, el log del servidor dice qué variable revisar:
`[levy-calendar] El token de ... no tiene permisos de calendario`.

Si falta `LEVY_MEETING_CALENDAR_ID`, el paso no desaparece: muestra el WhatsApp
de soporte y deja seguir. `LEVY_WORKSPACE_CODE` (por defecto `AAA001`) solo hace
falta si la empresa creadora de Levy tuviera otro código.

Los huecos libres se piden a GHL una vez por minuto y se guardan en memoria, y
la pantalla del onboarding los recibe ya pintados desde el servidor; si GHL
tarda más de 2,5 s, la página no espera y los carga la pantalla por su cuenta.

## 8. Antes de dar acceso a un cliente

- [ ] Preflight en verde
- [ ] Webhook de YCloud recibiendo (mándate un mensaje de prueba)
- [ ] Perfil de negocio completo, incluido el **Link de agenda**: la plantilla de
      flujo lo usa para cerrar la conversación y sin él ese mensaje sale sin CTA
- [ ] Crons visibles en Vercel > Cron Jobs
- [ ] Contraseña temporal cambiada por el cliente (las altas automáticas no
      tienen: el cliente crea la suya con el enlace de acceso)
