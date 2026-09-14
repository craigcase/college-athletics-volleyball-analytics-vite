-- v0.7.0 canonical rally analytics foundation.
-- Additive only: preserves all v0.6.6 canonical/evidence/analytics tables.


alter table public.match_sets
  add column if not exists rally_score_status text not null default 'unknown'
    check (rally_score_status in ('unknown','verified','conflict')),
  add column if not exists source_final_score_json jsonb,
  add column if not exists rally_canonical_revision integer;

alter table public.match_capabilities
  add column if not exists terminal_event_detail boolean not null default false,
  add column if not exists timeout_timeline boolean not null default false,
  add column if not exists substitution_timeline boolean not null default false,
  add column if not exists offensive_phase boolean not null default false,
  add column if not exists transition_depth boolean not null default false,
  add column if not exists contact_sequence boolean not null default false,
  add column if not exists timestamps boolean not null default false;

create table if not exists public.match_rallies (
  id text primary key,
  program_id text not null references public.programs(id) on delete cascade,
  match_id text not null references public.matches(id) on delete cascade,
  set_number integer not null,
  rally_number integer not null,
  canonical_revision integer not null,
  score_before_our integer not null,
  score_before_opponent integer not null,
  score_after_our integer not null,
  score_after_opponent integer not null,
  serving_side text check (serving_side in ('our_team','opponent')),
  receiving_side text check (receiving_side in ('our_team','opponent')),
  server_source_key text,
  point_winner text not null check (point_winner in ('our_team','opponent')),
  terminal_event_type text,
  terminal_player_source_key text,
  pathway text not null,
  attribution text not null,
  evidence_status text not null check (evidence_status in ('supported','gap_placeholder','ambiguous')),
  terminal_json jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(match_id,set_number,rally_number,canonical_revision)
);

create table if not exists public.rally_phases (
  id text primary key,
  rally_id text not null references public.match_rallies(id) on delete cascade,
  team_side text not null check (team_side in ('our_team','opponent')),
  phase_order integer not null,
  phase_type text not null,
  transition_depth integer,
  evidence_method text not null default 'source_reported',
  details_json jsonb,
  created_at timestamptz not null,
  unique(rally_id,team_side,phase_order)
);

create table if not exists public.rally_events (
  id text primary key,
  rally_id text not null references public.match_rallies(id) on delete cascade,
  event_order integer not null,
  team_side text check (team_side in ('our_team','opponent')),
  player_source_key text,
  event_type text not null,
  quality_grade text,
  phase_order integer,
  occurred_at_seconds double precision,
  details_json jsonb,
  created_at timestamptz not null,
  unique(rally_id,event_order)
);

create table if not exists public.match_timeline_events (
  id text primary key,
  program_id text not null references public.programs(id) on delete cascade,
  match_id text not null references public.matches(id) on delete cascade,
  set_number integer not null,
  rally_number integer,
  canonical_revision integer not null,
  source_record_key text,
  source_ordinal integer,
  event_type text not null,
  team_side text check (team_side in ('our_team','opponent')),
  details_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null
);

create table if not exists public.rally_source_links (
  id text primary key,
  rally_id text not null references public.match_rallies(id) on delete cascade,
  source_artifact_id text not null references public.source_artifacts(id) on delete cascade,
  source_record_key text not null,
  source_ordinal integer,
  alignment_confidence double precision not null,
  reconciliation_status text not null default 'aligned',
  source_score_json jsonb,
  created_at timestamptz not null,
  unique(rally_id,source_artifact_id,source_record_key)
);

create table if not exists public.rally_rotation_states (
  id text primary key,
  rally_id text not null references public.match_rallies(id) on delete cascade,
  team_side text not null check (team_side in ('our_team','opponent')),
  cycle_slot integer check (cycle_slot between 1 and 6),
  rotation_number integer check (rotation_number between 1 and 6),
  method text not null,
  confidence double precision not null,
  server_source_key text,
  derivation_version text not null,
  evidence_json jsonb,
  created_at timestamptz not null,
  unique(rally_id,team_side,method)
);

create index if not exists match_rallies_lookup_idx on public.match_rallies(match_id,canonical_revision,set_number,rally_number);
create index if not exists match_timeline_events_lookup_idx on public.match_timeline_events(match_id,canonical_revision,set_number);
create index if not exists rally_source_links_source_idx on public.rally_source_links(source_artifact_id,source_record_key);
create index if not exists rally_rotation_states_lookup_idx on public.rally_rotation_states(rally_id,team_side);
create index if not exists rally_phases_lookup_idx on public.rally_phases(rally_id,team_side,phase_order);
create index if not exists rally_events_lookup_idx on public.rally_events(rally_id,event_order);

alter table public.match_rallies enable row level security;
alter table public.rally_phases enable row level security;
alter table public.rally_events enable row level security;
alter table public.match_timeline_events enable row level security;
alter table public.rally_source_links enable row level security;
alter table public.rally_rotation_states enable row level security;

grant select, insert, update, delete on table public.match_rallies to authenticated;
grant select, insert, update, delete on table public.rally_phases to authenticated;
grant select, insert, update, delete on table public.rally_events to authenticated;
grant select, insert, update, delete on table public.match_timeline_events to authenticated;
grant select, insert, update, delete on table public.rally_source_links to authenticated;
grant select, insert, update, delete on table public.rally_rotation_states to authenticated;

create or replace function private.can_access_rally(p_rally_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.match_rallies r
    where r.id = p_rally_id
      and private.can_access_match(r.match_id)
  );
$$;
revoke all on function private.can_access_rally(text) from public;
grant execute on function private.can_access_rally(text) to authenticated;

drop policy if exists match_rallies_member_all on public.match_rallies;
create policy match_rallies_member_all on public.match_rallies for all to authenticated
using (private.can_access_match(match_id))
with check (private.can_access_match(match_id));

drop policy if exists match_timeline_events_member_all on public.match_timeline_events;
create policy match_timeline_events_member_all on public.match_timeline_events for all to authenticated
using (private.can_access_match(match_id))
with check (private.can_access_match(match_id));

drop policy if exists rally_phases_member_all on public.rally_phases;
create policy rally_phases_member_all on public.rally_phases for all to authenticated
using (private.can_access_rally(rally_id))
with check (private.can_access_rally(rally_id));

drop policy if exists rally_events_member_all on public.rally_events;
create policy rally_events_member_all on public.rally_events for all to authenticated
using (private.can_access_rally(rally_id))
with check (private.can_access_rally(rally_id));

drop policy if exists rally_source_links_member_all on public.rally_source_links;
create policy rally_source_links_member_all on public.rally_source_links for all to authenticated
using (private.can_access_rally(rally_id))
with check (private.can_access_rally(rally_id));

drop policy if exists rally_rotation_states_member_all on public.rally_rotation_states;
create policy rally_rotation_states_member_all on public.rally_rotation_states for all to authenticated
using (private.can_access_rally(rally_id))
with check (private.can_access_rally(rally_id));
