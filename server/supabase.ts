import { createClient } from '@supabase/supabase-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from '../shared/schema';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const { SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL } = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !DATABASE_URL) {
  console.error('❌ ERRO: Variáveis de ambiente faltando!');
  console.error('SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅' : '❌');
  console.error('DATABASE_URL:', DATABASE_URL ? '✅' : '❌');

  if (process.env.NODE_ENV === 'production') {
    // No Vercel/Produção, não podemos continuar sem o DB
    console.warn('Aviso: Continuando inicialização, mas as chamadas ao banco irão falhar.');
  }
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
  SUPABASE_URL || '',
  SUPABASE_ANON_KEY || ''
);

// Criar cliente postgres-js de forma segura
const queryClient = (typeof DATABASE_URL === 'string' && DATABASE_URL.length > 0)
  ? postgres(DATABASE_URL)
  : null as any;

// Exportar cliente Drizzle com o esquema
export const db = queryClient
  ? drizzle(queryClient, { schema })
  : null as any;

// Função para executar migrações
export async function runMigrations() {
  if (!db) {
    console.error('❌ Ignorando migrações: DATABASE_URL não definida.');
    return;
  }
  try {
    console.log('Iniciando migrações do banco de dados...');
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('Migrações concluídas com sucesso!');
  } catch (error) {
    console.error('Erro ao executar migrações:', error);
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