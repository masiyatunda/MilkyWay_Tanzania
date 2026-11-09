begin;
create or replace function public.mw_live_notification_recipients(host_id uuid, after_id uuid default null)
returns table(recipient_id uuid)
language sql stable security definer set search_path = ''
as $$
  select follow.follower_id
  from public.mw_follows follow
  join public.mw_profiles recipient on recipient.id = follow.follower_id
  join public.mw_profiles host on host.id = follow.following_id
  where host_id = auth.uid() and follow.following_id = host_id
    and (after_id is null or follow.follower_id > after_id)
    and follow.follower_id <> host_id
    and coalesce(to_jsonb(recipient)->>'live_notifications', 'true') <> 'false'
    and coalesce(to_jsonb(recipient)->>'is_banned', 'false') <> 'true'
    and coalesce(to_jsonb(host)->>'is_banned', 'false') <> 'true'
    and not exists (
      select 1 from public.mw_blocks block
      where (block.blocker_id = host_id and block.blocked_id = follow.follower_id)
         or (block.blocker_id = follow.follower_id and block.blocked_id = host_id)
    )
  order by follow.follower_id
  limit 500;
$$;
revoke all on function public.mw_live_notification_recipients(uuid, uuid) from public;
grant execute on function public.mw_live_notification_recipients(uuid, uuid) to authenticated;
commit;
