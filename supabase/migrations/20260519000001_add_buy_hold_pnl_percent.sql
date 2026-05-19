-- Store Market Wave buy & hold benchmark on the recipe row for reliable public reads
ALTER TABLE public.recipes
ADD COLUMN IF NOT EXISTS buy_hold_pnl_percent numeric;

COMMENT ON COLUMN public.recipes.buy_hold_pnl_percent IS
  'Market Wave buy & hold PnL (%) benchmark for strategy comparison.';

-- Backfill from algorithm_inputs JSON when present
UPDATE public.recipes
SET buy_hold_pnl_percent = (algorithm_inputs->>'buyHoldPnlPercent')::numeric
WHERE algorithm = 'Market Wave'
  AND buy_hold_pnl_percent IS NULL
  AND algorithm_inputs ? 'buyHoldPnlPercent'
  AND (algorithm_inputs->>'buyHoldPnlPercent') ~ '^-?[0-9]+(\.[0-9]+)?$';
