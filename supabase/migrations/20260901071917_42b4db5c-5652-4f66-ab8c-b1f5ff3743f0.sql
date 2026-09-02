ALTER TABLE public.attendance ALTER COLUMN service_type DROP NOT NULL;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_service_target_chk
  CHECK (service_type IS NOT NULL OR extra_service_id IS NOT NULL);