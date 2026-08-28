CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings readable by everyone"
ON public.app_settings FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "app_settings writable by admins"
ON public.app_settings FOR ALL
TO authenticated
USING (app_private.has_role(auth.uid(), 'admin') OR app_private.has_role(auth.uid(), 'super_admin'))
WITH CHECK (app_private.has_role(auth.uid(), 'admin') OR app_private.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_app_settings_updated
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (key, value) VALUES ('admin_access_key', 'SAFT@2026')
ON CONFLICT (key) DO NOTHING;