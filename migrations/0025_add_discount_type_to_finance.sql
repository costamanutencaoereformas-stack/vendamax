-- Add discount_type and surcharge_type columns to finance table
-- Allows distinguishing between PERCENTAGE (%) and FIXED_VALUE discounts/surcharges

ALTER TABLE finance ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'FIXED_VALUE';
ALTER TABLE finance ADD COLUMN IF NOT EXISTS surcharge_type TEXT DEFAULT 'FIXED_VALUE';

-- Create indexes for faster filtering
CREATE INDEX IF NOT EXISTS finance_discount_type_idx ON finance(discount_type);
CREATE INDEX IF NOT EXISTS finance_surcharge_type_idx ON finance(surcharge_type);

-- Set comments on the columns
COMMENT ON COLUMN finance.discount_type IS 'Type of discount: PERCENTAGE (%) or FIXED_VALUE (R$)';
COMMENT ON COLUMN finance.surcharge_type IS 'Type of surcharge: PERCENTAGE (%) or FIXED_VALUE (R$)';
