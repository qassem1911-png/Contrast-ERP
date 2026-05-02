-- Admin RPC: create profile + assign role for an existing auth user
-- Caller must be super_admin. Creates/updates the profile row and sets the role.
CREATE OR REPLACE FUNCTION public.admin_create_user(
  _user_id uuid,
  _email text,
  _arabic_name text,
  _role app_role,
  _phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only super admins can create users';
  END IF;

  IF _user_id IS NULL OR _email IS NULL OR _arabic_name IS NULL OR _role IS NULL THEN
    RAISE EXCEPTION 'Missing required fields';
  END IF;

  -- Upsert profile (handle_new_user trigger may have already created one)
  INSERT INTO public.profiles (id, email, arabic_name, phone, is_active)
  VALUES (_user_id, _email, _arabic_name, _phone, true)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        arabic_name = EXCLUDED.arabic_name,
        phone = EXCLUDED.phone,
        is_active = true,
        updated_at = now();

  -- Reset roles and assign the requested one
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role);

  INSERT INTO public.audit_logs (action_type, table_name, record_id, user_id, after_value)
  VALUES ('user_created', 'profiles', _user_id::text, auth.uid(),
          jsonb_build_object('email', _email, 'role', _role, 'arabic_name', _arabic_name));

  RETURN _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_user(uuid, text, text, app_role, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_user(uuid, text, text, app_role, text) TO authenticated;