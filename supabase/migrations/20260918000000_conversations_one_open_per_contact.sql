-- Una sola conversación abierta por contacto.
--
-- Problema: el webhook de YCloud y el de GoHighLevel hacían "¿existe
-- conversación? no → crear". Cuando dos avisos del mismo contacto llegaban en
-- el mismo segundo (el mensaje y su acuse, o dos reintentos), los dos creaban
-- una, y el inbox mostraba el chat duplicado.
--
-- 1) Fusiona los duplicados que ya existen: se queda la conversación con
--    actividad más reciente y todo lo que apuntaba a las otras pasa a ella.
-- 2) Índice único parcial: imposible volver a tener dos abiertas. El código
--    captura el conflicto (23505) y reutiliza la que ganó la carrera.

begin;

create temporary table conversation_merges on commit drop as
with ranked as (
  select
    id,
    workspace_id,
    contact_id,
    row_number() over (
      partition by workspace_id, contact_id
      order by last_message_at desc nulls last, created_at desc, id desc
    ) as rn
  from public.conversations
  where status <> 'closed'
),
keepers as (
  select workspace_id, contact_id, id as keeper_id
  from ranked
  where rn = 1
)
select r.id as dupe_id, k.keeper_id
from ranked r
join keepers k using (workspace_id, contact_id)
where r.rn > 1;

-- Todo lo que colgaba de la duplicada pasa a la conversación que se conserva.
update public.messages m
set conversation_id = cm.keeper_id
from conversation_merges cm
where m.conversation_id = cm.dupe_id;

update public.usage_events u
set conversation_id = cm.keeper_id
from conversation_merges cm
where u.conversation_id = cm.dupe_id;

update public.flow_runs fr
set conversation_id = cm.keeper_id
from conversation_merges cm
where fr.conversation_id = cm.dupe_id;

update public.flow_events fe
set conversation_id = cm.keeper_id
from conversation_merges cm
where fe.conversation_id = cm.dupe_id;

update public.flow_answer_reviews far
set conversation_id = cm.keeper_id
from conversation_merges cm
where far.conversation_id = cm.dupe_id;

-- La conservada hereda el estado más útil: si alguna de las fusionadas tenía
-- la IA encendida, se mantiene encendida.
update public.conversations c
set ai_enabled = true
from conversation_merges cm
join public.conversations d on d.id = cm.dupe_id
where c.id = cm.keeper_id
  and d.ai_enabled = true;

delete from public.conversations c
using conversation_merges cm
where c.id = cm.dupe_id;

-- El candado. Solo entre abiertas: una conversación cerrada puede convivir
-- con una nueva del mismo contacto.
create unique index if not exists conversations_one_open_per_contact
on public.conversations (workspace_id, contact_id)
where status <> 'closed';

commit;
