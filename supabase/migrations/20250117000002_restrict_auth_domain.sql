-- Create function to validate email domain
CREATE OR REPLACE FUNCTION public.validate_email_domain(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN email ~ '^[a-zA-Z0-9._%+-]+@thearchpublic\.com$';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has valid domain
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

-- Update recipes policies to check email domain
DROP POLICY IF EXISTS "Authenticated users can insert recipes" ON public.recipes;
DROP POLICY IF EXISTS "Authenticated users can update recipes" ON public.recipes;
DROP POLICY IF EXISTS "Authenticated users can delete recipes" ON public.recipes;

CREATE POLICY "Arch Public users can insert recipes" 
ON public.recipes 
FOR INSERT 
TO authenticated
WITH CHECK (public.user_has_valid_domain());

CREATE POLICY "Arch Public users can update recipes" 
ON public.recipes 
FOR UPDATE 
TO authenticated
USING (public.user_has_valid_domain());

CREATE POLICY "Arch Public users can delete recipes" 
ON public.recipes 
FOR DELETE 
TO authenticated
USING (public.user_has_valid_domain());

-- Update recipe_screenshots policies to check email domain
DROP POLICY IF EXISTS "Authenticated users can insert screenshots" ON public.recipe_screenshots;
DROP POLICY IF EXISTS "Authenticated users can update screenshots" ON public.recipe_screenshots;
DROP POLICY IF EXISTS "Authenticated users can delete screenshots" ON public.recipe_screenshots;

CREATE POLICY "Arch Public users can insert screenshots" 
ON public.recipe_screenshots 
FOR INSERT 
TO authenticated
WITH CHECK (public.user_has_valid_domain());

CREATE POLICY "Arch Public users can update screenshots" 
ON public.recipe_screenshots 
FOR UPDATE 
TO authenticated
USING (public.user_has_valid_domain());

CREATE POLICY "Arch Public users can delete screenshots" 
ON public.recipe_screenshots 
FOR DELETE 
TO authenticated
USING (public.user_has_valid_domain());

-- Update storage policies to check email domain
DROP POLICY IF EXISTS "Authenticated users can upload recipe screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update recipe screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete recipe screenshots" ON storage.objects;

CREATE POLICY "Arch Public users can upload recipe screenshots" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'recipe-screenshots' AND public.user_has_valid_domain());

CREATE POLICY "Arch Public users can update recipe screenshots" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (bucket_id = 'recipe-screenshots' AND public.user_has_valid_domain());

CREATE POLICY "Arch Public users can delete recipe screenshots" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (bucket_id = 'recipe-screenshots' AND public.user_has_valid_domain());
