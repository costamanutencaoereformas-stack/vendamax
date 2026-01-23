-- Migration: Update Database Schema
-- Add missing tables and columns

-- 1. Create missing tables

-- Quote Attachments (already exists, but adding missing columns if needed)
ALTER TABLE quote_attachments
ADD COLUMN IF NOT EXISTS file_size INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id);

-- Project Documents (if not exists)
CREATE TABLE IF NOT EXISTS project_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT
);

-- Contract Documents (if not exists)
CREATE TABLE IF NOT EXISTS contract_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT
);

-- 2. Add missing indexes

-- For better performance on common queries
CREATE INDEX IF NOT EXISTS idx_quote_attachments_quote_id ON quote_attachments(quote_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_contract_documents_contract_id ON contract_documents(contract_id);

-- 3. Add foreign key constraints if they don't exist

-- For quote_attachments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'quote_attachments_quote_id_fkey'
    ) THEN
        ALTER TABLE quote_attachments 
        ADD CONSTRAINT quote_attachments_quote_id_fkey 
        FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'quote_attachments_uploaded_by_fkey'
    ) THEN
        ALTER TABLE quote_attachments 
        ADD CONSTRAINT quote_attachments_uploaded_by_fkey 
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Add any missing columns to existing tables

-- Add observations column to quotes if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='quotes' AND column_name='observations'
    ) THEN
        ALTER TABLE quotes ADD COLUMN observations TEXT;
    END IF;
END $$;

-- 5. Update existing data if needed

-- Set default values for any new non-nullable columns
UPDATE quote_attachments 
SET file_size = 0 
WHERE file_size IS NULL;
