-- v0.7.2 Import & Evidence Quality
-- Run after 202609130002_rally_analytics.sql.

alter table public.program_memberships
  add column if not exists can_correct_data boolean not null default false;

update public.program_memberships
set can_correct_data = true
where role = 'owner' and can_correct_data = false;

create or replace function private.ensure_owner_can_correct_data()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'owner' then
    new.can_correct_data := true;
  end if;
  return new;
end;
$$;

drop trigger if exists program_memberships_owner_correction_default on public.program_memberships;
create trigger program_memberships_owner_correction_default
before insert or update of role on public.program_memberships
for each row execute function private.ensure_owner_can_correct_data();

create or replace function private.can_correct_program_data(p_program_id text)
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
      and pm.can_correct_data = true
      and (
        pm.user_external_id = (select auth.uid())::text
        or lower(pm.user_email) = lower(coalesce((select auth.jwt()->>'email'), ''))
      )
  );
$$;

revoke all on function private.can_correct_program_data(text) from public;
grant execute on function private.can_correct_program_data(text) to authenticated;

create table if not exists public.program_opponent_aliases (
  id text primary key,
  program_id text not null references public.programs(id) on delete cascade,
  team_id text not null references public.teams(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  source_family text,
  source_artifact_id text references public.source_artifacts(id) on delete set null,
  confirmed_by_email text not null,
  confirmed_at timestamptz not null,
  revoked_by_email text,
  revoked_at timestamptz,
  unique(program_id, normalized_alias)
);
create index if not exists program_opponent_aliases_team_idx on public.program_opponent_aliases(program_id, team_id);

create table if not exists public.canonical_override_history (
  id text primary key,
  program_id text not null references public.programs(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  field_name text not null,
  action text not null check (action in ('apply','replace','undo')),
  previous_value_json text,
  new_value_json text,
  reason text,
  actor_email text not null,
  created_at timestamptz not null
);
create index if not exists canonical_override_history_entity_idx
  on public.canonical_override_history(program_id, entity_type, entity_id, field_name, created_at);

grant select, insert, update, delete on table public.program_opponent_aliases to authenticated;
grant select, insert on table public.canonical_override_history to authenticated;
revoke update, delete on table public.canonical_override_history from authenticated;

alter table public.program_opponent_aliases enable row level security;
alter table public.canonical_override_history enable row level security;

-- Members may inspect trusted aliases; only explicitly correction-enabled staff may change them.
drop policy if exists program_opponent_aliases_member_all on public.program_opponent_aliases;
drop policy if exists program_opponent_aliases_member_select on public.program_opponent_aliases;
create policy program_opponent_aliases_member_select on public.program_opponent_aliases for select to authenticated
using (private.can_access_program(program_id));
drop policy if exists program_opponent_aliases_corrector_write on public.program_opponent_aliases;
create policy program_opponent_aliases_corrector_write on public.program_opponent_aliases for all to authenticated
using (private.can_correct_program_data(program_id))
with check (private.can_correct_program_data(program_id));

-- Existing canonical overrides used to be writable by any program member. v0.7.2
-- keeps them readable to members but makes writes correction-permission only.
drop policy if exists canonical_overrides_member_all on public.canonical_overrides;
drop policy if exists canonical_overrides_member_select on public.canonical_overrides;
create policy canonical_overrides_member_select on public.canonical_overrides for select to authenticated
using (private.can_access_program(program_id));
drop policy if exists canonical_overrides_corrector_write on public.canonical_overrides;
create policy canonical_overrides_corrector_write on public.canonical_overrides for all to authenticated
using (private.can_correct_program_data(program_id))
with check (private.can_correct_program_data(program_id));

-- Override history is append-only. Members can inspect it, but only correction-enabled
-- users can append history through a correction/undo operation.
drop policy if exists canonical_override_history_member_all on public.canonical_override_history;
drop policy if exists canonical_override_history_member_select on public.canonical_override_history;
create policy canonical_override_history_member_select on public.canonical_override_history for select to authenticated
using (private.can_access_program(program_id));
drop policy if exists canonical_override_history_corrector_insert on public.canonical_override_history;
create policy canonical_override_history_corrector_insert on public.canonical_override_history for insert to authenticated
with check (private.can_correct_program_data(program_id));

-- v0.7.2 distinguishes mathematically reconciled facts from source-supported facts.
alter table public.match_rallies drop constraint if exists match_rallies_evidence_status_check;
alter table public.match_rallies
  add constraint match_rallies_evidence_status_check
  check (evidence_status in ('supported','gap_placeholder','ambiguous','uniquely_reconciled','staff_confirmed'));
