-- 0008 prescriptions: drafts, system-generated alerts, clinician decisions.
-- Users may create and edit their own drafts through column-level grants.
-- Status changes happen only through the functions in migration 0009.

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  medication_id uuid not null references public.medications (id) on delete restrict,
  prescriber_id uuid not null references public.profiles (id) on delete restrict,
  dose_amount numeric(10, 3) not null check (dose_amount > 0),
  dose_unit public.dose_unit not null,
  route public.medication_route not null,
  frequency public.dose_frequency not null,
  quantity integer not null check (quantity > 0 and quantity <= 1000),
  refills smallint not null default 0 check (refills between 0 and 5),
  duration_days integer check (duration_days > 0 and duration_days <= 365),
  start_date date not null,
  instructions text check (char_length(instructions) <= 500),
  status public.prescription_status not null default 'draft',
  version integer not null default 1 check (version >= 1),
  idempotency_key uuid not null,
  last_evaluated_version integer,
  signed_by uuid references public.profiles (id) on delete restrict,
  signed_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete restrict,
  cancelled_at timestamptz,
  cancel_reason text check (char_length(cancel_reason) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prescriber_id, idempotency_key),
  check ((status = 'signed') = (signed_at is not null and signed_by is not null)),
  check ((status = 'cancelled') = (cancelled_at is not null and cancelled_by is not null)),
  check (last_evaluated_version is null or last_evaluated_version <= version)
);

create index prescriptions_patient_idx on public.prescriptions (patient_id, created_at desc);
create index prescriptions_prescriber_idx on public.prescriptions (prescriber_id);
create index prescriptions_medication_idx on public.prescriptions (medication_id);

alter table public.patient_medications
  add constraint patient_medications_source_prescription_fkey
  foreign key (source_prescription_id) references public.prescriptions (id) on delete restrict;

create trigger prescriptions_set_updated_at
  before update on public.prescriptions
  for each row execute function private.set_updated_at();

-- Enforces the draft lifecycle for every writer, including definer functions:
-- inserts always start as version-1 drafts, content edits bump the version,
-- identity columns never change, and non-draft rows are immutable.
create or replace function private.prescriptions_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_content_changed boolean := false;
  v_check_medication boolean := false;
  v_check_start_date boolean := false;
begin
  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.version := 1;
    new.last_evaluated_version := null;
    new.signed_by := null;
    new.signed_at := null;
    new.cancelled_by := null;
    new.cancelled_at := null;
    new.cancel_reason := null;
    v_check_medication := true;
    v_check_start_date := true;
  else
    if old.status <> 'draft' then
      raise exception 'Prescription is no longer a draft' using errcode = 'KE001';
    end if;

    if new.patient_id <> old.patient_id
      or new.prescriber_id <> old.prescriber_id
      or new.idempotency_key <> old.idempotency_key
      or new.created_at <> old.created_at then
      raise exception 'Immutable prescription fields cannot change' using errcode = 'insufficient_privilege';
    end if;

    v_content_changed :=
      (new.medication_id, new.dose_amount, new.dose_unit, new.route, new.frequency, new.quantity,
       new.refills, new.duration_days, new.start_date, new.instructions)
      is distinct from
      (old.medication_id, old.dose_amount, old.dose_unit, old.route, old.frequency, old.quantity,
       old.refills, old.duration_days, old.start_date, old.instructions);

    if new.status <> old.status then
      if v_content_changed or new.status not in ('signed', 'cancelled') or new.version <> old.version then
        raise exception 'Invalid prescription status transition' using errcode = 'KE001';
      end if;
    elsif v_content_changed then
      new.version := old.version + 1;
    else
      new.version := old.version;
    end if;

    v_check_medication := new.medication_id is distinct from old.medication_id;
    v_check_start_date := new.status = 'draft' and new.start_date is distinct from old.start_date;
  end if;

  if v_check_medication and not exists (
    select 1 from public.medications m where m.id = new.medication_id and m.is_active
  ) then
    raise exception 'Medication is not active in the catalog' using errcode = 'KE006';
  end if;

  if v_check_start_date and new.start_date not between current_date - 30 and current_date + 30 then
    raise exception 'Start date must be within 30 days of today' using errcode = 'KE005';
  end if;

  return new;
end;
$$;

revoke all on function private.prescriptions_guard() from public, anon, authenticated;

create trigger prescriptions_guard
  before insert or update on public.prescriptions
  for each row execute function private.prescriptions_guard();

create or replace function private.audit_prescriptions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_audit('prescription.created', 'prescription', new.id, new.patient_id,
      jsonb_build_object('version', new.version));
  elsif new.status <> old.status then
    perform private.write_audit(
      case new.status when 'signed' then 'prescription.signed' else 'prescription.cancelled' end,
      'prescription', new.id, new.patient_id, jsonb_build_object('version', new.version));
  elsif new.version <> old.version then
    perform private.write_audit('prescription.updated', 'prescription', new.id, new.patient_id,
      jsonb_build_object(
        'version', new.version,
        'changed_fields', to_jsonb(private.changed_columns(
          to_jsonb(old), to_jsonb(new), array['updated_at', 'version', 'last_evaluated_version']))
      ));
  end if;
  return new;
end;
$$;

revoke all on function private.audit_prescriptions() from public, anon, authenticated;

create trigger prescriptions_audit
  after insert or update on public.prescriptions
  for each row execute function private.audit_prescriptions();

create table public.prescription_alerts (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions (id) on delete restrict,
  prescription_version integer not null check (prescription_version >= 1),
  rule_id uuid not null references public.interaction_rules (id) on delete restrict,
  severity public.alert_severity not null,
  message text not null,
  allergy_id uuid references public.allergies (id) on delete restrict,
  patient_medication_id uuid references public.patient_medications (id) on delete restrict,
  -- Set when a re-evaluation of the same version no longer finds the condition.
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(allergy_id, patient_medication_id) = 1)
);

create unique index prescription_alerts_identity_idx on public.prescription_alerts
  (prescription_id, prescription_version, rule_id, (coalesce(allergy_id, patient_medication_id)));
create index prescription_alerts_rule_idx on public.prescription_alerts (rule_id);
create index prescription_alerts_allergy_idx on public.prescription_alerts (allergy_id) where allergy_id is not null;
create index prescription_alerts_patient_medication_idx on public.prescription_alerts (patient_medication_id)
  where patient_medication_id is not null;

create table public.prescription_safety_decisions (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null unique references public.prescription_alerts (id) on delete restrict,
  decided_by uuid not null references public.profiles (id) on delete restrict,
  decision text not null default 'acknowledged' check (decision = 'acknowledged'),
  reason text check (char_length(reason) <= 300),
  created_at timestamptz not null default now()
);

create index prescription_safety_decisions_decided_by_idx on public.prescription_safety_decisions (decided_by);

create or replace function private.audit_safety_decisions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prescription_id uuid;
  v_version integer;
  v_patient_id uuid;
begin
  select a.prescription_id, a.prescription_version, p.patient_id
    into v_prescription_id, v_version, v_patient_id
  from public.prescription_alerts a
  join public.prescriptions p on p.id = a.prescription_id
  where a.id = new.alert_id;

  perform private.write_audit('alert.acknowledged', 'prescription_alert', new.alert_id, v_patient_id,
    jsonb_build_object('prescription_id', v_prescription_id, 'version', v_version));
  return new;
end;
$$;

revoke all on function private.audit_safety_decisions() from public, anon, authenticated;

create trigger prescription_safety_decisions_audit
  after insert on public.prescription_safety_decisions
  for each row execute function private.audit_safety_decisions();

alter table public.prescriptions enable row level security;
alter table public.prescription_alerts enable row level security;
alter table public.prescription_safety_decisions enable row level security;
revoke all on public.prescriptions from anon, authenticated;
revoke all on public.prescription_alerts from anon, authenticated;
revoke all on public.prescription_safety_decisions from anon, authenticated;

grant select on public.prescriptions to authenticated;
-- Column-level grants: status, version, evaluation and signing columns can
-- only be written by the definer functions in migration 0009.
grant insert (
  patient_id, medication_id, prescriber_id, dose_amount, dose_unit, route, frequency,
  quantity, refills, duration_days, start_date, instructions, idempotency_key
) on public.prescriptions to authenticated;
grant update (
  medication_id, dose_amount, dose_unit, route, frequency,
  quantity, refills, duration_days, start_date, instructions
) on public.prescriptions to authenticated;
grant select on public.prescription_alerts to authenticated;
grant select on public.prescription_safety_decisions to authenticated;

create policy prescriptions_select_care_team on public.prescriptions
  for select to authenticated
  using (private.is_care_team_member(patient_id));

create policy prescriptions_insert_own_draft on public.prescriptions
  for insert to authenticated
  with check (
    prescriber_id = (select auth.uid())
    and status = 'draft'
    and (select private.is_clinician())
    and private.is_care_team_member(patient_id)
  );

create policy prescriptions_update_own_draft on public.prescriptions
  for update to authenticated
  using (
    prescriber_id = (select auth.uid())
    and status = 'draft'
    and private.is_care_team_member(patient_id)
  )
  with check (
    prescriber_id = (select auth.uid())
    and status = 'draft'
    and private.is_care_team_member(patient_id)
  );

create policy prescription_alerts_select_care_team on public.prescription_alerts
  for select to authenticated
  using (exists (
    select 1 from public.prescriptions p
    where p.id = prescription_id and private.is_care_team_member(p.patient_id)
  ));

create policy prescription_safety_decisions_select_care_team on public.prescription_safety_decisions
  for select to authenticated
  using (exists (
    select 1
    from public.prescription_alerts a
    join public.prescriptions p on p.id = a.prescription_id
    where a.id = alert_id and private.is_care_team_member(p.patient_id)
  ));
