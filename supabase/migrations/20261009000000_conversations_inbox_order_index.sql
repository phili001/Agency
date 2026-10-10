-- El inbox pide cada pocos segundos las 100 conversaciones mas recientes de
-- una empresa (`where workspace_id = ? order by last_message_at desc nulls
-- last limit 100`). Con solo idx_conversations_workspace_id Postgres tiene que
-- leer todas las de la empresa y ordenarlas en cada consulta; con este indice
-- lee las 100 primeras en orden.
--
-- Reversion: drop index if exists public.idx_conversations_workspace_last_message;
create index if not exists idx_conversations_workspace_last_message
  on public.conversations (workspace_id, last_message_at desc nulls last);
