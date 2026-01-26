# 🔧 RESOLUÇÃO DE PROBLEMAS NO VERCEL

## Problema Identificado
- Página `/quotes` não carrega clientes e serviços no Vercel
- Não é possível criar novos orçamentos em produção

## Alterações Realizadas

### 1. Logs de Debug Adicionados
- Endpoint `/api/customers` com logs detalhados
- Endpoint `/api/segments` com logs detalhados  
- Endpoint `/api/products` com logs detalhados
- Health check aprimorado em `/health`

### 2. CORS Melhorado
- Configuração atualizada para aceitar domínios Vercel
- Allow origins automático para `*.vercel.app` e `*.vercel.com`
- Headers adicionais para compatibilidade

### 3. Tratamento de Erros
- Stack trace em desenvolvimento
- Mensagens de erro mais detalhadas
- Verificação de ambiente

## Passos para Deploy

1. **Fazer o commit das alterações:**
```bash
git add .
git commit -m "fix: adicionar logs e melhorar CORS para Vercel"
git push
```

2. **Verificar variáveis de ambiente no Vercel:**
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` 
- `DATABASE_URL`
- `NODE_ENV=production`

3. **Testar endpoints após deploy:**
- `https://seu-app.vercel.app/health`
- `https://seu-app.vercel.app/api/customers`
- `https://seu-app.vercel.app/api/segments`
- `https://seu-app.vercel.app/api/products`

## Diagnóstico

### Se os endpoints ainda falharem:

1. **Verificar logs no Vercel:**
   - Dashboard > Functions > _server
   - Procurar por logs com `[DEBUG]` e `[ERROR]`

2. **Verificar conexão com Supabase:**
   - Testar `DATABASE_URL` no Vercel
   - Verificar se as credenciais estão corretas

3. **Possíveis causas:**
   - Variáveis de ambiente não configuradas
   - Conexão com Supabase falhando
   - Timeout na conexão com banco

### Comandos Úteis

```bash
# Verificar build local
npm run build

# Testar produção localmente
npm run start

# Verificar logs de debug
curl https://seu-app.vercel.app/health
```

## Contingência

Se o problema persistir, considerar:
1. Recriar as variáveis de ambiente no Vercel
2. Verificar se o Supabase está acessível externamente
3. Testar com um banco de dados alternativo

## Arquivos Modificados

- `server/index.ts` - CORS e health check
- `server/routes.ts` - Logs de debug
- `vite.config.ts` - Proxy (ambiente local)

## Próximos Passos

1. Fazer deploy das alterações
2. Monitorar logs no Vercel
3. Testar funcionalidade dos orçamentos
4. Ajustar conforme necessário
