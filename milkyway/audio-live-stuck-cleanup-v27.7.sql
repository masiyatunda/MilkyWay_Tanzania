-- MilkyWay V27.7: allow each authenticated host to remove their own stuck Live room.
-- Run once in Supabase SQL Editor. Does not allow deleting another user's room.
ALTER TABLE public.mw_audio_live_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mw_live_rooms_host_delete_own_live_v27_7" ON public.mw_audio_live_rooms;
CREATE POLICY "mw_live_rooms_host_delete_own_live_v27_7"
ON public.mw_audio_live_rooms
FOR DELETE TO authenticated
USING (host_id = auth.uid() AND status = 'live');
GRANT DELETE ON public.mw_audio_live_rooms TO authenticated;

-- Optional cleanup of participant rows is handled by the app after room deletion.
-- If the participants table has restrictive RLS, room deletion still remains host-scoped.
