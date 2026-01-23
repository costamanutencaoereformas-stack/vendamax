import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Função para verificar se a tela é de um dispositivo móvel
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 1024); // Usando 1024px como breakpoint para lg
    };

    // Verificar inicialmente
    checkIsMobile();

    // Adicionar listener para redimensionamento da janela
    window.addEventListener('resize', checkIsMobile);

    // Limpar listener quando o componente for desmontado
    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  return isMobile;
}