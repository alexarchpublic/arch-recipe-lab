-- Add algorithm and algorithm_inputs columns to recipes
-- This migration adds a constrained TEXT column for the selected algorithm
-- and a flexible JSONB column to store algorithm-specific inputs.

-- 1) Add columns (nullable initially for safe backfill)
ALTER TABLE public.recipes
ADD COLUMN IF NOT EXISTS algorithm TEXT,
ADD COLUMN IF NOT EXISTS algorithm_inputs JSONB DEFAULT '{}'::jsonb;

-- 2) Backfill algorithm based on existing strategy_type when possible
UPDATE public.recipes
SET algorithm = CASE
  WHEN strategy_type ILIKE '%intelligence%' THEN 'Intelligence Algorithm'
  WHEN strategy_type ILIKE '%arbitrage%' THEN 'Arbitrage Algorithm'
  WHEN strategy_type ILIKE '%oracle%' THEN 'Oracle Protocol'
  ELSE 'Oracle Protocol'
END
WHERE algorithm IS NULL;

-- 3) Set NOT NULL and add CHECK constraint for allowed values
ALTER TABLE public.recipes
ALTER COLUMN algorithm SET NOT NULL;

-- Drop old constraint if re-running
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'recipes_algorithm_check'
  ) THEN
    ALTER TABLE public.recipes DROP CONSTRAINT recipes_algorithm_check;
  END IF;
END$$;

ALTER TABLE public.recipes
ADD CONSTRAINT recipes_algorithm_check
CHECK (algorithm IN ('Intelligence Algorithm','Arbitrage Algorithm','Oracle Protocol'));

-- 4) Ensure algorithm_inputs is NOT NULL with default
UPDATE public.recipes SET algorithm_inputs = '{}'::jsonb WHERE algorithm_inputs IS NULL;
ALTER TABLE public.recipes ALTER COLUMN algorithm_inputs SET NOT NULL;

COMMENT ON COLUMN public.recipes.algorithm IS 'High-level algorithm selection for the recipe UI (documentation-only)';
COMMENT ON COLUMN public.recipes.algorithm_inputs IS 'Algorithm-specific inputs captured as JSON for end-user replication.';


