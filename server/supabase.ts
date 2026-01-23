import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '../shared/schema';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

// Verificar se as variáveis de ambiente estão definidas
console.log('Verificando variáveis de ambiente:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Definido' : 'Não definido');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Definido' : 'Não definido');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Definido' : 'Não definido');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.DATABASE_URL) {
  throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY e DATABASE_URL devem ser definidos nas variáveis de ambiente');
}

// Retorna informações de debug do banco e colunas da tabela projects
export async function getProjectsTableDebug() {
  const url = new URL(process.env.DATABASE_URL!);
  const masked = `${url.protocol}//${url.hostname}:${url.port}/${url.pathname.replace(/^\//, '')}`;
  const cols = await queryClient`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects'
    ORDER BY ordinal_position
  `;
  return { database: masked, columns: cols.map((r: any) => r.column_name) };
}

// Criar cliente Supabase
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Criar cliente postgres-js
const queryClient = postgres(process.env.DATABASE_URL);

// Exportar cliente Drizzle com o esquema
export const db = drizzle(queryClient, { schema });

// Função para executar migrações
export async function runMigrations() {
  try {
    console.log('Iniciando migrações do banco de dados...');
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('Migrações concluídas com sucesso!');
  } catch (error) {
    console.error('Erro ao executar migrações:', error);
    throw error;
  }
}

// Helper para verificar conexão/consistência com o banco utilizado pelo servidor
export async function verifyDbConsistency() {
  try {
    // Log seguro do host e database (sem credenciais)
    const url = new URL(process.env.DATABASE_URL!);
    const masked = `${url.protocol}//${url.hostname}:${url.port}/${url.pathname.replace(/^\//, '')}`;
    console.log(`[DB] Conectado a: ${masked}`);

    // Checar existência da tabela finance
    const financeTable = await queryClient`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'finance'
    `;
    if (financeTable.length === 0) {
      console.warn("[DB] Aviso: tabela 'finance' NÃO existe neste banco. O endpoint /api/finance irá falhar.");
    } else {
      console.log("[DB] Ok: tabela 'finance' encontrada.");
      
      // Verificar colunas principais
      const financeCols = await queryClient`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'finance'
        ORDER BY ordinal_position
      `;
      console.log("[DB] Colunas da tabela finance:", financeCols.map((r: any) => r.column_name).join(', '));
    }

    // Checar existência da coluna projects.status
    const rows = await queryClient`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'status'
    `;
    if (rows.length === 0) {
      console.warn("[DB] Aviso: coluna 'projects.status' NÃO existe neste banco. O endpoint /api/projects irá falhar até que o schema seja ajustado.");
    } else {
      console.log("[DB] Ok: coluna 'projects.status' encontrada.");
    }
  } catch (e) {
    console.warn('[DB] Falha ao verificar consistência do banco:', e);
  }
}