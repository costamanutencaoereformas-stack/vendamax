# Plano de Preparação para Vercel e Supabase

Este guia detalha as mudanças necessárias para preparar a aplicação para produção no Vercel utilizando Supabase.

## 1. Banco de Dados (Supabase PostgreSQL)
A aplicação já está configurada para usar Drizzle ORM com PostgreSQL.
- **Variável Necessária**: `DATABASE_URL` (String de conexão do Supabase).
- **Nota**: Use a string de conexão com o pooler (Transaction mode) para melhor performance em Serverless (Vercel).

## 2. Configurações do Vercel
- Criado arquivo `vercel.json` para roteamento dinâmico.
- Criado entry point `api/index.ts` para funções serverless do Vercel.
- Refatorado `server/index.ts` para exportar a aplicação sem travar o processo.

## 3. Armazenamento de Arquivos (Supabase Storage) - **IMPORTANTE**
O Vercel possui sistema de arquivos somente-leitura. Atualmente a aplicação salva em `uploads/`. 
- **Ação**: Implementar suporte a Supabase Storage Buckets.
- **Variáveis**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## 4. Próximos Passos
1. Criar os Buckets no Supabase: `projects`, `products`, `documents`.
2. Configurar as variáveis de ambiente no painel do Vercel.
3. Realizar o Deploy via GitHub.
