import React from 'react';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface RefreshDataButtonProps {
  className?: string;
}

export const RefreshDataButton: React.FC<RefreshDataButtonProps> = ({ className }) => {
  const { fetchExchanges, isLoading } = useData();

  const handleRefresh = async () => {
    // Forçar atualização de dados limpando o cache
    await fetchExchanges(true);
  };

  return (
    <Button 
      onClick={handleRefresh} 
      variant="outline" 
      size="sm" 
      className={className}
      disabled={isLoading}
    >
      <RefreshCw className="mr-2 h-4 w-4" />
      {isLoading ? 'Atualizando...' : 'Atualizar Dados'}
    </Button>
  );
};

export default RefreshDataButton; 