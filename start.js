// Script para iniciar o servidor com as variáveis de ambiente carregadas
import { config } from 'dotenv';
import { spawn } from 'child_process';
import { resolve } from 'path';

// Carregar variáveis de ambiente do arquivo .env
config();

// Verificar se as variáveis necessárias estão definidas
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'DATABASE_URL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`Erro: As seguintes variáveis de ambiente são necessárias mas não estão definidas: ${missingVars.join(', ')}`);
  console.error('Por favor, configure o arquivo .env com as informações corretas do Supabase.');
  process.exit(1);
}

// Iniciar o servidor
const isDev = process.argv.includes('--dev');

// Usar comandos simples com shell:true
const command = isDev ? 'npm' : 'node';
const args = isDev ? ['run', 'dev'] : ['dist/index.js'];

console.log(`Iniciando o servidor em modo ${isDev ? 'desenvolvimento' : 'produção'}...`);

const server = spawn(command, args, { 
  stdio: 'inherit',
  env: process.env,
  shell: true
});

server.on('close', (code) => {
  console.log(`Servidor encerrado com código ${code}`);
});