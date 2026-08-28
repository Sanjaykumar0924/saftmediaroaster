
CREATE OR REPLACE FUNCTION public.claim_admin(_access_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _access_key IS DISTINCT FROM 'SAFTABERNACLE' THEN
    RETURN FALSE;
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_admin(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_admin(TEXT) TO authenticated;
