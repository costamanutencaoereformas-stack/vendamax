import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL env var is not set');
  process.exit(1);
}

const saleNumbers = process.argv.slice(2);
if (saleNumbers.length === 0) {
  console.error('Usage: node scripts/backfill-sale-movements.mjs <SALE_NUMBER> [<SALE_NUMBER> ...]');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: true });

async function backfillForSale(number) {
  console.log(`\n=== Backfilling sale ${number} ===`);
  const [sale] = await sql`
    SELECT id, number
    FROM sales
    WHERE number = ${number}
    LIMIT 1`;
  if (!sale) {
    console.log('Sale not found');
    return;
  }

  const items = await sql`
    SELECT id, sale_id, product_id, quantity
    FROM sale_items
    WHERE sale_id = ${sale.id}
    ORDER BY created_at ASC`;

  const reason = `Venda: ${sale.id}`;
  const existing = await sql`
    SELECT id, product_id, quantity
    FROM inventory
    WHERE reason = ${reason}`;

  let created = 0;
  for (const it of items) {
    if (!it.product_id) continue; // service
    const found = existing.find(mv => mv.product_id === it.product_id && Number(mv.quantity) === Number(it.quantity));
    if (found) continue;

    // Fetch current stock to log
    const [prod] = await sql`SELECT id, current_stock FROM products WHERE id = ${it.product_id} LIMIT 1`;
    const before = prod ? Number(prod.current_stock ?? 0) : null;

    const [mv] = await sql`
      INSERT INTO inventory (product_id, type, quantity, reason)
      VALUES (${it.product_id}, 'OUT', ${it.quantity}, ${reason})
      RETURNING id`;

    const [prodAfter] = await sql`SELECT current_stock FROM products WHERE id = ${it.product_id} LIMIT 1`;
    const after = prodAfter ? Number(prodAfter.current_stock ?? 0) : null;

    console.log(`Created movement ${mv.id} for item ${it.id} product=${it.product_id} qty=${it.quantity} stock ${before} -> ${after}`);
    created++;
  }

  console.log(`Backfill summary for ${number}: created ${created} movements`);
}

async function main() {
  try {
    for (const n of saleNumbers) {
      await backfillForSale(n);
    }
  } catch (err) {
    console.error('Backfill error:', err);
  } finally {
    await sql.end();
  }
}

main();
