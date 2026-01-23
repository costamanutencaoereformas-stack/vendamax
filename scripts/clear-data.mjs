#!/usr/bin/env node
import 'dotenv/config';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL não definido no .env');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });

async function main() {
  console.log('Limpando dados de exemplo...');
  await sql.begin(async (tx) => {
    // Remover itens dependentes primeiro
    await tx`DELETE FROM sale_items`;
    await tx`DELETE FROM sales`;

    await tx`DELETE FROM quote_items`;
    await tx`DELETE FROM quotes`;

    await tx`DELETE FROM inventory`;

    await tx`DELETE FROM appointments`;

    await tx`DELETE FROM products`;
    await tx`DELETE FROM categories`;
    await tx`DELETE FROM segments`;
    await tx`DELETE FROM suppliers`;

    await tx`DELETE FROM customers`;

    // Manter apenas usuário admin
    await tx`DELETE FROM users WHERE username <> 'admin'`;
  });

  console.log('Dados de exemplo removidos. Mantido apenas o usuário admin.');
}

main()
  .catch((err) => {
    console.error('Erro ao limpar dados:', err);
    process.exit(1);
  })
  .finally(() => sql.end());
