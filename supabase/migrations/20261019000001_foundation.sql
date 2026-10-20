-- 0001 foundation: private schema, default privileges, shared trigger helpers, enums.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
-- Policies call private helper functions, which needs USAGE on the schema.
-- The schema is not exposed through the Data API (see supabase/config.toml).
grant usage on schema private to authenticated;

-- Supabase grants broad privileges on new public objects by default. Kestrel
-- grants everything explicitly instead, table by table and column by column.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

create type public.app_role as enum ('clinician', 'admin');
create type public.record_status as enum ('active', 'inactive', 'entered_in_error');
create type public.allergy_severity as enum ('mild', 'moderate', 'severe');
create type public.prescription_status as enum ('draft', 'signed', 'cancelled');
create type public.alert_severity as enum ('blocking', 'advisory');
create type public.rule_type as enum ('allergy_class', 'interaction_class');
create type public.dose_unit as enum ('mg', 'mcg', 'g', 'mL', 'tablet', 'capsule');
create type public.medication_route as enum ('oral', 'topical', 'inhaled', 'subcutaneous', 'intramuscular');
create type public.dose_frequency as enum (
  'once_daily',
  'twice_daily',
  'three_times_daily',
  'four_times_daily',
  'every_8_hours',
  'at_bedtime',
  'as_needed'
);
