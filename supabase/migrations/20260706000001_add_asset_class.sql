-- Add asset_class taxonomy to recipes (Equities, ETFs, Crypto)
ALTER TABLE public.recipes
ADD COLUMN IF NOT EXISTS asset_class TEXT NOT NULL DEFAULT 'Crypto'
CHECK (asset_class IN ('Equities', 'ETFs', 'Crypto'));

CREATE INDEX IF NOT EXISTS idx_recipes_asset_class ON public.recipes (asset_class);

-- Equities and ETFs recipes must use Market Wave; Crypto may use any algorithm
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recipes_asset_class_algorithm_check'
      AND conrelid = 'public.recipes'::regclass
  ) THEN
    ALTER TABLE public.recipes
    ADD CONSTRAINT recipes_asset_class_algorithm_check
    CHECK (asset_class = 'Crypto' OR algorithm = 'Market Wave');
  END IF;
END $$;

COMMENT ON COLUMN public.recipes.asset_class IS
  'Asset class taxonomy: Equities, ETFs, or Crypto. Non-Crypto classes require Market Wave algorithm.';
