// Script para inserir dados de exemplo no banco de dados
import dotenv from 'dotenv';
import postgres from 'postgres';

// Carregar variáveis de ambiente
dotenv.config();

// Verificar se DATABASE_URL está definido
if (!process.env.DATABASE_URL) {
  console.error('Erro: DATABASE_URL não está definido');
  process.exit(1);
}

console.log('Inserindo dados de exemplo no banco de dados...');

// Criar cliente postgres
const sql = postgres(process.env.DATABASE_URL, {
  connect_timeout: 10,
  idle_timeout: 10,
  max_lifetime: 10,
});

// Dados de exemplo
const sampleData = {
  categories: [
    { name: 'Eletrônicos', description: 'Produtos eletrônicos em geral' },
    { name: 'Informática', description: 'Produtos de informática' },
    { name: 'Móveis', description: 'Móveis para casa e escritório' },
    { name: 'Decoração', description: 'Itens de decoração' }
  ],
  suppliers: [
    {
      name: 'Fornecedor A',
      tradeName: 'Fornecedor A Ltda',
      cnpj: '12.345.678/0001-90',
      email: 'contato@fornecedora.com',
      phone: '(11) 9999-9999',
      address: 'Rua A, 123',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01234-567',
      paymentTerms: '30 dias'
    },
    {
      name: 'Fornecedor B',
      tradeName: 'Fornecedor B Ltda',
      cnpj: '98.765.432/0001-10',
      email: 'contato@fornecedorb.com',
      phone: '(11) 8888-8888',
      address: 'Rua B, 456',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '04567-890',
      paymentTerms: '15 dias'
    }
  ],
  customers: [
    {
      name: 'João Silva',
      document: '123.456.789-00',
      documentType: 'CPF',
      email: 'joao@email.com',
      phone: '(11) 7777-7777',
      address: 'Rua C, 789',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01234-567',
      classification: 'VIP'
    },
    {
      name: 'Maria Santos',
      document: '987.654.321-00',
      documentType: 'CPF',
      email: 'maria@email.com',
      phone: '(11) 6666-6666',
      address: 'Rua D, 321',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '04567-890',
      classification: 'REGULAR'
    }
  ],
  products: [
    {
      code: 'PROD001',
      barcode: '7891234567890',
      name: 'Notebook Dell Inspiron',
      description: 'Notebook Dell Inspiron 15 polegadas',
      unit: 'UN',
      costPrice: 2500.00,
      salePrice: 3500.00,
      currentStock: 10,
      minimumStock: 2,
      maximumStock: 50
    },
    {
      code: 'PROD002',
      barcode: '7891234567891',
      name: 'Mouse Wireless',
      description: 'Mouse wireless com sensor óptico',
      unit: 'UN',
      costPrice: 25.00,
      salePrice: 45.00,
      currentStock: 50,
      minimumStock: 10,
      maximumStock: 200
    },
    {
      code: 'PROD003',
      barcode: '7891234567892',
      name: 'Teclado Mecânico',
      description: 'Teclado mecânico com switches blue',
      unit: 'UN',
      costPrice: 150.00,
      salePrice: 250.00,
      currentStock: 15,
      minimumStock: 5,
      maximumStock: 100
    }
  ]
};

// Função para inserir dados
async function seedDatabase() {
  try {
    console.log('\n1. Inserindo categorias...');
    const categoryIds = {};
    
    for (const category of sampleData.categories) {
      const result = await sql`
        INSERT INTO categories (name, description) 
        VALUES (${category.name}, ${category.description})
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
        RETURNING id, name
      `;
      
      if (result.length > 0) {
        categoryIds[category.name] = result[0].id;
        console.log(`  ✅ Categoria criada/atualizada: ${result[0].name}`);
      }
    }

    console.log('\n2. Inserindo fornecedores...');
    const supplierIds = {};
    
    for (const supplier of sampleData.suppliers) {
      const result = await sql`
        INSERT INTO suppliers (name, trade_name, cnpj, email, phone, address, city, state, zip_code, payment_terms) 
        VALUES (${supplier.name}, ${supplier.tradeName}, ${supplier.cnpj}, ${supplier.email}, ${supplier.phone}, ${supplier.address}, ${supplier.city}, ${supplier.state}, ${supplier.zipCode}, ${supplier.paymentTerms})
        ON CONFLICT (cnpj) DO UPDATE SET 
          name = EXCLUDED.name,
          trade_name = EXCLUDED.trade_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          address = EXCLUDED.address,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          zip_code = EXCLUDED.zip_code,
          payment_terms = EXCLUDED.payment_terms
        RETURNING id, name
      `;
      
      if (result.length > 0) {
        supplierIds[supplier.name] = result[0].id;
        console.log(`  ✅ Fornecedor criado/atualizado: ${result[0].name}`);
      }
    }

    console.log('\n3. Inserindo clientes...');
    const customerIds = {};
    
    for (const customer of sampleData.customers) {
      const result = await sql`
        INSERT INTO customers (name, document, document_type, email, phone, address, city, state, zip_code, classification) 
        VALUES (${customer.name}, ${customer.document}, ${customer.documentType}, ${customer.email}, ${customer.phone}, ${customer.address}, ${customer.city}, ${customer.state}, ${customer.zipCode}, ${customer.classification})
        ON CONFLICT (document) DO UPDATE SET 
          name = EXCLUDED.name,
          document_type = EXCLUDED.document_type,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          address = EXCLUDED.address,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          zip_code = EXCLUDED.zip_code,
          classification = EXCLUDED.classification
        RETURNING id, name
      `;
      
      if (result.length > 0) {
        customerIds[customer.name] = result[0].id;
        console.log(`  ✅ Cliente criado/atualizado: ${result[0].name}`);
      }
    }

    console.log('\n4. Inserindo produtos...');
    const productIds = {};
    
    for (const product of sampleData.products) {
      const result = await sql`
        INSERT INTO products (code, barcode, name, description, category_id, supplier_id, unit, cost_price, sale_price, current_stock, minimum_stock, maximum_stock) 
        VALUES (${product.code}, ${product.barcode}, ${product.name}, ${product.description}, ${categoryIds['Informática'] || null}, ${supplierIds['Fornecedor A'] || null}, ${product.unit}, ${product.costPrice}, ${product.salePrice}, ${product.currentStock}, ${product.minimumStock}, ${product.maximumStock})
        ON CONFLICT (code) DO UPDATE SET 
          barcode = EXCLUDED.barcode,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          category_id = EXCLUDED.category_id,
          supplier_id = EXCLUDED.supplier_id,
          unit = EXCLUDED.unit,
          cost_price = EXCLUDED.cost_price,
          sale_price = EXCLUDED.sale_price,
          current_stock = EXCLUDED.current_stock,
          minimum_stock = EXCLUDED.minimum_stock,
          maximum_stock = EXCLUDED.maximum_stock
        RETURNING id, name, code
      `;
      
      if (result.length > 0) {
        productIds[product.code] = result[0].id;
        console.log(`  ✅ Produto criado/atualizado: ${result[0].name} (${result[0].code})`);
      }
    }

    // Verificar dados inseridos
    console.log('\n5. Verificando dados inseridos...');
    
    const counts = await sql`
      SELECT 
        'categories' as table_name, COUNT(*) as count FROM categories
      UNION ALL
      SELECT 'suppliers', COUNT(*) FROM suppliers
      UNION ALL
      SELECT 'customers', COUNT(*) FROM customers
      UNION ALL
      SELECT 'products', COUNT(*) FROM products
    `;
    
    counts.forEach(row => {
      console.log(`  - ${row.table_name}: ${row.count} registros`);
    });

    console.log('\n🎉 Dados de exemplo inseridos com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao inserir dados:', error);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

seedDatabase();
