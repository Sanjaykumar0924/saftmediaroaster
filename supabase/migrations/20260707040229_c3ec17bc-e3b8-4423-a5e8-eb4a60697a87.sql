
-- Roster status
ALTER TABLE public.roster ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
ALTER TABLE public.roster ADD COLUMN IF NOT EXISTS published_at timestamptz;
DO $$ BEGIN
  ALTER TABLE public.roster ADD CONSTRAINT roster_status_check CHECK (status IN ('draft','published'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Existing rows were previously visible to all; treat them as published
UPDATE public.roster SET status='published', published_at=COALESCE(published_at, now()) WHERE status='draft';

-- Replace member SELECT policy: members only see published
DROP POLICY IF EXISTS roster_select_authenticated ON public.roster;
CREATE POLICY roster_select_published ON public.roster
  FOR SELECT TO authenticated
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));

-- Realtime: replica identity + publication
ALTER TABLE public.roster REPLICA IDENTITY FULL;
ALTER TABLE public.availability REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.announcements REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.roster;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.availability;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Members can update their own profile phone/photo already covered by profiles_update_own
