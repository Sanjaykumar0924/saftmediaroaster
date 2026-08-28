CREATE OR REPLACE FUNCTION public.purge_old_messages()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.messages WHERE created_at < (now() - interval '7 days');
$$;

CREATE OR REPLACE FUNCTION public.purge_old_checklist_reports()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.checklist_reports WHERE created_at < (now() - interval '7 days');
$$;

CREATE OR REPLACE FUNCTION public.purge_finished_mpz_services()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.mpc_services
  WHERE service_date < current_date
    AND id NOT IN (
      SELECT id FROM public.mpc_services
      WHERE service_date < current_date
      ORDER BY service_date DESC
      LIMIT 5
    );
$$;

CREATE OR REPLACE FUNCTION public.run_housekeeping()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.purge_old_messages();
  PERFORM public.purge_old_checklist_reports();
  PERFORM public.purge_finished_mpz_services();
  PERFORM public.purge_old_rosters();
END; $$;

GRANT EXECUTE ON FUNCTION public.run_housekeeping() TO authenticated;

-- Admins may remove checklist reports
DROP POLICY IF EXISTS "Admins can delete checklist reports" ON public.checklist_reports;
CREATE POLICY "Admins can delete checklist reports"
ON public.checklist_reports FOR DELETE TO authenticated
USING (app_private.has_role(auth.uid(), 'admin') OR reporter_id = auth.uid());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('saft-housekeeping') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'saft-housekeeping'
    );
    PERFORM cron.schedule('saft-housekeeping', '17 3 * * *', 'SELECT public.run_housekeeping();');
  END IF;
END $$;