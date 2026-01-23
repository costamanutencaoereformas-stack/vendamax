-- Fix amount field type in finance table
-- Convert amount from TEXT to DECIMAL(10,2) to ensure proper numeric storage

-- First, create a backup of the data
CREATE TABLE IF NOT EXISTS finance_backup AS SELECT * FROM finance;

-- Convert amount field to proper decimal type
-- This will handle string to decimal conversion
ALTER TABLE finance ALTER COLUMN amount TYPE DECIMAL(10,2) USING 
  CASE 
    WHEN amount ~ '^[0-9]*\.?[0-9]+$' THEN CAST(amount AS DECIMAL(10,2))
    WHEN amount ~ '^[0-9]*\,[0-9]+$' THEN CAST(REPLACE(amount, ',', '.') AS DECIMAL(10,2))
    WHEN amount ~ '^[0-9]*\.?[0-9]*,[0-9]+$' THEN CAST(REPLACE(REPLACE(amount, '.', ''), ',', '.') AS DECIMAL(10,2))
    ELSE 0.00
  END;

-- Update any records that might have invalid amounts
UPDATE finance 
SET amount = 0.00 
WHERE amount IS NULL OR amount = '' OR amount NOT ~ '^[0-9]*\.?[0-9]*([,\.][0-9]*)?$';

-- Add comment to clarify the field type
COMMENT ON COLUMN finance.amount IS 'Valor monetário do lançamento (decimal com 2 casas decimais)';

-- Create index for amount field for better query performance
CREATE INDEX IF NOT EXISTS finance_amount_idx ON finance(amount);

-- Log the migration completion
DO $$
BEGIN
  RAISE NOTICE 'Finance amount field migration completed: Converted to DECIMAL(10,2)';
END $$;
