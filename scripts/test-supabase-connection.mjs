#!/usr/bin/env node

// Script para testar conexão com Supabase antes do deploy
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const { SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL } = process.env;

console.log('🔍 Testando conexão com Supabase...');
console.log('📍 Environment:', process.env.NODE_ENV || 'development');
console.log('🔗 SUPABASE_URL:', SUPABASE_URL ? '✅ Configurado' : '❌ Não configurado');
console.log('🔑 SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅ Configurado' : '❌ Não configurado');
console.log('💾 DATABASE_URL:', DATABASE_URL ? '✅ Configurado' : '❌ Não configurado');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Variáveis de ambiente do Supabase não estão configuradas!');
  process.exit(1);
}

try {
  // Testar conexão com Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  console.log('🔄 Testando conexão...');
  
  // Testar consulta simples
  const { data, error } = await supabase
    .from('customers')
    .select('id, name')
    .limit(1);
  
  if (error) {
    console.error('❌ Erro na consulta:', error);
    process.exit(1);
  }
  
  console.log('✅ Conexão bem-sucedida!');
  console.log('📊 Dados encontrados:', data?.length || 0, 'clientes');
  
  // Testar outras tabelas
  const tables = ['segments', 'products', 'quotes'];
  
  for (const table of tables) {
    try {
      const { data: tableData, error: tableError } = await supabase
        .from(table)
        .select('id')
        .limit(1);
      
      if (tableError) {
        console.log(`⚠️  Tabela ${table}: Erro -`, tableError.message);
      } else {
        console.log(`✅ Tabela ${table}: OK (${tableData?.length || 0} registros)`);
      }
    } catch (e) {
      console.log(`❌ Tabela ${table}: Falha crítica -`, e.message);
    }
  }
  
  console.log('🎉 Teste concluído com sucesso!');
  
} catch (error) {
  console.error('❌ Erro crítico na conexão:', error);
  process.exit(1);
}
