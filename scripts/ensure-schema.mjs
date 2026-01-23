import postgres from 'postgres';
import { config } from 'dotenv';

config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const sql = postgres(connectionString, { max: 1 });

async function columnExists(table, column) {
  const result = await sql`
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = ${table}
      AND column_name = ${column}
    LIMIT 1
  `;
  return result.length > 0;
}

async function constraintExists(table, constraintName) {
  const result = await sql`
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = ${table}
      AND constraint_name = ${constraintName}
    LIMIT 1
  `;
  return result.length > 0;
}

async function tableExists(table) {
  const result = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_name = ${table}
    LIMIT 1
  `;
  return result.length > 0;
}

async function ensureTable(table) {
  const exists = await tableExists(table);
  if (exists) {
    console.log(`✔ Table ${table} exists`);
    return;
  }
  console.log(`➕ Creating table ${table}`);
  // minimal table structure
  await sql.unsafe(
    `CREATE TABLE ${table} (
      id text PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamp DEFAULT now()
    )`
  );
  console.log(`✅ Created table ${table}`);
}

async function ensureColumn(table, column, typeSql, options = {}) {
  const { defaultSql = null, usingSql = null } = options;
  const exists = await columnExists(table, column);
  if (exists) {
    console.log(`✔ Column ${table}.${column} exists`);
    return;
  }
  console.log(`➕ Adding column ${table}.${column}`);
  const alter = `ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`
    + (defaultSql ? ` DEFAULT ${defaultSql}` : '');
  await sql.unsafe(alter);
  if (usingSql) {
    await sql.unsafe(`UPDATE ${table} SET ${column} = ${usingSql}`);
  }
  console.log(`✅ Added column ${table}.${column}`);
}

async function ensureUnique(table, column, constraintName) {
  const exists = await constraintExists(table, constraintName);
  if (exists) {
    console.log(`✔ Unique constraint ${constraintName} exists on ${table}.${column}`);
    return;
  }
  console.log(`➕ Adding unique constraint ${constraintName} on ${table}.${column}`);
  await sql.unsafe(`ALTER TABLE ${table} ADD CONSTRAINT ${constraintName} UNIQUE (${column})`);
  console.log(`✅ Added unique constraint ${constraintName}`);
}

async function setColumnNullable(table, column, makeNullable = true) {
  // Toggle nullability for an existing column. Safe to run multiple times.
  try {
    if (makeNullable) {
      await sql.unsafe(`ALTER TABLE ${table} ALTER COLUMN ${column} DROP NOT NULL`);
      console.log(`✔ Set ${table}.${column} to NULLABLE`);
    } else {
      await sql.unsafe(`ALTER TABLE ${table} ALTER COLUMN ${column} SET NOT NULL`);
      console.log(`✔ Set ${table}.${column} to NOT NULL`);
    }
  } catch (e) {
    // If constraint/state already matches, ignore
    console.warn(`(info) Could not toggle nullability for ${table}.${column}: ${e.message}`);
  }
}

async function ensureSchema() {
  try {
    console.log('=== Ensuring database schema matches @shared/schema.ts ===');

    // Ensure base tables exist (id, created_at minimal) before adding columns
    await ensureTable('users');
    await ensureTable('customers');
    await ensureTable('segments');
    await ensureTable('suppliers');
    await ensureTable('categories');
    await ensureTable('products');
    await ensureTable('inventory');
    await ensureTable('projects');
    await ensureTable('project_tasks');
    await ensureTable('project_expenses');
    await ensureTable('project_documents');
  await ensureTable('notes');
    await ensureTable('quotes');
    await ensureTable('quote_items');
    await ensureTable('quote_attachments');
    await ensureTable('sales');
    await ensureTable('sale_items');
    await ensureTable('contracts');
    await ensureTable('contract_documents');
    await ensureTable('appointments');
    await ensureTable('finance');
    await ensureTable('company_settings');
    await ensureTable('purchase_requests');
    await ensureTable('purchase_request_items');
    // cash register tables
    await ensureTable('cash_registers');
    await ensureTable('cash_movements');

    // users
    await ensureColumn('users', 'username', 'text');
    await ensureUnique('users', 'username', 'users_username_key');
    await ensureColumn('users', 'password', 'text');
    await ensureColumn('users', 'name', 'text');
    await ensureColumn('users', 'role', 'text', { defaultSql: `'user'` });
    await ensureColumn('users', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // customers
    await ensureColumn('customers', 'name', 'text');
    await ensureColumn('customers', 'document', 'text');
    await ensureColumn('customers', 'document_type', 'text');
    await ensureUnique('customers', 'document', 'customers_document_key');
    await ensureColumn('customers', 'email', 'text');
    await ensureColumn('customers', 'phone', 'text');
    await ensureColumn('customers', 'contact', 'text');
    await ensureColumn('customers', 'address', 'text');
    await ensureColumn('customers', 'city', 'text');
    await ensureColumn('customers', 'state', 'text');
    await ensureColumn('customers', 'zip_code', 'text');
    await ensureColumn('customers', 'responsible', 'text');
    await ensureColumn('customers', 'segment', 'text');
    await ensureColumn('customers', 'observations', 'text');
    await ensureColumn('customers', 'state_registration', 'text');
    await ensureColumn('customers', 'state_registration_exempt', 'boolean', { defaultSql: 'false' });
    await ensureColumn('customers', 'is_active', 'boolean', { defaultSql: 'true' });
    await ensureColumn('customers', 'classification', 'text', { defaultSql: `'REGULAR'` });
    await ensureColumn('customers', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // segments
    await ensureColumn('segments', 'name', 'text');
    await ensureUnique('segments', 'name', 'segments_name_key');
    await ensureColumn('segments', 'description', 'text');
    await ensureColumn('segments', 'color', 'text', { defaultSql: `'#3B82F6'` });
    await ensureColumn('segments', 'is_active', 'boolean', { defaultSql: 'true' });
    await ensureColumn('segments', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // suppliers
    await ensureColumn('suppliers', 'name', 'text');
    await ensureColumn('suppliers', 'trade_name', 'text');
    await ensureColumn('suppliers', 'cnpj', 'text');
    await ensureUnique('suppliers', 'cnpj', 'suppliers_cnpj_key');
    await ensureColumn('suppliers', 'email', 'text');
    await ensureColumn('suppliers', 'phone', 'text');
    await ensureColumn('suppliers', 'address', 'text');
    await ensureColumn('suppliers', 'city', 'text');
    await ensureColumn('suppliers', 'state', 'text');
    await ensureColumn('suppliers', 'zip_code', 'text');
    await ensureColumn('suppliers', 'payment_terms', 'text');
    await ensureColumn('suppliers', 'is_active', 'boolean', { defaultSql: 'true' });
    await ensureColumn('suppliers', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // categories
    await ensureColumn('categories', 'name', 'text');
    await ensureUnique('categories', 'name', 'categories_name_key');
    await ensureColumn('categories', 'description', 'text');
    await ensureColumn('categories', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // products
    await ensureColumn('products', 'code', 'text');
    await ensureUnique('products', 'code', 'products_code_key');
    await ensureColumn('products', 'barcode', 'text');
    await ensureColumn('products', 'name', 'text');
    await ensureColumn('products', 'description', 'text');
    await ensureColumn('products', 'category_id', 'text');
    await ensureColumn('products', 'supplier_id', 'text');
    await ensureColumn('products', 'unit', 'text', { defaultSql: `'UN'` });
    await ensureColumn('products', 'cost_price', 'numeric(10,2)');
    await ensureColumn('products', 'sale_price', 'numeric(10,2)');
    await ensureColumn('products', 'current_stock', 'integer', { defaultSql: '0' });
    await ensureColumn('products', 'minimum_stock', 'integer', { defaultSql: '0' });
    await ensureColumn('products', 'maximum_stock', 'integer', { defaultSql: '1000' });
    await ensureColumn('products', 'is_active', 'boolean', { defaultSql: 'true' });
    await ensureColumn('products', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // inventory
    await ensureColumn('inventory', 'product_id', 'text');
    await ensureColumn('inventory', 'type', 'text');
    await ensureColumn('inventory', 'quantity', 'integer');
    await ensureColumn('inventory', 'reason', 'text');
    await ensureColumn('inventory', 'user_id', 'text');
    await ensureColumn('inventory', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // projects
    await ensureColumn('projects', 'code', 'text');
    await ensureUnique('projects', 'code', 'projects_code_key');
    await ensureColumn('projects', 'name', 'text');
    await ensureColumn('projects', 'description', 'text');
    await ensureColumn('projects', 'customer_id', 'text');
    await ensureColumn('projects', 'quote_id', 'text');
    await ensureColumn('projects', 'sale_id', 'text');
    await ensureColumn('projects', 'status', 'text', { defaultSql: `'PLANNING'` });
    await ensureColumn('projects', 'start_date', 'timestamp');
    await ensureColumn('projects', 'expected_end_date', 'timestamp');
    await ensureColumn('projects', 'end_date', 'timestamp');
    await ensureColumn('projects', 'budget', 'numeric(12,2)');
    await ensureColumn('projects', 'progress', 'integer', { defaultSql: '0' });
    await ensureColumn('projects', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // project_tasks
    await ensureColumn('project_tasks', 'project_id', 'text');
    await ensureColumn('project_tasks', 'title', 'text');
    await ensureColumn('project_tasks', 'description', 'text');
    await ensureColumn('project_tasks', 'assignee', 'text');
    await ensureColumn('project_tasks', 'start_date', 'timestamp');
    await ensureColumn('project_tasks', 'due_date', 'timestamp');
    await ensureColumn('project_tasks', 'status', 'text', { defaultSql: `'TODO'` });
    await ensureColumn('project_tasks', 'estimated_hours', 'numeric(10,2)', { defaultSql: '0' });
    await ensureColumn('project_tasks', 'actual_hours', 'numeric(10,2)', { defaultSql: '0' });
    await ensureColumn('project_tasks', 'cost', 'numeric(12,2)', { defaultSql: '0' });
    await ensureColumn('project_tasks', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // project_expenses
    await ensureColumn('project_expenses', 'project_id', 'text');
    await ensureColumn('project_expenses', 'date', 'timestamp');
    await ensureColumn('project_expenses', 'category', 'text');
    await ensureColumn('project_expenses', 'description', 'text');
    await ensureColumn('project_expenses', 'supplier_id', 'text');
    await ensureColumn('project_expenses', 'amount', 'numeric(12,2)');
    await ensureColumn('project_expenses', 'linked_quote_item_id', 'text');
    await ensureColumn('project_expenses', 'linked_sale_item_id', 'text');
    await ensureColumn('project_expenses', 'status', 'text', { defaultSql: `'OPEN'` });
    await ensureColumn('project_expenses', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // project_documents
    await ensureColumn('project_documents', 'project_id', 'text');
    await ensureColumn('project_documents', 'title', 'text');
    await ensureColumn('project_documents', 'url', 'text');
    await ensureColumn('project_documents', 'type', 'text', { defaultSql: `'OTHER'` });
    await ensureColumn('project_documents', 'uploaded_at', 'timestamp', { defaultSql: 'now()' });

    // quotes
    await ensureColumn('quotes', 'number', 'text');
    await ensureUnique('quotes', 'number', 'quotes_number_key');
    await ensureColumn('quotes', 'customer_id', 'text');
    await ensureColumn('quotes', 'status', 'text', { defaultSql: `'PENDING'` });
    await ensureColumn('quotes', 'valid_until', 'timestamp');
    await ensureColumn('quotes', 'subtotal', 'numeric(10,2)');
    await ensureColumn('quotes', 'discount', 'numeric(10,2)', { defaultSql: '0' });
    await ensureColumn('quotes', 'total', 'numeric(10,2)');
    await ensureColumn('quotes', 'tax_total', 'numeric');
    await ensureColumn('quotes', 'shipping', 'numeric');
    await ensureColumn('quotes', 'seller', 'text');
    await ensureColumn('quotes', 'company_signature', 'text');
    await ensureColumn('quotes', 'customer_signature', 'text');
    await ensureColumn('quotes', 'payment_terms', 'text');
    await ensureColumn('quotes', 'notes', 'text');
    await ensureColumn('quotes', 'user_id', 'text');
    // align with shared/schema.ts -> quotes.projectId
    await ensureColumn('quotes', 'project_id', 'text');
    await ensureColumn('quotes', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // quote_items
    await ensureColumn('quote_items', 'quote_id', 'text');
    await ensureColumn('quote_items', 'product_id', 'text');
    await ensureColumn('quote_items', 'service_description', 'text');
    await ensureColumn('quote_items', 'quantity', 'integer');
    await ensureColumn('quote_items', 'unit_price', 'numeric(10,2)');
    await ensureColumn('quote_items', 'discount', 'numeric(10,2)', { defaultSql: '0' });
    await ensureColumn('quote_items', 'total', 'numeric(10,2)');
    // allow service rows without product
    await setColumnNullable('quote_items', 'product_id', true);

    // sales
    await ensureColumn('sales', 'number', 'text');
    await ensureUnique('sales', 'number', 'sales_number_key');
    await ensureColumn('sales', 'customer_id', 'text');
    await ensureColumn('sales', 'quote_id', 'text');
    await ensureColumn('sales', 'project_id', 'text');
    // ensure only one sale per quote
    await ensureUnique('sales', 'quote_id', 'sales_quote_id_unique');
    await ensureColumn('sales', 'status', 'text', { defaultSql: `'COMPLETED'` });
    await ensureColumn('sales', 'payment_method', 'text');
    await ensureColumn('sales', 'subtotal', 'numeric(10,2)');
    await ensureColumn('sales', 'discount', 'numeric(10,2)', { defaultSql: '0' });
    await ensureColumn('sales', 'total', 'numeric(10,2)');
    await ensureColumn('sales', 'notes', 'text');
    await ensureColumn('sales', 'due_date', 'timestamp');
    await ensureColumn('sales', 'user_id', 'text');
    await ensureColumn('sales', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // sale_items
    await ensureColumn('sale_items', 'sale_id', 'text');
    await ensureColumn('sale_items', 'product_id', 'text');
    await ensureColumn('sale_items', 'service_description', 'text');
    await ensureColumn('sale_items', 'quantity', 'integer');
    await ensureColumn('sale_items', 'unit_price', 'numeric(10,2)');
    await ensureColumn('sale_items', 'discount', 'numeric(10,2)', { defaultSql: '0' });
    await ensureColumn('sale_items', 'total', 'numeric(10,2)');
    await ensureColumn('sale_items', 'service_cost', 'numeric(10,2)');
    // allow service rows without product
    await setColumnNullable('sale_items', 'product_id', true);

    // contracts (ensure critical columns exist)
    await ensureColumn('contracts', 'number', 'text');
    await ensureUnique('contracts', 'number', 'contracts_number_key');
    await ensureColumn('contracts', 'title', 'text');
    await ensureColumn('contracts', 'customer_id', 'text');
    await ensureColumn('contracts', 'supplier_id', 'text');
    await ensureColumn('contracts', 'project_id', 'text');
    await ensureColumn('contracts', 'status', 'text', { defaultSql: `'DRAFT'` });
    await ensureColumn('contracts', 'start_date', 'timestamp');
    await ensureColumn('contracts', 'end_date', 'timestamp');
    await ensureColumn('contracts', 'total_value', 'numeric(12,2)');
    await ensureColumn('contracts', 'payment_terms', 'text');
    await ensureColumn('contracts', 'renewal', 'text');
    await ensureColumn('contracts', 'cancel_date', 'timestamp');
    await ensureColumn('contracts', 'notes', 'text');
    await ensureColumn('contracts', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // contract_documents
    await ensureColumn('contract_documents', 'contract_id', 'text');
    await ensureColumn('contract_documents', 'title', 'text');
    await ensureColumn('contract_documents', 'url', 'text');
    await ensureColumn('contract_documents', 'type', 'text', { defaultSql: `'OTHER'` });
    await ensureColumn('contract_documents', 'uploaded_at', 'timestamp', { defaultSql: 'now()' });

    // purchase_requests
    await ensureColumn('purchase_requests', 'number', 'text');
    await ensureUnique('purchase_requests', 'number', 'purchase_requests_number_key');
    await ensureColumn('purchase_requests', 'supplier_id', 'text');
    await ensureColumn('purchase_requests', 'requester', 'text');
    await ensureColumn('purchase_requests', 'status', 'text', { defaultSql: `'DRAFT'` });
    await ensureColumn('purchase_requests', 'notes', 'text');
    await ensureColumn('purchase_requests', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // purchase_request_items
    await ensureColumn('purchase_request_items', 'request_id', 'text');
    await ensureColumn('purchase_request_items', 'product_id', 'text');
    await setColumnNullable('purchase_request_items', 'product_id', true);
    await ensureColumn('purchase_request_items', 'description', 'text');
    await ensureColumn('purchase_request_items', 'quantity', 'integer');
    await ensureColumn('purchase_request_items', 'unit_price', 'numeric(10,2)');
    await ensureColumn('purchase_request_items', 'total', 'numeric(12,2)');

    // appointments (agenda)
    await ensureColumn('appointments', 'type', 'text');
    await ensureColumn('appointments', 'date', 'timestamp');
    await ensureColumn('appointments', 'status', 'text', { defaultSql: `'PENDING'` });
    await ensureColumn('appointments', 'subject', 'text');
    await ensureColumn('appointments', 'notes', 'text');
    await ensureColumn('appointments', 'customer_id', 'text');
    await ensureColumn('appointments', 'contact_name', 'text');
    await ensureColumn('appointments', 'contact_phone', 'text');
    await ensureColumn('appointments', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // cash_registers
    await ensureColumn('cash_registers', 'code', 'text');
    await ensureUnique('cash_registers', 'code', 'cash_registers_code_key');
    await ensureColumn('cash_registers', 'name', 'text');
    await ensureColumn('cash_registers', 'status', 'text', { defaultSql: `'CLOSED'` });
    await ensureColumn('cash_registers', 'user_id', 'text');
    await ensureColumn('cash_registers', 'opened_at', 'timestamp');
    await ensureColumn('cash_registers', 'closed_at', 'timestamp');
    await ensureColumn('cash_registers', 'opening_balance', 'numeric(10,2)', { defaultSql: '0' });
    await ensureColumn('cash_registers', 'current_balance', 'numeric(10,2)', { defaultSql: '0' });
    await ensureColumn('cash_registers', 'expected_balance', 'numeric(10,2)', { defaultSql: '0' });
    await ensureColumn('cash_registers', 'closing_balance', 'numeric(10,2)');
    await ensureColumn('cash_registers', 'difference', 'numeric(10,2)');
    await ensureColumn('cash_registers', 'notes', 'text');
    await ensureColumn('cash_registers', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // cash_movements
    await ensureColumn('cash_movements', 'register_id', 'text');
    await ensureColumn('cash_movements', 'type', 'text');
    await ensureColumn('cash_movements', 'description', 'text');
    await ensureColumn('cash_movements', 'amount', 'numeric(10,2)');
    await ensureColumn('cash_movements', 'payment_method', 'text');
    await ensureColumn('cash_movements', 'sale_id', 'text');
    await ensureColumn('cash_movements', 'user_id', 'text');
    await ensureColumn('cash_movements', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // finance
    await ensureColumn('finance', 'entry_type', 'text');
    await ensureColumn('finance', 'status', 'text', { defaultSql: `'OPEN'` });
    await ensureColumn('finance', 'date', 'timestamp');
    await ensureColumn('finance', 'due_date', 'timestamp');
    await ensureColumn('finance', 'description', 'text');
    await ensureColumn('finance', 'party_name', 'text');
    await ensureColumn('finance', 'customer_id', 'text');
    await ensureColumn('finance', 'supplier_id', 'text');
    await ensureColumn('finance', 'sale_id', 'text');
    await ensureColumn('finance', 'amount', 'numeric(10,2)');
    await ensureColumn('finance', 'payment_method', 'text');
    await ensureColumn('finance', 'recurrence', 'text', { defaultSql: `'NONE'` });
    await ensureColumn('finance', 'category', 'text');
    await ensureColumn('finance', 'cost_center', 'text');
    await ensureColumn('finance', 'project', 'text');
    await ensureColumn('finance', 'notes', 'text');
    await ensureColumn('finance', 'link_finance_id', 'text');
    await ensureColumn('finance', 'paid_at', 'timestamp');
    await ensureColumn('finance', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // company_settings
    await ensureColumn('company_settings', 'cnpj', 'text');
    await ensureUnique('company_settings', 'cnpj', 'company_settings_cnpj_key');
    await ensureColumn('company_settings', 'name', 'text');
    await ensureColumn('company_settings', 'trade_name', 'text');
    await ensureColumn('company_settings', 'state_registration', 'text');
    await ensureColumn('company_settings', 'phone', 'text');
    await ensureColumn('company_settings', 'email', 'text');
    await ensureColumn('company_settings', 'address', 'text');
    await ensureColumn('company_settings', 'number', 'text');
    await ensureColumn('company_settings', 'complement', 'text');
    await ensureColumn('company_settings', 'neighborhood', 'text');
    await ensureColumn('company_settings', 'city', 'text');
    await ensureColumn('company_settings', 'state', 'text');
    await ensureColumn('company_settings', 'zip_code', 'text');
    await ensureColumn('company_settings', 'logo_url', 'text');
    await ensureColumn('company_settings', 'created_at', 'timestamp', { defaultSql: 'now()' });

    // quote_attachments
    await ensureColumn('quote_attachments', 'quote_id', 'text');
    await ensureColumn('quote_attachments', 'file_name', 'text');
    await ensureColumn('quote_attachments', 'file_type', 'text');
    await ensureColumn('quote_attachments', 'file_size', 'integer', { defaultSql: '0' });
    await ensureColumn('quote_attachments', 'file_path', 'text');
    await ensureColumn('quote_attachments', 'uploaded_by', 'text');
    await ensureColumn('quote_attachments', 'uploaded_at', 'timestamp', { defaultSql: 'now()' });
    await ensureColumn('quote_attachments', 'description', 'text');

  // notes (user sticky notes / diário etc.)
  await ensureColumn('notes', 'title', 'text');
  await ensureColumn('notes', 'content', 'text');
  await ensureColumn('notes', 'color', 'text', { defaultSql: `'bg-white'` });
  await ensureColumn('notes', 'is_pinned', 'boolean', { defaultSql: 'false' });
  await ensureColumn('notes', 'user_id', 'text');
  await ensureColumn('notes', 'created_at', 'timestamp', { defaultSql: 'now()' });
  await ensureColumn('notes', 'updated_at', 'timestamp', { defaultSql: 'now()' });

    // Note: project_documents and contract_documents columns already ensured above

    // Add foreign key constraints
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_category_id_fkey') THEN
          ALTER TABLE products ADD CONSTRAINT products_category_id_fkey 
          FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_supplier_id_fkey') THEN
          ALTER TABLE products ADD CONSTRAINT products_supplier_id_fkey 
          FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
        END IF;

        -- Quote Attachments foreign keys
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_attachments_quote_id_fkey') THEN
          ALTER TABLE quote_attachments ADD CONSTRAINT quote_attachments_quote_id_fkey 
          FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_attachments_uploaded_by_fkey') THEN
          ALTER TABLE quote_attachments ADD CONSTRAINT quote_attachments_uploaded_by_fkey 
          FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;
        END IF;

        -- Project Documents foreign keys
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_documents_project_id_fkey') THEN
          ALTER TABLE project_documents ADD CONSTRAINT project_documents_project_id_fkey 
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
        END IF;

        -- Contract Documents foreign keys (only contract_id as per schema)
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_documents_contract_id_fkey') THEN
          ALTER TABLE contract_documents ADD CONSTRAINT contract_documents_contract_id_fkey 
          FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;
        END IF;
      END
      $$;
    `;

    // Create indexes for better performance (split into separate executions)
    await sql`CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id)`;

    // Document indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_quote_attachments_quote_id ON quote_attachments(quote_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON project_documents(project_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_contract_documents_contract_id ON contract_documents(contract_id)`;

    // --- Seed default data (idempotent) ---
    try {
      // Seed segments if empty
      const segCount = await sql`SELECT COUNT(*)::int AS count FROM segments`;
      const segN = segCount && segCount[0] ? Number(segCount[0].count) : 0;
      if (segN === 0) {
        console.log('➕ Seeding default segments');
        await sql.unsafe(`INSERT INTO segments (id, name, description, color, is_active, created_at) VALUES
          (gen_random_uuid(), 'Residencial', 'Segmento residenciais', '#3B82F6', true, now()),
          (gen_random_uuid(), 'Comercial', 'Segmento comercial', '#10B981', true, now()),
          (gen_random_uuid(), 'Industrial', 'Segmento industrial', '#F59E0B', true, now())
        `);
        console.log('✅ Seeded segments');
      } else {
        console.log(`✔ segments already seeded (${segN} rows)`);
      }

      // Seed categories if empty
      const catCount = await sql`SELECT COUNT(*)::int AS count FROM categories`;
      const catN = catCount && catCount[0] ? Number(catCount[0].count) : 0;
      if (catN === 0) {
        console.log('➕ Seeding default categories');
        await sql.unsafe(`INSERT INTO categories (id, name, description, created_at) VALUES
          (gen_random_uuid(), 'Materiais', 'Materiais de construção e insumos', now()),
          (gen_random_uuid(), 'Mão de Obra', 'Serviços e mão de obra', now()),
          (gen_random_uuid(), 'Transporte', 'Fretes e deslocamentos', now())
        `);
        console.log('✅ Seeded categories');
      } else {
        console.log(`✔ categories already seeded (${catN} rows)`);
      }
    } catch (seedErr) {
      console.warn('(info) Seed step failed or was skipped:', seedErr.message || seedErr);
    }

    console.log('=== Schema ensure completed ===');
  } finally {
    await sql.end();
  }
}

ensureSchema().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
