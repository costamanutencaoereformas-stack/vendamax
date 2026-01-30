export default async (req: any, res: any) => {
  try {
    console.log('[DEBUG] Iniciando endpoint de debug...');
    
    // Verificar variáveis de ambiente
    const env = {
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      DATABASE_URL: !!process.env.DATABASE_URL,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: !!process.env.VERCEL
    };
    
    console.log('[DEBUG] Variáveis de ambiente:', env);
    
    // Testar importação dos módulos
    let imports = {};
    try {
      const { createClient } = await import('@supabase/supabase-js');
      imports.supabase = '✅';
    } catch (e: any) {
      imports.supabase = `❌ ${e.message}`;
    }
    
    try {
      const { drizzle } = await import('drizzle-orm/postgres-js');
      imports.drizzle = '✅';
    } catch (e: any) {
      imports.drizzle = `❌ ${e.message}`;
    }
    
    try {
      const postgres = await import('postgres');
      imports.postgres = '✅';
    } catch (e: any) {
      imports.postgres = `❌ ${e.message}`;
    }
    
    console.log('[DEBUG] Imports:', imports);
    
    // Testar conexão básica se tiver DATABASE_URL
    let connectionTest = '❌ DATABASE_URL não configurada';
    if (process.env.DATABASE_URL) {
      try {
        const postgres = await import('postgres');
        const sql = postgres.default(process.env.DATABASE_URL, {
          max: 1,
          connect_timeout: 5,
          ssl: { rejectUnauthorized: false }
        });
        
        const result = await sql`SELECT 1 as test`;
        connectionTest = '✅ Conexão OK';
        await sql.end();
      } catch (e: any) {
        connectionTest = `❌ ${e.message}`;
      }
    }
    
    const response = {
      status: 'debug',
      timestamp: new Date().toISOString(),
      env,
      imports,
      connectionTest,
      headers: req.headers
    };
    
    console.log('[DEBUG] Resposta:', response);
    res.status(200).json(response);
    
  } catch (error: any) {
    console.error('[DEBUG] Erro geral:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
};
