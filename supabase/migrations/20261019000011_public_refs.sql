-- 0011 public refs: opaque, random URL references for patients and prescriptions,
-- so no internal id (and no name or MRN) appears in a URL. The reference is not
-- derived from the id and carries no meaning. The app cannot write it: it is not
-- in any insert or update column grant, and new rows get it from a trigger.

-- Ten characters from a 32-letter alphabet (no i, l, o, u), drawn from the random
-- bytes of gen_random_uuid(). The UUID's version and variant bytes are skipped,
-- so every character comes from a fully random byte: 50 bits per reference.
create or replace function private.new_public_ref()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := '0123456789abcdefghjkmnpqrstvwxyz';
  v_bytes bytea := uuid_send(gen_random_uuid());
  v_ref text := '';
  v_index integer;
begin
  foreach v_index in array array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11] loop
    v_ref := v_ref || substr(v_alphabet, (get_byte(v_bytes, v_index) % 32) + 1, 1);
  end loop;
  return v_ref;
end;
$$;

revoke all on function private.new_public_ref() from public, anon, authenticated;

-- Existing rows get their reference from the volatile default while the column is
-- added (one value per row, no UPDATE, so no row triggers fire and nothing else changes).
alter table public.patients add column public_ref text not null default private.new_public_ref();
alter table public.patients alter column public_ref drop default;
alter table public.patients add constraint patients_public_ref_format check (public_ref ~ '^[0-9a-hjkmnp-tv-z]{10}$');
alter table public.patients add constraint patients_public_ref_key unique (public_ref);

alter table public.prescriptions add column public_ref text not null default private.new_public_ref();
alter table public.prescriptions alter column public_ref drop default;
alter table public.prescriptions add constraint prescriptions_public_ref_format check (public_ref ~ '^[0-9a-hjkmnp-tv-z]{10}$');
alter table public.prescriptions add constraint prescriptions_public_ref_key unique (public_ref);

-- New rows: always a fresh reference, whatever the insert supplied. Retries on the
-- (very unlikely) collision instead of failing the insert.
create or replace function private.assign_public_ref()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text;
  v_attempt integer := 0;
begin
  loop
    v_attempt := v_attempt + 1;
    v_ref := private.new_public_ref();
    exit when v_attempt >= 5
      or (tg_table_name = 'patients' and not exists (select 1 from public.patients p where p.public_ref = v_ref))
      or (tg_table_name = 'prescriptions' and not exists (select 1 from public.prescriptions p where p.public_ref = v_ref));
  end loop;
  new.public_ref := v_ref;
  return new;
end;
$$;

revoke all on function private.assign_public_ref() from public, anon, authenticated;

create trigger patients_assign_public_ref
  before insert on public.patients
  for each row execute function private.assign_public_ref();

create trigger prescriptions_assign_public_ref
  before insert on public.prescriptions
  for each row execute function private.assign_public_ref();
