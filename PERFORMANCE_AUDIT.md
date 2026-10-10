# Auditoría de rendimiento — 2026-10-09

Next 16.2.10 (App Router, Turbopack, Segment Cache), React 19.2, `@supabase/ssr` 0.12,
sin librería de caché cliente. Todas las secciones del panel eran Server Components
dinámicos que renderizaban un único `AppShell` de 1.350 líneas.

Las cifras marcadas como **estimadas** salen de contar llamadas en el código, no de
mediciones en producción. Las **medidas** salen del build local.

## Cuellos de botella encontrados (por impacto)

1. **Prefetch completo de 12 secciones en cada carga.** Los enlaces del sidebar tenían
   `prefetch` (= `true`). En Next 16 eso renderiza en el servidor la página dinámica
   entera. Cada carga del panel en producción disparaba ~13 renders de `AppShell`
   (1 visible + 12 precargas), cada uno con 15–25 consultas. Además esas precargas
   se reutilizaban hasta 5 minutos, así que se podían ver datos anteriores a un cambio.
2. **Polling del inbox cada 3,5 s sin condiciones.** Seguía con la pestaña oculta:
   ~1.030 invocaciones/hora por pestaña abierta, ~9 llamadas a Supabase cada una
   (incluida una a Auth), en 5 etapas secuenciales. Cada ciclo re-renderizaba la
   bandeja aunque no hubiera cambios.
3. **`isPlatformAdmin` recorría `auth.admin.listUsers`** (hasta 20 páginas de 100
   usuarios) en cada render para cualquier usuario que no fuera superadmin, aunque el
   `app_metadata` ya venía fresco de `auth.getUser()`.
4. **Cascada en el dashboard:** después del lote principal había 7 consultas en
   serie (perfiles de miembros, revisiones, handoffs, flow runs, mensajes, métricas,
   checklist). En total, ~12 viajes secuenciales a Supabase antes de pintar.
5. **Consultas que no se usaban:** las 4 consultas de "vista agencia" (incluidas
   *todas* las conversaciones de todas las empresas, sin límite y cortadas a 1.000
   filas por PostgREST, por lo que el conteo era incorrecto) corrían en todas las
   secciones; miembros, con una llamada a Auth por persona, se pedían en el
   dashboard sin mostrarse; `syncDefaultAgentPrompts` bloqueaba todas las páginas.
6. **Bundle único:** cada ruta descargaba los mismos componentes cliente (inbox,
   constructor de flujos, ajustes, supabase-js): 125,6 KB gzip por ruta.

## Cambios implementados

| Cambio | Archivos |
|---|---|
| Layout compartido `(panel)`: el sidebar, la sesión y la lista de empresas se resuelven una vez; en navegación interna solo se renderiza la página. Skeleton dentro del contenido, el sidebar no desaparece. URLs sin cambios. | `src/app/(panel)/layout.tsx`, `loading.tsx`, `src/lib/panel-context.ts` |
| Cada sección carga solo sus datos y sus componentes cliente. | `src/app/(panel)/*/page.tsx`, `src/components/panel/*` |
| Prefetch completo solo por intención (hover, foco, toque). `staleTimes.static` de 300 s a 30 s. | `src/components/panel/sidebar-nav.tsx`, `next.config.ts` |
| Dashboard en 2 lotes paralelos; vista agencia con conteos `head` (arregla el tope de 1.000 filas). | `src/app/(panel)/page.tsx` |
| `isPlatformAdmin` confía en el `app_metadata` del usuario recién validado. | `src/lib/platform-admin.ts` |
| `syncDefaultAgentPrompts` va en paralelo y solo se releen los agentes si actualizó algo. Ya no corre en Clientes ni en Observabilidad. | `src/lib/panel-data.ts` |
| Inbox: el polling se pausa con la pestaña oculta y refresca al volver; backoff 3,5 s → 10 s sin cambios; si la respuesta no cambia, no se toca el estado; descarta respuestas viejas; no repite al montar lo que acaba de llegar del servidor; las acciones del usuario devuelven el ritmo rápido. | `src/components/inbox-panel.tsx` |
| Endpoint del inbox: revisiones y handoffs entran en el mismo lote (5 → 4 etapas). El permiso se sigue comprobando antes de leer. | `src/app/api/inbox/snapshot/route.ts` |
| supabase-js se carga al terminar el tour, no en cada página. | `src/components/guided-tour.tsx` |
| Índice propuesto para el orden del inbox. **No aplicado.** | `supabase/migrations/20261009000000_conversations_inbox_order_index.sql` |

## Medido (build local)

JS de componentes cliente por ruta, gzip (sin el runtime de Next/React):

| Ruta | Antes | Después |
|---|---|---|
| `/` Inbox | 125,6 KB | 100,4 KB |
| `/agentes` (y resto de ajustes) | 125,6 KB | 109,3 KB |
| `/flujos` | 125,6 KB | 36,1 KB |
| `/clientes`, `/observabilidad` | 125,6 KB | 27,7 KB |

## Estimado (contando llamadas en el código)

| Métrica | Antes | Después |
|---|---|---|
| Renders en servidor por carga del panel (prod) | ~13 | 1 + los que el usuario señale con el ratón |
| Viajes secuenciales a Supabase antes de pintar el dashboard | ~12 (+ páginas de `listUsers`) | 5 |
| Llamadas a Supabase al navegar a otra sección | 15–25 + listUsers | getUser + 2 + las de la sección |
| Polling con la pestaña oculta | ~1.030/h | 0 |
| Polling visible sin actividad | ~1.030/h | ~370/h |
| Etapas secuenciales por ciclo de polling | 5 | 4 |

No hay línea base de LCP, INP ni latencia SQL en producción: hace falta medirlas con
Vercel Speed Insights o Analytics y con `pg_stat_statements` en Supabase.

## Pendientes recomendados

1. **Supabase Realtime para el inbox.** Es lo que de verdad elimina el polling:
   suscribirse a `messages` y `conversations` filtrando por `workspace_id`, y pedir
   el snapshot solo cuando llega un evento. Necesita publicar esas tablas en
   `supabase_realtime` y revisar que las políticas RLS de SELECT sirvan para
   Realtime. Es un cambio de base de datos, así que queda para una decisión aparte.
2. **Proxy (antes middleware) para refrescar la sesión.** No existe `src/proxy.ts`.
   Los Server Components no pueden escribir cookies, así que con el access token
   caducado cada render vuelve a refrescar sin poder guardar el resultado. Supabase
   recomienda el proxy. Añade una invocación por petición, pero evita refrescos
   repetidos: hay que valorarlo.
3. **`getClaims()` en lugar de `getUser()`** si el proyecto usa claves JWT
   asimétricas: valida el token sin llamar a Auth. Cambia la semántica de sesión
   revocada, así que necesita una decisión explícita.
4. **Aplicar el índice** `idx_conversations_workspace_last_message` después de
   comprobar con `explain analyze` que el planificador lo usa.
5. **Snapshot incremental:** hoy cada cambio devuelve los 300 mensajes de la
   conversación abierta. Se podría pedir solo lo posterior al último id conocido,
   pero los mensajes también se actualizan (estado de envío), así que hace falta
   una columna `updated_at` fiable.
6. **Perfiles de miembros:** Equipo hace una llamada a Auth por miembro. Con
   equipos grandes conviene guardar nombre y email en una tabla de perfiles.
