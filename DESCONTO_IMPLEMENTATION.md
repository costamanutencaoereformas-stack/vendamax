# Implementação: Desconto com Opção de % ou Valor nas Contas a Receber

## Resumo das Mudanças

Foi implementado um sistema de desconto configurável para **Contas a Receber** que permite escolher entre:
- **Valor Fixo (R$)**: Desconto em reais
- **Percentual (%)**: Desconto em percentual do valor total

## Arquivos Modificados

### 1. **Banco de Dados** (`migrations/0025_add_discount_type_to_finance.sql`)
- Adicionada coluna `discount_type` à tabela `finance`
- Valores aceitos: `FIXED_VALUE` (padrão) ou `PERCENTAGE`
- Aplicado índice para performance de filtros

### 2. **Schema** (`shared/schema.ts`)
- Adicionado campo `discountType` na tabela `finance` com valor padrão `"FIXED_VALUE"`
- Campo é incluído automaticamente em todas as operações de finance

### 3. **Backend** (`server/routes.ts`)
- As rotas POST e PUT de finance (`/api/finance`) agora aceitam o campo `discountType`
- A validação é feita automaticamente via `insertFinanceSchema`
- O campo é persistido no banco de dados

### 4. **Frontend** (`client/src/pages/finance.tsx`)

#### Estados adicionados:
- `launchDiscountType`: tipo de desconto no modo de novo lançamento
- `editDiscountType`: tipo de desconto no modo de edição

#### UI Implementada:
- **Novo Lançamento**: Botões toggle "R$ Valor" e "% Percentual" para escolher o tipo
- **Edição**: Mesmos botões toggle para alterar o tipo de desconto
- **Cálculo automático**: O valor final é recalculado automaticamente com base no tipo escolhido

#### Lógica:
- Quando o tipo é `"valor"`, o desconto é um valor absoluto
- Quando o tipo é `"percentual"`, o desconto é calculado como porcentagem do valor total
- O placeholder do campo muda dinamicamente para orientar o usuário

## Como Usar

### Novo Lançamento (Conta a Receber)
1. Abrir dialog de novo lançamento
2. Selecionar tipo "Receber"
3. Preencher valor
4. **Selecionar tipo de desconto** (R$ ou %)
5. Informar o valor do desconto
6. O "Valor Final" será calculado automaticamente

### Editar Lançamento (Conta a Receber)
1. Clicar em editar em uma conta a receber
2. **Alterar o tipo de desconto** conforme necessário
3. Atualizar o valor do desconto
4. Salvar as mudanças

## Exemplo de Uso

**Cenário 1: Desconto em Valor Fixo**
- Valor: R$ 1.000,00
- Tipo: R$ Valor
- Desconto: R$ 100,00
- **Valor Final: R$ 900,00**

**Cenário 2: Desconto em Percentual**
- Valor: R$ 1.000,00
- Tipo: % Percentual
- Desconto: 10% (informar como 10,00)
- **Valor Final: R$ 900,00**

## Banco de Dados

### Estrutura da Tabela `finance`
```sql
finance.discount_type: TEXT (DEFAULT 'FIXED_VALUE')
-- Valores aceitos: 'FIXED_VALUE' ou 'PERCENTAGE'
```

### Dados de Exemplo
```json
{
  "id": "xxx",
  "entryType": "RECEIVABLE",
  "amount": 1000.00,
  "discount": 100.00,
  "discountType": "FIXED_VALUE"
}
```

## Próximas Etapas (Opcional)

1. **Cálculo automático de percentual**: Adicionar cálculo automático quando o tipo muda
2. **Relatórios**: Incluir filtros de relatórios por tipo de desconto
3. **Contas a Pagar**: Estender a funcionalidade para acréscimos (surcharge) também
4. **API de cálculo**: Criar endpoint que retorna o valor final baseado em (valor, desconto, tipo)

## Validações

- Ambos os tipos (valor e percentual) aceitam até 2 casas decimais
- O valor do desconto deve ser maior ou igual a 0
- O desconto não pode ser negativo
- O campo `discountType` é opcional (padrão: "FIXED_VALUE")

## Notas de Implementação

- A migração aplica `DEFAULT 'FIXED_VALUE'` para manter retrocompatibilidade
- Registros existentes terão `discountType = 'FIXED_VALUE'` por padrão
- A UI permite trocar o tipo mesmo com registros antigos
- O cálculo do "Valor Final" é feito no frontend para feedback imediato
- A persistência é feita no backend com validação de schema Zod
