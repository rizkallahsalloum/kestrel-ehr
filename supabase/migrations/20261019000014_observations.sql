-- 0014 observations: vital sign readings and lab results for synthetic patients.
-- Read-only to the care team; there is no app path that writes them (seeded only).
-- Ranges are plausibility limits for data entry, not clinical thresholds. The demo
-- status thresholds live in the app (src/features/vitals/thresholds.ts).

create table public.vital_readings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  recorded_at timestamptz not null,
  heart_rate integer not null check (heart_rate between 20 and 250),
  systolic integer not null check (systolic between 50 and 260),
  diastolic integer not null check (diastolic between 30 and 160),
  spo2 integer not null check (spo2 between 50 and 100),
  temperature_f numeric(4, 1) not null check (temperature_f between 90.0 and 110.0),
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (diastolic < systolic),
  unique (patient_id, recorded_at)
);

-- eAG is derived from HbA1c in the app, so only the measured value is stored.
create type public.lab_test as enum ('hba1c');

create table public.lab_results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  test public.lab_test not null,
  value numeric(4, 1) not null,
  unit text not null,
  collected_on date not null,
  recorded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (test <> 'hba1c' or (unit = '%' and value between 3.0 and 20.0)),
  unique (patient_id, test, collected_on)
);

alter table public.vital_readings enable row level security;
alter table public.lab_results enable row level security;
revoke all on public.vital_readings from anon, authenticated;
revoke all on public.lab_results from anon, authenticated;
grant select on public.vital_readings to authenticated;
grant select on public.lab_results to authenticated;

create policy vital_readings_select_care_team on public.vital_readings
  for select to authenticated
  using (private.is_care_team_member(patient_id));

create policy lab_results_select_care_team on public.lab_results
  for select to authenticated
  using (private.is_care_team_member(patient_id));
