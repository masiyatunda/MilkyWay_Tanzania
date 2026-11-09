-- MilkyWay Stage 2 security hardening.
-- These functions are defined in the existing SQL bundles. Guard each revoke so
-- this migration is safe on projects where an optional bundle has not been applied.
DO $$
BEGIN
  IF to_regprocedure('public.mw_rate_limit(text,integer,integer)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.mw_rate_limit(text, integer, integer) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.mw_rate_limit(text, integer, integer) FROM anon;
    REVOKE ALL ON FUNCTION public.mw_rate_limit(text, integer, integer) FROM authenticated;
  END IF;

  IF to_regprocedure('public.mw_is_admin()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.mw_is_admin() FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.mw_is_admin() FROM anon;
    GRANT EXECUTE ON FUNCTION public.mw_is_admin() TO authenticated;
  END IF;
END $$;
