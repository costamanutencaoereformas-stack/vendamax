#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carrega variáveis de ambiente
dotenv.config({ path: join(__dirname, '..', '.env') });

/**
 * Script de backup automático do banco de dados PostgreSQL
 * Cria backups diários com timestamp e mantém histórico
 */

const BACKUP_DIR = join(__dirname, '..', 'backups');
const MAX_BACKUPS = 30; // Manter últimos 30 backups

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

function ensureBackupDirectory() {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
    log(`📁 Diretório de backup criado: ${BACKUP_DIR}`);
  }
}

function generateBackupFilename() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  
  return `backup_${year}${month}${day}_${hour}${minute}.sql`;
}

function createDatabaseBackup() {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL não encontrada nas variáveis de ambiente');
    }

    const backupFilename = generateBackupFilename();
    const backupPath = join(BACKUP_DIR, backupFilename);
    
    log('🔄 Iniciando backup do banco de dados...');
    
    // Comando pg_dump para criar backup
    const command = `pg_dump "${databaseUrl}" --no-owner --no-privileges --clean --if-exists`;
    
    try {
      const backupData = execSync(command, { 
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024 // 50MB buffer
      });
      
      // Salva o backup no arquivo
      writeFileSync(backupPath, backupData);
      
      log(`✅ Backup criado com sucesso: ${backupFilename}`);
      log(`📍 Localização: ${backupPath}`);
      
      // Cria arquivo de metadados
      const metadata = {
        filename: backupFilename,
        created_at: new Date().toISOString(),
        size_bytes: Buffer.byteLength(backupData, 'utf8'),
        database_url: databaseUrl.replace(/:[^:@]*@/, ':****@'), // Oculta senha
        tables_count: (backupData.match(/CREATE TABLE/g) || []).length,
        records_estimated: (backupData.match(/INSERT INTO/g) || []).length
      };
      
      writeFileSync(
        join(BACKUP_DIR, backupFilename.replace('.sql', '.json')),
        JSON.stringify(metadata, null, 2)
      );
      
      return { success: true, filename: backupFilename, path: backupPath, metadata };
      
    } catch (pgError) {
      // Se pg_dump não estiver disponível, tenta backup via SQL
      log('⚠️  pg_dump não disponível, tentando backup via SQL...');
      return createSQLBackup(backupPath, backupFilename);
    }
    
  } catch (error) {
    log(`❌ Erro ao criar backup: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function createSQLBackup(backupPath, backupFilename) {
  try {
    // Importa o cliente SQL
    const { default: postgres } = await import('postgres');
    
    const databaseUrl = process.env.DATABASE_URL;
    const sql = postgres(databaseUrl);
    
    log('🔄 Criando backup via SQL queries...');
    
    // Lista todas as tabelas
    const tables = await sql`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    
    let backupContent = `-- Backup do BudgetSales Database
-- Criado em: ${new Date().toISOString()}
-- Tabelas: ${tables.length}

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

`;

    let totalRecords = 0;
    
    for (const table of tables) {
      const tableName = table.tablename;
      
      try {
        // Obtém estrutura da tabela
        const columns = await sql`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = ${tableName}
          ORDER BY ordinal_position
        `;
        
        // Obtém dados da tabela
        const data = await sql`SELECT * FROM ${sql(tableName)}`;
        
        if (data.length > 0) {
          backupContent += `\n-- Dados da tabela: ${tableName} (${data.length} registros)\n`;
          
          // Gera INSERTs
          const columnNames = columns.map(col => col.column_name);
          const columnsList = columnNames.join(', ');
          
          for (const row of data) {
            const values = columnNames.map(col => {
              const value = row[col];
              if (value === null) return 'NULL';
              if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
              if (value instanceof Date) return `'${value.toISOString()}'`;
              if (typeof value === 'boolean') return value ? 'true' : 'false';
              return value;
            }).join(', ');
            
            backupContent += `INSERT INTO ${tableName} (${columnsList}) VALUES (${values});\n`;
          }
          
          totalRecords += data.length;
        }
      } catch (tableError) {
        log(`⚠️  Erro ao fazer backup da tabela ${tableName}: ${tableError.message}`);
      }
    }
    
    await sql.end();
    
    // Salva o backup
    writeFileSync(backupPath, backupContent);
    
    // Cria metadados
    const metadata = {
      filename: backupFilename,
      created_at: new Date().toISOString(),
      size_bytes: Buffer.byteLength(backupContent, 'utf8'),
      method: 'SQL_QUERIES',
      tables_count: tables.length,
      records_count: totalRecords
    };
    
    writeFileSync(
      join(BACKUP_DIR, backupFilename.replace('.sql', '.json')),
      JSON.stringify(metadata, null, 2)
    );
    
    log(`✅ Backup SQL criado com sucesso: ${backupFilename}`);
    log(`📊 ${tables.length} tabelas, ${totalRecords} registros`);
    
    return { success: true, filename: backupFilename, path: backupPath, metadata };
    
  } catch (error) {
    log(`❌ Erro no backup SQL: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function cleanOldBackups() {
  try {
    const fs = await import('fs');
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.endsWith('.sql'))
      .map(file => ({
        name: file,
        path: join(BACKUP_DIR, file),
        stats: fs.statSync(join(BACKUP_DIR, file))
      }))
      .sort((a, b) => b.stats.mtime - a.stats.mtime);
    
    if (files.length > MAX_BACKUPS) {
      const filesToDelete = files.slice(MAX_BACKUPS);
      
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path);
        
        // Remove arquivo de metadados também
        const metadataPath = file.path.replace('.sql', '.json');
        if (fs.existsSync(metadataPath)) {
          fs.unlinkSync(metadataPath);
        }
        
        log(`🗑️  Backup antigo removido: ${file.name}`);
      }
      
      log(`🧹 ${filesToDelete.length} backups antigos removidos`);
    }
    
  } catch (error) {
    log(`⚠️  Erro ao limpar backups antigos: ${error.message}`);
  }
}

async function main() {
  log('🚀 Iniciando processo de backup automático...');
  
  ensureBackupDirectory();
  
  const result = await createDatabaseBackup();
  
  if (result.success) {
    log(`📈 Backup concluído com sucesso!`);
    log(`📁 Arquivo: ${result.filename}`);
    
    if (result.metadata) {
      log(`📊 Estatísticas:`);
      log(`   - Tamanho: ${(result.metadata.size_bytes / 1024 / 1024).toFixed(2)} MB`);
      log(`   - Tabelas: ${result.metadata.tables_count || 'N/A'}`);
      log(`   - Registros: ${result.metadata.records_count || result.metadata.records_estimated || 'N/A'}`);
    }
    
    // Limpa backups antigos
    await cleanOldBackups();
    
    log('✅ Processo de backup finalizado com sucesso!');
  } else {
    log(`❌ Falha no backup: ${result.error}`);
    process.exit(1);
  }
}

// Executa o backup se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    log(`💥 Erro fatal: ${error.message}`);
    process.exit(1);
  });
}

export { createDatabaseBackup, ensureBackupDirectory };
