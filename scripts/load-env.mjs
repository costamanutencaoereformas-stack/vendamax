// Script para carregar variáveis de ambiente
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// Obter o diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = new URL('.', import.meta.url).pathname;

// Carregar variáveis de ambiente do arquivo .env
const result = dotenv.config({ path: resolve(process.cwd(), '.env') });

if (result.error) {
  console.error('Erro ao carregar o arquivo .env:', result.error);
  process.exit(1);
}

console.log('Variáveis de ambiente carregadas com sucesso!');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Definido' : 'Não definido');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'Definido' : 'Não definido');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Definido' : 'Não definido');