-- Fix all numeric fields in finance table
-- Ensure discount, surcharge, and other monetary fields are properly typed as DECIMAL

-- Convert discount field to DECIMAL(10,2) if it's currently TEXT
ALTER TABLE finance ALTER COLUMN discount TYPE DECIMAL(10,2) USING 
  CASE 
    WHEN discount IS NULL OR discount = '' THEN NULL
    WHEN discount ~ '^[0-9]*\.?[0-9]+$' THEN CAST(discount AS DECIMAL(10,2))
    WHEN discount ~ '^[0-9]*\,[0-9]+$' THEN CAST(REPLACE(discount, ',', '.') AS DECIMAL(10,2))
    WHEN discount ~ '^[0-9]*\.?[0-9]*,[0-9]+$' THEN CAST(REPLACE(REPLACE(discount, '.', ''), ',', '.') AS DECIMAL(10,2))
    ELSE 0.00
  END;

-- Convert surcharge field to DECIMAL(10,2) if it's currently TEXT
ALTER TABLE finance ALTER COLUMN surcharge TYPE DECIMAL(10,2) USING 
  CASE 
    WHEN surcharge IS NULL OR surcharge = '' THEN NULL
    WHEN surcharge ~ '^[0-9]*\.?[0-9]+$' THEN CAST(surcharge AS DECIMAL(10,2))
    WHEN surcharge ~ '^[0-9]*\,[0-9]+$' THEN CAST(REPLACE(surcharge, ',', '.') AS DECIMAL(10,2))
    WHEN surcharge ~ '^[0-9]*\.?[0-9]*,[0-9]+$' THEN CAST(REPLACE(REPLACE(surcharge, '.', ''), ',', '.') AS DECIMAL(10,2))
    ELSE 0.00
  END;

-- Add comments to clarify field types
COMMENT ON COLUMN finance.discount IS 'Valor do desconto (decimal com 2 casas decimais)';
COMMENT ON COLUMN finance.surcharge IS 'Valor do acréscimo (decimal com 2 casas decimais)';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS finance_discount_idx ON finance(discount);
CREATE INDEX IF NOT EXISTS finance_surcharge_idx ON finance(surcharge);

-- Log the migration completion
DO $$
BEGIN
  RAISE NOTICE 'Finance numeric fields migration completed: discount and surcharge converted to DECIMAL(10,2)';
END $$;
