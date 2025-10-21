-- Create recipe_screenshots table
CREATE TABLE public.recipe_screenshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.recipe_screenshots ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view screenshots (public read access)
CREATE POLICY "Anyone can view screenshots" 
ON public.recipe_screenshots 
FOR SELECT 
USING (true);

-- Policy: Only authenticated users can insert screenshots
CREATE POLICY "Authenticated users can insert screenshots" 
ON public.recipe_screenshots 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Policy: Only authenticated users can update screenshots
CREATE POLICY "Authenticated users can update screenshots" 
ON public.recipe_screenshots 
FOR UPDATE 
TO authenticated
USING (true);

-- Policy: Only authenticated users can delete screenshots
CREATE POLICY "Authenticated users can delete screenshots" 
ON public.recipe_screenshots 
FOR DELETE 
TO authenticated
USING (true);

-- Create index for better performance
CREATE INDEX idx_recipe_screenshots_recipe_id ON public.recipe_screenshots(recipe_id);
CREATE INDEX idx_recipe_screenshots_display_order ON public.recipe_screenshots(recipe_id, display_order);

-- Create storage bucket for recipe screenshots
INSERT INTO storage.buckets (id, name, public) 
VALUES ('recipe-screenshots', 'recipe-screenshots', true);

-- Storage policies for recipe-screenshots bucket
CREATE POLICY "Public read access for recipe screenshots" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'recipe-screenshots');

CREATE POLICY "Authenticated users can upload recipe screenshots" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'recipe-screenshots');

CREATE POLICY "Authenticated users can update recipe screenshots" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (bucket_id = 'recipe-screenshots');

CREATE POLICY "Authenticated users can delete recipe screenshots" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (bucket_id = 'recipe-screenshots');
