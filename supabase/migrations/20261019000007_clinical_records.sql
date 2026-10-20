-- 0007 clinical records: allergies and the patient's medication list.
-- Read-only through the API in the MVP. patient_medications rows are also
-- created by sign_prescription (migration 0009).

create table public.allergies (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  drug_class_code text references public.drug_classes (code) on delete restrict,
  substance_text text not null check (char_length(substance_text) between 1 and 120),
  reaction text check (char_length(reaction) <= 200),
  severity public.allergy_severity not null,
  status public.record_status not null default 'active',
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index allergies_patient_active_idx on public.allergies (patient_id) where status = 'active';

create trigger allergies_set_updated_at
  before update on public.allergies
  for each row execute function private.set_updated_at();

create table public.patient_medications (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  medication_id uuid not null references public.medications (id) on delete restrict,
  status public.record_status not null default 'active',
  dose_text text check (char_length(dose_text) <= 200),
  start_date date not null,
  end_date date,
  -- Foreign key to prescriptions is added in migration 0008.
  source_prescription_id uuid unique,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create index patient_medications_patient_active_idx on public.patient_medications (patient_id) where status = 'active';
create index patient_medications_medication_idx on public.patient_medications (medication_id);

create trigger patient_medications_set_updated_at
  before update on public.patient_medications
  for each row execute function private.set_updated_at();

alter table public.allergies enable row level security;
alter table public.patient_medications enable row level security;
revoke all on public.allergies from anon, authenticated;
revoke all on public.patient_medications from anon, authenticated;
grant select on public.allergies to authenticated;
grant select on public.patient_medications to authenticated;

-- Admins are deliberately excluded: no implicit access to clinical records.
create policy allergies_select_care_team on public.allergies
  for select to authenticated
  using (private.is_care_team_member(patient_id));

create policy patient_medications_select_care_team on public.patient_medications
  for select to authenticated
  using (private.is_care_team_member(patient_id));
