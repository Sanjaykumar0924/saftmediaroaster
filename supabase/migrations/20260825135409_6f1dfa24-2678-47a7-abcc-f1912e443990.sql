REVOKE ALL ON FUNCTION public.purge_old_messages() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_old_checklist_reports() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_finished_mpz_services() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_housekeeping() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_housekeeping() TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_old_messages() TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_old_checklist_reports() TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_finished_mpz_services() TO service_role;