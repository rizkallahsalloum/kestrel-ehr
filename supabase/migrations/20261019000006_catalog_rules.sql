-- 0006 catalog and rules: fictional drug classes, medication catalog, and
-- illustrative safety rules. Read-only through the API; seeded by migrations/seed.

create table public.drug_classes (
  code text primary key check (code ~ '^DEMO-[A-Z0-9]{1,12}$'),
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger drug_classes_set_updated_at
  before update on public.drug_classes
  for each row execute function private.set_updated_at();

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  strength text not null check (char_length(strength) between 1 and 40),
  form text not null check (char_length(form) between 1 and 40),
  drug_class_code text not null references public.drug_classes (code) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, strength, form)
);

create index medications_class_idx on public.medications (drug_class_code);

create trigger medications_set_updated_at
  before update on public.medications
  for each row execute function private.set_updated_at();

create table public.interaction_rules (
  id uuid primary key default gen_random_uuid(),
  rule_code text not null unique check (rule_code ~ '^DEMO-R[0-9]{3}$'),
  rule_type public.rule_type not null,
  class_a text not null references public.drug_classes (code) on delete restrict,
  class_b text references public.drug_classes (code) on delete restrict,
  severity public.alert_severity not null,
  message text not null check (message like 'DEMO RULE%' and char_length(message) <= 300),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((rule_type = 'interaction_class') = (class_b is not null)),
  check (class_b is null or class_b <> class_a)
);

create index interaction_rules_class_a_idx on public.interaction_rules (class_a) where is_active;
create index interaction_rules_class_b_idx on public.interaction_rules (class_b) where is_active;

create trigger interaction_rules_set_updated_at
  before update on public.interaction_rules
  for each row execute function private.set_updated_at();

alter table public.drug_classes enable row level security;
alter table public.medications enable row level security;
alter table public.interaction_rules enable row level security;
revoke all on public.drug_classes from anon, authenticated;
revoke all on public.medications from anon, authenticated;
revoke all on public.interaction_rules from anon, authenticated;
grant select on public.drug_classes to authenticated;
grant select on public.medications to authenticated;
grant select on public.interaction_rules to authenticated;

create policy drug_classes_select on public.drug_classes
  for select to authenticated using ((select private.is_active_user()));

create policy medications_select on public.medications
  for select to authenticated using ((select private.is_active_user()));

create policy interaction_rules_select on public.interaction_rules
  for select to authenticated using ((select private.is_active_user()));
