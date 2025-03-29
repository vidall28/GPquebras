import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, CloudOff, CloudSync, Cloud, AlertTriangle } from 'lucide-react';
import { useOnlineStatus } from '@/lib/offlineManager';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

interface SyncStatus {
  isSyncing: boolean;
  pendingOps: number;
  completedOps: number;
  totalOps: number;
  progress: number;
  lastSyncTime: Date | null;
}

export function ConnectionStatus({
  size = 'md',
  showLabel = false,
  className
}: ConnectionStatusProps) {
  const isOnline = useOnlineStatus();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    pendingOps: 0,
    completedOps: 0,
    totalOps: 0,
    progress: 0,
    lastSyncTime: null
  });
  
  // Tamanhos de ícones com base no prop size
  const iconSizes = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };
  
  // Escuta eventos de sincronização
  useEffect(() => {
    const handleSyncStart = (event: CustomEvent) => {
      const { totalOperations } = event.detail;
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: true,
        pendingOps: totalOperations,
        totalOps: totalOperations,
        completedOps: 0,
        progress: 0
      }));
    };

    const handleSyncProgress = (event: CustomEvent) => {
      const { completedOperations, totalOperations } = event.detail;
      const progress = totalOperations ? (completedOperations / totalOperations) * 100 : 0;
      
      setSyncStatus(prev => ({
        ...prev,
        pendingOps: totalOperations - completedOperations,
        completedOps: completedOperations,
        totalOps: totalOperations,
        progress
      }));
    };

    const handleSyncComplete = () => {
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        pendingOps: 0,
        completedOps: prev.totalOps,
        progress: 100,
        lastSyncTime: new Date()
      }));
      
      setTimeout(() => {
        setSyncStatus(prev => ({
          ...prev,
          progress: 0,
          completedOps: 0,
          totalOps: 0
        }));
      }, 3000);
    };

    const handleSyncError = (event: CustomEvent) => {
      const { error } = event.detail;
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false
      }));
      
      toast({
        variant: "destructive",
        title: "Erro de sincronização",
        description: `Não foi possível sincronizar os dados: ${error?.message || 'Erro desconhecido'}`,
      });
    };

    // Registra listeners para eventos de sincronização
    window.addEventListener('sync:start', handleSyncStart as EventListener);
    window.addEventListener('sync:progress', handleSyncProgress as EventListener);
    window.addEventListener('sync:complete', handleSyncComplete);
    window.addEventListener('sync:error', handleSyncError as EventListener);

    // Limpa listeners ao desmontar
    return () => {
      window.removeEventListener('sync:start', handleSyncStart as EventListener);
      window.removeEventListener('sync:progress', handleSyncProgress as EventListener);
      window.removeEventListener('sync:complete', handleSyncComplete);
      window.removeEventListener('sync:error', handleSyncError as EventListener);
    };
  }, []);

  // Função para forçar a sincronização
  const handleForceSync = () => {
    // Dispara evento para forçar sincronização
    window.dispatchEvent(new CustomEvent('sync:force'));
    toast({
      description: "Iniciando sincronização manual...",
    });
  };

  // Mostra o status atual
  const getConnectionStatus = () => {
    if (!isOnline) {
      return { 
        icon: <WifiOff className={cn(iconSizes[size], "text-red-500")} />,
        label: "Offline",
        description: "Sem conexão com a internet. As mudanças serão sincronizadas quando você estiver online."
      };
    }
    
    if (syncStatus.isSyncing) {
      return {
        icon: <CloudSync className={cn(iconSizes[size], "text-blue-500 animate-spin")} />,
        label: "Sincronizando",
        description: `Sincronizando dados (${syncStatus.completedOps}/${syncStatus.totalOps})`
      };
    }
    
    if (syncStatus.pendingOps > 0) {
      return {
        icon: <CloudOff className={cn(iconSizes[size], "text-amber-500")} />,
        label: `Pendente (${syncStatus.pendingOps})`,
        description: `${syncStatus.pendingOps} ${syncStatus.pendingOps === 1 ? 'operação pendente' : 'operações pendentes'} de sincronização`
      };
    }
    
    return {
      icon: <Cloud className={cn(iconSizes[size], "text-green-500")} />,
      label: "Online",
      description: "Conectado ao servidor e sincronizado"
    };
  };

  const status = getConnectionStatus();

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div className={cn(
            "inline-flex items-center gap-1.5 rounded-full",
            isOnline ? "text-green-700" : "text-red-700",
            syncStatus.isSyncing && "text-blue-700",
            syncStatus.pendingOps > 0 && !syncStatus.isSyncing && "text-amber-700",
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
            className
          )}>
            {status.icon}
            
            {showLabel && (
              <span className={cn(
                "font-medium",
                size === 'sm' ? 'text-xs' : 'text-sm'
              )}>
                {status.label}
              </span>
            )}
            
            {syncStatus.isSyncing && (
              <Progress value={syncStatus.progress} className="w-12 h-1.5" />
            )}
          </div>
        </TooltipTrigger>
        
        <TooltipContent>
          <div className="space-y-2 max-w-xs p-1">
            <p>{status.description}</p>
            {(isOnline && syncStatus.pendingOps > 0 && !syncStatus.isSyncing) && (
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs h-7"
                onClick={handleForceSync}
              >
                <CloudSync className="mr-1 h-3 w-3" />
                Sincronizar agora
              </Button>
            )}
            {syncStatus.lastSyncTime && (
              <p className="text-xs text-muted-foreground">
                Última sincronização: {syncStatus.lastSyncTime.toLocaleTimeString()}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Componente simplificado que pode ser exportado como padrão
export default function SimpleConnectionStatus() {
  const isOnline = useOnlineStatus();
  
  return (
    <div className="flex items-center gap-1.5">
      {isOnline ? (
        <Wifi className="h-4 w-4 text-green-500" />
      ) : (
        <WifiOff className="h-4 w-4 text-red-500" />
      )}
      <span className="text-sm font-medium">
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
} 