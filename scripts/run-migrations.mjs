// Script para executar migrações
import dotenv from 'dotenv';
import { resolve } from 'path';
import { spawn } from 'child_process';

// Carregar variáveis de ambiente do arquivo .env
const result = dotenv.config({ path: resolve(process.cwd(), '.env') });

if (result.error) {
  console.error('Erro ao carregar o arquivo .env:', result.error);
  process.exit(1);
}

// Verificar se as variáveis necessárias estão definidas
const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DATABASE_URL'];
for (const varName of requiredVars) {
  if (!process.env[varName]) {
    console.error(`Erro: Variável de ambiente ${varName} não está definida`);
    process.exit(1);
  }
}

console.log('Variáveis de ambiente carregadas com sucesso!');
console.log('Executando migrações...');

// Executar o comando de migração
const child = spawn('npm', ['run', 'db:migrate'], {
  stdio: 'inherit',
  env: process.env,
  shell: true
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('Migrações executadas com sucesso!');
  } else {
    console.error(`Erro ao executar migrações. Código de saída: ${code}`);
  }
});