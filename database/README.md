# Configuração do Banco de Dados

Este diretório contém os scripts necessários para configurar o banco de dados MySQL do sistema Budget Sales.

## Estrutura dos Arquivos

- `init.sql`: Script principal de inicialização do banco de dados
- `schema.sql`: Definição das tabelas e estruturas do banco
- `seed.sql`: Dados iniciais de exemplo

## Pré-requisitos

- MySQL Server 8.0 ou superior instalado
- Usuário MySQL com permissões de administrador

## Configuração

1. Certifique-se de que o MySQL Server está em execução

2. Configure as variáveis de ambiente no arquivo `.env` na raiz do projeto:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=seu_usuario
   DB_PASSWORD=sua_senha
   DB_NAME=budget_sales
   ```

3. Execute o script de inicialização usando o MySQL CLI:
   ```bash
   mysql -u seu_usuario -p < init.sql
   ```
   Ou através do MySQL Workbench:
   - Abra o MySQL Workbench
   - Conecte ao seu servidor MySQL
   - Abra o arquivo `init.sql`
   - Execute o script

## Verificação

Após a execução, o script mostrará:
- Lista de tabelas criadas
- Contagem de registros em cada tabela

## Estrutura do Banco

### Tabelas Principais

1. `users`: Usuários do sistema
   - Administradores
   - Vendedores
   - Outros usuários

2. `customers`: Cadastro de clientes
   - Pessoas físicas (CPF)
   - Pessoas jurídicas (CNPJ)

3. `suppliers`: Cadastro de fornecedores
   - Dados cadastrais
   - Informações de contato
   - Condições de pagamento

4. `categories`: Categorias de produtos
   - Categorias padrão
   - Possibilidade de expansão

## Manutenção

Para reinicializar o banco de dados:
1. Execute novamente o script `init.sql`
2. Todos os dados serão removidos e recriados
3. Apenas os dados de exemplo serão restaurados

## Backup

Para fazer backup do banco de dados:
```bash
mysqldump -u seu_usuario -p budget_sales > backup.sql
```

Para restaurar um backup:
```bash
mysql -u seu_usuario -p budget_sales < backup.sql
```