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

async function repairDuplicateSaleItems() {
  console.log('🔧 Iniciando reparo de itens duplicados em vendas...');
  
  try {
    // Buscar todas as vendas que têm quoteId
    const salesWithQuotes = await sql`
      SELECT id, number, quote_id 
      FROM sales 
      WHERE quote_id IS NOT NULL
    `;
    
    console.log(`📊 Encontradas ${salesWithQuotes.length} vendas vinculadas a orçamentos`);
    
         let repairedCount = 0;
     let totalDuplicatesRemoved = 0;
     let totalMoneyRecovered = 0;
    
    for (const sale of salesWithQuotes) {
      console.log(`\n🔍 Verificando venda ${sale.number} (ID: ${sale.id})`);
      
      // Buscar itens da venda
      const saleItemsList = await sql`
        SELECT id, product_id, service_description, quantity, unit_price, discount, total
        FROM sale_items 
        WHERE sale_id = ${sale.id}
      `;
      
      if (saleItemsList.length === 0) {
        console.log(`  ⚠️  Venda ${sale.number} não possui itens`);
        continue;
      }
      
      // Buscar itens do orçamento
      const quoteItemsList = await sql`
        SELECT id, product_id, service_description, quantity, unit_price, discount, total
        FROM quote_items 
        WHERE quote_id = ${sale.quote_id}
      `;
      
      if (quoteItemsList.length === 0) {
        console.log(`  ⚠️  Orçamento ${sale.quote_id} não possui itens`);
        continue;
      }
      
             console.log(`  📋 Venda tem ${saleItemsList.length} itens, orçamento tem ${quoteItemsList.length} itens`);
       
       // Mostrar totais atuais da venda
       const currentSaleData = await sql`
         SELECT subtotal, total, discount
         FROM sales 
         WHERE id = ${sale.id}
       `;
       const currentSale = currentSaleData[0];
       console.log(`  💰 Totais atuais - Subtotal: R$ ${currentSale.subtotal}, Total: R$ ${currentSale.total}, Desconto: R$ ${currentSale.discount || '0.00'}`);
       
       // Verificar se há duplicatas
       const duplicates = findDuplicateItems(saleItemsList);
      
             if (duplicates.length > 0) {
         console.log(`  🚨 Encontrados ${duplicates.length} itens duplicados`);
         
         // Remover itens duplicados (manter apenas os primeiros)
         for (const duplicate of duplicates) {
           console.log(`    🗑️  Removendo item duplicado: ${duplicate.service_description || duplicate.id}`);
           await sql`DELETE FROM sale_items WHERE id = ${duplicate.id}`;
           totalDuplicatesRemoved++;
         }
         
         // Recalcular totais da venda após remover duplicatas
         const moneyRecovered = await recalculateSaleTotals(sale.id);
         totalMoneyRecovered += moneyRecovered;
         console.log(`  🔄 Totais da venda ${sale.number} recalculados`);
         
         repairedCount++;
       } else {
         console.log(`  ✅ Nenhum item duplicado encontrado`);
       }
    }
    
         console.log(`\n🎉 Reparo concluído!`);
     console.log(`   - Vendas reparadas: ${repairedCount}`);
     console.log(`   - Itens duplicados removidos: ${totalDuplicatesRemoved}`);
     console.log(`   - Total de vendas verificadas: ${salesWithQuotes.length}`);
     console.log(`   - Valor total recuperado: R$ ${totalMoneyRecovered.toFixed(2)}`);
     console.log(`\n💰 Resumo Financeiro:`);
     console.log(`   - O sistema corrigiu ${repairedCount} vendas com itens duplicados`);
     console.log(`   - Foram removidos ${totalDuplicatesRemoved} itens duplicados`);
     console.log(`   - Total de R$ ${totalMoneyRecovered.toFixed(2)} foi corrigido nos totais das vendas`);
     if (totalMoneyRecovered > 0) {
       console.log(`   ✅ Correção bem-sucedida! Os totais das vendas agora estão corretos.`);
     } else {
       console.log(`   ✅ Nenhum valor incorreto foi encontrado. Todas as vendas já estavam corretas.`);
     }
    
  } catch (error) {
    console.error('❌ Erro durante o reparo:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

function findDuplicateItems(saleItems) {
  const duplicates = [];
  const seen = new Set();
  
  for (const saleItem of saleItems) {
    // Criar chave única para identificar duplicatas
    const key = createItemKey(saleItem);
    
    if (seen.has(key)) {
      duplicates.push(saleItem);
    } else {
      seen.add(key);
    }
  }
  
  return duplicates;
}

function createItemKey(item) {
  // Criar uma chave única baseada no conteúdo do item
  const productId = item.product_id || '';
  const serviceDescription = item.service_description || '';
  const quantity = item.quantity || 0;
  const unitPrice = item.unit_price || '0';
  
  return `${productId}|${serviceDescription}|${quantity}|${unitPrice}`;
}

async function recalculateSaleTotals(saleId) {
  try {
    // Buscar totais atuais antes da correção
    const currentSaleData = await sql`
      SELECT subtotal, total, discount
      FROM sales 
      WHERE id = ${saleId}
    `;
    const currentSale = currentSaleData[0];
    const oldSubtotal = Number(currentSale.subtotal || 0);
    const oldTotal = Number(currentSale.total || 0);
    
    // Buscar todos os itens da venda (após remover duplicatas)
    const remainingItems = await sql`
      SELECT total
      FROM sale_items 
      WHERE sale_id = ${saleId}
    `;
    
    // Calcular subtotal (soma de todos os itens)
    const subtotal = remainingItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
    
    // Buscar desconto da venda
    const discount = Number(currentSale.discount || 0);
    const total = Math.max(0, subtotal - discount);
    
    // Atualizar totais da venda
    await sql`
      UPDATE sales 
      SET subtotal = ${subtotal.toFixed(2)}, total = ${total.toFixed(2)}
      WHERE id = ${saleId}
    `;
    
    // Calcular diferenças
    const subtotalDiff = oldSubtotal - subtotal;
    const totalDiff = oldTotal - total;
    
         console.log(`    💰 Novos totais - Subtotal: R$ ${subtotal.toFixed(2)}, Total: R$ ${total.toFixed(2)}`);
     console.log(`    📊 Diferença - Subtotal: -R$ ${subtotalDiff.toFixed(2)}, Total: -R$ ${totalDiff.toFixed(2)}`);
     
     return totalDiff; // Retornar o valor recuperado
   } catch (error) {
     console.error(`    ❌ Erro ao recalcular totais da venda ${saleId}:`, error);
     return 0;
   }
}



// Executar o reparo
repairDuplicateSaleItems().catch(console.error);
