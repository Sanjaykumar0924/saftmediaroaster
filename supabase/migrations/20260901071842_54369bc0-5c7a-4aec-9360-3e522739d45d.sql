ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS extra_service_id uuid REFERENCES public.extra_services(id) ON DELETE CASCADE;

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_user_id_service_date_service_type_key;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_user_service_unique
  UNIQUE NULLS NOT DISTINCT (user_id, service_date, service_type, extra_service_id);

CREATE INDEX IF NOT EXISTS attendance_extra_service_idx ON public.attendance (extra_service_id);