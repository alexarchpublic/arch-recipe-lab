-- Persistent, monotonic recipe numbers for client reference

-- Create sequence if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'recipes_display_number_seq') THEN
    CREATE SEQUENCE public.recipes_display_number_seq START 1 OWNED BY NONE;
  END IF;
END$$;

-- Add column with default nextval
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS display_number BIGINT UNIQUE;

-- Backfill existing rows: assign numbers by created_at order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.recipes
  WHERE display_number IS NULL
)
UPDATE public.recipes r
SET display_number = o.rn
FROM ordered o
WHERE r.id = o.id;

-- Set default to sequence for future inserts; initialize sequence beyond current max
SELECT setval('public.recipes_display_number_seq', COALESCE((SELECT MAX(display_number) FROM public.recipes), 0));

ALTER TABLE public.recipes
  ALTER COLUMN display_number SET DEFAULT nextval('public.recipes_display_number_seq');

COMMENT ON COLUMN public.recipes.display_number IS 'Persistent human-friendly recipe number';


