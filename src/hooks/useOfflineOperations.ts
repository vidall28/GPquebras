import { useState, useEffect } from 'react';
import { OfflineManager, OfflineOperation } from '@/lib/offlineManager';

export interface OfflineStats {
  totalOperations: number;
  pendingOperations: number;
  failedOperations: number;
  completedOperations: number;
  processingOperations: number;
  byType: Record<string, number>;
  byTable: Record<string, number>;
  byStatus: Record<string, number>;
  oldestOperation: Date | null;
  newestOperation: Date | null;
  hasHighPriorityOperations: boolean;
}

export function useOfflineOperations() {
  const [operations, setOperations] = useState<OfflineOperation[]>([]);
  const [stats, setStats] = useState<OfflineStats>({
    totalOperations: 0,
    pendingOperations: 0,
    failedOperations: 0,
    completedOperations: 0,
    processingOperations: 0,
    byType: {},
    byTable: {},
    byStatus: {},
    oldestOperation: null,
    newestOperation: null,
    hasHighPriorityOperations: false
  });
  const [isLoading, setIsLoading] = useState(true);

  // Função para atualizar as operações
  const refreshOperations = () => {
    const ops = OfflineManager.getPendingOperations();
    setOperations(ops);
    updateStats(ops);
    setIsLoading(false);
  };

  // Atualiza as estatísticas com base nas operações
  const updateStats = (ops: OfflineOperation[]) => {
    if (ops.length === 0) {
      setStats({
        totalOperations: 0,
        pendingOperations: 0,
        failedOperations: 0,
        completedOperations: 0,
        processingOperations: 0,
        byType: {},
        byTable: {},
        byStatus: {},
        oldestOperation: null,
        newestOperation: null,
        hasHighPriorityOperations: false
      });
      return;
    }

    const byType: Record<string, number> = {};
    const byTable: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    
    let oldestDate: Date | null = null;
    let newestDate: Date | null = null;
    let hasHighPriority = false;

    ops.forEach(op => {
      // Contagem por tipo
      byType[op.type] = (byType[op.type] || 0) + 1;
      
      // Contagem por tabela
      byTable[op.table] = (byTable[op.table] || 0) + 1;
      
      // Contagem por status
      byStatus[op.status] = (byStatus[op.status] || 0) + 1;
      
      // Verificar prioridade alta (1 ou 2)
      if (op.priority <= 2) {
        hasHighPriority = true;
      }
      
      // Verificar data mais antiga
      const date = new Date(op.createdAt);
      if (!oldestDate || date < oldestDate) {
        oldestDate = date;
      }
      
      // Verificar data mais recente
      if (!newestDate || date > newestDate) {
        newestDate = date;
      }
    });

    setStats({
      totalOperations: ops.length,
      pendingOperations: ops.filter(op => op.status === 'pending').length,
      failedOperations: ops.filter(op => op.status === 'failed').length,
      completedOperations: ops.filter(op => op.status === 'complete').length,
      processingOperations: ops.filter(op => op.status === 'processing').length,
      byType,
      byTable,
      byStatus,
      oldestOperation: oldestDate,
      newestOperation: newestDate,
      hasHighPriorityOperations: hasHighPriority
    });
  };

  // Configurar atualização periódica das operações
  useEffect(() => {
    // Verificar se o OfflineManager está inicializado
    if (!OfflineManager.getInitializationStatus()) {
      console.warn('OfflineManager não está inicializado. useOfflineOperations pode não funcionar corretamente.');
    }
    
    // Primeira carga
    refreshOperations();
    
    // Configurar intervalo de atualização
    const interval = setInterval(refreshOperations, 5000);
    
    // Limpar intervalo ao desmontar
    return () => clearInterval(interval);
  }, []);

  // Função para forçar a sincronização
  const synchronize = async () => {
    try {
      const result = await OfflineManager.synchronize();
      refreshOperations();
      return result;
    } catch (error) {
      console.error('Erro ao sincronizar operações offline:', error);
      throw error;
    }
  };

  // Função para limpar todas as operações pendentes
  const clearOperations = () => {
    OfflineManager.clearQueue();
    refreshOperations();
  };

  // Retorna os dados e funções úteis
  return {
    operations,
    stats,
    isLoading,
    refreshOperations,
    synchronize,
    clearOperations,
    isOfflineAvailable: OfflineManager.getInitializationStatus()
  };
} 