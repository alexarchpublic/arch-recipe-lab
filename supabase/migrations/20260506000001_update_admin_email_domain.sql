-- Update email domain restriction for admin (RLS enforcement)
CREATE OR REPLACE FUNCTION public.validate_email_domain(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN email ~ '^[a-zA-Z0-9._%+-]+@archpublic\.com$';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure any dependent helper picks up the updated validation logic
CREATE OR REPLACE FUNCTION public.user_has_valid_domain()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
      AND public.validate_email_domain(auth.users.email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

