import postgres from 'postgres';
import { config } from 'dotenv';

config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

const expected = {
  users: [
    'id','username','password','name','role','created_at'
  ],
  customers: [
    'id','name','document','document_type','email','phone','contact','address','city','state','zip_code','responsible','segment','observations','is_active','classification','created_at','state_registration','state_registration_exempt'
  ],
  segments: ['id','name','description','color','is_active','created_at'],
  suppliers: ['id','name','trade_name','cnpj','email','phone','address','city','state','zip_code','payment_terms','is_active','created_at'],
  categories: ['id','name','description','created_at'],
  products: ['id','code','barcode','name','description','category_id','supplier_id','unit','cost_price','sale_price','current_stock','minimum_stock','maximum_stock','is_active','created_at'],
  inventory: ['id','product_id','type','quantity','reason','user_id','created_at'],
  projects: ['id','code','name','description','customer_id','quote_id','sale_id','status','start_date','end_date','budget','progress','created_at'],
  project_tasks: ['id','project_id','title','description','assignee','start_date','due_date','status','estimated_hours','actual_hours','cost','created_at'],
  project_expenses: ['id','project_id','date','category','description','supplier_id','amount','linked_quote_item_id','linked_sale_item_id','created_at'],
  project_documents: ['id','project_id','title','url','type','uploaded_at'],
  quotes: ['id','number','customer_id','status','valid_until','subtotal','discount','total','notes','payment_terms','project_id','tax_total','shipping','seller','company_signature','customer_signature','user_id','created_at'],
  quote_items: ['id','quote_id','product_id','service_description','quantity','unit_price','discount','total'],
  quote_attachments: ['id','quote_id','file_name','file_type','file_size','file_path','uploaded_at','uploaded_by'],
  sales: ['id','number','customer_id','quote_id','project_id','status','payment_method','subtotal','discount','total','notes','due_date','user_id','created_at'],
  sale_items: ['id','sale_id','product_id','service_description','quantity','unit_price','discount','total','service_cost'],
  contracts: ['id','number','title','customer_id','supplier_id','project_id','status','start_date','end_date','total_value','payment_terms','renewal','cancel_date','notes','created_at'],
  contract_documents: ['id','contract_id','title','url','type','uploaded_at'],
  appointments: ['id','type','date','status','subject','notes','customer_id','contact_name','contact_phone','created_at'],
  finance: ['id','entry_type','status','date','due_date','description','party_name','customer_id','supplier_id','sale_id','amount','paid_at','payment_method','recurrence','category','cost_center','project','notes','link_finance_id','created_at'],
  company_settings: ['id','cnpj','name','trade_name','state_registration','phone','email','address','number','complement','neighborhood','city','state','zip_code','logo_url','created_at'],
  purchase_requests: ['id','number','supplier_id','requester','status','notes','created_at'],
  purchase_request_items: ['id','request_id','product_id','description','quantity','unit_price','total']
};

async function getTables() {
  const rows = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
  `;
  return rows.map(r => r.table_name);
}

async function getColumns(table) {
  const rows = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
  `;
  return rows.map(r => r.column_name);
}

async function audit() {
  try {
    const existingTables = await getTables();
    const report = [];

    for (const [table, expCols] of Object.entries(expected)) {
      const exists = existingTables.includes(table);
      if (!exists) {
        report.push({ table, status: 'MISSING_TABLE', details: `Missing table: ${table}` });
        continue;
      }
      const cols = await getColumns(table);
      const missing = expCols.filter(c => !cols.includes(c));
      const extra = cols.filter(c => !expCols.includes(c));
      if (missing.length === 0 && extra.length === 0) {
        report.push({ table, status: 'OK' });
      } else {
        report.push({ table, status: 'DIVERGENCE', missing, extra });
      }
    }

    // Also list unexpected tables
    const unexpectedTables = existingTables.filter(t => !Object.keys(expected).includes(t));

    const summary = {
      ok: report.filter(r => r.status === 'OK').length,
      missingTables: report.filter(r => r.status === 'MISSING_TABLE').length,
      divergent: report.filter(r => r.status === 'DIVERGENCE').length,
      unexpectedTables
    };

    console.log('=== Database Audit Report ===');
    console.log(JSON.stringify({ summary, report }, null, 2));
  } catch (e) {
    console.error('Audit failed:', e);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

audit();
