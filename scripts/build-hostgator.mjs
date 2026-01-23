#!/usr/bin/env node

import { execSync } from 'child_process';
import { copyFileSync, mkdirSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

console.log('🏗️ Preparando build para HostGator cPanel...\n');

try {
  // 1. Build da aplicação
  console.log('📦 Executando build de produção...');
  execSync('npm run build:prod', { cwd: rootDir, stdio: 'inherit' });
  
  // 2. Criar diretório para HostGator
  const hostgatorDir = resolve(rootDir, 'hostgator-deploy');
  if (!existsSync(hostgatorDir)) {
    mkdirSync(hostgatorDir, { recursive: true });
  }
  
  // 3. Copiar arquivos estáticos
  console.log('📁 Copiando arquivos para deploy...');
  const publicDir = resolve(rootDir, 'dist/public');
  
  if (existsSync(publicDir)) {
    execSync(`xcopy "${publicDir}" "${hostgatorDir}" /E /I /Y`, { stdio: 'inherit' });
  }
  
  // 4. Copiar .htaccess
  const htaccessSource = resolve(rootDir, '.htaccess');
  const htaccessDest = resolve(hostgatorDir, '.htaccess');
  
  if (existsSync(htaccessSource)) {
    copyFileSync(htaccessSource, htaccessDest);
    console.log('✅ .htaccess copiado');
  }
  
  // 5. Criar arquivo de configuração
  const configContent = `
<!-- Configuração para HostGator -->
<script>
  // Configurações da aplicação
  window.ENV = {
    API_URL: 'https://SEU-BACKEND.render.com/api',
    SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
    SUPABASE_ANON_KEY: 'SUA-CHAVE-AQUI',
    NODE_ENV: 'production'
  };
</script>
`;
  
  writeFileSync(resolve(hostgatorDir, 'config.html'), configContent);
  
  // 6. Criar README para upload
  const readmeContent = `
# Upload para HostGator cPanel

## Passos:
1. Acesse cPanel → File Manager
2. Navegue até public_html (ou subpasta do seu domínio)
3. Upload TODOS os arquivos desta pasta
4. Edite o arquivo index.html e adicione as configurações do config.html
5. Configure suas variáveis de ambiente reais
6. Teste o site

## Configurações necessárias:
- Backend externo (Render, Railway, etc.)
- Banco Supabase configurado
- SSL ativado no HostGator

## Estrutura de pastas no cPanel:
public_html/
├── index.html
├── assets/
├── .htaccess
└── uploads/ (criar manualmente)
`;
  
  writeFileSync(resolve(hostgatorDir, 'README-UPLOAD.txt'), readmeContent);
  
  console.log('\n✅ Build para HostGator concluído!');
  console.log(`📂 Arquivos em: ${hostgatorDir}`);
  console.log('\n📋 Próximos passos:');
  console.log('1. Configure backend externo (Render/Railway)');
  console.log('2. Edite config.html com suas URLs reais');
  console.log('3. Faça upload dos arquivos via cPanel');
  console.log('4. Teste a aplicação');
  
} catch (error) {
  console.error('❌ Erro durante o build:', error.message);
  process.exit(1);
}
