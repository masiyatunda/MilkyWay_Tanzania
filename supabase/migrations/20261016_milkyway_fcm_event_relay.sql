-- Relays new direct messages and like/comment/follow notifications to the Render FCM route,
-- which sends native Android push notifications. Requires the pg_net extension.
-- Before running: replace REPLACE_WITH_FCM_WEBHOOK_SECRET with the same value set as
-- FCM_WEBHOOK_SECRET in the Render environment variables.
begin;
create extension if not exists pg_net;

create or replace function public.mw_fcm_relay()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform net.http_post(
    url := 'https://masiyatunda.com/api/fcm?action=event',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', 'REPLACE_WITH_FCM_WEBHOOK_SECRET'),
    body := jsonb_build_object('type', 'INSERT', 'table', tg_table_name, 'record', to_jsonb(new) - 'body')
  );
  return new;
exception when others then
  return new; -- push delivery must never block the original insert
end $$;

drop trigger if exists mw_messages_fcm on public.mw_messages;
create trigger mw_messages_fcm after insert on public.mw_messages for each row execute function public.mw_fcm_relay();
drop trigger if exists mw_notifications_fcm on public.mw_notifications;
create trigger mw_notifications_fcm after insert on public.mw_notifications for each row execute function public.mw_fcm_relay();
commit;
