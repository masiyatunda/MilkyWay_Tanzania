-- MilkyWay V27.4: allow signed-in users to view ended Live history,
-- while allowing each host to delete only their own ended Live rooms.
-- Run this migration once in Supabase SQL Editor.

ALTER TABLE public.mw_audio_live_rooms ENABLE ROW LEVEL SECURITY;

-- History needs to be readable by authenticated users.
DROP POLICY IF EXISTS "mw_live_rooms_ended_history_read" ON public.mw_audio_live_rooms;
CREATE POLICY "mw_live_rooms_ended_history_read"
ON public.mw_audio_live_rooms
FOR SELECT
TO authenticated
USING (status = 'ended' OR status = 'live');

-- A host may delete only their own rooms after they have ended.
DROP POLICY IF EXISTS "mw_live_rooms_host_delete_ended" ON public.mw_audio_live_rooms;
CREATE POLICY "mw_live_rooms_host_delete_ended"
ON public.mw_audio_live_rooms
FOR DELETE
TO authenticated
USING (host_id = auth.uid() AND status = 'ended');

GRANT SELECT, DELETE ON public.mw_audio_live_rooms TO authenticated;
