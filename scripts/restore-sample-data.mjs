// Script para restaurar dados de exemplo após perda no banco
import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não está definido');
  process.exit(1);
}

console.log('🔄 Restaurando dados de exemplo após perda...');

const sql = postgres(process.env.DATABASE_URL, {
  connect_timeout: 10,
  idle_timeout: 10,
  max_lifetime: 10,
});

async function restoreData() {
  try {
    console.log('\n1. Inserindo categorias...');
    await sql`
      INSERT INTO categories (name, description) VALUES
      ('Ferramentas Elétricas', 'Ferramentas que utilizam energia elétrica'),
      ('Ferramentas Manuais', 'Ferramentas operadas manualmente'),
      ('Material de Construção', 'Materiais para construção civil'),
      ('Equipamentos de Segurança', 'EPIs e equipamentos de proteção'),
      ('Acessórios', 'Acessórios diversos para ferramentas')
      ON CONFLICT (name) DO NOTHING
    `;
    console.log('  ✅ Categorias restauradas');

    console.log('\n2. Inserindo fornecedores...');
    await sql`
      INSERT INTO suppliers (name, trade_name, cnpj, email, phone, address, city, state, zip_code, payment_terms, is_active) VALUES
      ('FERRAMENTAS BRASIL DISTRIBUIDORA LTDA', 'Ferramentas Brasil', '12.345.678/0001-90', 'vendas@ferramentasbrasil.com.br', '11988887777', 'Rodovia dos Fornecedores, 1000', 'Campinas', 'SP', '13000-000', '30 dias', true),
      ('CIMENTO FORTE INDUSTRIA S.A.', 'Cimento Forte', '98.765.432/0001-10', 'comercial@cimentoforte.com.br', '11933332222', 'Estrada da Indústria, 500', 'Sorocaba', 'SP', '18000-000', '21 dias', true)
      ON CONFLICT (cnpj) DO NOTHING
    `;
    console.log('  ✅ Fornecedores restaurados');

    console.log('\n3. Inserindo clientes...');
    await sql`
      INSERT INTO customers (name, document, document_type, email, phone, address, city, state, zip_code, classification, is_active) VALUES
      ('PORCA ELETRICA COMERCIO DE FERRAGENS LTDA', '11.222.333/0001-44', 'CNPJ', 'contato@porcaeletrica.com.br', '11987654321', 'Rua das Ferramentas, 123', 'São Paulo', 'SP', '01234-567', 'VIP', true),
      ('CONSTRUTORA ALICERCE FORTE LTDA', '22.333.444/0001-55', 'CNPJ', 'compras@alicerceforte.com.br', '11912345678', 'Av. dos Construtores, 456', 'São Paulo', 'SP', '04567-890', 'REGULAR', true),
      ('JOÃO SILVA REFORMAS ME', '33.444.555/0001-66', 'CNPJ', 'joao.silva@reformas.com', '11955554444', 'Rua das Obras, 789', 'Guarulhos', 'SP', '07123-456', 'REGULAR', true)
      ON CONFLICT (document) DO NOTHING
    `;
    console.log('  ✅ Clientes restaurados');

    console.log('\n4. Inserindo produtos...');
    const categories = await sql`SELECT id, name FROM categories LIMIT 5`;
    const suppliers = await sql`SELECT id, name FROM suppliers LIMIT 2`;
    
    if (categories.length > 0 && suppliers.length > 0) {
      await sql`
        INSERT INTO products (code, name, description, category_id, supplier_id, unit, cost_price, sale_price, current_stock, minimum_stock, is_active) VALUES
        ('FUR-750-IMP', 'Furadeira de Impacto 750W', 'Furadeira de impacto profissional com potência de 750W', ${categories[0].id}, ${suppliers[0].id}, 'UN', 250.00, 299.90, 15, 5, true),
        ('MART-29-UNH', 'Martelo de Unha 29mm', 'Martelo de unha com cabo de madeira', ${categories[1].id}, ${suppliers[0].id}, 'UN', 35.00, 45.90, 30, 10, true),
        ('CIM-PORT-50', 'Cimento Portland 50kg', 'Saco de cimento Portland de alta resistência', ${categories[2].id}, ${suppliers[1].id}, 'UN', 25.00, 32.50, 50, 20, true),
        ('CAP-SEG-01', 'Capacete de Segurança', 'Capacete de segurança com carneira', ${categories[3].id}, ${suppliers[0].id}, 'UN', 18.00, 25.90, 40, 15, true),
        ('BRO-CON-10', 'Broca para Concreto 10mm', 'Broca para furadeira para uso em concreto', ${categories[4].id}, ${suppliers[0].id}, 'UN', 8.50, 12.90, 25, 8, true)
        ON CONFLICT (code) DO NOTHING
      `;
      console.log('  ✅ Produtos restaurados');
    }

    console.log('\n5. Inserindo dados financeiros de exemplo...');
    const customers = await sql`SELECT id, name FROM customers LIMIT 3`;
    
    if (customers.length > 0) {
      const customerId = customers[0].id;
      const customerName = customers[0].name;
      const futureDate = new Date(Date.now() + 30*24*60*60*1000).toISOString();
      const nearDate = new Date(Date.now() + 15*24*60*60*1000).toISOString();
      const pastDate = new Date(Date.now() - 5*24*60*60*1000).toISOString();
      const today = new Date().toISOString();

      await sql`
        INSERT INTO finance (description, entry_type, amount, due_date, status, category, customer_id) VALUES
        (${`Venda de materiais - ${customerName}`}, 'RECEIVABLE', 1500.00, ${futureDate}, 'PENDING', 'Vendas', ${customerId}),
        ('Compra de ferramentas', 'PAYABLE', 800.00, ${nearDate}, 'PENDING', 'Compras', null),
        ('Pagamento fornecedor', 'PAYABLE', 2200.00, ${pastDate}, 'OVERDUE', 'Fornecedores', null),
        ('Recebimento cliente VIP', 'RECEIVABLE', 3500.00, ${today}, 'PAID', 'Vendas', ${customerId})
      `;
      console.log('  ✅ Dados financeiros restaurados');
    }

    console.log('\n6. Criando orçamento de exemplo...');
    if (customers.length > 0) {
      const customerId = customers[0].id;
      const validUntil = new Date(Date.now() + 30*24*60*60*1000).toISOString();
      
      const quoteResult = await sql`
        INSERT INTO quotes (number, customer_id, status, valid_until, subtotal, discount, total, notes) 
        VALUES ('ORC-001', ${customerId}, 'PENDING', ${validUntil}, 500.00, 0, 500.00, 'Orçamento para reforma')
        RETURNING id
      `;
      
      if (quoteResult.length > 0) {
        const products = await sql`SELECT id, sale_price FROM products LIMIT 2`;
        if (products.length > 0) {
          const quoteId = quoteResult[0].id;
          const productId = products[0].id;
          const unitPrice = products[0].sale_price;
          const quantity = 2;
          const total = unitPrice * quantity;
          
          await sql`
            INSERT INTO quote_items (quote_id, product_id, quantity, unit_price, discount, total) VALUES
            (${quoteId}, ${productId}, ${quantity}, ${unitPrice}, 0, ${total})
          `;
        }
      }
      console.log('  ✅ Orçamento de exemplo criado');
    }

    console.log('\n7. Verificando dados restaurados...');
    const counts = await sql`
      SELECT 
        'categories' as table_name, COUNT(*) as count FROM categories
      UNION ALL
      SELECT 'suppliers', COUNT(*) FROM suppliers
      UNION ALL
      SELECT 'customers', COUNT(*) FROM customers
      UNION ALL
      SELECT 'products', COUNT(*) FROM products
      UNION ALL
      SELECT 'finance', COUNT(*) FROM finance
      UNION ALL
      SELECT 'quotes', COUNT(*) FROM quotes
    `;
    
    counts.forEach(row => {
      console.log(`  - ${row.table_name}: ${row.count} registros`);
    });

    console.log('\n🎉 Dados restaurados com sucesso!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Inicie o servidor: npm run dev');
    console.log('2. Verifique se os dados estão carregando nas páginas');
    console.log('3. Crie novos registros conforme necessário');
    
  } catch (error) {
    console.error('❌ Erro ao restaurar dados:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

restoreData().catch(console.error);
