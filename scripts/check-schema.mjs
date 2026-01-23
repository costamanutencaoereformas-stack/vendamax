#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

const repoRoot = process.cwd();
const sharedPath = path.join(repoRoot, 'shared', 'schema.ts');
const sqlPath = path.join(repoRoot, 'database', 'schema.sql');
const migrationsDir = path.join(repoRoot, 'migrations');

function extractTsTables(content) {
  // Match: export const name = pgTable("table_name", { ... });
  const tableRegex = /export\s+const\s+([a-zA-Z0-9_]+)\s*=\s*pgTable\(\s*"([^"]+)"\s*,\s*\{([\s\S]*?)^\s*\}\s*\)\s*;/gms;
  const tables = {};
  let m;
  while ((m = tableRegex.exec(content))) {
    const varName = m[1];
    const tableName = m[2];
    const body = m[3];
    // extract DB column names from patterns like 'propName: varchar("db_col").primaryKey()' or 'prop: text("name")'
    const fieldRegex = /([a-zA-Z0-9_]+)\s*:\s*[a-zA-Z0-9_]+\(\s*\"([^\"]+)\"/g;
    const cols = [];
    let f;
    while ((f = fieldRegex.exec(body))) {
      // f[1] = TS prop name, f[2] = DB column name string
      cols.push(f[2]);
    }
    tables[tableName] = { varName, cols };
  }
  return tables;
}

function extractSqlTables(content) {
  // Match: CREATE TABLE IF NOT EXISTS table_name ( ... );
  const tblRegex = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-zA-Z0-9_\".]+)\s*\(([^;]+?)\)\s*;/gims;
  const tables = {};
  let m;
  while ((m = tblRegex.exec(content))) {
    let table = m[1].trim();
    // remove optional schema qualifiers and quotes
    table = table.replace(/^[\"]+|[\"]+$/g, '');
    if (table.includes('.')) table = table.split('.').pop();
    const body = m[2];
    const lines = body.split(/\n/).map(l => l.trim()).filter(Boolean);
    const cols = [];
    for (const line of lines) {
      // stop if line starts with PRIMARY KEY or CONSTRAINT or FOREIGN KEY
      if (/^(PRIMARY|CONSTRAINT|UNIQUE|KEY|FOREIGN)\b/i.test(line)) continue;
      // column pattern: name type ... ,
      const colMatch = /^([`\"]?)([a-zA-Z0-9_]+)\1\s+[A-Z]/i.exec(line);
      if (colMatch) cols.push(colMatch[2]);
    }
    tables[table] = { cols };
  }
  return tables;
}

async function main() {
  try {
    const tsRaw = await fs.readFile(sharedPath, 'utf8');
    let sqlRaw = '';
    try {
      sqlRaw = await fs.readFile(sqlPath, 'utf8');
    } catch (e) {
      // file might be missing; fall back to concatenating migrations
      sqlRaw = '';
    }

    // If database/schema.sql doesn't contain all CREATE TABLEs, concat migrations/*.sql
    if (!sqlRaw || !/CREATE\s+TABLE/i.test(sqlRaw)) {
      try {
        const files = await fs.readdir(migrationsDir);
        const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();
        const parts = [];
        for (const f of sqlFiles) {
          const p = path.join(migrationsDir, f);
          const c = await fs.readFile(p, 'utf8');
          parts.push(c);
        }
        sqlRaw = parts.join('\n');
      } catch (e) {
        // if migrations dir missing, leave sqlRaw as-is
      }
    }

  const tsTables = extractTsTables(tsRaw);
  const sqlTables = extractSqlTables(sqlRaw);

    const report = [];

    const allTableNames = new Set([...Object.keys(tsTables), ...Object.keys(sqlTables)]);
    for (const t of Array.from(allTableNames).sort()) {
      const inTs = !!tsTables[t];
      const inSql = !!sqlTables[t];
      const tsCols = inTs ? tsTables[t].cols : [];
      const sqlCols = inSql ? sqlTables[t].cols : [];
      const missingInSql = tsCols.filter(c => !sqlCols.includes(c));
      const extraInSql = sqlCols.filter(c => !tsCols.includes(c));
      report.push({ table: t, inTs, inSql, tsCount: tsCols.length, sqlCount: sqlCols.length, missingInSql, extraInSql });
    }

    // Print human readable summary
    console.log('Schema comparison report');
    console.log('Shared (Drizzle) => database/schema.sql');
    console.log('-----------------------------------------------------');
    for (const r of report) {
      console.log(`Table: ${r.table}`);
      console.log(`  In shared/schema.ts: ${r.inTs}`);
      console.log(`  In database/schema.sql: ${r.inSql}`);
      if (r.inTs && r.inSql) {
        console.log(`  Columns in shared: ${r.tsCount}, in sql: ${r.sqlCount}`);
        if (r.missingInSql.length === 0 && r.extraInSql.length === 0) {
          console.log('  ✅ Columns match');
        } else {
          if (r.missingInSql.length) console.log(`  ⚠ Missing in SQL: ${r.missingInSql.join(', ')}`);
          if (r.extraInSql.length) console.log(`  ⚠ Extra in SQL: ${r.extraInSql.join(', ')}`);
        }
      } else if (r.inTs && !r.inSql) {
        console.log('  ⚠ Table defined in shared/schema.ts but missing in database/schema.sql');
      } else if (!r.inTs && r.inSql) {
        console.log('  ⚠ Table present in database/schema.sql but missing in shared/schema.ts');
      }
      console.log('');
    }

    // Exit non-zero if any discrepancies
    const hasProblems = report.some(r => (r.missingInSql && r.missingInSql.length) || (r.extraInSql && r.extraInSql.length) || (r.inTs !== r.inSql));
    process.exit(hasProblems ? 2 : 0);
  } catch (err) {
    console.error('Error checking schema:', err);
    process.exit(3);
  }
}

main();
