-- Add code and projectId columns to finance table
ALTER TABLE finance ADD COLUMN IF NOT EXISTS code VARCHAR;
ALTER TABLE finance ADD COLUMN IF NOT EXISTS project_id VARCHAR;

-- Create unique index on code
CREATE UNIQUE INDEX IF NOT EXISTS finance_code_idx ON finance(code);

-- Generate codes for existing records
DO $$
DECLARE
  rec RECORD;
  new_code VARCHAR;
  counter INTEGER := 1;
BEGIN
  FOR rec IN SELECT id, entry_type, created_at FROM finance WHERE code IS NULL ORDER BY created_at
  LOOP
    -- Generate code based on entry type
    IF rec.entry_type = 'RECEIVABLE' THEN
      new_code := 'REC-' || LPAD(counter::TEXT, 5, '0');
    ELSIF rec.entry_type = 'PAYABLE' THEN
      new_code := 'PAG-' || LPAD(counter::TEXT, 5, '0');
    ELSE
      new_code := 'CX-' || LPAD(counter::TEXT, 5, '0');
    END IF;
    
    -- Update the record
    UPDATE finance SET code = new_code WHERE id = rec.id;
    counter := counter + 1;
  END LOOP;
END $$;

-- Migrate project text to projectId where possible
-- This assumes project field contains project IDs, not names
UPDATE finance 
SET project_id = project 
WHERE project IS NOT NULL 
  AND project <> '' 
  AND project_id IS NULL;
