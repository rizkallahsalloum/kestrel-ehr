-- Synthetic seed data for Kestrel EHR. Every name, MRN, drug, class and rule
-- is fictional. Identifiers must match scripts/fixtures.ts.
-- Run by `pnpm db:seed:test` after the Auth users exist. Idempotent.

-- Profiles are created by the auth trigger; set roles and status here.
update public.profiles set role = 'admin' where id = 'ad000000-0000-4000-8000-000000000001';
update public.profiles set is_active = false where id = 'c0000000-0000-4000-8000-000000000001';

insert into public.care_teams (id, name) values
  ('7a000000-0000-4000-8000-000000000001', 'Team Kestrel North (synthetic)'),
  ('7b000000-0000-4000-8000-000000000001', 'Team Kestrel South (synthetic)')
on conflict (id) do nothing;

insert into public.care_team_members (care_team_id, profile_id) values
  ('7a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('7a000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002'),
  ('7a000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001'),
  ('7b000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001')
on conflict do nothing;

insert into public.patients (id, mrn, given_name, family_name, date_of_birth, sex, care_team_id) values
  ('9a000000-0000-4000-8000-000000000001', 'SYN-000101', 'Rowan', 'Testcase', '1968-04-12', 'female', '7a000000-0000-4000-8000-000000000001'),
  ('9a000000-0000-4000-8000-000000000002', 'SYN-000102', 'Elliot', 'Samplewood', '1985-09-30', 'male', '7a000000-0000-4000-8000-000000000001'),
  ('9a000000-0000-4000-8000-000000000003', 'SYN-000103', 'Morgan', 'Fixture', '1999-01-05', 'unknown', '7a000000-0000-4000-8000-000000000001'),
  ('9b000000-0000-4000-8000-000000000001', 'SYN-000201', 'Jordan', 'Mockridge', '1952-11-23', 'male', '7b000000-0000-4000-8000-000000000001'),
  ('9b000000-0000-4000-8000-000000000002', 'SYN-000202', 'Casey', 'Placeholder', '2004-06-17', 'female', '7b000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.drug_classes (code, name) values
  ('DEMO-ALPHA', 'Demo class Alpha (fictional)'),
  ('DEMO-BETA', 'Demo class Beta (fictional)'),
  ('DEMO-GAMMA', 'Demo class Gamma (fictional)'),
  ('DEMO-DELTA', 'Demo class Delta (fictional)')
on conflict (code) do nothing;

insert into public.medications (id, name, strength, form, drug_class_code, is_active) values
  ('3e000000-0000-4000-8000-000000000001', 'Zentoril', '10 mg', 'tablet', 'DEMO-ALPHA', true),
  ('3e000000-0000-4000-8000-000000000002', 'Calvexa', '250 mg', 'capsule', 'DEMO-BETA', true),
  ('3e000000-0000-4000-8000-000000000003', 'Morivane', '5 mg', 'tablet', 'DEMO-GAMMA', true),
  ('3e000000-0000-4000-8000-000000000004', 'Tessaline', '20 mg', 'tablet', 'DEMO-DELTA', true),
  ('3e000000-0000-4000-8000-000000000005', 'Ploxidrin', '100 mg', 'tablet', 'DEMO-BETA', true),
  ('3e000000-0000-4000-8000-000000000006', 'Retirex', '1 mg', 'tablet', 'DEMO-DELTA', false)
on conflict (id) do nothing;

insert into public.interaction_rules (rule_code, rule_type, class_a, class_b, severity, message) values
  ('DEMO-R001', 'allergy_class', 'DEMO-ALPHA', null, 'blocking',
   'DEMO RULE: recorded allergy to demo class Alpha. Illustrative only, not clinical guidance.'),
  ('DEMO-R002', 'allergy_class', 'DEMO-BETA', null, 'blocking',
   'DEMO RULE: recorded allergy to demo class Beta. Illustrative only, not clinical guidance.'),
  ('DEMO-R003', 'interaction_class', 'DEMO-GAMMA', 'DEMO-DELTA', 'advisory',
   'DEMO RULE: demo classes Gamma and Delta flagged together. Illustrative only, not clinical guidance.'),
  ('DEMO-R004', 'interaction_class', 'DEMO-BETA', 'DEMO-GAMMA', 'advisory',
   'DEMO RULE: demo classes Beta and Gamma flagged together. Illustrative only, not clinical guidance.')
on conflict (rule_code) do nothing;

insert into public.allergies (id, patient_id, drug_class_code, substance_text, reaction, severity, status, recorded_by) values
  ('a1000000-0000-4000-8000-000000000001', '9a000000-0000-4000-8000-000000000001', 'DEMO-ALPHA',
   'Demo class Alpha agents', 'Synthetic rash (example)', 'severe', 'active', 'a0000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000002', '9a000000-0000-4000-8000-000000000001', 'DEMO-BETA',
   'Demo class Beta agents', 'Synthetic nausea (example)', 'mild', 'inactive', 'a0000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000003', '9b000000-0000-4000-8000-000000000001', 'DEMO-GAMMA',
   'Demo class Gamma agents', 'Synthetic hives (example)', 'moderate', 'active', 'b0000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.patient_medications (id, patient_id, medication_id, status, dose_text, start_date, end_date, recorded_by) values
  ('5d000000-0000-4000-8000-000000000001', '9a000000-0000-4000-8000-000000000001', '3e000000-0000-4000-8000-000000000004',
   'active', '20 mg oral once daily', '2026-01-10', null, 'a0000000-0000-4000-8000-000000000001'),
  ('5d000000-0000-4000-8000-000000000002', '9a000000-0000-4000-8000-000000000001', '3e000000-0000-4000-8000-000000000002',
   'inactive', '250 mg oral twice daily', '2025-03-01', '2025-03-14', 'a0000000-0000-4000-8000-000000000001'),
  ('5d000000-0000-4000-8000-000000000003', '9a000000-0000-4000-8000-000000000002', '3e000000-0000-4000-8000-000000000003',
   'active', '5 mg oral once daily', '2026-02-01', null, 'a0000000-0000-4000-8000-000000000002'),
  ('5d000000-0000-4000-8000-000000000004', '9b000000-0000-4000-8000-000000000001', '3e000000-0000-4000-8000-000000000001',
   'active', '10 mg oral once daily', '2026-03-15', null, 'b0000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;
