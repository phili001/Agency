-- Recordatorios e inasistencias por agenda (F4.1, de crm-levy
-- `seguimientos.py`). Aditivo: columnas con default. Apagados de fábrica: nadie
-- empieza a recibir mensajes por desplegar.
--
-- - reminder_*: aviso `reminder_hours_before` horas antes de la cita.
-- - no_show_*: aviso `no_show_hours_after` horas después de marcar «No asistió».
-- - *_message: texto propio (null = el de serie). Variables: {nombre},
--   {negocio}, {fecha}, {hora}, {servicio}.
-- - *_template: plantilla aprobada de WhatsApp para cuando la ventana de 24 h
--   está cerrada (decisión D3). Mientras no haya una, esos avisos se omiten y
--   se apunta el motivo en la cita.
--
-- Reversión:
--   alter table public.agendas drop column if exists reminder_enabled,
--     drop column if exists reminder_hours_before, drop column if exists reminder_message,
--     drop column if exists reminder_template, drop column if exists no_show_enabled,
--     drop column if exists no_show_hours_after, drop column if exists no_show_message,
--     drop column if exists no_show_template;
alter table public.agendas
  add column if not exists reminder_enabled boolean not null default false,
  add column if not exists reminder_hours_before integer not null default 24
    check (reminder_hours_before between 1 and 72),
  add column if not exists reminder_message text
    check (reminder_message is null or char_length(reminder_message) <= 1000),
  add column if not exists reminder_template text
    check (reminder_template is null or char_length(reminder_template) <= 512),
  add column if not exists no_show_enabled boolean not null default false,
  add column if not exists no_show_hours_after integer not null default 1
    check (no_show_hours_after between 0 and 72),
  add column if not exists no_show_message text
    check (no_show_message is null or char_length(no_show_message) <= 1000),
  add column if not exists no_show_template text
    check (no_show_template is null or char_length(no_show_template) <= 512);

create index if not exists idx_appointments_no_show_due
  on public.appointments (updated_at)
  where status = 'no_show' and no_show_sent_at is null;
