-- User-scoped RLS foundation for StackBlitz/local-first development.
-- Run this after 202609090001_initial.sql.
-- Authenticated requests use the publishable key + the signed-in user's JWT.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.current_user_program_ids()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select pm.program_id
  from public.program_memberships pm
  where pm.is_active = true
    and (
      pm.user_external_id = (select auth.uid())::text
      or lower(pm.user_email) = lower(coalesce((select auth.jwt()->>'email'), ''))
    );
$$;

create or replace function private.can_access_program(p_program_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.program_memberships pm
    where pm.program_id = p_program_id
      and pm.is_active = true
      and (
        pm.user_external_id = (select auth.uid())::text
        or lower(pm.user_email) = lower(coalesce((select auth.jwt()->>'email'), ''))
      )
  );
$$;

create or replace function private.can_access_match(p_match_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and private.can_access_program(m.program_id)
  );
$$;

create or replace function private.can_access_team(p_team_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.programs p
    where p.team_id = p_team_id
      and private.can_access_program(p.id)
  ) or exists (
    select 1
    from public.matches m
    where (m.our_team_id = p_team_id or m.opponent_team_id = p_team_id)
      and private.can_access_program(m.program_id)
  );
$$;

create or replace function private.can_access_player(p_player_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.player_seasons ps
    where ps.player_id = p_player_id
      and private.can_access_program(ps.program_id)
  );
$$;

revoke all on function private.current_user_program_ids() from public;
revoke all on function private.can_access_program(text) from public;
revoke all on function private.can_access_match(text) from public;
revoke all on function private.can_access_team(text) from public;
revoke all on function private.can_access_player(text) from public;
grant execute on function private.current_user_program_ids() to authenticated;
grant execute on function private.can_access_program(text) to authenticated;
grant execute on function private.can_access_match(text) to authenticated;
grant execute on function private.can_access_team(text) to authenticated;
grant execute on function private.can_access_player(text) to authenticated;

create or replace function private.create_volleyball_program_impl(
  p_school_abbreviation text,
  p_team_name text,
  p_primary_color text,
  p_secondary_color text,
  p_accent_color text,
  p_season_year integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_now timestamptz := now();
  v_team_id text := 'team_' || replace(gen_random_uuid()::text, '-', '');
  v_program_id text := 'program_' || replace(gen_random_uuid()::text, '-', '');
  v_season_id text := 'season_' || replace(gen_random_uuid()::text, '-', '');
  v_school text := upper(btrim(coalesce(p_school_abbreviation, '')));
  v_team_name text := btrim(coalesce(p_team_name, ''));
begin
  if v_user_id is null or v_email = '' then
    raise exception 'UNAUTHENTICATED';
  end if;

  if v_school = '' or length(v_school) > 12
     or v_team_name = '' or length(v_team_name) > 80
     or coalesce(p_primary_color, '') !~ '^#[0-9A-Fa-f]{6}$'
     or coalesce(p_secondary_color, '') !~ '^#[0-9A-Fa-f]{6}$'
     or coalesce(p_accent_color, '') !~ '^#[0-9A-Fa-f]{6}$'
     or p_season_year < 2000 or p_season_year > 2100 then
    raise exception 'INVALID_PROGRAM_SETUP';
  end if;

  if exists (
    select 1
    from public.program_memberships pm
    where pm.is_active = true
      and (pm.user_external_id = v_user_id::text or lower(pm.user_email) = v_email)
  ) then
    raise exception 'ACTIVE_PROGRAM_EXISTS';
  end if;

  insert into public.teams (id, canonical_name, created_at)
  values (v_team_id, v_team_name, v_now);

  insert into public.team_aliases (id, team_id, alias, source_family, created_at)
  values ('teamalias_' || replace(gen_random_uuid()::text, '-', ''), v_team_id, v_team_name, 'program_setup', v_now);

  insert into public.team_seasons (id, team_id, season_year, created_at)
  values ('teamseason_' || replace(gen_random_uuid()::text, '-', ''), v_team_id, p_season_year, v_now);

  insert into public.programs (
    id, team_id, school_abbreviation, team_name,
    primary_color, secondary_color, accent_color, created_at
  ) values (
    v_program_id, v_team_id, v_school, v_team_name,
    p_primary_color, p_secondary_color, p_accent_color, v_now
  );

  insert into public.seasons (id, program_id, label, year, is_current, created_at)
  values (v_season_id, v_program_id, p_season_year::text, p_season_year, true, v_now);

  insert into public.program_memberships (
    id, program_id, user_email, user_external_id, role, is_active, created_at
  ) values (
    'membership_' || replace(gen_random_uuid()::text, '-', ''),
    v_program_id, v_email, v_user_id::text, 'owner', true, v_now
  );

  insert into public.activity_events (
    id, program_id, actor_email, action, entity_type, entity_id, created_at
  ) values (
    'activity_' || replace(gen_random_uuid()::text, '-', ''),
    v_program_id, v_email, 'program.created', 'program', v_program_id, v_now
  );

  return jsonb_build_object(
    'programId', v_program_id,
    'seasonId', v_season_id,
    'seasonYear', p_season_year,
    'teamId', v_team_id,
    'schoolAbbreviation', v_school,
    'teamName', v_team_name,
    'primaryColor', p_primary_color,
    'secondaryColor', p_secondary_color,
    'accentColor', p_accent_color,
    'role', 'owner'
  );
end;
$$;

revoke all on function private.create_volleyball_program_impl(text,text,text,text,text,integer) from public;
grant execute on function private.create_volleyball_program_impl(text,text,text,text,text,integer) to authenticated;

create or replace function public.create_volleyball_program(
  p_school_abbreviation text,
  p_team_name text,
  p_primary_color text,
  p_secondary_color text,
  p_accent_color text,
  p_season_year integer
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_volleyball_program_impl(
    p_school_abbreviation,
    p_team_name,
    p_primary_color,
    p_secondary_color,
    p_accent_color,
    p_season_year
  );
$$;

revoke all on function public.create_volleyball_program(text,text,text,text,text,integer) from public;
grant execute on function public.create_volleyball_program(text,text,text,text,text,integer) to authenticated;

-- Explicit Data API grants. RLS below remains the authorization boundary.
do $$
declare t text;
begin
  foreach t in array array[
    'teams','programs','seasons','players','program_memberships','team_aliases','team_seasons',
    'player_aliases','player_seasons','matches','match_sets','source_lineages','source_artifacts',
    'match_source_links','evidence_observations','canonical_overrides','reconciliation_issues',
    'match_capabilities','match_team_totals','player_match_totals','match_metric_results','match_findings','activity_events'
  ] loop
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
  end loop;
end $$;

-- Program and membership policies.
drop policy if exists programs_member_select on public.programs;
create policy programs_member_select on public.programs for select to authenticated
using (private.can_access_program(id));
drop policy if exists programs_member_update on public.programs;
create policy programs_member_update on public.programs for update to authenticated
using (private.can_access_program(id)) with check (private.can_access_program(id));
drop policy if exists programs_member_delete on public.programs;
create policy programs_member_delete on public.programs for delete to authenticated
using (private.can_access_program(id));

drop policy if exists memberships_member_select on public.program_memberships;
create policy memberships_member_select on public.program_memberships for select to authenticated
using (
  user_external_id = (select auth.uid())::text
  or lower(user_email) = lower(coalesce((select auth.jwt()->>'email'), ''))
  or private.can_access_program(program_id)
);

-- Program-owned tables with a direct program_id column.
do $$
declare t text;
begin
  foreach t in array array[
    'seasons','player_seasons','matches','source_lineages','source_artifacts',
    'evidence_observations','canonical_overrides','reconciliation_issues','activity_events'
  ] loop
    execute format('drop policy if exists %I_member_all on public.%I', t, t);
    execute format(
      'create policy %I_member_all on public.%I for all to authenticated using (private.can_access_program(program_id)) with check (private.can_access_program(program_id))',
      t, t
    );
  end loop;
end $$;

-- Team identity: authenticated imports may create a new opponent before the match links it.
drop policy if exists teams_member_select on public.teams;
create policy teams_member_select on public.teams for select to authenticated
using (private.can_access_team(id));
drop policy if exists teams_authenticated_insert on public.teams;
create policy teams_authenticated_insert on public.teams for insert to authenticated with check (true);
drop policy if exists teams_member_update on public.teams;
create policy teams_member_update on public.teams for update to authenticated
using (private.can_access_team(id)) with check (private.can_access_team(id));
drop policy if exists teams_member_delete on public.teams;
create policy teams_member_delete on public.teams for delete to authenticated
using (private.can_access_team(id));

drop policy if exists team_aliases_member_select on public.team_aliases;
create policy team_aliases_member_select on public.team_aliases for select to authenticated
using (private.can_access_team(team_id));
drop policy if exists team_aliases_authenticated_insert on public.team_aliases;
create policy team_aliases_authenticated_insert on public.team_aliases for insert to authenticated with check (true);
drop policy if exists team_aliases_member_update on public.team_aliases;
create policy team_aliases_member_update on public.team_aliases for update to authenticated
using (private.can_access_team(team_id)) with check (private.can_access_team(team_id));
drop policy if exists team_aliases_member_delete on public.team_aliases;
create policy team_aliases_member_delete on public.team_aliases for delete to authenticated
using (private.can_access_team(team_id));

drop policy if exists team_seasons_member_select on public.team_seasons;
create policy team_seasons_member_select on public.team_seasons for select to authenticated
using (private.can_access_team(team_id));
drop policy if exists team_seasons_authenticated_insert on public.team_seasons;
create policy team_seasons_authenticated_insert on public.team_seasons for insert to authenticated with check (true);
drop policy if exists team_seasons_member_update on public.team_seasons;
create policy team_seasons_member_update on public.team_seasons for update to authenticated
using (private.can_access_team(team_id)) with check (private.can_access_team(team_id));
drop policy if exists team_seasons_member_delete on public.team_seasons;
create policy team_seasons_member_delete on public.team_seasons for delete to authenticated
using (private.can_access_team(team_id));

-- Player identity: roster imports create the player before linking the player-season row.
drop policy if exists players_member_select on public.players;
create policy players_member_select on public.players for select to authenticated
using (private.can_access_player(id));
drop policy if exists players_authenticated_insert on public.players;
create policy players_authenticated_insert on public.players for insert to authenticated with check (true);
drop policy if exists players_member_update on public.players;
create policy players_member_update on public.players for update to authenticated
using (private.can_access_player(id)) with check (private.can_access_player(id));
drop policy if exists players_member_delete on public.players;
create policy players_member_delete on public.players for delete to authenticated
using (private.can_access_player(id));

drop policy if exists player_aliases_member_select on public.player_aliases;
create policy player_aliases_member_select on public.player_aliases for select to authenticated
using (private.can_access_player(player_id));
drop policy if exists player_aliases_authenticated_insert on public.player_aliases;
create policy player_aliases_authenticated_insert on public.player_aliases for insert to authenticated with check (true);
drop policy if exists player_aliases_member_update on public.player_aliases;
create policy player_aliases_member_update on public.player_aliases for update to authenticated
using (private.can_access_player(player_id)) with check (private.can_access_player(player_id));
drop policy if exists player_aliases_member_delete on public.player_aliases;
create policy player_aliases_member_delete on public.player_aliases for delete to authenticated
using (private.can_access_player(player_id));

-- Match-owned tables.
do $$
declare t text;
begin
  foreach t in array array[
    'match_sets','match_source_links','match_capabilities','match_team_totals',
    'player_match_totals','match_metric_results','match_findings'
  ] loop
    execute format('drop policy if exists %I_member_all on public.%I', t, t);
    execute format(
      'create policy %I_member_all on public.%I for all to authenticated using (private.can_access_match(match_id)) with check (private.can_access_match(match_id))',
      t, t
    );
  end loop;
end $$;

-- Evidence bytes use program-scoped object paths: programs/<program_id>/evidence/...
drop policy if exists volleyball_evidence_member_select on storage.objects;
create policy volleyball_evidence_member_select on storage.objects for select to authenticated
using (
  bucket_id = 'volleyball-evidence'
  and split_part(name, '/', 1) = 'programs'
  and private.can_access_program(split_part(name, '/', 2))
);
drop policy if exists volleyball_evidence_member_insert on storage.objects;
create policy volleyball_evidence_member_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'volleyball-evidence'
  and split_part(name, '/', 1) = 'programs'
  and private.can_access_program(split_part(name, '/', 2))
);
drop policy if exists volleyball_evidence_member_update on storage.objects;
create policy volleyball_evidence_member_update on storage.objects for update to authenticated
using (
  bucket_id = 'volleyball-evidence'
  and split_part(name, '/', 1) = 'programs'
  and private.can_access_program(split_part(name, '/', 2))
)
with check (
  bucket_id = 'volleyball-evidence'
  and split_part(name, '/', 1) = 'programs'
  and private.can_access_program(split_part(name, '/', 2))
);
drop policy if exists volleyball_evidence_member_delete on storage.objects;
create policy volleyball_evidence_member_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'volleyball-evidence'
  and split_part(name, '/', 1) = 'programs'
  and private.can_access_program(split_part(name, '/', 2))
);
