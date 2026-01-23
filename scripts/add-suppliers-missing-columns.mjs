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

async function ensureColumn(table, column, typeSql, defaultSql = null) {
  const exists = await columnExists(table, column);
  if (exists) {
    console.log(`Column ${table}.${column} already exists`);
    return;
  }
  console.log(`Adding column ${table}.${column} ...`);
  await sql.unsafe(
    `ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}${defaultSql ? ` DEFAULT ${defaultSql}` : ''}`
  );
  console.log(`Added column ${table}.${column}`);
}

async function run() {
  try {
    console.log('Ensuring suppliers table has required columns...');

    // Align with shared schema suppliers table
    await ensureColumn('suppliers', 'trade_name', 'text');
    await ensureColumn('suppliers', 'zip_code', 'text');
    await ensureColumn('suppliers', 'payment_terms', 'text');
    await ensureColumn('suppliers', 'is_active', 'boolean', 'true');

    console.log('Done. Suppliers table columns are up to date.');
  } catch (err) {
    console.error('Error ensuring suppliers columns:', err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

run();
