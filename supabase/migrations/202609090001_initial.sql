-- College Athletics Consulting Volleyball Analytics
-- Supabase/Postgres foundation migrated from the Sites/D1 schema.

create table if not exists teams (
  id text primary key,
  canonical_name text not null,
  created_at timestamptz not null
);

create table if not exists programs (
  id text primary key,
  team_id text references teams(id),
  school_abbreviation text not null,
  team_name text not null,
  primary_color text not null,
  secondary_color text not null,
  accent_color text not null,
  created_at timestamptz not null,
  archived_at timestamptz
);

create table if not exists seasons (
  id text primary key,
  program_id text not null references programs(id) on delete cascade,
  label text not null,
  year integer not null,
  is_current boolean not null default false,
  starts_on date,
  ends_on date,
  created_at timestamptz not null,
  unique(program_id, year)
);

create table if not exists players (
  id text primary key,
  canonical_name text not null,
  created_at timestamptz not null
);

create table if not exists program_memberships (
  id text primary key,
  program_id text not null references programs(id) on delete cascade,
  user_email text not null,
  user_external_id text,
  role text not null check(role in ('owner','staff','player')),
  display_title text,
  player_id text references players(id),
  is_active boolean not null default true,
  created_at timestamptz not null,
  unique(program_id, user_email)
);
create index if not exists idx_program_memberships_external on program_memberships(user_external_id) where is_active = true;

create table if not exists team_aliases (
  id text primary key,
  team_id text not null references teams(id) on delete cascade,
  alias text not null,
  source_family text,
  source_external_id text,
  created_at timestamptz not null,
  unique(team_id, alias)
);
create index if not exists idx_team_aliases_lower on team_aliases(lower(alias));

create table if not exists team_seasons (
  id text primary key,
  team_id text not null references teams(id) on delete cascade,
  season_year integer not null,
  roster_url text,
  schedule_url text,
  created_at timestamptz not null,
  unique(team_id, season_year)
);

create table if not exists player_aliases (
  id text primary key,
  player_id text not null references players(id) on delete cascade,
  alias text not null,
  source_family text,
  source_external_id text,
  created_at timestamptz not null,
  unique(player_id, alias)
);
create index if not exists idx_player_aliases_external on player_aliases(source_external_id) where source_external_id is not null;

create table if not exists player_seasons (
  id text primary key,
  player_id text not null references players(id) on delete cascade,
  program_id text not null references programs(id) on delete cascade,
  season_id text not null references seasons(id) on delete cascade,
  team_id text references teams(id),
  jersey_number text,
  official_position text,
  observed_role text,
  class_year text,
  height text,
  hometown text,
  previous_school text,
  profile_url text,
  image_url text,
  source_player_id text,
  active boolean not null default true,
  created_at timestamptz not null,
  unique(player_id, season_id)
);
create index if not exists idx_player_seasons_program_season on player_seasons(program_id, season_id);

create table if not exists matches (
  id text primary key,
  program_id text not null references programs(id) on delete cascade,
  season_id text not null references seasons(id) on delete cascade,
  our_team_id text references teams(id),
  opponent_team_id text references teams(id),
  scheduled_at timestamptz not null,
  actual_started_at timestamptz,
  home_away text not null default 'unknown' check(home_away in ('home','away','neutral','unknown')),
  competition text not null default 'unknown' check(competition in ('conference','nonconference','unknown')),
  location text,
  status text not null default 'scheduled',
  result text,
  set_scores_json text,
  source_match_id text,
  canonical_revision integer not null default 1,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists idx_matches_season_date on matches(season_id, scheduled_at);
create index if not exists idx_matches_program on matches(program_id);

create table if not exists match_sets (
  id text primary key,
  match_id text not null references matches(id) on delete cascade,
  set_number integer not null,
  our_score integer,
  opponent_score integer,
  created_at timestamptz not null,
  unique(match_id, set_number)
);

create table if not exists source_lineages (
  id text primary key,
  program_id text not null references programs(id) on delete cascade,
  lineage_key text not null,
  description text,
  created_at timestamptz not null,
  unique(program_id, lineage_key)
);

create table if not exists source_artifacts (
  id text primary key,
  program_id text not null references programs(id) on delete cascade,
  lineage_id text references source_lineages(id),
  source_family text not null,
  source_url text,
  original_filename text,
  content_type text,
  content_hash text not null,
  object_key text not null,
  parser_version text,
  imported_at timestamptz not null,
  imported_by_email text,
  unique(program_id, content_hash)
);

create table if not exists match_source_links (
  id text primary key,
  match_id text not null references matches(id) on delete cascade,
  source_artifact_id text not null references source_artifacts(id) on delete cascade,
  match_confidence double precision not null,
  created_at timestamptz not null,
  unique(match_id, source_artifact_id)
);

create table if not exists evidence_observations (
  id text primary key,
  program_id text not null references programs(id) on delete cascade,
  source_artifact_id text not null references source_artifacts(id) on delete cascade,
  match_id text references matches(id),
  entity_type text not null,
  entity_id text,
  source_entity_key text,
  field_name text not null,
  value_json text not null,
  set_number integer,
  rally_index integer,
  source_confidence double precision not null default 0.5,
  observed_at timestamptz not null
);
create index if not exists idx_observations_match on evidence_observations(match_id, field_name);
create index if not exists idx_observations_source on evidence_observations(source_artifact_id);

create table if not exists canonical_overrides (
  id text primary key,
  program_id text not null references programs(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  field_name text not null,
  canonical_value_json text not null,
  reason text,
  corrected_by_email text not null,
  corrected_at timestamptz not null,
  unique(program_id, entity_type, entity_id, field_name)
);

create table if not exists reconciliation_issues (
  id text primary key,
  program_id text not null references programs(id) on delete cascade,
  issue_type text not null,
  entity_type text,
  entity_id text,
  source_artifact_id text references source_artifacts(id),
  details_json text not null,
  status text not null default 'open',
  resolved_by_email text,
  resolved_at timestamptz,
  created_at timestamptz not null
);

create table if not exists match_capabilities (
  match_id text primary key references matches(id) on delete cascade,
  canonical_revision integer not null,
  box_score_totals boolean not null default false,
  player_totals boolean not null default false,
  set_totals boolean not null default false,
  rally_sequence boolean not null default false,
  serve_receive_state boolean not null default false,
  rotation_state boolean not null default false,
  on_court_state boolean not null default false,
  contact_quality boolean not null default false,
  attack_origin boolean not null default false,
  attack_destination boolean not null default false,
  updated_at timestamptz not null
);

create table if not exists match_team_totals (
  id text primary key,
  match_id text not null references matches(id) on delete cascade,
  team_side text not null check(team_side in ('our_team','opponent')),
  canonical_revision integer not null,
  kills integer,
  attack_errors integer,
  attack_attempts integer,
  assists integer,
  aces integer,
  service_errors integer,
  digs integer,
  blocks double precision,
  reception_errors integer,
  updated_at timestamptz not null,
  unique(match_id, team_side, canonical_revision)
);

create table if not exists player_match_totals (
  id text primary key,
  match_id text not null references matches(id) on delete cascade,
  player_id text not null references players(id),
  team_side text not null check(team_side in ('our_team','opponent')),
  canonical_revision integer not null,
  totals_json text not null,
  updated_at timestamptz not null,
  unique(match_id, player_id, canonical_revision)
);

create table if not exists match_metric_results (
  id text primary key,
  match_id text not null references matches(id) on delete cascade,
  canonical_revision integer not null,
  subject text not null,
  metric_code text not null,
  numerator double precision,
  denominator double precision,
  value double precision,
  status text not null default 'supported',
  engine_version text not null,
  calculated_at timestamptz not null,
  unique(match_id, canonical_revision, subject, metric_code)
);

create table if not exists match_findings (
  id text primary key,
  match_id text not null references matches(id) on delete cascade,
  canonical_revision integer not null,
  side text not null,
  metric_code text not null,
  direction text not null,
  magnitude double precision not null,
  opportunities double precision,
  rank_score double precision not null,
  evidence_json text not null,
  engine_version text not null,
  created_at timestamptz not null
);

create table if not exists activity_events (
  id text primary key,
  program_id text not null references programs(id) on delete cascade,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  details_json text,
  created_at timestamptz not null
);

-- The browser never queries program intelligence directly in V1. Server code uses
-- the service role only after Supabase Auth and program-scope checks pass.
-- Enabling RLS with no broad client policies fails closed if a browser client is misused.
do $$
declare t text;
begin
  foreach t in array array[
    'teams','programs','seasons','players','program_memberships','team_aliases','team_seasons',
    'player_aliases','player_seasons','matches','match_sets','source_lineages','source_artifacts',
    'match_source_links','evidence_observations','canonical_overrides','reconciliation_issues',
    'match_capabilities','match_team_totals','player_match_totals','match_metric_results','match_findings','activity_events'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('volleyball-evidence', 'volleyball-evidence', false)
on conflict (id) do update set public = excluded.public;
