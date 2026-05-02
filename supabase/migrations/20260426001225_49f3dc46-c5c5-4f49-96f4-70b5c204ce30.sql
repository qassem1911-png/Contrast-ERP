CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _arabic_name TEXT;
  _phone TEXT;
BEGIN
  _arabic_name := COALESCE(NEW.raw_user_meta_data->>'arabic_name', '');
  _phone := NEW.raw_user_meta_data->>'phone';

  INSERT INTO public.profiles (id, email, arabic_name, phone)
  VALUES (NEW.id, NEW.email, _arabic_name, _phone);

  -- Default role for every new user; promote to super_admin manually via SQL or the Users dashboard.
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'technician');

  RETURN NEW;
END;
$function$;