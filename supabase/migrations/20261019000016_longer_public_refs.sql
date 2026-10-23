-- 0016 longer public refs: new patients and prescriptions get a 21-character reference
-- from a 64-letter URL-safe alphabet (A-Z, a-z, 0-9, "_" and "-"): 126 random bits.
-- Existing 10-character references are not touched: no row is updated, and the format
-- check accepts both shapes, so every existing URL keeps resolving.
-- The column stays `text`; the check caps it at 32 characters, so no type change is needed.

-- Same source as 0011: the random bytes of gen_random_uuid() (a cryptographically secure
-- generator). Two UUIDs give 32 bytes; the version and variant bytes (6 and 8 of each) are
-- skipped, and 21 of the remaining fully random bytes are used. 256 is a multiple of 64,
-- so `byte % 64` picks every letter with equal probability.
create or replace function private.new_public_ref()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  v_bytes bytea := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
  v_ref text := '';
  v_index integer;
begin
  foreach v_index in array array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23] loop
    v_ref := v_ref || substr(v_alphabet, (get_byte(v_bytes, v_index) % 64) + 1, 1);
  end loop;
  return v_ref;
end;
$$;

revoke all on function private.new_public_ref() from public, anon, authenticated;

-- Legacy 10-character references (0011 alphabet) or new 21-character ones, never longer than 32.
-- Re-adding the check validates existing rows without changing them.
alter table public.patients drop constraint patients_public_ref_format;
alter table public.patients add constraint patients_public_ref_format check (
  char_length(public_ref) <= 32
  and (public_ref ~ '^[0-9a-hjkmnp-tv-z]{10}$' or public_ref ~ '^[A-Za-z0-9_-]{21}$')
);

alter table public.prescriptions drop constraint prescriptions_public_ref_format;
alter table public.prescriptions add constraint prescriptions_public_ref_format check (
  char_length(public_ref) <= 32
  and (public_ref ~ '^[0-9a-hjkmnp-tv-z]{10}$' or public_ref ~ '^[A-Za-z0-9_-]{21}$')
);
