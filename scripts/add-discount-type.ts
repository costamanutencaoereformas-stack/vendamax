import { Pool } from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL não está definido');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function addDiscountTypeColumn() {
  try {
    const client = await pool.connect();
    
    // Verificar se a coluna já existe
    const checkQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name='finance' AND column_name='discount_type'
      );
    `;
    const result = await client.query(checkQuery);
    
    if (result.rows[0].exists) {
      console.log('✅ Coluna discount_type já existe na tabela finance');
      await client.end();
      return;
    }
    
    // Adicionar coluna
    const addColumnQuery = `
      ALTER TABLE finance 
      ADD COLUMN discount_type TEXT DEFAULT 'FIXED_VALUE';
    `;
    await client.query(addColumnQuery);
    console.log('✅ Coluna discount_type adicionada com sucesso');
    
    // Criar índice
    const createIndexQuery = `
      CREATE INDEX IF NOT EXISTS finance_discount_type_idx ON finance(discount_type);
    `;
    await client.query(createIndexQuery);
    console.log('✅ Índice finance_discount_type_idx criado com sucesso');
    
    await client.end();
  } catch (error) {
    console.error('❌ Erro ao adicionar coluna:', error);
    process.exit(1);
  }
}

addDiscountTypeColumn();
