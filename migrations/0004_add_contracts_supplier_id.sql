-- Add optional supplier_id to contracts
ALTER TABLE "contracts"
  ADD COLUMN IF NOT EXISTS "supplier_id" varchar NULL REFERENCES "suppliers"("id");

-- Note: existing rows remain valid (NULL supplier_id). Ensure application validation requires at least one of customer_id or supplier_id.
