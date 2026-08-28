ALTER TABLE public.checklist_reports REPLICA IDENTITY FULL;
ALTER TABLE public.checklist_shares REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checklist_shares;