import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const sql = postgres(connectionString);
const db = drizzle(sql);

async function addObservationsColumn() {
  try {
    console.log('Adding observations column to customers table...');
    
    // Check if column already exists
    const result = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      AND column_name = 'observations'
    `;
    
    if (result.length > 0) {
      console.log('Column observations already exists');
      return;
    }
    
    // Add the column
    await sql`ALTER TABLE customers ADD COLUMN observations text`;
    console.log('Successfully added observations column to customers table');
    
  } catch (error) {
    console.error('Error adding observations column:', error);
  } finally {
    await sql.end();
  }
}

addObservationsColumn();
