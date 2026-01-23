
## Versão em Português — Orientação rápida (Vendamax / BudgetSales)

Repositório full-stack TypeScript (React + Express) com esquema compartilhado (`shared/schema.ts`) e migrations via Drizzle.

O que é este projeto:
- Frontend: React + Vite (pasta `client/`). Código-fonte em `client/src`. O build resulta em `dist/public` (ver `vite.config.ts`).
- Backend: Express + TypeScript (pasta `server/`). Entrada do servidor: `server/index.ts` (dev: `npm run dev`).
- Banco: PostgreSQL com Drizzle ORM e Drizzle Kit para migrations (`drizzle.config.ts`, `scripts/*`, `migrations/`).
- Estrutura monorepo leve: tipos e Zod schemas em `shared/` usados por cliente e servidor.

Scripts importantes (rodar na raiz do repositório):
- `npm run dev` — modo dev sem Supabase (armazenamento em memória).
- `npm run dev:supabase` — dev com integração Supabase (use para testes com banco real).
- `npm run build` — gera `dist/` (frontend + bundle do servidor).
- `npm run start` — inicia bundle de produção (usa `dist/index.js`).
- `npm run db:generate` / `npm run db:migrate` — helpers do Drizzle para migrations.

Ambiente & notas de configuração:
- Copie `.env.example` → `.env` antes de rodar; variáveis obrigatórias: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL`, `ALLOWED_ORIGINS`, `SESSION_SECRET` (veja `README.md` e `DEPLOYMENT.md`).
- `VITE_BASE_PATH` permite servir o frontend sob um subpath (configurado em `vite.config.ts`).
- Para desabilitar checagens de autenticação em dev: `DISABLE_AUTH=1`.

Padrões e convenções específicas:
- Validação compartilhada: Zod/Drizzle em `shared/schema.ts`. O servidor importa como `@shared/schema` (veja `server/routes.ts`). Mantenha os shapes sincronizados entre frontend e backend.
- Troca de storage: `server/storage.ts` exporta implementações diferentes (memória vs Supabase). Altere a exportação para trocar o backend de storage.
- Uploads: `multer` é usado em `server/routes.ts`. Arquivos ficam em `uploads/` (projetos → `uploads/projects/:id`, produtos → `uploads/products`). Observe limites de tamanho por rota.
- Rotas admin: muitas rotas dependem do header `x-user-role`/`x-role` para autorização; em dev `DISABLE_AUTH=1` ignora isso.
- Datas: use `parseDateSafe` em `server/routes.ts` para evitar problemas de timezone com datas no formato `YYYY-MM-DD`.

Exemplos de mudanças comuns:
- Adicionar endpoint: siga `registerRoutes` em `server/routes.ts` e valide bodies com os schemas de insert de `@shared/schema` (ex.: `insertQuoteSchema`).
- UI: componentes em `client/src/components`, usam shadcn/ui + Tailwind. Ver `components.json` para aliases e `tailwind.config.ts` para classes safelist.
- Banco: editar `shared/schema.ts` → `npm run db:generate` → `npm run db:migrate` → `npm run build`.

Testes, debug e deploy:
- Health check: `/health` (usado em `render.yaml`).
- Debug local: `npm run dev` (usa `tsx` e carrega `.env`).
- Validar build: `npm run build` então `npm run test:db` / `npm run test:conn`.
- Manifests de deploy: `render.yaml`, `netlify.toml`, `Dockerfile`.

Cuidados importantes:
- Não assumir JWT: autenticação por sessões (connect-pg-simple).
- Alterar o fluxo de auth exige mudanças em vários pontos (rotas que checam `x-user-role`).
- Arquivos estáticos do frontend servem de `dist/public`; uploads ficam em `uploads/`.

Se alterar tipos em `shared/schema.ts`:
1. Atualize `shared/schema.ts`.
2. Rode `npm run db:generate` e `npm run db:migrate`.
3. Rode `npm run build` e faça testes rápidos das rotas que usam as tabelas alteradas.

Entradas úteis para explorar (comece por estes arquivos):
- `server/index.ts` — bootstrap e middleware do servidor
- `server/routes.ts` — endpoints, validação e configuração do `multer`
- `shared/schema.ts` — esquema canônico e schemas de insert
- `client/src` — app React
- `package.json` / `DEPLOYMENT.md` / `replit.md` — scripts e workflows

Ao terminar uma mudança, descreva no PR os passos mínimos de verificação (build, migrate, smoke-call nas rotas, checar uploads). Se precisar de credenciais Supabase reais, peça aos mantenedores — o dev local funciona com armazenamento em memória.

— Fim da versão em Português —

Se quiser que eu ajuste algo (reduzir, tornar bilíngue em outra forma, ou focar em cenários CI/CD específicos), diga qual seção deseja atualizar.
