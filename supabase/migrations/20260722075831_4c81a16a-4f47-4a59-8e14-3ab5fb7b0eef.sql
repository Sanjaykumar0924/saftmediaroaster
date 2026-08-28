
-- TEAMS
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams_select_authenticated" ON public.teams;
CREATE POLICY "teams_select_authenticated" ON public.teams
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "teams_super_admin_all" ON public.teams;
CREATE POLICY "teams_super_admin_all" ON public.teams
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'));

DROP TRIGGER IF EXISTS teams_updated_at ON public.teams;
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.teams (name, slug, description) VALUES
  ('Media Team', 'media', 'Cameras, streaming, projection, and audio/visual worship support.'),
  ('Editing Team', 'editing', 'Post-production video, thumbnails, social clips, and archives.')
ON CONFLICT (slug) DO NOTHING;

-- PROFILES.team_id
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
UPDATE public.profiles SET team_id = (SELECT id FROM public.teams WHERE slug = 'media')
  WHERE team_id IS NULL;

-- ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs_super_admin_select" ON public.activity_logs;
CREATE POLICY "activity_logs_super_admin_select" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'));

CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON public.activity_logs (created_at DESC);
