import { db } from '../server/supabase';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const queryClient = postgres(process.env.DATABASE_URL);

async function checkDatabase() {
  try {
    console.log('Checking database connection...');
    
    // Test connection
    const result = await queryClient`SELECT current_database(), current_user, version()`.then(rows => rows[0]);
    console.log('Database connection successful!');
    console.log('Database:', result[0].current_database);
    console.log('User:', result[0].current_user);
    console.log('PostgreSQL Version:', result[0].version);
    
    // List all tables
    console.log('\nListing all tables in the database:');
    const tables = await queryClient`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `.then(rows => rows);
    
    console.log('\nFound tables:');
    tables.forEach((row: any) => {
      console.log(`- ${row.table_name}`);
    });
    
    // Check users table structure
    if (tables.some((t: any) => t.table_name === 'users')) {
      console.log('\nUsers table structure:');
      const userColumns = await queryClient`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position;
      `;
      
      console.table(userColumns);
    } else {
      console.log('\nUsers table does not exist in the database.');
    }
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await queryClient.end();
    process.exit(0);
  }
}

checkDatabase();
