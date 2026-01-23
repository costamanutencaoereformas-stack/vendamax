// Script to add image_url column to products table
import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

// Create postgres client
const queryClient = postgres(process.env.DATABASE_URL);

async function addImageUrlColumn() {
  try {
    console.log('Adding image_url column to products table...');
    
    // Check if column exists
    const columns = await queryClient`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'image_url';
    `;

    if (columns.length === 0) {
      // Add column if it doesn't exist
      await queryClient`
        ALTER TABLE products 
        ADD COLUMN image_url TEXT;
      `;
      console.log('Column image_url added successfully');
    } else {
      console.log('Column image_url already exists');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await queryClient.end();
  }
}

addImageUrlColumn();