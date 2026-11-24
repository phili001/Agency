# Verificación de la app en Google (solo Calendar)

Objetivo: que **cualquier cuenta de Google** pueda conectar su Google Calendar a Levy sin el límite de
100 usuarios de prueba y sin la pantalla «Google no ha verificado esta aplicación».

Permisos que pide Levy (`src/lib/integrations/google-calendar.ts`):

| Scope | Tipo | Para qué |
|---|---|---|
| `calendar.readonly` | Sensible | Leer el ocupado del calendario para no ofrecer huecos ya comprometidos |
| `calendar.events` | Sensible | Crear, mover y cancelar las citas agendadas desde Levy |

Los dos son **sensibles, no restringidos** → no hace falta la auditoría de seguridad
CASA. Solo la verificación de marca + verificación de scopes sensibles.

---

## 0. Antes de empezar

- [ ] App desplegada en el dominio de producción (`NEXT_PUBLIC_APP_URL`, p. ej. `https://agentelevi.com`).
- [ ] La portada `/` es pública, describe qué hace Levy y enlaza a `/privacidad` y `/terminos` (ya lo hace).
- [ ] `/privacidad` desplegada con el apartado «5. Datos de tu cuenta de Google» (declaración de Uso limitado).
- [ ] El dominio está verificado en **Google Search Console** con una cuenta que sea
      **Propietaria o Editora del proyecto de Google Cloud** (si no, Google no lo acepta).

## 1. Google Cloud Console → Google Auth Platform

### Branding
- Nombre de la app: **Levy** (igual que en la web; no uses «Google» en el nombre).
- Correo de asistencia: `info@agentelevi.com`.
- Logo: 120×120 px, cuadrado. *Subir logo obliga a verificar la marca; es lo que queremos.*
- Página principal: `https://agentelevi.com/`
- Política de privacidad: `https://agentelevi.com/privacidad`
- Términos: `https://agentelevi.com/terminos`
- Dominios autorizados: `agentelevi.com`
- Contacto del desarrollador: un correo que leas a diario (Google escribe ahí).

### Audience
- Tipo de usuario: **Externo**.
- Estado: pulsar **Publish app** (pasa de «Testing» a «In production»).

### Data access
Añadir exactamente los dos scopes de arriba (ni uno más: cada scope extra retrasa
o hace fallar la revisión). Justificaciones para pegar:

**calendar.readonly**
> Levy is a booking assistant for small businesses. Before offering appointment slots
> to a customer over WhatsApp, Levy reads the business owner's free/busy information
> from their Google Calendar so it never offers a time the owner is already busy.
> Levy only reads busy periods; event content is not stored or shown to third parties.

**calendar.events**
> When a customer books, reschedules or cancels an appointment through Levy, Levy
> creates, updates or deletes the matching event in the business owner's Google
> Calendar so their calendar always reflects their real agenda. Levy only modifies
> events it created itself.

## 2. Vídeo de demostración (YouTube, «No listado»)

En inglés o con subtítulos en inglés, 2–4 min. Debe verse:

1. La URL de la app en la barra del navegador (dominio de producción).
2. Iniciar sesión en Levy → **Integraciones** → «Conectar Google».
3. La **pantalla de consentimiento de Google completa**: nombre «Levy», los dos
   permisos de Calendar, y la URL de la barra con el `client_id` visible (hacer zoom).
4. Aceptar y volver a Levy con Google conectado.
5. `calendar.readonly`: poner un evento «Ocupado» en Google Calendar y mostrar que
   Levy ya no ofrece ese hueco.
6. `calendar.events`: agendar una cita (por WhatsApp o desde **Agenda**) y mostrar que
   aparece en Google Calendar; luego reagendarla/cancelarla y mostrar el cambio.
7. Desconectar Google desde el panel.

## 3. Enviar y seguir

- **Verification Center** → «Prepare for verification» → rellenar y enviar.
- Plazo habitual: verificación de marca 2–3 días hábiles; scopes sensibles de unos días
  a varias semanas.
- Responder **rápido** a los correos de Google (Trust & Safety). Si piden cambios,
  suelen ser: texto de privacidad, vídeo sin `client_id` visible o scopes de más.

## Mientras se verifica

Con la app ya publicada («In production») pero sin verificar, cualquier cuenta puede
conectarse, pero:
- verá el aviso «Google no ha verificado esta aplicación» (hay que pulsar
  *Configuración avanzada → Ir a Levy*), y
- hay un **tope de 100 usuarios** nuevos en total hasta que se apruebe.

> Gmail queda fuera a propósito: los correos salen por SMTP (Hostinger). No añadir
> `gmail.send` ni la Gmail API al proyecto de Google Cloud.
