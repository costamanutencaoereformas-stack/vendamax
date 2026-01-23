# Script PowerShell para agendar backup automático diário
# Configura uma tarefa no Windows Task Scheduler

param(
    [string]$Time = "02:00",  # Horário padrão: 2:00 AM
    [switch]$Remove,          # Remove a tarefa agendada
    [switch]$Status           # Mostra status da tarefa
)

$TaskName = "BudgetSales-DailyBackup"
$ScriptPath = Join-Path $PSScriptRoot "backup-database.mjs"
$ProjectPath = Split-Path $PSScriptRoot -Parent

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] $Message"
}

function Test-TaskScheduler {
    try {
        Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Create-BackupTask {
    param([string]$BackupTime)
    
    Write-Log "🔧 Criando tarefa agendada para backup diário..."
    
    # Configurações da tarefa
    $Action = New-ScheduledTaskAction -Execute "node" -Argument "`"$ScriptPath`"" -WorkingDirectory $ProjectPath
    
    # Trigger diário no horário especificado
    $Trigger = New-ScheduledTaskTrigger -Daily -At $BackupTime
    
    # Configurações principais
    $Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    
    # Descrição da tarefa
    $Description = "Backup automático diário do banco de dados BudgetSales"
    
    try {
        # Registra a tarefa
        Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description $Description -Force
        
        Write-Log "✅ Tarefa '$TaskName' criada com sucesso!"
        Write-Log "⏰ Backup será executado diariamente às $BackupTime"
        Write-Log "📁 Script: $ScriptPath"
        
        return $true
    } catch {
        Write-Log "❌ Erro ao criar tarefa: $($_.Exception.Message)"
        return $false
    }
}

function Remove-BackupTask {
    Write-Log "🗑️ Removendo tarefa agendada..."
    
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Log "✅ Tarefa '$TaskName' removida com sucesso!"
        return $true
    } catch {
        Write-Log "❌ Erro ao remover tarefa: $($_.Exception.Message)"
        return $false
    }
}

function Show-TaskStatus {
    if (Test-TaskScheduler) {
        $Task = Get-ScheduledTask -TaskName $TaskName
        $TaskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
        
        Write-Log "📊 Status da tarefa '$TaskName':"
        Write-Log "   Estado: $($Task.State)"
        Write-Log "   Última execução: $($TaskInfo.LastRunTime)"
        Write-Log "   Próxima execução: $($TaskInfo.NextRunTime)"
        Write-Log "   Último resultado: $($TaskInfo.LastTaskResult)"
        
        # Mostra triggers
        $Task.Triggers | ForEach-Object {
            if ($_.CimClass.CimClassName -eq "MSFT_TaskDailyTrigger") {
                Write-Log "   Horário: $($_.StartBoundary.ToString("HH:mm"))"
            }
        }
    } else {
        Write-Log "❌ Tarefa '$TaskName' não encontrada"
    }
}

function Test-NodeAndScript {
    # Verifica se Node.js está disponível
    try {
        $nodeVersion = node --version 2>$null
        Write-Log "✅ Node.js encontrado: $nodeVersion"
    } catch {
        Write-Log "❌ Node.js não encontrado. Instale o Node.js primeiro."
        return $false
    }
    
    # Verifica se o script de backup existe
    if (Test-Path $ScriptPath) {
        Write-Log "✅ Script de backup encontrado: $ScriptPath"
    } else {
        Write-Log "❌ Script de backup não encontrado: $ScriptPath"
        return $false
    }
    
    return $true
}

# Função principal
function Main {
    Write-Log "🚀 Configurador de Backup Automático - BudgetSales"
    Write-Log "=" * 50
    
    # Verifica pré-requisitos
    if (-not (Test-NodeAndScript)) {
        Write-Log "❌ Pré-requisitos não atendidos. Abortando."
        exit 1
    }
    
    # Processa parâmetros
    if ($Remove) {
        if (Test-TaskScheduler) {
            Remove-BackupTask
        } else {
            Write-Log "❌ Tarefa '$TaskName' não existe"
        }
        return
    }
    
    if ($Status) {
        Show-TaskStatus
        return
    }
    
    # Cria ou atualiza a tarefa
    if (Test-TaskScheduler) {
        Write-Log "⚠️ Tarefa '$TaskName' já existe. Será atualizada."
    }
    
    $success = Create-BackupTask -BackupTime $Time
    
    if ($success) {
        Write-Log ""
        Write-Log "🎉 Configuração concluída!"
        Write-Log ""
        Write-Log "📋 Comandos úteis:"
        Write-Log "   Ver status:    .\scripts\schedule-backup.ps1 -Status"
        Write-Log "   Remover:       .\scripts\schedule-backup.ps1 -Remove"
        Write-Log "   Executar agora: schtasks /run /tn `"$TaskName`""
        Write-Log ""
        Write-Log "📁 Backups serão salvos em: .\backups\"
        Write-Log "🔄 Backup manual: node scripts\backup-database.mjs"
    }
}

# Executa apenas se chamado diretamente
if ($MyInvocation.InvocationName -ne '.') {
    Main
}
