-- 0002 audit: append-only audit log and the internal writer used by triggers
-- and trusted database functions. The log lives in the private schema, which
-- the Data API does not expose; admins read it through admin_list_audit_events.

create table private.audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  -- No foreign key: audit rows must outlive profile changes.
  actor_id uuid,
  actor_role public.app_role,
  action text not null check (action in (
    'prescription.created',
    'prescription.updated',
    'prescription.evaluated',
    'alert.acknowledged',
    'prescription.signed',
    'prescription.cancelled',
    'patient.team_assigned',
    'care_team.member_added',
    'care_team.member_removed',
    'patient_chart.viewed'
  )),
  entity_type text not null check (entity_type in (
    'prescription', 'prescription_alert', 'patient', 'care_team'
  )),
  entity_id uuid not null,
  -- Identifier only. Names and clinical content never enter the audit log.
  patient_id uuid,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) < 2048)
);

create index audit_logs_entity_idx on private.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on private.audit_logs (actor_id, occurred_at desc);
create index audit_logs_patient_idx on private.audit_logs (patient_id, occurred_at desc);

alter table private.audit_logs enable row level security;
revoke all on private.audit_logs from public, anon, authenticated;

create or replace function private.audit_logs_block_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only'
    using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function private.audit_logs_block_mutation() from public, anon, authenticated;

create trigger audit_logs_no_update_delete
  before update or delete on private.audit_logs
  for each row execute function private.audit_logs_block_mutation();

create trigger audit_logs_no_truncate
  before truncate on private.audit_logs
  for each statement execute function private.audit_logs_block_mutation();

-- The actor is always derived from the verified JWT (auth.uid()) and is never a
-- parameter, so callers cannot attribute events to someone else.
create or replace function private.write_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_patient_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.app_role;
begin
  if v_actor is not null then
    select p.role into v_role from public.profiles p where p.id = v_actor;
  end if;

  insert into private.audit_logs (actor_id, actor_role, action, entity_type, entity_id, patient_id, metadata)
  values (v_actor, v_role, p_action, p_entity_type, p_entity_id, p_patient_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function private.write_audit(text, text, uuid, uuid, jsonb) from public, anon, authenticated;

-- Returns the names (never the values) of columns that changed between two row images.
create or replace function private.changed_columns(p_old jsonb, p_new jsonb, p_ignore text[] default '{}')
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(key order by key), '{}')
  from jsonb_object_keys(p_new) as key
  where not (key = any (p_ignore))
    and (p_old -> key) is distinct from (p_new -> key);
$$;

revoke all on function private.changed_columns(jsonb, jsonb, text[]) from public, anon, authenticated;
