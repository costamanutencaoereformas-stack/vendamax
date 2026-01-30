#!/usr/bin/env node

// Script para verificar variáveis de ambiente no Vercel
console.log('🔍 Verificando variáveis de ambiente necessárias para o Vercel...');

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY', 
  'DATABASE_URL'
];

const optional = [
  'NODE_ENV',
  'ALLOWED_ORIGINS'
];

console.log('\n📋 Variáveis OBRIGATÓRIAS:');
required.forEach(env => {
  const value = process.env[env];
  if (value) {
    // Mask sensitive values
    const masked = env.includes('URL') 
      ? value.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')
      : env.includes('KEY') || env.includes('SECRET')
      ? value.substring(0, 10) + '...'
      : value;
    console.log(`✅ ${env}: ${masked}`);
  } else {
    console.log(`❌ ${env}: NÃO CONFIGURADA`);
  }
});

console.log('\n📋 Variáveis OPCIONAIS:');
optional.forEach(env => {
  const value = process.env[env];
  console.log(`${value ? '✅' : '⚪'} ${env}: ${value || 'não definida'}`);
});

console.log('\n🚀 Para configurar no Vercel:');
console.log('1. Vá para Dashboard > Project > Settings > Environment Variables');
console.log('2. Adicione as variáveis obrigatórias com os valores do seu .env');
console.log('3. Faça um novo deploy');
