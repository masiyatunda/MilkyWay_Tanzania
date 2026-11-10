-- Keep the room-members API columns present even when the table predates the
-- Live rooms migration, then refresh PostgREST's schema cache.
alter table public.mw_live_room_members
  add column if not exists room_name text not null default '',
  add column if not exists user_id uuid,
  add column if not exists name text not null default 'MilkyWay user',
  add column if not exists avatar text not null default '',
  add column if not exists state text not null default 'viewer',
  add column if not exists host_muted boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.mw_live_room_members'::regclass
      and conname = 'mw_live_room_members_state_check'
  ) then
    alter table public.mw_live_room_members
      add constraint mw_live_room_members_state_check
      check (state in ('viewer', 'pending', 'speaker'));
  end if;
end;
$$;

notify pgrst, 'reload schema';
