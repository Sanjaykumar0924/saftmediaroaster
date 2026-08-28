
CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Drop ALL existing policies on affected tables/storage so we start clean
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE (schemaname='public' AND tablename IN ('profiles','user_roles','attendance','availability','announcements','notifications','roster'))
       OR (schemaname='storage' AND tablename='objects' AND policyname LIKE 'avatars_%')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.claim_admin(text);
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- profiles
CREATE POLICY profiles_select_own_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY profiles_insert_self ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.member_directory AS
SELECT id, username, full_name, role_title, photo_url, is_active FROM public.profiles;
GRANT SELECT ON public.member_directory TO authenticated;

-- user_roles
CREATE POLICY roles_select_own_or_admin ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY roles_admin_manage ON public.user_roles
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

-- attendance
CREATE POLICY att_select_own_or_admin ON public.attendance
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY att_admin_manage ON public.attendance
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

-- availability
CREATE POLICY avail_select_own_or_admin ON public.availability
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY avail_manage_own ON public.availability
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY avail_admin_all ON public.availability
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

-- announcements
CREATE POLICY ann_select_authenticated ON public.announcements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ann_admin_manage ON public.announcements
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

-- notifications
CREATE POLICY notif_select_own ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notif_update_own ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notif_admin_manage ON public.notifications
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

-- roster
CREATE POLICY roster_select_published_or_own ON public.roster
  FOR SELECT TO authenticated
  USING (status = 'published' OR assigned_user_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY roster_admin_manage ON public.roster
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

-- storage: avatars
CREATE POLICY avatars_read_own_or_admin ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars'
         AND ((storage.foldername(name))[1] = (auth.uid())::text
              OR app_private.has_role(auth.uid(), 'admin')));
CREATE POLICY avatars_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);
CREATE POLICY avatars_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);
CREATE POLICY avatars_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);
CREATE POLICY avatars_admin_all ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND app_private.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'avatars' AND app_private.has_role(auth.uid(), 'admin'));
