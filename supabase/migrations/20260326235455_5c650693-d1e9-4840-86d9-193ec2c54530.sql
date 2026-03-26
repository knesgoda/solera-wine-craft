ALTER TABLE public.profiles ADD COLUMN language text DEFAULT 'en';
ALTER TABLE public.organizations ADD COLUMN units_preference text DEFAULT 'imperial';