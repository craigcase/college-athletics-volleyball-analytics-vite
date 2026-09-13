-- Program identity settings: full university name plus uppercase abbreviation/mascot branding.
-- Existing programs remain valid with school_name null until the owner saves Program Settings.

alter table public.programs
  add column if not exists school_name text;

create or replace function private.create_volleyball_program_impl(
  p_school_name text,
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
  v_school_name text := btrim(coalesce(p_school_name, ''));
  v_school text := upper(btrim(coalesce(p_school_abbreviation, '')));
  v_team_name text := upper(btrim(coalesce(p_team_name, '')));
begin
  if v_user_id is null or v_email = '' then
    raise exception 'UNAUTHENTICATED';
  end if;

  if v_school_name = '' or length(v_school_name) > 160
     or v_school = '' or length(v_school) > 12
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
  values
    ('teamalias_' || replace(gen_random_uuid()::text, '-', ''), v_team_id, v_team_name, 'program_setup', v_now),
    ('teamalias_' || replace(gen_random_uuid()::text, '-', ''), v_team_id, v_school, 'program_setup', v_now),
    ('teamalias_' || replace(gen_random_uuid()::text, '-', ''), v_team_id, v_school_name, 'program_setup', v_now)
  on conflict (team_id, alias) do nothing;

  insert into public.team_seasons (id, team_id, season_year, created_at)
  values ('teamseason_' || replace(gen_random_uuid()::text, '-', ''), v_team_id, p_season_year, v_now);

  insert into public.programs (
    id, team_id, school_name, school_abbreviation, team_name,
    primary_color, secondary_color, accent_color, created_at
  ) values (
    v_program_id, v_team_id, v_school_name, v_school, v_team_name,
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
    'schoolName', v_school_name,
    'schoolAbbreviation', v_school,
    'teamName', v_team_name,
    'primaryColor', p_primary_color,
    'secondaryColor', p_secondary_color,
    'accentColor', p_accent_color,
    'role', 'owner'
  );
end;
$$;

revoke all on function private.create_volleyball_program_impl(text,text,text,text,text,text,integer) from public;
grant execute on function private.create_volleyball_program_impl(text,text,text,text,text,text,integer) to authenticated;

create or replace function public.create_volleyball_program(
  p_school_name text,
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
    p_school_name,
    p_school_abbreviation,
    p_team_name,
    p_primary_color,
    p_secondary_color,
    p_accent_color,
    p_season_year
  );
$$;

revoke all on function public.create_volleyball_program(text,text,text,text,text,text,integer) from public;
grant execute on function public.create_volleyball_program(text,text,text,text,text,text,integer) to authenticated;

-- v0.6.6 also corrects the previously persisted direction label for service-error findings.
-- The finding threshold/rank math is unchanged; fewer service errors is the favorable direction.
update public.match_findings
set
  direction = case
    when ((evidence_json::jsonb)->>'ourValue')::double precision <= ((evidence_json::jsonb)->>'opponentValue')::double precision then 'our_advantage'
    else 'opponent_advantage'
  end,
  side = case
    when ((evidence_json::jsonb)->>'ourValue')::double precision <= ((evidence_json::jsonb)->>'opponentValue')::double precision then 'our_team'
    else 'opponent'
  end
where metric_code = 'service_errors'
  and evidence_json is not null
  and (evidence_json::jsonb ? 'ourValue')
  and (evidence_json::jsonb ? 'opponentValue');
