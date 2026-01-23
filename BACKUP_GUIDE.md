# 🛡️ Sistema de Backup Automático - BudgetSales

## 📋 Visão Geral

Sistema completo de backup automático para proteger os dados do BudgetSales contra perda acidental. Inclui backup diário automático, restauração de dados e gerenciamento de histórico.

## 🚀 Configuração Rápida

### Windows (Recomendado)
```bash
# 1. Criar backup manual (teste)
npm run backup:create

# 2. Agendar backup diário às 2:00 AM
npm run backup:schedule

# 3. Verificar status
.\scripts\schedule-backup.ps1 -Status
```

### Linux/macOS
```bash
# 1. Tornar script executável
chmod +x scripts/schedule-backup.sh

# 2. Instalar backup diário
./scripts/schedule-backup.sh install

# 3. Verificar status
./scripts/schedule-backup.sh status
```

## 📁 Estrutura de Arquivos

```
BudgetSales/
├── backups/                    # Diretório de backups
│   ├── backup_20250109_0200.sql   # Arquivo de backup
│   └── backup_20250109_0200.json  # Metadados do backup
├── scripts/
│   ├── backup-database.mjs     # Script principal de backup
│   ├── restore-backup.mjs      # Script de restauração
│   ├── schedule-backup.ps1     # Agendador Windows
│   └── schedule-backup.sh      # Agendador Linux/macOS
└── logs/
    └── backup.log              # Log dos backups automáticos
```

## 🔧 Comandos Disponíveis

### NPM Scripts
```bash
npm run backup:create      # Criar backup manual
npm run backup:restore     # Restaurar backup (interativo)
npm run backup:list        # Listar backups disponíveis
npm run backup:schedule    # Configurar backup automático (Windows)
```

### Scripts Diretos

#### Backup Manual
```bash
node scripts/backup-database.mjs
```

#### Restauração
```bash
# Listar backups disponíveis
node scripts/restore-backup.mjs

# Restaurar backup mais recente
node scripts/restore-backup.mjs --latest

# Restaurar backup específico
node scripts/restore-backup.mjs --index 2

# Restaurar com limpeza completa (CUIDADO!)
node scripts/restore-backup.mjs --latest --drop-tables
```

## ⚙️ Configuração Automática

### Windows - Task Scheduler

```powershell
# Instalar backup diário às 2:00 AM
.\scripts\schedule-backup.ps1

# Personalizar horário (3:30 AM)
.\scripts\schedule-backup.ps1 -Time "03:30"

# Ver status da tarefa
.\scripts\schedule-backup.ps1 -Status

# Remover agendamento
.\scripts\schedule-backup.ps1 -Remove

# Executar backup agora
schtasks /run /tn "BudgetSales-DailyBackup"
```

### Linux/macOS - Cron Jobs

```bash
# Instalar backup diário às 2:00 AM
./scripts/schedule-backup.sh install

# Personalizar horário (3:30 AM todos os dias)
./scripts/schedule-backup.sh "30 3 * * *" install

# Ver status
./scripts/schedule-backup.sh status

# Remover agendamento
./scripts/schedule-backup.sh remove

# Testar backup
./scripts/schedule-backup.sh test
```

## 📊 Características dos Backups

### Conteúdo Incluído
- ✅ Todas as tabelas do banco de dados
- ✅ Estrutura completa (schemas, índices, constraints)
- ✅ Todos os dados (clientes, produtos, vendas, orçamentos, etc.)
- ✅ Configurações e metadados
- ✅ Dados financeiros e relatórios

### Formato dos Arquivos
- **SQL**: Arquivo principal com comandos SQL completos
- **JSON**: Metadados (data, tamanho, estatísticas)
- **Compressão**: Automática para arquivos grandes
- **Nomenclatura**: `backup_YYYYMMDD_HHMM.sql`

### Retenção
- **Padrão**: 30 backups mais recentes
- **Limpeza**: Automática de arquivos antigos
- **Espaço**: Otimizado para não ocupar muito disco

## 🔄 Processo de Restauração

### Cenários Comuns

#### 1. Recuperar Dados Perdidos
```bash
# Ver backups disponíveis
npm run backup:restore

# Restaurar o mais recente
node scripts/restore-backup.mjs --latest
```

#### 2. Voltar a Estado Anterior
```bash
# Listar com detalhes
node scripts/restore-backup.mjs

# Escolher backup específico
node scripts/restore-backup.mjs --index 3
```

#### 3. Restauração Completa (Reset Total)
```bash
# ATENÇÃO: Remove TODOS os dados atuais
node scripts/restore-backup.mjs --latest --drop-tables
```

## 🛠️ Métodos de Backup

### 1. PostgreSQL nativo (pg_dump)
- **Melhor opção** se disponível
- Backup completo e otimizado
- Compatível com ferramentas PostgreSQL

### 2. SQL Queries (Fallback)
- Usado quando pg_dump não está disponível
- Funciona em qualquer ambiente
- Backup via consultas SQL diretas

## 📈 Monitoramento

### Logs de Backup
```bash
# Ver logs recentes (Windows)
Get-Content logs\backup.log -Tail 20

# Ver logs recentes (Linux/macOS)
tail -f logs/backup.log
```

### Verificação de Integridade
```bash
# Testar backup manual
npm run backup:create

# Verificar se arquivos foram criados
ls -la backups/

# Testar restauração (sem aplicar)
node scripts/restore-backup.mjs --help
```

## 🚨 Troubleshooting

### Problemas Comuns

#### Erro: "DATABASE_URL não encontrada"
```bash
# Verificar arquivo .env
cat .env | grep DATABASE_URL

# Recriar se necessário
cp .env.example .env
# Editar com suas credenciais
```

#### Erro: "pg_dump não encontrado"
- **Windows**: Instalar PostgreSQL tools ou usar método SQL
- **Linux**: `sudo apt install postgresql-client`
- **macOS**: `brew install postgresql`

#### Erro: "Permissão negada"
```bash
# Linux/macOS - dar permissão aos scripts
chmod +x scripts/*.sh
chmod +x scripts/*.mjs
```

#### Backup muito grande
- Verificar espaço em disco
- Ajustar MAX_BACKUPS no script
- Considerar compressão externa

### Recuperação de Emergência

#### Se perdeu TODOS os dados:
1. **Pare o servidor** (`Ctrl+C`)
2. **Liste backups**: `npm run backup:restore`
3. **Restaure o mais recente**: `node scripts/restore-backup.mjs --latest --drop-tables`
4. **Reinicie o servidor**: `npm run dev`

#### Se backup falhou:
1. **Verifique .env**: Credenciais corretas?
2. **Teste conexão**: `npm run test:conn`
3. **Backup manual**: `npm run backup:create`
4. **Verifique logs**: `cat logs/backup.log`

## 🔐 Segurança

### Proteção dos Backups
- Backups contêm dados sensíveis
- Manter diretório `backups/` seguro
- Não versionar no Git (já está no .gitignore)
- Considerar backup externo para produção

### Credenciais
- Nunca versionar arquivo `.env`
- Usar variáveis de ambiente em produção
- Rotacionar senhas periodicamente

## 📅 Cronograma Recomendado

### Desenvolvimento
- **Backup manual**: Antes de mudanças grandes
- **Backup automático**: Diário às 2:00 AM
- **Retenção**: 7-15 backups

### Produção
- **Backup automático**: Diário às 2:00 AM
- **Backup semanal**: Arquivo para armazenamento externo
- **Retenção**: 30-90 backups
- **Teste de restauração**: Mensal

## 🎯 Próximos Passos

1. **Configure o backup automático** para sua plataforma
2. **Teste a restauração** com dados de exemplo
3. **Monitore os logs** regularmente
4. **Documente** procedimentos específicos da sua empresa
5. **Treine a equipe** nos procedimentos de recuperação

---

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique os logs em `logs/backup.log`
2. Execute `npm run backup:create` para teste manual
3. Consulte este guia para troubleshooting
4. Verifique as configurações do `.env`

**Lembre-se**: Backup é segurança. Teste regularmente! 🛡️
