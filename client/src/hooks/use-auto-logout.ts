import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutos em milissegundos
const WARNING_TIMEOUT = 9 * 60 * 1000; // 9 minutos (aviso 1 minuto antes)
const LAST_ACTIVITY_KEY = 'lastActivity';

export function useAutoLogout() {
  const { logout, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    warningShownRef.current = false;
  }, []);

  const handleLogout = useCallback(() => {
    toast({
      title: 'Sessão Expirada',
      description: 'Você foi desconectado por inatividade.',
      variant: 'destructive',
    });
    logout();
  }, [logout, toast]);

  const showWarning = useCallback(() => {
    if (!warningShownRef.current) {
      warningShownRef.current = true;
      toast({
        title: 'Aviso de Inatividade',
        description: 'Você será desconectado em 1 minuto por inatividade.',
        variant: 'default',
      });
    }
  }, [toast]);

  const updateLastActivity = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  }, []);

  const checkSessionExpired = useCallback(() => {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastActivity) return false;
    
    const timeSinceLastActivity = Date.now() - parseInt(lastActivity, 10);
    return timeSinceLastActivity >= INACTIVITY_TIMEOUT;
  }, []);

  const resetTimer = useCallback(() => {
    // Limpar timers existentes
    clearTimers();

    // Só configurar novos timers se estiver autenticado
    if (!isAuthenticated) return;

    // Atualizar timestamp da última atividade
    updateLastActivity();

    // Configurar aviso (1 minuto antes do logout)
    warningTimeoutRef.current = setTimeout(() => {
      showWarning();
    }, WARNING_TIMEOUT);

    // Configurar logout automático
    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_TIMEOUT);
  }, [isAuthenticated, clearTimers, showWarning, handleLogout, updateLastActivity]);

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimers();
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      return;
    }

    // Verificar se a sessão já expirou ao carregar a página
    if (checkSessionExpired()) {
      handleLogout();
      return;
    }

    // Eventos que indicam atividade do usuário
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Iniciar o timer
    resetTimer();

    // Adicionar listeners para todos os eventos
    events.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    // Cleanup
    return () => {
      clearTimers();
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [isAuthenticated, resetTimer, clearTimers, checkSessionExpired, handleLogout]);
}
