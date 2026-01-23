import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function addStateRegistrationColumns() {
  try {
    console.log('Adding state registration columns to customers table...');
    
    // Add the columns if they don't exist
    await sql`
      ALTER TABLE customers 
      ADD COLUMN IF NOT EXISTS state_registration text,
      ADD COLUMN IF NOT EXISTS state_registration_exempt boolean DEFAULT false
    `;
    
    console.log('✅ State registration columns added successfully!');
  } catch (error) {
    console.error('❌ Error adding columns:', error);
    process.exit(1);
  }
}

addStateRegistrationColumns();
