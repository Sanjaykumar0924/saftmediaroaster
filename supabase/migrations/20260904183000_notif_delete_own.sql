-- Allow authenticated users to delete their own notifications
DROP POLICY IF EXISTS notif_delete_own ON public.notifications;
CREATE POLICY notif_delete_own ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
