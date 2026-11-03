-- Permisos explícitos del Data API para las tablas del CRM. En este proyecto
-- ya los da Supabase por defecto, pero desde 2026-10-30 los proyectos nuevos
-- no los conceden solos (ver el final de schema.sql). El acceso real lo
-- limitan las políticas RLS de 20261102200000_crm_core.sql.
--
-- Reversión: no hace falta; se van con las tablas.
grant select, insert, update, delete on
  public.crm_pipeline_stages,
  public.crm_tags,
  public.crm_contact_tags,
  public.crm_custom_fields,
  public.crm_contact_notes,
  public.crm_contact_tasks,
  public.crm_contact_activity
to authenticated, service_role;
