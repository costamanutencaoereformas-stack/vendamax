#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

console.log('🔍 Verificando configurações para deployment...\n');

const checks = [
  {
    name: 'Arquivo package.json',
    check: () => existsSync(resolve(rootDir, 'package.json')),
    required: true
  },
  {
    name: 'Diretório dist',
    check: () => existsSync(resolve(rootDir, 'dist')),
    required: false,
    message: 'Execute "npm run build" antes do deploy'
  },
  {
    name: 'Arquivo .env.example',
    check: () => existsSync(resolve(rootDir, '.env.example')),
    required: true
  },
  {
    name: 'Dockerfile',
    check: () => existsSync(resolve(rootDir, 'Dockerfile')),
    required: false
  },
  {
    name: 'Configuração Netlify',
    check: () => existsSync(resolve(rootDir, 'netlify.toml')),
    required: false
  },
  {
    name: 'Configuração Render',
    check: () => existsSync(resolve(rootDir, 'render.yaml')),
    required: false
  }
];

let allPassed = true;

for (const check of checks) {
  const passed = check.check();
  const status = passed ? '✅' : (check.required ? '❌' : '⚠️');
  const message = check.message ? ` (${check.message})` : '';
  
  console.log(`${status} ${check.name}${message}`);
  
  if (!passed && check.required) {
    allPassed = false;
  }
}

console.log('\n📋 Variáveis de ambiente necessárias:');
try {
  const envExample = await readFile(resolve(rootDir, '.env.example'), 'utf-8');
  const envVars = envExample
    .split('\n')
    .filter(line => line.includes('=') && !line.startsWith('#'))
    .map(line => line.split('=')[0]);
  
  envVars.forEach(varName => {
    console.log(`   • ${varName}`);
  });
} catch (error) {
  console.log('   ⚠️ Não foi possível ler .env.example');
}

console.log('\n🚀 Comandos de deployment:');
console.log('   • Build: npm run build');
console.log('   • Verificação: npm run check');
console.log('   • Produção: npm start');
console.log('   • Migração DB: npm run db:migrate');

if (allPassed) {
  console.log('\n✅ Aplicação pronta para deployment!');
  process.exit(0);
} else {
  console.log('\n❌ Corrija os problemas antes do deployment.');
  process.exit(1);
}
