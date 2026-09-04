ALTER TABLE public.extra_services ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS extra_services_deleted_at_idx ON public.extra_services (deleted_at);