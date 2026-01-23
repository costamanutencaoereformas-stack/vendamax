#!/usr/bin/env node

import dotenv from 'dotenv';
import postgres from 'postgres';

// Load environment variables
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not found in environment variables');
  process.exit(1);
}

const sql = postgres(connectionString);

async function repairCashBalance() {
  console.log('🔧 Corrigindo saldo do caixa...');
  
  try {
    // Buscar todos os movimentos de caixa
    const cashMovements = await sql`
      SELECT id, entry_type, status, date, amount, description, party_name, link_finance_id, created_at
      FROM finance 
      WHERE entry_type = 'CASH'
      ORDER BY date, created_at
    `;
    
    console.log(`📊 Total de movimentos de caixa: ${cashMovements.length}`);
    
    // Encontrar duplicatas
    const duplicates = findDuplicateCashMovements(cashMovements);
    
    if (duplicates.length === 0) {
      console.log('✅ Nenhum movimento duplicado encontrado. Saldo do caixa está correto.');
      return;
    }
    
    console.log(`🚨 Encontrados ${duplicates.length} movimentos duplicados para remoção:`);
    
    let totalRemoved = 0;
    let totalAmountRemoved = 0;
    
    for (const duplicate of duplicates) {
      console.log(`\n🗑️  Removendo movimento duplicado:`);
      console.log(`   - Descrição: ${duplicate.description}`);
      console.log(`   - Valor: R$ ${duplicate.amount}`);
      console.log(`   - Data: ${duplicate.date}`);
      console.log(`   - ID: ${duplicate.id}`);
      
      // Remover o movimento duplicado (manter o primeiro, remover os subsequentes)
      await sql`DELETE FROM finance WHERE id = ${duplicate.id}`;
      
      totalRemoved++;
      totalAmountRemoved += Math.abs(Number(duplicate.amount));
      
      console.log(`   ✅ Movimento removido com sucesso`);
    }
    
    // Recalcular saldo
    const remainingCashMovements = await sql`
      SELECT amount
      FROM finance 
      WHERE entry_type = 'CASH'
    `;
    
    const cashIn = remainingCashMovements.filter(m => Number(m.amount) > 0);
    const cashOut = remainingCashMovements.filter(m => Number(m.amount) < 0);
    
    const totalCashIn = cashIn.reduce((sum, m) => sum + Number(m.amount), 0);
    const totalCashOut = cashOut.reduce((sum, m) => sum + Math.abs(Number(m.amount)), 0);
    const correctedBalance = totalCashIn - totalCashOut;
    
    console.log(`\n🎉 Correção concluída!`);
    console.log(`   - Movimentos removidos: ${totalRemoved}`);
    console.log(`   - Valor total removido: R$ ${totalAmountRemoved.toFixed(2)}`);
    console.log(`   - Saldo corrigido: R$ ${correctedBalance.toFixed(2)}`);
    
    // Mostrar resumo final
    console.log(`\n💰 Resumo final:`);
    console.log(`   - Entradas de caixa: ${cashIn.length} movimentos, total: R$ ${totalCashIn.toFixed(2)}`);
    console.log(`   - Saídas de caixa: ${cashOut.length} movimentos, total: R$ ${totalCashOut.toFixed(2)}`);
    console.log(`   - Saldo do caixa: R$ ${correctedBalance.toFixed(2)}`);
    
    if (correctedBalance < 0) {
      console.log(`   ⚠️  Saldo negativo: R$ ${Math.abs(correctedBalance).toFixed(2)}`);
    } else {
      console.log(`   ✅ Saldo positivo: R$ ${correctedBalance.toFixed(2)}`);
    }
    
  } catch (error) {
    console.error('❌ Erro durante a correção:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

function findDuplicateCashMovements(cashMovements) {
  const duplicates = [];
  const seen = new Map(); // Usar Map para manter o primeiro e identificar duplicatas
  
  for (const movement of cashMovements) {
    // Criar chave única baseada em data, valor e descrição
    const key = `${movement.date}|${movement.amount}|${movement.description}`;
    
    if (seen.has(key)) {
      // Este é um duplicado - adicionar à lista para remoção
      duplicates.push(movement);
    } else {
      // Primeira ocorrência - manter
      seen.set(key, movement);
    }
  }
  
  return duplicates;
}

// Executar a correção
repairCashBalance().catch(console.error);
