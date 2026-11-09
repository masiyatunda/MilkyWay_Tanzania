begin;
create or replace function public.mw_dm_contact_allowed(sender uuid, receiver uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select sender = auth.uid() and sender <> receiver
    and exists (
      select 1 from public.mw_profiles profile where profile.id = sender
        and not coalesce((to_jsonb(profile)->>'is_banned')::boolean, false)
        and (to_jsonb(profile)->>'suspended_until' is null
          or (to_jsonb(profile)->>'suspended_until')::timestamptz <= now())
    )
    and exists (
      select 1 from public.mw_profiles profile where profile.id = receiver
        and coalesce(to_jsonb(profile)->>'allow_messages', 'everyone') <> 'nobody'
        and (coalesce(to_jsonb(profile)->>'allow_messages', 'everyone') = 'everyone'
          or exists(select 1 from public.mw_follows follow where follow.follower_id = sender and follow.following_id = receiver))
    )
    and not exists (
      select 1 from public.mw_blocks block where
        (block.blocker_id = sender and block.blocked_id = receiver)
        or (block.blocker_id = receiver and block.blocked_id = sender)
    );
$$;
revoke all on function public.mw_dm_contact_allowed(uuid, uuid) from public;
grant execute on function public.mw_dm_contact_allowed(uuid, uuid) to authenticated;
drop policy if exists mw_messages_send on public.mw_messages;
create policy mw_messages_send on public.mw_messages for insert to authenticated
with check(sender_id = auth.uid() and public.mw_dm_contact_allowed(sender_id, receiver_id));

create or replace function public.mw_profile_posts_visible(owner_id text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.mw_profiles profile where profile.id::text = owner_id
      and (profile.id = auth.uid() or not coalesce((to_jsonb(profile)->>'is_private')::boolean, false)
        or exists(select 1 from public.mw_follows follow where follow.follower_id = auth.uid() and follow.following_id = profile.id))
      and not exists(select 1 from public.mw_blocks block where
        (block.blocker_id = auth.uid() and block.blocked_id = profile.id)
        or (block.blocker_id = profile.id and block.blocked_id = auth.uid()))
  );
$$;
revoke all on function public.mw_profile_posts_visible(text) from public;
grant execute on function public.mw_profile_posts_visible(text) to anon, authenticated;
drop policy if exists mw_posts_read on public.mw_posts;
create policy mw_posts_read on public.mw_posts for select to anon, authenticated
using(public.mw_profile_posts_visible(author_id::text));

create or replace function public.mw_privacy_capabilities()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'profileVisibility', auth.uid() is not null
      and exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'mw_profiles' and column_name = 'is_private')
      and exists(select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'mw_posts' and policyname = 'mw_posts_read'),
    'messagePrivacy', auth.uid() is not null
      and exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'mw_profiles' and column_name = 'allow_messages')
      and exists(select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'mw_messages' and policyname = 'mw_messages_send'),
    'blocking', auth.uid() is not null
      and exists(select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'mw_messages' and policyname = 'mw_messages_send')
  );
$$;
revoke all on function public.mw_privacy_capabilities() from public;
grant execute on function public.mw_privacy_capabilities() to authenticated;
commit;
notify pgrst, 'reload schema';
