-- 0013 diagnoses: the patient's diagnostic history. Codes are real ICD-10-CM codes
-- used as labels on synthetic patients; nothing here is clinical guidance.
-- The app can read diagnoses but cannot write them directly: status changes and
-- description edits go through the two functions below, which lock the row, check
-- the caller and the expected version, keep an append-only revision, and write a
-- content-free audit row in the same transaction (so a failed audit write fails the change).

create type public.diagnosis_status as enum ('active', 'resolved');

create table public.diagnoses (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  icd10_code text not null check (icd10_code ~ '^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$'),
  description text not null check (char_length(btrim(description)) between 1 and 200),
  status public.diagnosis_status not null default 'active',
  recorded_on date not null,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  resolved_on date,
  resolved_by uuid references public.profiles (id) on delete restrict,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'resolved') = (resolved_on is not null)),
  check ((resolved_on is null) = (resolved_by is null)),
  check (resolved_on is null or resolved_on >= recorded_on)
);

create index diagnoses_patient_idx on public.diagnoses (patient_id, status, recorded_on desc);

create trigger diagnoses_set_updated_at
  before update on public.diagnoses
  for each row execute function private.set_updated_at();

-- Every version of a diagnosis, including the first. Append-only.
create table public.diagnosis_revisions (
  id uuid primary key default gen_random_uuid(),
  diagnosis_id uuid not null references public.diagnoses (id) on delete restrict,
  version integer not null check (version >= 1),
  status public.diagnosis_status not null,
  description text not null,
  resolved_on date,
  changed_by uuid references public.profiles (id) on delete restrict,
  changed_at timestamptz not null default now(),
  unique (diagnosis_id, version)
);

create or replace function private.diagnosis_revisions_block_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'diagnosis_revisions is append-only' using errcode = 'insufficient_privilege';
end;
$$;

revoke all on function private.diagnosis_revisions_block_mutation() from public, anon, authenticated;

create trigger diagnosis_revisions_no_update
  before update or delete on public.diagnosis_revisions
  for each row execute function private.diagnosis_revisions_block_mutation();

create trigger diagnosis_revisions_no_truncate
  before truncate on public.diagnosis_revisions
  for each statement execute function private.diagnosis_revisions_block_mutation();

-- Records version 1 when a diagnosis is created (seed or a future create function).
create or replace function private.diagnoses_initial_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.diagnosis_revisions (diagnosis_id, version, status, description, resolved_on, changed_by, changed_at)
  values (new.id, new.version, new.status, new.description, new.resolved_on, new.recorded_by, new.created_at);
  return null;
end;
$$;

revoke all on function private.diagnoses_initial_revision() from public, anon, authenticated;

create trigger diagnoses_initial_revision
  after insert on public.diagnoses
  for each row execute function private.diagnoses_initial_revision();

alter table public.diagnoses enable row level security;
alter table public.diagnosis_revisions enable row level security;
revoke all on public.diagnoses from anon, authenticated;
revoke all on public.diagnosis_revisions from anon, authenticated;
grant select on public.diagnoses to authenticated;
grant select on public.diagnosis_revisions to authenticated;

create policy diagnoses_select_care_team on public.diagnoses
  for select to authenticated
  using (private.is_care_team_member(patient_id));

create policy diagnosis_revisions_select_care_team on public.diagnosis_revisions
  for select to authenticated
  using (exists (
    select 1 from public.diagnoses d
    where d.id = diagnosis_id and private.is_care_team_member(d.patient_id)
  ));

-- Locks a diagnosis for a change by any active clinician on the patient's team.
-- Non-members get "not found" so the function does not reveal that a record exists.
create or replace function private.lock_team_diagnosis(p_diagnosis_id uuid, p_expected_version integer)
returns public.diagnoses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dx public.diagnoses;
begin
  select * into v_dx from public.diagnoses where id = p_diagnosis_id for update;
  if not found or not private.is_care_team_member(v_dx.patient_id) then
    raise exception 'Diagnosis not found' using errcode = 'no_data_found';
  end if;
  if not private.is_clinician() then
    raise exception 'Only clinicians can change diagnoses' using errcode = 'insufficient_privilege';
  end if;
  if v_dx.version <> p_expected_version then
    raise exception 'Diagnosis changed since it was loaded' using errcode = 'KE008';
  end if;
  return v_dx;
end;
$$;

revoke all on function private.lock_team_diagnosis(uuid, integer) from public, anon, authenticated;

create or replace function public.set_diagnosis_status(
  p_diagnosis_id uuid,
  p_status public.diagnosis_status,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dx public.diagnoses;
  v_revision_id uuid;
begin
  v_dx := private.lock_team_diagnosis(p_diagnosis_id, p_expected_version);
  if v_dx.status = p_status then
    raise exception 'Diagnosis already has this status' using errcode = 'KE009';
  end if;

  update public.diagnoses
     set status = p_status,
         resolved_on = case when p_status = 'resolved' then greatest(current_date, v_dx.recorded_on) end,
         resolved_by = case when p_status = 'resolved' then auth.uid() end,
         version = v_dx.version + 1
   where id = v_dx.id
  returning * into v_dx;

  insert into public.diagnosis_revisions (diagnosis_id, version, status, description, resolved_on, changed_by)
  values (v_dx.id, v_dx.version, v_dx.status, v_dx.description, v_dx.resolved_on, auth.uid())
  returning id into v_revision_id;

  perform private.write_audit(
    case when p_status = 'resolved' then 'diagnosis.resolved' else 'diagnosis.reopened' end,
    'diagnosis', v_dx.id, v_dx.patient_id,
    jsonb_build_object('version', v_dx.version, 'revision_id', v_revision_id)
  );

  return jsonb_build_object('id', v_dx.id, 'status', v_dx.status, 'version', v_dx.version);
end;
$$;

create or replace function public.update_diagnosis_description(
  p_diagnosis_id uuid,
  p_description text,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dx public.diagnoses;
  v_description text := btrim(coalesce(p_description, ''));
  v_revision_id uuid;
begin
  v_dx := private.lock_team_diagnosis(p_diagnosis_id, p_expected_version);
  if v_description = v_dx.description then
    return jsonb_build_object('id', v_dx.id, 'status', v_dx.status, 'version', v_dx.version);
  end if;

  update public.diagnoses
     set description = v_description,
         version = v_dx.version + 1
   where id = v_dx.id
  returning * into v_dx;

  insert into public.diagnosis_revisions (diagnosis_id, version, status, description, resolved_on, changed_by)
  values (v_dx.id, v_dx.version, v_dx.status, v_dx.description, v_dx.resolved_on, auth.uid())
  returning id into v_revision_id;

  perform private.write_audit(
    'diagnosis.updated', 'diagnosis', v_dx.id, v_dx.patient_id,
    jsonb_build_object('version', v_dx.version, 'revision_id', v_revision_id)
  );

  return jsonb_build_object('id', v_dx.id, 'status', v_dx.status, 'version', v_dx.version);
end;
$$;

revoke all on function public.set_diagnosis_status(uuid, public.diagnosis_status, integer) from public, anon;
revoke all on function public.update_diagnosis_description(uuid, text, integer) from public, anon;
grant execute on function public.set_diagnosis_status(uuid, public.diagnosis_status, integer) to authenticated;
grant execute on function public.update_diagnosis_description(uuid, text, integer) to authenticated;
