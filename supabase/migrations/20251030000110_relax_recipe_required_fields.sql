-- Relax NOT NULL constraints for legacy descriptive fields on recipes
-- These are now documented via algorithm_inputs instead of required columns

ALTER TABLE public.recipes
  ALTER COLUMN entry_trade DROP NOT NULL,
  ALTER COLUMN exit_trade DROP NOT NULL,
  ALTER COLUMN exit_to_entry_proportion DROP NOT NULL,
  ALTER COLUMN time_frame DROP NOT NULL,
  ALTER COLUMN backtesting_period DROP NOT NULL;

-- Keep existing data as-is; no default values are required


