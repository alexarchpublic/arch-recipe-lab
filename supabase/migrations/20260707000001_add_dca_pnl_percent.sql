-- Store Market Wave DCA benchmark on the recipe row for reliable public reads
ALTER TABLE public.recipes
ADD COLUMN IF NOT EXISTS dca_pnl_percent numeric;

COMMENT ON COLUMN public.recipes.dca_pnl_percent IS
  'Market Wave DCA PnL (%) benchmark for strategy comparison.';

-- Backfill from algorithm_inputs JSON when present
UPDATE public.recipes
SET dca_pnl_percent = (algorithm_inputs->>'dcaPnlPercent')::numeric
WHERE algorithm = 'Market Wave'
  AND dca_pnl_percent IS NULL
  AND algorithm_inputs ? 'dcaPnlPercent'
  AND (algorithm_inputs->>'dcaPnlPercent') ~ '^-?[0-9]+(\.[0-9]+)?$';
