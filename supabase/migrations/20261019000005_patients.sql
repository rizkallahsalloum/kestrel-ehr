-- 0005 patients: synthetic demographics, care-team access helper, admin
-- reassignment RPC, chart-view logging and the admin audit reader.

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  mrn text not null unique check (mrn ~ '^SYN-[0-9]{6}$'),
  given_name text not null check (char_length(given_name) between 1 and 80),
  family_name text not null check (char_length(family_name) between 1 and 80),
  date_of_birth date not null check (date_of_birth >= date '1900-01-01'),
  sex text not null check (sex in ('female', 'male', 'intersex', 'unknown')),
  care_team_id uuid not null references public.care_teams (id) on delete restrict,
  is_synthetic boolean not null default true check (is_synthetic),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patients_care_team_idx on public.patients (care_team_id);
create index patients_name_idx on public.patients (family_name, given_name);

create trigger patients_set_updated_at
  before update on public.patients
  for each row execute function private.set_updated_at();

-- The single source of truth for patient-level access. Every patient-scoped
-- table delegates to this function, so access always follows the patient's team.
create or replace function private.is_care_team_member(p_patient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.patients pt
    where pt.id = p_patient_id
      and pt.care_team_id in (select private.my_care_team_ids())
  );
$$;

revoke all on function private.is_care_team_member(uuid) from public, anon;
grant execute on function private.is_care_team_member(uuid) to authenticated;

alter table public.patients enable row level security;
revoke all on public.patients from anon, authenticated;
-- Read-only for everyone through the API. Reassignment goes through
-- admin_assign_patient_team; patient registration is seed-only in the MVP.
grant select on public.patients to authenticated;

create policy patients_select_care_team on public.patients
  for select to authenticated
  using (care_team_id in (select private.my_care_team_ids()));

create policy patients_select_admin on public.patients
  for select to authenticated
  using ((select private.is_admin()));

create or replace function private.audit_patients()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.care_team_id is distinct from old.care_team_id then
    perform private.write_audit('patient.team_assigned', 'patient', new.id, new.id,
      jsonb_build_object('from_care_team_id', old.care_team_id, 'to_care_team_id', new.care_team_id));
  end if;
  return new;
end;
$$;

revoke all on function private.audit_patients() from public, anon, authenticated;

create trigger patients_audit
  after update on public.patients
  for each row execute function private.audit_patients();

create or replace function public.admin_assign_patient_team(p_patient_id uuid, p_care_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only admins can reassign patients'
      using errcode = 'insufficient_privilege';
  end if;

  update public.patients set care_team_id = p_care_team_id where id = p_patient_id;
  if not found then
    raise exception 'Patient not found' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.admin_assign_patient_team(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_patient_team(uuid, uuid) to authenticated;

-- Called by trusted server code before a chart is rendered (SELECT does not
-- fire row triggers). Refuses callers outside the patient's care team, so view
-- events cannot be forged for other patients.
create or replace function public.log_patient_access(p_patient_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_care_team_member(p_patient_id) then
    raise exception 'Not authorized for this patient'
      using errcode = 'insufficient_privilege';
  end if;
  perform private.write_audit('patient_chart.viewed', 'patient', p_patient_id, p_patient_id, '{}'::jsonb);
end;
$$;

revoke all on function public.log_patient_access(uuid) from public, anon;
grant execute on function public.log_patient_access(uuid) to authenticated;

create or replace function public.admin_list_audit_events(
  p_limit integer default 50,
  p_before_id bigint default null
)
returns table (
  id bigint,
  occurred_at timestamptz,
  actor_id uuid,
  actor_role public.app_role,
  action text,
  entity_type text,
  entity_id uuid,
  patient_id uuid,
  metadata jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only admins can read the audit log'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select a.id, a.occurred_at, a.actor_id, a.actor_role, a.action, a.entity_type, a.entity_id, a.patient_id, a.metadata
    from private.audit_logs a
    where p_before_id is null or a.id < p_before_id
    order by a.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

revoke all on function public.admin_list_audit_events(integer, bigint) from public, anon;
grant execute on function public.admin_list_audit_events(integer, bigint) to authenticated;
