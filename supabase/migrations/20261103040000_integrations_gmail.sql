-- F6.8: proveedor `gmail` para enviar correo con la cuenta de Google de cada
-- empresa. Va aparte de `google_calendar`: se conecta y se desconecta por su
-- cuenta. Aditiva: solo amplía los check, no toca ninguna fila.
--
-- Reversión (solo si no hay filas de gmail):
--   alter table public.integrations drop constraint integrations_provider_check,
--     add constraint integrations_provider_check check (provider in ('ycloud', 'openai', 'gohighlevel', 'google_calendar'));
--   alter table public.integration_secrets drop constraint integration_secrets_provider_check,
--     add constraint integration_secrets_provider_check check (provider in ('openai', 'ycloud', 'gohighlevel', 'google_calendar'));
alter table public.integrations
  drop constraint if exists integrations_provider_check,
  add constraint integrations_provider_check
    check (provider in ('ycloud', 'openai', 'gohighlevel', 'google_calendar', 'gmail'));

alter table public.integration_secrets
  drop constraint if exists integration_secrets_provider_check,
  add constraint integration_secrets_provider_check
    check (provider in ('openai', 'ycloud', 'gohighlevel', 'google_calendar', 'gmail'));
