-- 0015 encounter notes: free-text notes for synthetic encounters. One note per
-- patient, author and UTC day; the author edits it in place (autosave) and every
-- body change bumps its version. Other team members can read it.
-- Each save writes a content-free audit row in the same transaction, so a failed
-- audit write fails the save.

create table public.encounter_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict,
  note_date date not null default current_date,
  body text not null check (char_length(body) <= 5000),
  version integer not null default 1 check (version >= 1),
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (patient_id, author_id, note_date)
);

create index encounter_notes_patient_idx on public.encounter_notes (patient_id, note_date desc);

-- Server-owned fields: the date, version and timestamps are set here, and the
-- identity of a note never changes after it is created.
create or replace function private.encounter_notes_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.note_date := current_date;
    new.version := 1;
    new.saved_at := now();
    new.created_at := now();
    return new;
  end if;

  if new.patient_id <> old.patient_id
    or new.author_id <> old.author_id
    or new.note_date <> old.note_date
    or new.created_at <> old.created_at then
    raise exception 'Immutable note fields cannot change' using errcode = 'insufficient_privilege';
  end if;

  if new.body is distinct from old.body then
    new.version := old.version + 1;
    new.saved_at := now();
  else
    new.version := old.version;
    new.saved_at := old.saved_at;
  end if;
  return new;
end;
$$;

revoke all on function private.encounter_notes_guard() from public, anon, authenticated;

create trigger encounter_notes_guard
  before insert or update on public.encounter_notes
  for each row execute function private.encounter_notes_guard();

create or replace function private.audit_encounter_notes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_audit('encounter_note.created', 'encounter_note', new.id, new.patient_id,
      jsonb_build_object('version', new.version));
  elsif new.version <> old.version then
    perform private.write_audit('encounter_note.updated', 'encounter_note', new.id, new.patient_id,
      jsonb_build_object('version', new.version));
  end if;
  return new;
end;
$$;

revoke all on function private.audit_encounter_notes() from public, anon, authenticated;

create trigger encounter_notes_audit
  after insert or update on public.encounter_notes
  for each row execute function private.audit_encounter_notes();

alter table public.encounter_notes enable row level security;
revoke all on public.encounter_notes from anon, authenticated;
grant select on public.encounter_notes to authenticated;
grant insert (patient_id, author_id, body) on public.encounter_notes to authenticated;
grant update (body) on public.encounter_notes to authenticated;

create policy encounter_notes_select_care_team on public.encounter_notes
  for select to authenticated
  using (private.is_care_team_member(patient_id));

create policy encounter_notes_insert_author on public.encounter_notes
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select private.is_clinician())
    and private.is_care_team_member(patient_id)
  );

create policy encounter_notes_update_author on public.encounter_notes
  for update to authenticated
  using (
    author_id = (select auth.uid())
    and (select private.is_clinician())
    and private.is_care_team_member(patient_id)
  )
  with check (
    author_id = (select auth.uid())
    and (select private.is_clinician())
    and private.is_care_team_member(patient_id)
  );
