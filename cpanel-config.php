<?php
/**
 * Configuração PHP para HostGator cPanel
 * Este arquivo pode ser usado para configurações específicas do servidor
 */

// Configurações de erro para produção
error_reporting(0);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Configurações de sessão
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);
ini_set('session.use_strict_mode', 1);

// Headers de segurança
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');
header('Referrer-Policy: strict-origin-when-cross-origin');

// Configurações de upload (se necessário)
ini_set('upload_max_filesize', '10M');
ini_set('post_max_size', '10M');
ini_set('max_execution_time', 300);

// Timezone
date_default_timezone_set('America/Sao_Paulo');

// Função para redirecionar para HTTPS
function forceHTTPS() {
    if (!isset($_SERVER['HTTPS']) || $_SERVER['HTTPS'] !== 'on') {
        $redirectURL = 'https://' . $_SERVER['HTTP_HOST'] . $_SERVER['REQUEST_URI'];
        header("Location: $redirectURL");
        exit();
    }
}

// Descomente a linha abaixo para forçar HTTPS
// forceHTTPS();
?>
