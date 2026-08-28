-- enums
CREATE TYPE public.item_status AS ENUM ('active','inactive');
CREATE TYPE public.item_working_status AS ENUM ('working','not_working');
CREATE TYPE public.seniority_level AS ENUM ('super_senior','senior','junior','newbie');

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS seniority public.seniority_level;

-- inventory
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  item_name text NOT NULL,
  brand_name text,
  status public.item_status NOT NULL DEFAULT 'active',
  working_status public.item_working_status NOT NULL DEFAULT 'working',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY inv_select_auth ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY inv_admin_all ON public.inventory_items FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin')) WITH CHECK (app_private.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_inv_updated BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MPC services (2nd Saturday etc.)
CREATE TABLE public.mpc_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  service_date date NOT NULL,
  location text NOT NULL DEFAULT 'MPC',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mpc_services TO authenticated;
GRANT ALL ON public.mpc_services TO service_role;
ALTER TABLE public.mpc_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY mpc_select_auth ON public.mpc_services FOR SELECT TO authenticated USING (true);
CREATE POLICY mpc_admin_all ON public.mpc_services FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin')) WITH CHECK (app_private.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_mpc_updated BEFORE UPDATE ON public.mpc_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- checklist ticks
CREATE TABLE public.checklist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.mpc_services(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  checked boolean NOT NULL DEFAULT false,
  checked_by uuid REFERENCES auth.users(id),
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_entries TO authenticated;
GRANT ALL ON public.checklist_entries TO service_role;
ALTER TABLE public.checklist_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY chk_select_auth ON public.checklist_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY chk_admin_all ON public.checklist_entries FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin')) WITH CHECK (app_private.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_chk_updated BEFORE UPDATE ON public.checklist_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- checklist shares
CREATE TABLE public.checklist_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.mpc_services(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_shares TO authenticated;
GRANT ALL ON public.checklist_shares TO service_role;
ALTER TABLE public.checklist_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY share_select_own_or_admin ON public.checklist_shares FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY share_admin_all ON public.checklist_shares FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin')) WITH CHECK (app_private.has_role(auth.uid(), 'admin'));

-- extra (non Sunday/Tuesday) services
CREATE TABLE public.extra_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  service_date date NOT NULL,
  start_time time,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extra_services TO authenticated;
GRANT ALL ON public.extra_services TO service_role;
ALTER TABLE public.extra_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY extra_select_auth ON public.extra_services FOR SELECT TO authenticated USING (true);
CREATE POLICY extra_admin_all ON public.extra_services FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin')) WITH CHECK (app_private.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_extra_updated BEFORE UPDATE ON public.extra_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.extra_service_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extra_service_id uuid NOT NULL REFERENCES public.extra_services(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.availability_status NOT NULL DEFAULT 'pending',
  unavailable_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (extra_service_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extra_service_availability TO authenticated;
GRANT ALL ON public.extra_service_availability TO service_role;
ALTER TABLE public.extra_service_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY esa_select_own_or_admin ON public.extra_service_availability FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'));
CREATE POLICY esa_manage_own ON public.extra_service_availability FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY esa_admin_all ON public.extra_service_availability FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'admin')) WITH CHECK (app_private.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_esa_updated BEFORE UPDATE ON public.extra_service_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- rolling 3-month roster retention
CREATE OR REPLACE FUNCTION public.purge_old_rosters()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.roster WHERE service_date < (current_date - interval '3 months');
$$;
REVOKE EXECUTE ON FUNCTION public.purge_old_rosters() FROM public, anon, authenticated;