CREATE OR REPLACE FUNCTION public.enforce_availability_cutoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamp;
  now_ist timestamp := (now() AT TIME ZONE 'Asia/Kolkata');
BEGIN
  -- Admins and super admins bypass the cutoff entirely.
  IF auth.uid() IS NULL
     OR app_private.has_role(auth.uid(), 'admin')
     OR app_private.has_role(auth.uid(), 'super_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.service_type = 'sunday_morning' THEN
    cutoff := NEW.service_date::timestamp + interval '11 hours';
  ELSIF NEW.service_type = 'sunday_evening' THEN
    cutoff := NEW.service_date::timestamp + interval '19 hours';
  ELSE
    RETURN NEW;
  END IF;

  IF now_ist > cutoff THEN
    RAISE EXCEPTION 'Availability for this service is closed (cutoff has passed).';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_availability_cutoff ON public.availability;
CREATE TRIGGER trg_availability_cutoff
BEFORE INSERT OR UPDATE ON public.availability
FOR EACH ROW EXECUTE FUNCTION public.enforce_availability_cutoff();