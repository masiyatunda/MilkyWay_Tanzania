-- Add the member state used by live-room status, guest requests, and speaker seats.
alter table public.mw_live_room_members
  add column if not exists state text not null default 'viewer';

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
