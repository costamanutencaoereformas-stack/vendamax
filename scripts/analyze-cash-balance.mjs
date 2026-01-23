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

async function analyzeCashBalance() {
  console.log('🔍 Analisando saldo do caixa...');
  
  try {
    // Buscar todos os lançamentos financeiros
    const allFinanceEntries = await sql`
      SELECT id, entry_type, status, date, amount, description, party_name, link_finance_id
      FROM finance 
      ORDER BY date, created_at
    `;
    
    console.log(`📊 Total de lançamentos financeiros: ${allFinanceEntries.length}`);
    
    // Separar por tipo
    const receivables = allFinanceEntries.filter(f => f.entry_type === 'RECEIVABLE');
    const payables = allFinanceEntries.filter(f => f.entry_type === 'PAYABLE');
    const cashMovements = allFinanceEntries.filter(f => f.entry_type === 'CASH');
    
    console.log(`\n📋 Resumo por tipo:`);
    console.log(`   - Contas a receber: ${receivables.length}`);
    console.log(`   - Contas a pagar: ${payables.length}`);
    console.log(`   - Movimentos de caixa: ${cashMovements.length}`);
    
    // Analisar movimentos de caixa
    console.log(`\n💰 Análise dos movimentos de caixa:`);
    
    const cashIn = cashMovements.filter(m => Number(m.amount) > 0);
    const cashOut = cashMovements.filter(m => Number(m.amount) < 0);
    
    const totalCashIn = cashIn.reduce((sum, m) => sum + Number(m.amount), 0);
    const totalCashOut = cashOut.reduce((sum, m) => sum + Math.abs(Number(m.amount)), 0);
    const netCashFlow = totalCashIn - totalCashOut;
    
    console.log(`   - Entradas: ${cashIn.length} movimentos, total: R$ ${totalCashIn.toFixed(2)}`);
    console.log(`   - Saídas: ${cashOut.length} movimentos, total: R$ ${totalCashOut.toFixed(2)}`);
    console.log(`   - Fluxo líquido: R$ ${netCashFlow.toFixed(2)}`);
    
    // Verificar duplicações
    console.log(`\n🔍 Verificando duplicações:`);
    
    const duplicates = findDuplicateCashMovements(cashMovements);
    if (duplicates.length > 0) {
      console.log(`   🚨 Encontrados ${duplicates.length} movimentos duplicados:`);
      for (const dup of duplicates) {
        console.log(`      - ${dup.description} (R$ ${dup.amount}) - ${dup.date}`);
      }
    } else {
      console.log(`   ✅ Nenhum movimento duplicado encontrado`);
    }
    
    // Verificar movimentos vinculados
    console.log(`\n🔗 Análise de movimentos vinculados:`);
    
    const linkedMovements = cashMovements.filter(m => m.link_finance_id);
    const unlinkedMovements = cashMovements.filter(m => !m.link_finance_id);
    
    console.log(`   - Movimentos vinculados: ${linkedMovements.length}`);
    console.log(`   - Movimentos avulsos: ${unlinkedMovements.length}`);
    
    // Verificar se há recebíveis/pagáveis pagos sem movimento de caixa
    console.log(`\n📋 Verificando recebíveis/pagáveis pagos:`);
    
    const paidReceivables = receivables.filter(r => r.status === 'PAID');
    const paidPayables = payables.filter(p => p.status === 'PAID');
    
    console.log(`   - Recebíveis pagos: ${paidReceivables.length}`);
    console.log(`   - Pagáveis pagos: ${paidPayables.length}`);
    
    // Verificar se cada recebível/pagável pago tem movimento de caixa correspondente
    const missingCashMovements = [];
    
    for (const rec of paidReceivables) {
      const hasCashMovement = linkedMovements.some(m => m.link_finance_id === rec.id);
      if (!hasCashMovement) {
        missingCashMovements.push({
          type: 'RECEIVABLE',
          id: rec.id,
          description: rec.description,
          amount: rec.amount,
          date: rec.date
        });
      }
    }
    
    for (const pay of paidPayables) {
      const hasCashMovement = linkedMovements.some(m => m.link_finance_id === pay.id);
      if (!hasCashMovement) {
        missingCashMovements.push({
          type: 'PAYABLE',
          id: pay.id,
          description: pay.description,
          amount: pay.amount,
          date: pay.date
        });
      }
    }
    
    if (missingCashMovements.length > 0) {
      console.log(`   🚨 Encontrados ${missingCashMovements.length} lançamentos pagos sem movimento de caixa:`);
      for (const missing of missingCashMovements) {
        console.log(`      - ${missing.type}: ${missing.description} (R$ ${missing.amount}) - ${missing.date}`);
      }
    } else {
      console.log(`   ✅ Todos os lançamentos pagos têm movimentos de caixa correspondentes`);
    }
    
    // Calcular saldo correto
    console.log(`\n💰 Cálculo do saldo do caixa:`);
    
    const initialCash = 0; // Saldo inicial
    const calculatedBalance = initialCash + netCashFlow;
    
    console.log(`   - Saldo inicial: R$ ${initialCash.toFixed(2)}`);
    console.log(`   - Fluxo líquido: R$ ${netCashFlow.toFixed(2)}`);
    console.log(`   - Saldo calculado: R$ ${calculatedBalance.toFixed(2)}`);
    
    // Verificar se há movimentos com valores suspeitos
    console.log(`\n⚠️  Verificando valores suspeitos:`);
    
    const suspiciousMovements = cashMovements.filter(m => {
      const amount = Number(m.amount);
      return amount === 0 || isNaN(amount) || amount > 1000000; // Valores muito altos ou zero
    });
    
    if (suspiciousMovements.length > 0) {
      console.log(`   🚨 Encontrados ${suspiciousMovements.length} movimentos com valores suspeitos:`);
      for (const sus of suspiciousMovements) {
        console.log(`      - ${sus.description}: R$ ${sus.amount} (${sus.date})`);
      }
    } else {
      console.log(`   ✅ Nenhum valor suspeito encontrado`);
    }
    
    // Resumo final
    console.log(`\n📊 Resumo da análise:`);
    console.log(`   - Total de movimentos de caixa: ${cashMovements.length}`);
    console.log(`   - Movimentos duplicados: ${duplicates.length}`);
    console.log(`   - Lançamentos pagos sem movimento: ${missingCashMovements.length}`);
    console.log(`   - Valores suspeitos: ${suspiciousMovements.length}`);
    console.log(`   - Saldo calculado: R$ ${calculatedBalance.toFixed(2)}`);
    
    if (duplicates.length > 0 || missingCashMovements.length > 0 || suspiciousMovements.length > 0) {
      console.log(`\n🔧 Problemas encontrados que podem afetar o saldo do caixa!`);
      console.log(`   Recomenda-se executar o script de correção.`);
    } else {
      console.log(`\n✅ Análise concluída - Nenhum problema encontrado no saldo do caixa.`);
    }
    
  } catch (error) {
    console.error('❌ Erro durante a análise:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

function findDuplicateCashMovements(cashMovements) {
  const duplicates = [];
  const seen = new Set();
  
  for (const movement of cashMovements) {
    // Criar chave única baseada em data, valor e descrição
    const key = `${movement.date}|${movement.amount}|${movement.description}`;
    
    if (seen.has(key)) {
      duplicates.push(movement);
    } else {
      seen.add(key);
    }
  }
  
  return duplicates;
}

// Executar a análise
analyzeCashBalance().catch(console.error);
