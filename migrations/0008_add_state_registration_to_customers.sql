-- Add state registration fields to customers table for CNPJ customers
ALTER TABLE customers ADD COLUMN state_registration text;
ALTER TABLE customers ADD COLUMN state_registration_exempt boolean DEFAULT false;
