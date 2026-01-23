-- Script de inicialização do banco de dados

-- Remover banco de dados se existir
DROP DATABASE IF EXISTS budget_sales;

-- Criar banco de dados
CREATE DATABASE budget_sales;

-- Usar o banco de dados
USE budget_sales;

-- Importar schema
SOURCE schema.sql;

-- Importar dados de exemplo
SOURCE seed.sql;

-- Verificar tabelas criadas
SHOW TABLES;

-- Exibir contagem de registros em cada tabela
SELECT 'users' as table_name, COUNT(*) as record_count FROM users
UNION
SELECT 'customers', COUNT(*) FROM customers
UNION
SELECT 'suppliers', COUNT(*) FROM suppliers
UNION
SELECT 'categories', COUNT(*) FROM categories;