import { useState, useEffect, useCallback } from 'react';
import { useOnlineStatus } from '@/lib/offlineManager';

interface OfflineOperation {
  id: string;
  type: 'insert' | 'update' | 'delete';
  table: string;
  recordId: string | number;
  data: any;
  createdAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: 'high' | 'medium' | 'low';
  error?: string;
  attempts: number;
  lastAttempt?: string;
}

interface OperationsStats {
  totalOperations: number;
  pendingOperations: number;
  completedOperations: number;
  failedOperations: number;
  processingOperations: number;
  
  // Estatísticas por tipo
  operationsByType: {
    insert: number;
    update: number;
    delete: number;
  };
  
  // Estatísticas por tabela
  operationsByTable: Record<string, number>;
  
  // Estatísticas por status
  operationsByStatus: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  
  // Operações de alta prioridade
  highPriorityOperations: number;
  
  // Timestamp da mais antiga operação pendente
  oldestPendingOperation: string | null;
  
  // Timestamp da operação mais recente
  newestOperation: string | null;
  
  // Última sincronização
  lastSyncTime: Date | null;
  
  // Falhas na última tentativa
  failuresInLastAttempt: number;
}

export function useOfflineOperations() {
  const isOnline = useOnlineStatus();
  const [operations, setOperations] = useState<OfflineOperation[]>([]);
  const [stats, setStats] = useState<OperationsStats>({
    totalOperations: 0,
    pendingOperations: 0,
    completedOperations: 0,
    failedOperations: 0,
    processingOperations: 0,
    operationsByType: {
      insert: 0,
      update: 0,
      delete: 0,
    },
    operationsByTable: {},
    operationsByStatus: {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    },
    highPriorityOperations: 0,
    oldestPendingOperation: null,
    newestOperation: null,
    lastSyncTime: null,
    failuresInLastAttempt: 0,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  
  // Função para carregar operações do armazenamento local
  const refreshOperations = useCallback(() => {
    try {
      // Em um app real, isso viria do IndexedDB ou outro mecanismo de persistência
      // Aqui vamos simular com dados estáticos para demonstração
      const mockOperations: OfflineOperation[] = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          type: 'insert',
          table: 'products',
          recordId: 'new-1',
          data: { name: 'Novo Produto', price: 29.99 },
          createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hora atrás
          status: 'pending',
          priority: 'high',
          attempts: 0
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          type: 'update',
          table: 'users',
          recordId: 123,
          data: { name: 'Nome Atualizado' },
          createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 horas atrás
          status: 'completed',
          priority: 'medium',
          attempts: 1,
          lastAttempt: new Date(Date.now() - 3000000).toISOString() // 50 minutos atrás
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          type: 'delete',
          table: 'orders',
          recordId: 456,
          data: null,
          createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 dia atrás
          status: 'failed',
          priority: 'low',
          error: 'Registro não encontrado no servidor',
          attempts: 3,
          lastAttempt: new Date(Date.now() - 1800000).toISOString() // 30 minutos atrás
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          type: 'insert',
          table: 'products',
          recordId: 'new-2',
          data: { name: 'Outro Produto', price: 99.99 },
          createdAt: new Date(Date.now() - 1800000).toISOString(), // 30 minutos atrás
          status: 'processing',
          priority: 'high',
          attempts: 1,
          lastAttempt: new Date().toISOString()
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440004',
          type: 'update',
          table: 'exchanges',
          recordId: 789,
          data: { status: 'approved' },
          createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hora atrás
          status: 'pending',
          priority: 'high',
          attempts: 0
        }
      ];
      
      setOperations(mockOperations);
      updateStats(mockOperations);
    } catch (error) {
      console.error('Erro ao carregar operações offline:', error);
    }
  }, []);
  
  // Calcula estatísticas com base nas operações
  const updateStats = useCallback((ops: OfflineOperation[]) => {
    const tableStats: Record<string, number> = {};
    let highPriorityCount = 0;
    let oldestPendingDate: string | null = null;
    let newestDate: string | null = null;
    
    // Contadores por status
    let pendingCount = 0;
    let processingCount = 0;
    let completedCount = 0;
    let failedCount = 0;
    
    // Contadores por tipo
    let insertCount = 0;
    let updateCount = 0;
    let deleteCount = 0;
    
    ops.forEach(op => {
      // Estatísticas por tabela
      tableStats[op.table] = (tableStats[op.table] || 0) + 1;
      
      // Contador de prioridade alta
      if (op.priority === 'high') {
        highPriorityCount++;
      }
      
      // Operação mais antiga pendente
      if (op.status === 'pending') {
        pendingCount++;
        if (!oldestPendingDate || op.createdAt < oldestPendingDate) {
          oldestPendingDate = op.createdAt;
        }
      } else if (op.status === 'processing') {
        processingCount++;
      } else if (op.status === 'completed') {
        completedCount++;
      } else if (op.status === 'failed') {
        failedCount++;
      }
      
      // Contagem por tipo
      if (op.type === 'insert') {
        insertCount++;
      } else if (op.type === 'update') {
        updateCount++;
      } else if (op.type === 'delete') {
        deleteCount++;
      }
      
      // Operação mais recente
      if (!newestDate || op.createdAt > newestDate) {
        newestDate = op.createdAt;
      }
    });
    
    // Obtém a data da última sincronização (mockada para demonstração)
    const lastSyncTime = ops.length > 0 ? new Date(Date.now() - 1200000) : null; // 20 minutos atrás
    
    setStats({
      totalOperations: ops.length,
      pendingOperations: pendingCount,
      completedOperations: completedCount,
      failedOperations: failedCount,
      processingOperations: processingCount,
      operationsByType: {
        insert: insertCount,
        update: updateCount,
        delete: deleteCount,
      },
      operationsByTable: tableStats,
      operationsByStatus: {
        pending: pendingCount,
        processing: processingCount,
        completed: completedCount,
        failed: failedCount,
      },
      highPriorityOperations: highPriorityCount,
      oldestPendingOperation: oldestPendingDate,
      newestOperation: newestDate,
      lastSyncTime,
      failuresInLastAttempt: 1, // Mockado para demonstração
    });
  }, []);
  
  // Carrega operações na inicialização
  useEffect(() => {
    refreshOperations();
    
    // Atualiza periodicamente a cada 5 segundos
    const intervalId = setInterval(refreshOperations, 5000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [refreshOperations]);
  
  // Força a sincronização de todas as operações pendentes
  const synchronize = useCallback(async () => {
    if (!isOnline) {
      throw new Error('Não é possível sincronizar quando está offline');
    }
    
    setIsLoading(true);
    
    try {
      // Em um app real, você enviaria as operações pendentes para o servidor
      // e atualizaria o status conforme as respostas
      
      // Simula um atraso de processamento
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Dispara evento de sincronização para notificar a UI
      window.dispatchEvent(new CustomEvent('sync:start', {
        detail: { totalOperations: stats.pendingOperations }
      }));
      
      // Simula progresso
      let completed = 0;
      const pendingOps = operations.filter(op => op.status === 'pending');
      
      for (const op of pendingOps) {
        // Atualiza status para 'processing'
        setOperations(curr => 
          curr.map(item => 
            item.id === op.id 
              ? { ...item, status: 'processing' as const, lastAttempt: new Date().toISOString() } 
              : item
          )
        );
        
        // Simula processamento
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Atualiza status para 'completed' (simulando sucesso para a maioria)
        const newStatus = Math.random() > 0.2 ? 'completed' as const : 'failed' as const;
        const error = newStatus === 'failed' ? 'Erro simulado de sincronização' : undefined;
        
        setOperations(curr => 
          curr.map(item => 
            item.id === op.id 
              ? { 
                  ...item, 
                  status: newStatus, 
                  error, 
                  attempts: item.attempts + 1 
                } 
              : item
          )
        );
        
        completed++;
        
        // Dispara evento de progresso
        window.dispatchEvent(new CustomEvent('sync:progress', {
          detail: { 
            completedOperations: completed,
            totalOperations: pendingOps.length
          }
        }));
      }
      
      // Dispara evento de conclusão
      window.dispatchEvent(new CustomEvent('sync:complete'));
      
      // Atualiza estatísticas
      refreshOperations();
      
    } catch (error) {
      console.error('Erro durante a sincronização:', error);
      
      // Dispara evento de erro
      window.dispatchEvent(new CustomEvent('sync:error', {
        detail: { error }
      }));
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, operations, stats.pendingOperations, refreshOperations]);
  
  // Limpar operações pendentes (principalmente para testes)
  const clearPendingOperations = useCallback(() => {
    if (window.confirm('Tem certeza que deseja limpar todas as operações pendentes? Esta ação não pode ser desfeita.')) {
      // Remove operações pendentes
      setOperations(curr => curr.filter(op => op.status !== 'pending'));
      
      // Atualiza estatísticas
      setTimeout(refreshOperations, 0);
    }
  }, [refreshOperations]);
  
  return {
    operations,
    stats,
    isLoading,
    refreshOperations,
    synchronize,
    clearPendingOperations
  };
} 