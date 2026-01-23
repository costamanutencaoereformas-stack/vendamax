import postgres from 'postgres';
import { config } from 'dotenv';

config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set in environment/.env');
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

async function main() {
  try {
    console.log('Connected. Listing public tables...');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    const tableNames = tables.map(t => t.table_name);

    // Expected tables from shared/schema.ts
    const expected = [
      'users','customers','segments','suppliers','categories','products','inventory',
      'projects','project_tasks','project_expenses','project_documents',
      'quotes','quote_items','sales','sale_items','appointments','finance','company_settings'
    ];

    console.log('\nExisting tables:');
    tableNames.forEach(n => console.log(' -', n));

    const missing = expected.filter(n => !tableNames.includes(n));
    const extra = tableNames.filter(n => !expected.includes(n));

    console.log('\nSummary:');
    if (missing.length === 0) {
      console.log(' ✔ No missing tables.');
    } else {
      console.log(' ✖ Missing tables:');
      missing.forEach(n => console.log('   -', n));
    }

    if (extra.length) {
      console.log('\n(Info) Extra tables present (not in schema list):');
      extra.forEach(n => console.log('   -', n));
    }

    // Optionally, show columns for missing ones to help
    if (missing.length) {
      console.log('\nTip: run "npm run db:ensure" to create missing tables.');
    }
  } catch (e) {
    console.error('Error listing tables:', e);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
