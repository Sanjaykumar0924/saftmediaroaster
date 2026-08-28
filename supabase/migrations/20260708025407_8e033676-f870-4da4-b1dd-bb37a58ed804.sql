
-- Ensure handle_new_user trigger is attached to auth.users so future signups auto-provision profile + member role
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for any existing auth users that don't have one
INSERT INTO public.profiles (id, username, full_name, is_active)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'username', split_part(u.email,'@',1)) AS username,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'username', split_part(u.email,'@',1)) AS full_name,
  true
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Backfill member role for any authenticated user missing a role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'member'::app_role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
WHERE r.user_id IS NULL
ON CONFLICT DO NOTHING;
