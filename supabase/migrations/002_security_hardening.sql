-- Ensure existing installations do not trust user-controlled signup metadata
-- when assigning profile roles.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'customer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Keep profile self-service limited to ordinary account details. Application
-- service-role operations can still manage roles through trusted server code.
REVOKE UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT UPDATE (full_name, phone, company) ON TABLE public.profiles TO authenticated;
