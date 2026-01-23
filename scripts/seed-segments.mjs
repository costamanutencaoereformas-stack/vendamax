import { db } from '../server/supabase.ts';
import { segments } from '../shared/schema.ts';

const defaultSegments = [
  {
    name: 'Varejo',
    description: 'Clientes que compram para revenda no varejo',
    color: '#3B82F6'
  },
  {
    name: 'Atacado',
    description: 'Clientes que compram em grandes quantidades',
    color: '#10B981'
  },
  {
    name: 'Industrial',
    description: 'Clientes do setor industrial',
    color: '#F59E0B'
  },
  {
    name: 'Governo',
    description: 'Órgãos públicos e governamentais',
    color: '#8B5CF6'
  },
  {
    name: 'Pessoa Física',
    description: 'Consumidores finais pessoa física',
    color: '#EF4444'
  },
  {
    name: 'E-commerce',
    description: 'Clientes de vendas online',
    color: '#06B6D4'
  },
  {
    name: 'Serviços',
    description: 'Prestadores de serviços em geral',
    color: '#0EA5E9'
  },
  {
    name: 'Tecnologia',
    description: 'Empresas de software, hardware e TI',
    color: '#7C3AED'
  },
  {
    name: 'Saúde',
    description: 'Clínicas, hospitais, laboratórios e saúde em geral',
    color: '#22C55E'
  },
  {
    name: 'Educação',
    description: 'Escolas, universidades e cursos',
    color: '#F97316'
  },
  {
    name: 'Agronegócio',
    description: 'Produtores rurais, cooperativas e agroindústrias',
    color: '#16A34A'
  },
  {
    name: 'Construção Civil',
    description: 'Construtoras, empreiteiras e obras',
    color: '#EA580C'
  },
  {
    name: 'Logística',
    description: 'Transportadoras, armazenagem e distribuição',
    color: '#0891B2'
  },
  {
    name: 'Financeiro',
    description: 'Bancos, fintechs e serviços financeiros',
    color: '#10B981'
  },
  {
    name: 'Automotivo',
    description: 'Autopeças, oficinas e concessionárias',
    color: '#DC2626'
  },
  {
    name: 'Alimentício',
    description: 'Indústrias e comércios de alimentos',
    color: '#84CC16'
  },
  {
    name: 'Farmacêutico',
    description: 'Farmácias, drogarias e indústrias farmacêuticas',
    color: '#14B8A6'
  },
  {
    name: 'Energia',
    description: 'Geração, distribuição e soluções energéticas',
    color: '#F59E0B'
  },
  {
    name: 'Telecomunicações',
    description: 'Operadoras e provedores de internet',
    color: '#6366F1'
  },
  {
    name: 'Imobiliário',
    description: 'Construtoras, incorporadoras e imobiliárias',
    color: '#9333EA'
  }
];

async function seedSegments() {
  try {
    console.log('🌱 Inserindo segmentos padrão...');
    
    for (const segment of defaultSegments) {
      try {
        await db.insert(segments).values(segment);
        console.log(`✅ Segmento "${segment.name}" inserido com sucesso`);
      } catch (error) {
        if (error.message?.includes('duplicate key')) {
          console.log(`⚠️  Segmento "${segment.name}" já existe`);
        } else {
          console.error(`❌ Erro ao inserir segmento "${segment.name}":`, error.message);
        }
      }
    }
    
    console.log('🎉 Processo de inserção de segmentos concluído!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro geral:', error);
    process.exit(1);
  }
}

seedSegments();
