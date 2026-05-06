-- Add soft-archive support for recipes
ALTER TABLE public.recipes
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_recipes_archived_at ON public.recipes (archived_at);

