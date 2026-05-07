-- Allow 'Market Wave' as a valid algorithm value on recipes
-- Replaces the previous CHECK constraint to add the new option.

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
CHECK (algorithm IN (
  'Intelligence Algorithm',
  'Arbitrage Algorithm',
  'Oracle Protocol',
  'Market Wave'
));
