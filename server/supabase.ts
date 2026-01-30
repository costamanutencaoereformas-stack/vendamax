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
    console.warn('⚠️ Aviso: Continuando inicialização sem DATABASE_URL. O sistema usará dados mockados.');
  }
} else {
  try {
    const url = new URL(DATABASE_URL);
    console.log(`✅ DATABASE_URL encontrada. Host: ${url.hostname}`);
  } catch (e) {
    console.error('❌ DATABASE_URL malformatada!');
  }
}

// Retorna informações de debug do banco e colunas da tabela projects
export async function getProjectsTableDebug() {
  if (!process.env.DATABASE_URL) return { error: 'DATABASE_URL missing' };
  try {
    const url = new URL(process.env.DATABASE_URL);
    const masked = `${url.protocol}//${url.hostname}:${url.port}/${url.pathname.replace(/^\//, '')}`;
    if (!queryClient) return { database: masked, error: 'queryClient not initialized' };
    const cols = await queryClient`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects'
      ORDER BY ordinal_position
    `;
    return { database: masked, columns: cols.map((r: any) => r.column_name) };
  } catch (e: any) {
    return { error: e.message };
  }
}

// Criar cliente Supabase
export const supabase = createClient(
  SUPABASE_URL || '',
  SUPABASE_ANON_KEY || ''
);

// Criar cliente postgres-js de forma segura para ambiente serverless
const queryClient = (typeof DATABASE_URL === 'string' && DATABASE_URL.length > 0)
  ? postgres(DATABASE_URL, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: { rejectUnauthorized: false }, // Recomendado para Supabase no Vercel
    onnotice: () => { }, // Silenciar notices
    onconnect: () => {
      console.log('[DB] ✅ Conexão PostgreSQL estabelecida');
    },
    onerror: (err) => {
      console.error('[DB] ❌ Erro na conexão PostgreSQL:', err.message);
    }
  })
  : null as any;

// Exportar cliente Drizzle com o esquema
const actualDb = queryClient
  ? drizzle(queryClient, { schema })
  : null;

export const db: any = new Proxy({} as any, {
  get(_, prop) {
    // Permite verificar se a conexão é real sem disparar o mock log
    if (prop === 'connected') return !!actualDb;

    if (!actualDb) {
      if (typeof prop === 'symbol') return undefined;

      console.warn(`[DB Mock] Acesso a '${String(prop)}' sem conexão real.`);

      const mockChain: any = () => mockChain;
      mockChain.from = () => mockChain;
      mockChain.where = () => mockChain;
      mockChain.orderBy = () => mockChain;
      mockChain.limit = () => mockChain;
      mockChain.offset = () => mockChain;
      mockChain.returning = () => Promise.resolve([]);
      mockChain.values = () => mockChain;
      mockChain.set = () => mockChain;
      mockChain.execute = () => Promise.resolve([]);

      // Handle thenable for await
      mockChain.then = (resolve: any) => resolve([]);

      if (['select', 'insert', 'update', 'delete', 'execute'].includes(prop as string)) {
        return () => mockChain;
      }

      return mockChain;
    }
    return (actualDb as any)[prop];
  }
});

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
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn('[DB] verifyDbConsistency skipped: DATABASE_URL not set.');
    return;
  }
  if (!queryClient) {
    console.warn('[DB] verifyDbConsistency skipped: queryClient not initialized.');
    return;
  }

  try {
    const url = new URL(dbUrl);
    const masked = `${url.protocol}//${url.hostname}:${url.port}/${url.pathname.replace(/^\//, '')}`;
    console.log(`[DB] Conectado a: ${masked}`);

    // Check existence of table finance
    const financeTable = await queryClient`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'finance'
    `;
    if (financeTable.length === 0) {
      console.warn("[DB] Aviso: tabela 'finance' NÃO existe neste banco. O endpoint /api/finance irá falhar.");
    } else {
      console.log("[DB] Ok: tabela 'finance' encontrada.");

      // Check columns
      const financeCols = await queryClient`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'finance'
        ORDER BY ordinal_position
      `;
      console.log("[DB] Colunas da tabela finance:", financeCols.map((r: any) => r.column_name).join(', '));
    }

    // Check projects.status
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