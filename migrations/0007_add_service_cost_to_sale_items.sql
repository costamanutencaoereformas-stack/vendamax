-- Add service_cost to sale_items to persist cost for service items
ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS service_cost NUMERIC(10,2);
