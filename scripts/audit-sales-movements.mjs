import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL env var is not set');
  process.exit(1);
}

const saleNumbers = process.argv.slice(2);
if (saleNumbers.length === 0) {
  console.error('Usage: node scripts/audit-sales-movements.mjs <SALE_NUMBER> [<SALE_NUMBER> ...]');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: true });

function logError(prefix, err) {
  try {
    const full = JSON.stringify(err, Object.getOwnPropertyNames(err));
    console.error(prefix, full);
  } catch (_) {
    console.error(prefix, err);
  }
}

async function listColumns(table) {
  try {
    const rows = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table}
      ORDER BY ordinal_position`;
    console.log(`Columns for ${table}:`);
    for (const r of rows) console.log(`- ${r.column_name} (${r.data_type})`);
  } catch (err) {
    logError(`Failed to list columns for ${table}`, err);
  }
}

async function main() {
  try {
    // Introspect schemas first
    await listColumns('sales');
    await listColumns('sale_items');
    await listColumns('inventory');
    await listColumns('products');

    for (const number of saleNumbers) {
      console.log(`\n=== Auditing sale ${number} ===`);
      let sale;
      try {
        [sale] = await sql`
          SELECT id, number, status, subtotal, discount, total
          FROM sales
          WHERE number = ${number}
          LIMIT 1`;
      } catch (err) {
        logError('Query sales failed:', err);
        continue;
      }
      if (!sale) {
        console.log('Sale not found');
        continue;
      }

      console.log(`Sale ID: ${sale.id} Status: ${sale.status} Total: ${sale.total}`);

      let items = [];
      try {
        items = await sql`
          SELECT id, sale_id, product_id, service_description, quantity, unit_price, discount, total
          FROM sale_items
          WHERE sale_id = ${sale.id}`;
      } catch (err) {
        logError('Query sale_items failed:', err);
        items = [];
      }
      console.log(`Items (${items.length}):`);
      for (const it of items) {
        const isProduct = !!it.product_id;
        console.log(`- ${it.id} ${isProduct ? 'PRODUCT' : 'SERVICE'} qty=${it.quantity} unit=${it.unit_price} total=${it.total} product_id=${it.product_id || ''}`);
      }

      // Look for movements per product for this sale by reason
      const reasonLike = `Venda: ${sale.id}`;
      let movements = [];
      try {
        movements = await sql`
          SELECT id, product_id, type, quantity, reason
          FROM inventory
          WHERE reason = ${reasonLike}`;
      } catch (err) {
        logError('Query inventory failed:', err);
        movements = [];
      }
      console.log(`Inventory movements for this sale (${movements.length}):`);
      for (const mv of movements) {
        console.log(`- ${mv.id} product=${mv.product_id} ${mv.type} qty=${mv.quantity} reason='${mv.reason}'`);
      }

      // Cross-check per product item
      const productItems = items.filter(it => !!it.product_id);
      let missing = 0;
      for (const it of productItems) {
        const found = movements.find(mv => mv.product_id === it.product_id && mv.quantity === it.quantity);
        if (!found) {
          missing++;
          console.log(`! Missing movement for item ${it.id} product=${it.product_id} qty=${it.quantity}`);
        }
      }
      if (productItems.length > 0) {
        console.log(`Summary: ${productItems.length} product items, ${movements.length} movements, missing=${missing}`);
      } else {
        console.log('Summary: no product items (services only)');
      }
    }
  } catch (err) {
    console.error('Audit error:', err);
  } finally {
    await sql.end();
  }
}

main();
