ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS nos integer NOT NULL DEFAULT 1;
UPDATE public.inventory_items SET status = 'active', working_status = 'working';
ALTER TABLE public.inventory_items ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE public.inventory_items ALTER COLUMN working_status SET DEFAULT 'working';

ALTER TABLE public.checklist_entries ADD COLUMN IF NOT EXISTS going_date date;
ALTER TABLE public.checklist_entries ADD COLUMN IF NOT EXISTS return_date date;
UPDATE public.checklist_entries SET going_date = (checked_at AT TIME ZONE 'Asia/Kolkata')::date WHERE checked AND going_date IS NULL AND checked_at IS NOT NULL;
UPDATE public.checklist_entries SET return_date = (returned_at AT TIME ZONE 'Asia/Kolkata')::date WHERE returned AND return_date IS NULL AND returned_at IS NOT NULL;

ALTER TABLE public.roster ADD COLUMN IF NOT EXISTS card text;
ALTER TABLE public.roster ADD COLUMN IF NOT EXISTS talkback text;

INSERT INTO public.app_settings (key, value)
VALUES ('roster_card_options', 'Cam1,Cam2,Cam3,4K,ATEM')
ON CONFLICT (key) DO NOTHING;