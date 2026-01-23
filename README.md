# BudgetSales - Sistema de Gestão de Vendas

## Configuração do Supabase

Este projeto utiliza o Supabase como banco de dados. Siga os passos abaixo para configurar o ambiente:

### 1. Crie uma conta no Supabase

- Acesse [https://supabase.com/](https://supabase.com/) e crie uma conta
- Crie um novo projeto
- Anote a senha do banco de dados durante a criação do projeto

### 2. Obtenha as credenciais do projeto

1. No painel do Supabase, vá para **Project Settings** > **API**
2. Copie a **URL do projeto** e a **anon key** (chave anônima)
3. A referência do projeto é a parte da URL que vem antes de `.supabase.co`

### 3. Configure as variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e preencha com suas informações:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com as informações do seu projeto Supabase:

```
# Supabase configuration
SUPABASE_URL=https://seu-projeto-ref.supabase.co
SUPABASE_ANON_KEY=sua-supabase-anon-key
DATABASE_URL=postgresql://postgres:sua-senha-do-banco@seu-projeto-ref.supabase.co:5432/postgres
```

Substitua os valores pelas informações do seu projeto:
- `seu-projeto-ref`: Referência do seu projeto (parte da URL do projeto)
- `sua-supabase-anon-key`: Chave anônima (encontrada em Project Settings > API)
- `sua-senha-do-banco`: Senha do banco de dados (definida ao criar o projeto)

### 4. Gere e execute as migrações do banco de dados

Para gerar os arquivos de migração (caso ainda não existam):

```bash
npm run db:generate
```

Para criar as tabelas no Supabase:

```bash
npm run db:migrate
```

## Executando o projeto

### Com Supabase

Para iniciar o servidor em modo de desenvolvimento com Supabase:

```bash
npm run dev:supabase
```

Para iniciar em produção com Supabase:

```bash
npm run build
npm run start:supabase
```

### Sem Supabase (usando armazenamento em memória)

```bash
npm run dev
```

O servidor estará disponível em http://127.0.0.1:5000

## Estrutura do Banco de Dados

O sistema utiliza as seguintes tabelas:

- **users**: Usuários do sistema (autenticação e controle de acesso)
- **customers**: Clientes (dados cadastrais e classificação)
- **suppliers**: Fornecedores (dados cadastrais e condições de pagamento)
- **categories**: Categorias de produtos (organização do catálogo)
- **products**: Produtos (informações, preços e estoque)
- **inventory**: Movimentações de estoque (entradas, saídas e ajustes)
- **quotes**: Orçamentos (propostas de venda para clientes)
- **quote_items**: Itens dos orçamentos (produtos incluídos nas propostas)
- **sales**: Vendas (pedidos confirmados e faturados)
- **sale_items**: Itens das vendas (produtos vendidos)

## Alternando entre armazenamento

O sistema suporta dois tipos de armazenamento:

1. **MemStorage**: Armazenamento em memória (padrão, não persistente)
2. **SupabaseStorage**: Armazenamento no Supabase (persistente)

Para alternar entre eles, edite o arquivo `server/storage.ts` e modifique a linha de exportação.