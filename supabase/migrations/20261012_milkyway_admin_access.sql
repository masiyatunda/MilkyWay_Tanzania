begin;

create or replace function public.mw_is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and (
    coalesce(auth.jwt()->'app_metadata'->'authorization'->'roles', auth.jwt()->'app_metadata'->'roles', '[]'::jsonb) @> '["admin"]'::jsonb
    or exists (
      select 1 from auth.users
      where id = auth.uid()
        and email_confirmed_at is not null
        and lower(email) = 'masiyatunda@gmail.com'
    )
  );
$$;

revoke all on function public.mw_is_admin() from public;
grant execute on function public.mw_is_admin() to authenticated;

create or replace function public.mw_guard_profile_privileges()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
    or auth.role() = 'service_role'
    or public.mw_is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if coalesce((to_jsonb(new)->>'is_admin')::boolean, false)
      or coalesce((to_jsonb(new)->>'verified')::boolean, false) then
      raise exception 'Administrator-managed profile fields cannot be assigned by this account.';
    end if;
  elsif to_jsonb(new)->'is_admin' is distinct from to_jsonb(old)->'is_admin'
    or to_jsonb(new)->'verified' is distinct from to_jsonb(old)->'verified' then
    raise exception 'Administrator-managed profile fields cannot be changed by this account.';
  end if;
  return new;
end;
$$;

drop trigger if exists mw_guard_profile_privileges on public.mw_profiles;
create trigger mw_guard_profile_privileges
before insert or update on public.mw_profiles
for each row execute function public.mw_guard_profile_privileges();

commit;
notify pgrst, 'reload schema';
