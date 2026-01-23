# Sistema de PDV (Ponto de Venda)

## Visão Geral
Sistema completo de PDV implementado na aplicação com todas as funcionalidades necessárias para vendas rápidas e gerenciamento de caixa.

## Funcionalidades Implementadas

### 1. Interface de PDV (`/pdv`)
- **Busca de Produtos**
  - Busca por nome, código ou código de barras
  - Leitura de código de barras via scanner
  - Grid visual de produtos com imagens e preços
  - Indicador de estoque em tempo real

- **Carrinho de Compras**
  - Adicionar/remover produtos
  - Ajustar quantidades
  - Aplicar descontos
  - Visualização do total em tempo real

- **Seleção de Cliente**
  - Busca rápida de clientes
  - Venda com ou sem cliente

- **Finalização de Venda**
  - Múltiplas formas de pagamento:
    - Dinheiro (com cálculo de troco)
    - Cartão
    - PIX
    - Boleto
  - Validação de valores
  - Registro automático no sistema

### 2. Gerenciamento de Caixa (`/cash-register`)
- **Abertura de Caixa**
  - Definir saldo inicial
  - Registro de data/hora de abertura
  - Atribuição ao operador

- **Fechamento de Caixa**
  - Contagem de saldo final
  - Cálculo automático de diferença (quebra)
  - Relatório de movimentações

- **Movimentações**
  - **Sangria**: Retirada de valores do caixa
  - **Reforço**: Adição de valores ao caixa
  - Histórico completo de movimentações
  - Registro de vendas automaticamente

- **Visualização**
  - Saldo inicial, atual e esperado
  - Status do caixa (Aberto/Fechado)
  - Lista de todas as movimentações

### 3. Banco de Dados

#### Tabela: `cash_registers`
```sql
- id (UUID)
- code (TEXT) - Código único do caixa
- name (TEXT) - Nome do caixa
- status (TEXT) - OPEN ou CLOSED
- user_id (UUID) - Operador
- opened_at (TIMESTAMP)
- closed_at (TIMESTAMP)
- opening_balance (DECIMAL) - Saldo inicial
- current_balance (DECIMAL) - Saldo atual
- expected_balance (DECIMAL) - Saldo esperado
- closing_balance (DECIMAL) - Saldo no fechamento
- difference (DECIMAL) - Diferença/quebra
- notes (TEXT)
- created_at (TIMESTAMP)
```

#### Tabela: `cash_movements`
```sql
- id (UUID)
- register_id (UUID) - Referência ao caixa
- type (TEXT) - OPENING, SALE, WITHDRAWAL, REINFORCEMENT, CLOSING
- description (TEXT)
- amount (DECIMAL)
- payment_method (TEXT) - Para vendas
- sale_id (UUID) - Referência à venda
- user_id (UUID)
- created_at (TIMESTAMP)
```

### 4. Endpoints da API

#### Cash Register
- `GET /api/cash-register/current` - Buscar caixa aberto atual
- `GET /api/cash-register/movements/:registerId` - Listar movimentações
- `POST /api/cash-register/open` - Abrir caixa
- `POST /api/cash-register/close` - Fechar caixa
- `POST /api/cash-register/movement` - Adicionar movimentação (sangria/reforço)

### 5. Rotas da Aplicação
- `/pdv` - Interface de vendas rápidas
- `/cash-register` - Gerenciamento de caixa

### 6. Menu de Navegação
Adicionado ao menu "Operações":
- **PDV (Vendas Rápidas)** - Ícone: CreditCard
- **Gerenciar Caixa** - Ícone: DollarSign

## Fluxo de Trabalho

### Fluxo Típico de Operação
1. **Abertura do Caixa**
   - Operador vai em "Gerenciar Caixa"
   - Clica em "Abrir Caixa"
   - Define o saldo inicial
   - Caixa fica disponível para vendas

2. **Realização de Vendas**
   - Operador acessa o PDV
   - Escaneia ou busca produtos
   - Adiciona ao carrinho
   - Seleciona cliente (opcional)
   - Escolhe forma de pagamento
   - Finaliza a venda
   - Sistema registra automaticamente no caixa

3. **Movimentações Durante o Dia**
   - Sangria: Quando precisa retirar dinheiro para segurança
   - Reforço: Quando precisa adicionar troco

4. **Fechamento do Caixa**
   - Operador conta o dinheiro físico
   - Vai em "Gerenciar Caixa"
   - Clica em "Fechar Caixa"
   - Informa o saldo contado
   - Sistema calcula e mostra a diferença
   - Confirma o fechamento

## Arquivos Criados/Modificados

### Novos Arquivos
- `shared/schema.ts` - Schemas de CashRegister e CashMovement
- `migrations/0024_add_cash_register.sql` - Migration do banco
- `client/src/pages/pdv.tsx` - Interface do PDV
- `client/src/pages/cash-register.tsx` - Gerenciamento de caixa
- `docs/PDV_SYSTEM.md` - Esta documentação

### Arquivos Modificados
- `client/src/App.tsx` - Rotas adicionadas
- `client/src/components/layout/sidebar.tsx` - Menu atualizado
- `server/routes.ts` - Endpoints adicionados
- `server/storage.ts` - Interface IStorage atualizada
- `server/supabase-storage.ts` - Implementação dos métodos

## Próximos Passos Recomendados

### Melhorias Futuras
1. **Relatórios de Caixa**
   - Relatório diário/mensal de caixas
   - Análise de quebras
   - Performance por operador

2. **Impressão**
   - Impressão de cupom fiscal/não fiscal
   - Impressão de relatório de fechamento

3. **Múltiplos Caixas**
   - Suporte a vários caixas simultâneos
   - Gestão de múltiplos operadores

4. **Integrações**
   - Integração com impressora fiscal
   - Integração com TEF (pagamento com cartão)
   - Integração com balanças

5. **Segurança**
   - Permissões por usuário
   - Auditoria de operações
   - Backup automático

## Instruções de Instalação

1. **Aplicar Migration**
   ```bash
   npm run db:push
   ```

2. **Reiniciar Servidor**
   ```bash
   npm run dev
   ```

3. **Acessar PDV**
   - Faça login na aplicação
   - Acesse "PDV (Vendas Rápidas)" no menu

## Observações Importantes

- O sistema valida que apenas um caixa pode estar aberto por vez
- Vendas só podem ser realizadas com caixa aberto
- Todas as movimentações são registradas com timestamp
- O cálculo de diferença (quebra) é automático no fechamento
- Os valores são armazenados com 2 casas decimais

## Suporte

Para dúvidas ou problemas, consulte a documentação técnica ou entre em contato com o desenvolvedor.
