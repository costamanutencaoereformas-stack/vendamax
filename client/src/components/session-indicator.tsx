import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutos
const LAST_ACTIVITY_KEY = 'lastActivity';

export function SessionIndicator() {
  const [timeRemaining, setTimeRemaining] = useState<number>(INACTIVITY_TIMEOUT);
  const [isWarning, setIsWarning] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (!lastActivity) {
        setTimeRemaining(INACTIVITY_TIMEOUT);
        return;
      }

      const elapsed = Date.now() - parseInt(lastActivity, 10);
      const remaining = Math.max(0, INACTIVITY_TIMEOUT - elapsed);
      setTimeRemaining(remaining);
      setIsWarning(remaining < 60000); // Aviso quando falta menos de 1 minuto
    };

    // Atualizar a cada segundo
    const interval = setInterval(updateTimer, 1000);
    updateTimer();

    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  if (timeRemaining <= 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
        isWarning
          ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
      )}
      title="Tempo restante até logout automático por inatividade"
    >
      <Clock className="h-3 w-3" />
      <span>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  );
}
