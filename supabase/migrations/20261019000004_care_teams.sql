-- 0004 care teams: teams, clinician membership, membership helpers, admin RPC.

create table public.care_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger care_teams_set_updated_at
  before update on public.care_teams
  for each row execute function private.set_updated_at();

create table public.care_team_members (
  care_team_id uuid not null references public.care_teams (id) on delete restrict,
  profile_id uuid not null references public.profiles (id) on delete restrict,
  added_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (care_team_id, profile_id)
);

create index care_team_members_profile_idx on public.care_team_members (profile_id);

-- Only clinicians can be members, so an admin cannot add themselves to a team
-- to gain access to clinical records.
create or replace function private.enforce_member_is_clinician()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = new.profile_id and p.role = 'clinician'
  ) then
    raise exception 'Only clinicians can be care team members'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_member_is_clinician() from public, anon, authenticated;

create trigger care_team_members_clinician_only
  before insert or update on public.care_team_members
  for each row execute function private.enforce_member_is_clinician();

create or replace function private.audit_care_team_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.write_audit('care_team.member_added', 'care_team', new.care_team_id, null,
      jsonb_build_object('member_profile_id', new.profile_id));
    return new;
  end if;
  perform private.write_audit('care_team.member_removed', 'care_team', old.care_team_id, null,
    jsonb_build_object('member_profile_id', old.profile_id));
  return old;
end;
$$;

revoke all on function private.audit_care_team_members() from public, anon, authenticated;

create trigger care_team_members_audit
  after insert or delete on public.care_team_members
  for each row execute function private.audit_care_team_members();

-- Teams the current user belongs to as an active clinician.
create or replace function private.my_care_team_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.care_team_id
  from public.care_team_members m
  join public.profiles p on p.id = m.profile_id
  where m.profile_id = (select auth.uid())
    and p.is_active
    and p.role = 'clinician';
$$;

-- True when the current user and the given profile share at least one team.
create or replace function private.shares_team_with(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.care_team_members m
    where m.profile_id = p_profile_id
      and m.care_team_id in (select private.my_care_team_ids())
  );
$$;

revoke all on function private.my_care_team_ids() from public, anon;
revoke all on function private.shares_team_with(uuid) from public, anon;
grant execute on function private.my_care_team_ids() to authenticated;
grant execute on function private.shares_team_with(uuid) to authenticated;

alter table public.care_teams enable row level security;
alter table public.care_team_members enable row level security;
revoke all on public.care_teams from anon, authenticated;
revoke all on public.care_team_members from anon, authenticated;
grant select on public.care_teams to authenticated;
grant select on public.care_team_members to authenticated;

create policy care_teams_select on public.care_teams
  for select to authenticated
  using ((select private.is_admin()) or id in (select private.my_care_team_ids()));

create policy care_team_members_select on public.care_team_members
  for select to authenticated
  using ((select private.is_admin()) or care_team_id in (select private.my_care_team_ids()));

create policy profiles_select_teammates on public.profiles
  for select to authenticated
  using (private.shares_team_with(id));

-- The only write path for memberships. Writes are audited by the trigger above.
create or replace function public.admin_set_team_membership(
  p_care_team_id uuid,
  p_profile_id uuid,
  p_is_member boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only admins can manage care team membership'
      using errcode = 'insufficient_privilege';
  end if;

  if p_is_member then
    insert into public.care_team_members (care_team_id, profile_id, added_by)
    values (p_care_team_id, p_profile_id, auth.uid())
    on conflict (care_team_id, profile_id) do nothing;
  else
    delete from public.care_team_members
    where care_team_id = p_care_team_id and profile_id = p_profile_id;
  end if;
end;
$$;

revoke all on function public.admin_set_team_membership(uuid, uuid, boolean) from public, anon;
grant execute on function public.admin_set_team_membership(uuid, uuid, boolean) to authenticated;
