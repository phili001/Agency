-- Make new WhatsApp conversations start in human handoff mode.
-- Paste this in Supabase SQL Editor.

alter table public.conversations
alter column status set default 'pending_handoff';

alter table public.conversations
alter column ai_enabled set default false;

-- Optional but recommended while testing:
-- put current open conversations in handoff unless they were intentionally closed.
update public.conversations
set
  status = 'pending_handoff',
  ai_enabled = false
where status = 'open'
  and ai_enabled = true;
