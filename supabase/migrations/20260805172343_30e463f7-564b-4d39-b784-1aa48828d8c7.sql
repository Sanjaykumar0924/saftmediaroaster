-- 1. return tick on checklist entries
ALTER TABLE public.checklist_entries
  ADD COLUMN IF NOT EXISTS returned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS returned_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS returned_at timestamptz;

-- recipients of a shared checklist can tick items
DROP POLICY IF EXISTS chk_recipient_write ON public.checklist_entries;
CREATE POLICY chk_recipient_write ON public.checklist_entries
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.checklist_shares s
                 WHERE s.service_id = checklist_entries.service_id AND s.recipient_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.checklist_shares s
                 WHERE s.service_id = checklist_entries.service_id AND s.recipient_id = auth.uid()));

-- 2. checklist reports
CREATE TABLE IF NOT EXISTS public.checklist_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.mpc_services(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id),
  kind text NOT NULL DEFAULT 'issue',
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.checklist_reports TO authenticated;
GRANT ALL ON public.checklist_reports TO service_role;
ALTER TABLE public.checklist_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reports_insert_own ON public.checklist_reports;
CREATE POLICY reports_insert_own ON public.checklist_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS reports_select_own_or_admin ON public.checklist_reports;
CREATE POLICY reports_select_own_or_admin ON public.checklist_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::app_role));

-- 3. chat settings
CREATE TABLE IF NOT EXISTS public.chat_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  members_can_send boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.chat_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
GRANT SELECT ON public.chat_settings TO authenticated;
GRANT ALL ON public.chat_settings TO service_role;
ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS chat_settings_select ON public.chat_settings;
CREATE POLICY chat_settings_select ON public.chat_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS chat_settings_admin ON public.chat_settings;
CREATE POLICY chat_settings_admin ON public.chat_settings FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'::app_role));
GRANT INSERT, UPDATE ON public.chat_settings TO authenticated;

-- 4. messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS messages_select_auth ON public.messages;
CREATE POLICY messages_select_auth ON public.messages FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS messages_insert_allowed ON public.messages;
CREATE POLICY messages_insert_allowed ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      app_private.has_role(auth.uid(), 'admin'::app_role)
      OR COALESCE((SELECT members_can_send FROM public.chat_settings WHERE id), true)
    )
  );
DROP POLICY IF EXISTS messages_delete_own_or_admin ON public.messages;
CREATE POLICY messages_delete_own_or_admin ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.checklist_entries REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_entries;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;