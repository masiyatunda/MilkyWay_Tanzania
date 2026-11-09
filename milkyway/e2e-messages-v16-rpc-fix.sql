-- MilkyWay V28.6: safely publish E2E public keys via authenticated RPC.
-- Run in the SAME Supabase project configured in Render.
-- This does not disable RLS. It derives user_id from auth.uid() on the server.

CREATE OR REPLACE FUNCTION public.mw_e2e_publish_key(
  p_public_jwk jsonb,
  p_key_version integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated: sign in before publishing E2E key';
  END IF;

  IF p_public_jwk IS NULL
     OR p_public_jwk->>'kty' IS DISTINCT FROM 'EC'
     OR p_public_jwk->>'crv' IS DISTINCT FROM 'P-256'
     OR p_public_jwk->>'x' IS NULL
     OR p_public_jwk->>'y' IS NULL THEN
    RAISE EXCEPTION 'Invalid E2E public key payload';
  END IF;

  INSERT INTO public.mw_e2e_keys (user_id, public_jwk, key_version, updated_at)
  VALUES (v_uid, p_public_jwk, COALESCE(p_key_version, 1), now())
  ON CONFLICT (user_id) DO UPDATE
    SET updated_at = now()
    WHERE public.mw_e2e_keys.public_jwk = EXCLUDED.public_jwk;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'An E2E key already exists and differs from this device key; refusing to replace it';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mw_e2e_publish_key(jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mw_e2e_publish_key(jsonb, integer) TO authenticated;

-- Keep key reads limited to authenticated users; do not disable RLS.
ALTER TABLE public.mw_e2e_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mw_e2e_keys_read ON public.mw_e2e_keys;
CREATE POLICY mw_e2e_keys_read ON public.mw_e2e_keys
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.mw_e2e_keys TO authenticated;
NOTIFY pgrst, 'reload schema';
