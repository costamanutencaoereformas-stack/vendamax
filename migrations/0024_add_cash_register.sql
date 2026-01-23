-- Add Cash Register tables for PDV system

CREATE TABLE IF NOT EXISTS "cash_registers" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CLOSED',
  "user_id" VARCHAR REFERENCES "users"("id"),
  "opened_at" TIMESTAMP,
  "closed_at" TIMESTAMP,
  "opening_balance" DECIMAL(10, 2) DEFAULT '0',
  "current_balance" DECIMAL(10, 2) DEFAULT '0',
  "expected_balance" DECIMAL(10, 2) DEFAULT '0',
  "closing_balance" DECIMAL(10, 2),
  "difference" DECIMAL(10, 2),
  "notes" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "cash_movements" (
  "id" VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  "register_id" VARCHAR NOT NULL REFERENCES "cash_registers"("id"),
  "type" TEXT NOT NULL,
  "description" TEXT,
  "amount" DECIMAL(10, 2) NOT NULL,
  "payment_method" TEXT,
  "sale_id" VARCHAR REFERENCES "sales"("id"),
  "user_id" VARCHAR REFERENCES "users"("id"),
  "created_at" TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_cash_registers_status" ON "cash_registers"("status");
CREATE INDEX IF NOT EXISTS "idx_cash_registers_user_id" ON "cash_registers"("user_id");
CREATE INDEX IF NOT EXISTS "idx_cash_movements_register_id" ON "cash_movements"("register_id");
CREATE INDEX IF NOT EXISTS "idx_cash_movements_type" ON "cash_movements"("type");
CREATE INDEX IF NOT EXISTS "idx_cash_movements_sale_id" ON "cash_movements"("sale_id");
