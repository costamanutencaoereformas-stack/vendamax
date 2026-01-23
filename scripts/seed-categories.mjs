import { db } from "../server/supabase.ts";
import { categories } from "../shared/schema.ts";

// Lista de categorias focadas em Materiais de Construção
const constructionCategories = [
  { name: "Cimentos e Argamassas", description: "Cimento, argamassa, rejunte, gesso e aditivos" },
  { name: "Areia, Pedra e Agregados", description: "Areia, brita, pedrisco e agregados em geral" },
  { name: "Blocos e Tijolos", description: "Tijolos cerâmicos, blocos de concreto, tijolos ecológicos" },
  { name: "Madeiras e Compensados", description: "Madeira serrada, vigas, compensados, MDF e OSB" },
  { name: "Ferragens e Metais", description: "Vergalhões, telas, arames, chapas e perfis metálicos" },
  { name: "Tubos e Conexões (Hidráulica)", description: "PVC, PPR, cobre, conexões e acessórios" },
  { name: "Louças e Metais (Banheiro)", description: "Vasos, pias, torneiras, válvulas e acessórios" },
  { name: "Acabamentos (Revestimentos)", description: "Pisos, porcelanatos, azulejos e rodapés" },
  { name: "Tintas e Acessórios", description: "Tintas, massas, primers, pincéis, rolos e solventes" },
  { name: "Elétrica", description: "Cabos, disjuntores, tomadas, interruptores e luminárias" },
  { name: "Impermeabilização", description: "Mantas, emulsões, fitas e produtos impermeabilizantes" },
  { name: "Coberturas e Telhas", description: "Telhas cerâmicas, de concreto, metálicas e policarbonato" },
  { name: "Portas e Janelas", description: "Esquadrias de madeira, alumínio, aço e PVC" },
  { name: "Ferramentas Manuais", description: "Martelos, chaves, alicates, trenas e níveis" },
  { name: "Ferramentas Elétricas", description: "Furadeiras, esmerilhadeiras, serras e marteletes" },
  { name: "EPIs e Segurança", description: "Capacetes, luvas, óculos, botas e sinalização" },
  { name: "Fixadores", description: "Parafusos, porcas, arruelas, buchas e pregos" },
  { name: "Selantes e Adesivos", description: "Silicone, PU, cola branca, epóxi e fitas" },
  { name: "Drywall e Steel Frame", description: "Perfis, chapas, parafusos e acessórios" },
  { name: "Jardinagem e Externo", description: "Mangueiras, irrigação, ferramentas de jardim" },
];

async function seedCategories() {
  try {
    console.log("🌱 Inserindo categorias de Materiais de Construção...");

    for (const category of constructionCategories) {
      try {
        await db.insert(categories).values(category);
        console.log(`✅ Categoria "${category.name}" inserida`);
      } catch (error) {
        const message = error?.message || String(error);
        if (message.includes("duplicate key") || message.includes("unique")) {
          console.log(`⚠️  Categoria "${category.name}" já existe`);
        } else {
          console.error(`❌ Erro ao inserir "${category.name}":`, message);
        }
      }
    }

    console.log("🎉 Seed de categorias concluído!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro geral:", error);
    process.exit(1);
  }
}

seedCategories();
