#!/bin/bash

# Script para agendar backup automático diário no Linux/macOS
# Configura um cron job para executar o backup

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-database.mjs"
CRON_TIME="${1:-0 2 * * *}"  # Padrão: 2:00 AM todos os dias

function log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

function show_help() {
    echo "📖 Uso: $0 [CRON_TIME] [COMMAND]"
    echo ""
    echo "CRON_TIME: Formato cron (padrão: '0 2 * * *' = 2:00 AM diário)"
    echo ""
    echo "Comandos:"
    echo "  install   - Instala o cron job"
    echo "  remove    - Remove o cron job"
    echo "  status    - Mostra status do cron job"
    echo "  test      - Executa backup manualmente"
    echo ""
    echo "Exemplos:"
    echo "  $0 install                    # Instala backup às 2:00 AM"
    echo "  $0 '0 3 * * *' install       # Instala backup às 3:00 AM"
    echo "  $0 remove                     # Remove o backup agendado"
    echo "  $0 status                     # Verifica se está agendado"
}

function check_prerequisites() {
    # Verifica Node.js
    if ! command -v node &> /dev/null; then
        log "❌ Node.js não encontrado. Instale o Node.js primeiro."
        return 1
    fi
    
    local node_version=$(node --version)
    log "✅ Node.js encontrado: $node_version"
    
    # Verifica script de backup
    if [[ ! -f "$BACKUP_SCRIPT" ]]; then
        log "❌ Script de backup não encontrado: $BACKUP_SCRIPT"
        return 1
    fi
    
    log "✅ Script de backup encontrado: $BACKUP_SCRIPT"
    
    # Verifica crontab
    if ! command -v crontab &> /dev/null; then
        log "❌ crontab não encontrado. Sistema não suporta cron jobs."
        return 1
    fi
    
    log "✅ crontab disponível"
    return 0
}

function install_cron_job() {
    local cron_time="$1"
    local job_command="cd '$PROJECT_DIR' && node '$BACKUP_SCRIPT' >> '$PROJECT_DIR/logs/backup.log' 2>&1"
    local job_line="$cron_time $job_command"
    
    log "🔧 Instalando cron job para backup diário..."
    
    # Cria diretório de logs se não existir
    mkdir -p "$PROJECT_DIR/logs"
    
    # Remove job existente se houver
    remove_cron_job_silent
    
    # Adiciona novo job
    (crontab -l 2>/dev/null; echo "$job_line") | crontab -
    
    if [[ $? -eq 0 ]]; then
        log "✅ Cron job instalado com sucesso!"
        log "⏰ Backup será executado: $cron_time"
        log "📁 Logs em: $PROJECT_DIR/logs/backup.log"
        return 0
    else
        log "❌ Erro ao instalar cron job"
        return 1
    fi
}

function remove_cron_job() {
    log "🗑️ Removendo cron job de backup..."
    remove_cron_job_silent
    
    if [[ $? -eq 0 ]]; then
        log "✅ Cron job removido com sucesso!"
    else
        log "❌ Erro ao remover cron job"
    fi
}

function remove_cron_job_silent() {
    # Remove linhas que contenham o script de backup
    crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT" | crontab -
    return $?
}

function show_status() {
    log "📊 Status do backup automático:"
    
    local existing_job=$(crontab -l 2>/dev/null | grep "$BACKUP_SCRIPT")
    
    if [[ -n "$existing_job" ]]; then
        log "✅ Backup agendado encontrado:"
        log "   $existing_job"
        
        # Mostra próxima execução (aproximada)
        local cron_part=$(echo "$existing_job" | cut -d' ' -f1-5)
        log "   Horário: $cron_part"
        
        # Verifica log de backup
        local log_file="$PROJECT_DIR/logs/backup.log"
        if [[ -f "$log_file" ]]; then
            local last_backup=$(tail -n 20 "$log_file" | grep "Backup criado com sucesso" | tail -n 1)
            if [[ -n "$last_backup" ]]; then
                log "   Último backup: $last_backup"
            fi
        fi
    else
        log "❌ Nenhum backup agendado encontrado"
    fi
    
    # Mostra backups existentes
    local backup_dir="$PROJECT_DIR/backups"
    if [[ -d "$backup_dir" ]]; then
        local backup_count=$(ls -1 "$backup_dir"/*.sql 2>/dev/null | wc -l)
        log "📁 Backups existentes: $backup_count"
        
        if [[ $backup_count -gt 0 ]]; then
            local latest_backup=$(ls -t "$backup_dir"/*.sql 2>/dev/null | head -n 1)
            if [[ -n "$latest_backup" ]]; then
                local backup_date=$(stat -c %y "$latest_backup" 2>/dev/null || stat -f %Sm "$latest_backup" 2>/dev/null)
                log "   Mais recente: $(basename "$latest_backup") ($backup_date)"
            fi
        fi
    fi
}

function test_backup() {
    log "🧪 Executando backup de teste..."
    
    cd "$PROJECT_DIR"
    node "$BACKUP_SCRIPT"
    
    if [[ $? -eq 0 ]]; then
        log "✅ Teste de backup concluído com sucesso!"
    else
        log "❌ Falha no teste de backup"
        return 1
    fi
}

# Função principal
function main() {
    log "🚀 Configurador de Backup Automático - BudgetSales (Linux/macOS)"
    log "=" | head -c 60; echo
    
    # Processa argumentos
    local command=""
    local cron_time="0 2 * * *"  # Padrão: 2:00 AM
    
    # Parse dos argumentos
    for arg in "$@"; do
        case $arg in
            install|remove|status|test|help)
                command="$arg"
                ;;
            *\ *\ *\ *\ *)  # Formato cron (5 campos)
                cron_time="$arg"
                ;;
            --help|-h)
                command="help"
                ;;
        esac
    done
    
    # Se não especificou comando, assume install
    if [[ -z "$command" ]]; then
        command="install"
    fi
    
    case $command in
        help)
            show_help
            ;;
        install)
            if check_prerequisites; then
                install_cron_job "$cron_time"
                echo ""
                log "🎉 Configuração concluída!"
                echo ""
                log "📋 Comandos úteis:"
                log "   Ver status:    ./scripts/schedule-backup.sh status"
                log "   Remover:       ./scripts/schedule-backup.sh remove"
                log "   Testar:        ./scripts/schedule-backup.sh test"
                echo ""
                log "📁 Backups serão salvos em: ./backups/"
                log "📝 Logs em: ./logs/backup.log"
            fi
            ;;
        remove)
            remove_cron_job
            ;;
        status)
            show_status
            ;;
        test)
            if check_prerequisites; then
                test_backup
            fi
            ;;
        *)
            log "❌ Comando inválido: $command"
            show_help
            exit 1
            ;;
    esac
}

# Executa apenas se chamado diretamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
