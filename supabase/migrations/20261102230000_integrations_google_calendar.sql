-- `google_calendar` como proveedor de integraciones (conexión OAuth por
-- empresa) y de secretos (tokens cifrados). Aditivo: cada check se sustituye
-- por uno que admite lo mismo que antes más `google_calendar`, así que ninguna
-- fila existente deja de cumplirlo. Quitar `gohighlevel` es la tarea F7.4
-- [STOP], no esta.
--
-- Reversión (solo si no hay filas google_calendar):
--   alter table public.integrations drop constraint integrations_provider_check,
--     add constraint integrations_provider_check check (provider in ('ycloud', 'openai', 'gohighlevel'));
--   alter table public.integration_secrets drop constraint integration_secrets_provider_check,
--     add constraint integration_secrets_provider_check check (provider in ('openai', 'ycloud', 'gohighlevel'));
alter table public.integrations
  drop constraint if exists integrations_provider_check,
  add constraint integrations_provider_check
    check (provider in ('ycloud', 'openai', 'gohighlevel', 'google_calendar'));

alter table public.integration_secrets
  drop constraint if exists integration_secrets_provider_check,
  add constraint integration_secrets_provider_check
    check (provider in ('openai', 'ycloud', 'gohighlevel', 'google_calendar'));
