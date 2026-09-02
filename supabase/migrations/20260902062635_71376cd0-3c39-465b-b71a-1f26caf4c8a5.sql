DROP POLICY IF EXISTS "app_settings readable by everyone" ON public.app_settings;
REVOKE SELECT ON public.app_settings FROM anon;

CREATE POLICY "app_settings readable by admins"
ON public.app_settings FOR SELECT
TO authenticated
USING (
  app_private.has_role(auth.uid(), 'admin')
  OR app_private.has_role(auth.uid(), 'super_admin')
);