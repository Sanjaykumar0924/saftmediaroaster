
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS team text NOT NULL DEFAULT 'media';

ALTER TABLE public.availability
  ADD COLUMN IF NOT EXISTS unavailable_reason text,
  ADD COLUMN IF NOT EXISTS responsible boolean,
  ADD COLUMN IF NOT EXISTS responsible_reason text;

INSERT INTO public.user_roles (user_id, role)
VALUES ('fc2b1fc6-0c6c-41d9-aa3b-7a17f1b0e49f'::uuid, 'super_admin'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('fc2b1fc6-0c6c-41d9-aa3b-7a17f1b0e49f'::uuid, 'admin'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles
  SET contact_email = 'sanjaykumarh0078@gmail.com'
  WHERE id = 'fc2b1fc6-0c6c-41d9-aa3b-7a17f1b0e49f'::uuid;
