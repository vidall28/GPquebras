import React from 'react';
import { useOnlineStatus } from '@/lib/offlineManager';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
  const isOnline = useOnlineStatus();
  
  if (isOnline) {
    return null; // Não mostra nada se estiver online
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Alert className="bg-yellow-50 border-yellow-500">
        <AlertCircle className="h-4 w-4 text-yellow-500" />
        <AlertTitle className="text-yellow-800">
          Modo offline - dados serão sincronizados quando a conexão retornar
        </AlertTitle>
      </Alert>
    </div>
  );
}; 