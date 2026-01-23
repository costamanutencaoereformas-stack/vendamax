#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carrega variáveis de ambiente
dotenv.config({ path: join(__dirname, '..', '.env') });

/**
 * Script de restauração de backup do banco de dados
 * Permite restaurar dados de backups criados pelo sistema
 */

const BACKUP_DIR = join(__dirname, '..', 'backups');

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function listAvailableBackups() {
  if (!existsSync(BACKUP_DIR)) {
    log('❌ Diretório de backups não encontrado');
    return [];
  }

  const backupFiles = readdirSync(BACKUP_DIR)
    .filter(file => file.endsWith('.sql'))
    .map(file => {
      const filePath = join(BACKUP_DIR, file);
      const stats = statSync(filePath);
      const metadataPath = filePath.replace('.sql', '.json');
      
      let metadata = null;
      if (existsSync(metadataPath)) {
        try {
          metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
        } catch (error) {
          log(`⚠️  Erro ao ler metadados de ${file}: ${error.message}`);
        }
      }
      
      return {
        filename: file,
        path: filePath,
        size: stats.size,
        created: stats.mtime,
        metadata
      };
    })
    .sort((a, b) => b.created - a.created);

  return backupFiles;
}

function displayBackupList(backups) {
  if (backups.length === 0) {
    log('📭 Nenhum backup encontrado');
    return;
  }

  log('\n📋 Backups disponíveis:');
  log('═'.repeat(80));
  
  backups.forEach((backup, index) => {
    const sizeInMB = (backup.size / 1024 / 1024).toFixed(2);
    const date = backup.created.toLocaleString('pt-BR');
    
    log(`${index + 1}. ${backup.filename}`);
    log(`   📅 Criado: ${date}`);
    log(`   📊 Tamanho: ${sizeInMB} MB`);
    
    if (backup.metadata) {
      log(`   🗂️  Tabelas: ${backup.metadata.tables_count || 'N/A'}`);
      log(`   📝 Registros: ${backup.metadata.records_count || backup.metadata.records_estimated || 'N/A'}`);
      if (backup.metadata.method) {
        log(`   🔧 Método: ${backup.metadata.method}`);
      }
    }
    log('');
  });
}

async function restoreFromBackup(backupPath, options = {}) {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL não encontrada nas variáveis de ambiente');
    }

    if (!existsSync(backupPath)) {
      throw new Error(`Arquivo de backup não encontrado: ${backupPath}`);
    }

    log(`🔄 Iniciando restauração do backup: ${backupPath}`);
    
    const backupContent = readFileSync(backupPath, 'utf8');
    
    if (options.dropTables) {
      log('⚠️  Modo DROP TABLES ativado - todas as tabelas serão removidas!');
    }
    
    try {
      // Tenta usar psql para restaurar
      const command = `psql "${databaseUrl}" -f "${backupPath}"`;
      
      log('🔧 Executando restauração via psql...');
      execSync(command, { 
        stdio: options.verbose ? 'inherit' : 'pipe',
        encoding: 'utf8'
      });
      
      log('✅ Restauração concluída via psql');
      return { success: true, method: 'psql' };
      
    } catch (psqlError) {
      // Se psql não estiver disponível, usa SQL direto
      log('⚠️  psql não disponível, tentando restauração via SQL...');
      return await restoreViaSQLQueries(backupContent, options);
    }
    
  } catch (error) {
    log(`❌ Erro na restauração: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function restoreViaSQLQueries(backupContent, options = {}) {
  try {
    // Importa o cliente SQL
    const { default: postgres } = await import('postgres');
    
    const databaseUrl = process.env.DATABASE_URL;
    const sql = postgres(databaseUrl);
    
    log('🔄 Executando restauração via SQL queries...');
    
    // Divide o backup em comandos SQL individuais
    const sqlCommands = backupContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
    
    let executedCommands = 0;
    let errors = 0;
    
    for (const command of sqlCommands) {
      try {
        if (command.toUpperCase().includes('DROP TABLE') && !options.dropTables) {
          // Pula comandos DROP TABLE se não autorizado
          continue;
        }
        
        await sql.unsafe(command);
        executedCommands++;
        
        if (options.verbose && executedCommands % 100 === 0) {
          log(`📊 ${executedCommands} comandos executados...`);
        }
        
      } catch (cmdError) {
        errors++;
        if (options.verbose) {
          log(`⚠️  Erro no comando: ${cmdError.message}`);
        }
        
        // Para em caso de muitos erros
        if (errors > 50) {
          throw new Error(`Muitos erros durante a restauração (${errors})`);
        }
      }
    }
    
    await sql.end();
    
    log(`✅ Restauração SQL concluída`);
    log(`📊 ${executedCommands} comandos executados, ${errors} erros`);
    
    return { 
      success: true, 
      method: 'SQL_QUERIES',
      stats: { executed: executedCommands, errors }
    };
    
  } catch (error) {
    log(`❌ Erro na restauração SQL: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function interactiveRestore() {
  const backups = listAvailableBackups();
  
  if (backups.length === 0) {
    log('❌ Nenhum backup disponível para restauração');
    return;
  }
  
  displayBackupList(backups);
  
  // Para uso em scripts, permite passar argumentos
  const args = process.argv.slice(2);
  let selectedIndex = -1;
  let options = {
    dropTables: false,
    verbose: false
  };
  
  // Processa argumentos da linha de comando
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--latest') {
      selectedIndex = 0;
    } else if (arg === '--index' && i + 1 < args.length) {
      selectedIndex = parseInt(args[i + 1]) - 1;
      i++;
    } else if (arg === '--drop-tables') {
      options.dropTables = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--help') {
      showHelp();
      return;
    }
  }
  
  if (selectedIndex < 0 || selectedIndex >= backups.length) {
    log('❌ Índice de backup inválido');
    showHelp();
    return;
  }
  
  const selectedBackup = backups[selectedIndex];
  
  log(`\n🎯 Backup selecionado: ${selectedBackup.filename}`);
  log(`📅 Criado em: ${selectedBackup.created.toLocaleString('pt-BR')}`);
  
  if (options.dropTables) {
    log('⚠️  ATENÇÃO: Todas as tabelas existentes serão removidas!');
  }
  
  const result = await restoreFromBackup(selectedBackup.path, options);
  
  if (result.success) {
    log(`\n✅ Restauração concluída com sucesso!`);
    log(`🔧 Método: ${result.method}`);
    
    if (result.stats) {
      log(`📊 Comandos executados: ${result.stats.executed}`);
      log(`⚠️  Erros: ${result.stats.errors}`);
    }
  } else {
    log(`\n❌ Falha na restauração: ${result.error}`);
    process.exit(1);
  }
}

function showHelp() {
  log(`
📖 Uso do script de restauração:

node scripts/restore-backup.mjs [opções]

Opções:
  --latest              Restaura o backup mais recente
  --index N             Restaura o backup no índice N (1-based)
  --drop-tables         Remove todas as tabelas antes da restauração
  --verbose             Mostra detalhes da execução
  --help               Mostra esta ajuda

Exemplos:
  node scripts/restore-backup.mjs --latest
  node scripts/restore-backup.mjs --index 2 --verbose
  node scripts/restore-backup.mjs --latest --drop-tables
`);
}

// Executa a restauração se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  interactiveRestore().catch(error => {
    log(`💥 Erro fatal: ${error.message}`);
    process.exit(1);
  });
}

export { restoreFromBackup, listAvailableBackups };
