
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS team text NOT NULL DEFAULT 'media';

ALTER TABLE public.availability
  ADD COLUMN IF NOT EXISTS unavailable_reason text,
  ADD COLUMN IF NOT EXISTS responsible boolean,
  ADD COLUMN IF NOT EXISTS responsible_reason text;

