// Script para inserir projetos de exemplo no banco de dados
import dotenv from 'dotenv';
import postgres from 'postgres';

// Carregar variáveis de ambiente
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('Erro: DATABASE_URL não está definido');
  process.exit(1);
}

console.log('Inserindo projetos de exemplo no banco de dados...');

const sql = postgres(process.env.DATABASE_URL, {
  connect_timeout: 10,
  idle_timeout: 10,
  max_lifetime: 10,
});

async function getOrCreateCustomerByName(name) {
  const exist = await sql`select id from customers where name = ${name} limit 1`;
  if (exist.length) return exist[0].id;
  // Generate a unique document value to avoid unique constraint conflicts
  const slug = name.replace(/\s+/g, '').toUpperCase().slice(0, 8);
  const doc = `SEED-${slug}-${Date.now()}`; // conforms to text, uniqueness guaranteed per run
  const docType = 'CNPJ';
  const email = `${name.replace(/\s+/g, '.').toLowerCase()}@example.com`;
  try {
    const created = await sql`
      insert into customers (name, document, document_type, email, phone, classification)
      values (${name}, ${doc}, ${docType}, ${email}, '11999999999', 'REGULAR')
      returning id
    `;
    return created[0].id;
  } catch (e) {
    // If unique constraint on document hit for any reason, fetch by document
    const byDoc = await sql`select id from customers where document = ${doc} limit 1`;
    if (byDoc.length) return byDoc[0].id;
    throw e;
  }
}

async function getNextProjectCode() {
  // Define próximo código PJT000001 baseado na contagem atual
  const rows = await sql`select code from projects`;
  let max = 0;
  for (const r of rows) {
    const m = (r.code || '').match(/^PJT(\d{6})$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) max = Math.max(max, n);
    }
  }
  const next = (max + 1).toString().padStart(6, '0');
  return `PJT${next}`;
}

async function upsertProject({ name, customerName, status = 'PLANNING', daysOffset = 0, durationDays = 30 }) {
  const code = await getNextProjectCode();
  const start = new Date();
  start.setDate(start.getDate() + daysOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + durationDays);

  let customerId = null;
  if (customerName) {
    customerId = await getOrCreateCustomerByName(customerName);
  }

  const inserted = await sql`
    insert into projects (code, name, description, customer_id, status, start_date, end_date, budget, progress)
    values (
      ${code},
      ${name},
      ${`Projeto ${name}`},
      ${customerId},
      ${status},
      ${start.toISOString()},
      ${end.toISOString()},
      ${'10000.00'},
      ${Math.floor(Math.random() * 50)}
    )
    returning id, code, name
  `;
  return inserted[0];
}

async function seedProjects() {
  try {
    const examples = [
      { name: 'Reforma da Loja Centro', customerName: 'Comércio Centro LTDA', status: 'IN_PROGRESS', daysOffset: -10, durationDays: 45 },
      { name: 'Construção de Galpão', customerName: 'Indústrias Alfa SA', status: 'PLANNING', daysOffset: 5, durationDays: 60 },
      { name: 'Pintura Residencial', customerName: 'João da Silva', status: 'COMPLETED', daysOffset: -60, durationDays: 20 },
    ];

    // Evitar duplicar: se já existem projetos, apenas informa
    const count = await sql`select count(*) as c from projects`;
    if (Number(count[0].c) > 0) {
      console.log(`Já existem ${count[0].c} projetos. Inserindo mais alguns exemplos...`);
    }

    for (const ex of examples) {
      const p = await upsertProject(ex);
      console.log(`  ✅ Projeto criado: ${p.name} (${p.code})`);
    }

    // Mostrar contagem final
    const after = await sql`select count(*) as c from projects`;
    console.log(`\n🎉 Total de projetos agora: ${after[0].c}`);
  } catch (err) {
    console.error('❌ Erro ao inserir projetos:', err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

seedProjects();
