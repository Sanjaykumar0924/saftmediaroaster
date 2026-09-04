-- Fix member_directory view to include seniority field
-- so the checklist ShareDialog can display member levels.
CREATE OR REPLACE VIEW public.member_directory AS
SELECT id, username, full_name, role_title, seniority, photo_url, is_active
FROM public.profiles;

-- Ensure authenticated users can read the directory
GRANT SELECT ON public.member_directory TO authenticated;

-- Allow all authenticated members to see all profiles
-- (needed so any logged-in user can see the full team list)
DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;
CREATE POLICY profiles_select_all_authenticated ON public.profiles
  FOR SELECT TO authenticated
  USING (true);
