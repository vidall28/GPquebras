/**
 * Sistema de Gerenciamento Offline
 * Permite que o aplicativo continue funcionando mesmo quando o usuário está sem conexão à internet.
 * As operações são enfileiradas e sincronizadas posteriormente quando a conexão é restabelecida.
 */

import { supabase } from './supabase';
import { toast } from '../components/ui/use-toast';
import { advancedCache } from './cache';

// Tipos de operações que podem ser enfileiradas
export enum OfflineOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  EXCHANGE = 'exchange',
  MARK_AS_READ = 'mark_as_read',
}

// Interface para operações offline
export interface OfflineOperation {
  id: string;
  type: OfflineOperationType;
  data: any;
  table: string;
  createdAt: number;
  priority: number; // 1 (alta) a 5 (baixa)
  retries: number;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  error?: string;
}

// Opções para enfileiramento de operações
export interface EnqueueOptions {
  priority?: number;
  optimisticUpdate?: boolean; // Atualiza UI imediatamente antes da sincronização
}

// Chave para armazenamento no localStorage
const OFFLINE_QUEUE_KEY = 'gp_offline_queue';
const SYNC_INTERVAL = 60000; // 1 minuto
const MAX_RETRIES = 3;

// Classe principal do gerenciador offline
class OfflineManagerClass {
  private queue: OfflineOperation[] = [];
  private isInitialized: boolean = false;
  private isSyncing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private userId: string | null = null;
  private onlineStatus: boolean = navigator.onLine;

  /**
   * Inicializa o gerenciador offline
   * @param userId ID do usuário atual
   */
  public init(userId: string): void {
    if (this.isInitialized) return;
    
    this.userId = userId;
    this.loadFromStorage();
    this.setupEventListeners();
    this.startPeriodicSync();
    this.isInitialized = true;
    
    console.log('🔄 Gerenciador offline inicializado para usuário:', userId);
    console.log(`📋 ${this.queue.length} operações pendentes carregadas`);
  }

  /**
   * Configura event listeners para detectar mudanças no status da conexão
   */
  private setupEventListeners(): void {
    window.addEventListener('online', this.handleOnlineStatusChange.bind(this));
    window.addEventListener('offline', this.handleOnlineStatusChange.bind(this));
    
    // Também verifica status de conexão periodicamente
    setInterval(() => {
      this.checkOnlineStatus();
    }, 30000);
  }

  /**
   * Manipula mudanças no status de conexão
   */
  private async handleOnlineStatusChange(): Promise<void> {
    const wasOffline = !this.onlineStatus;
    this.onlineStatus = navigator.onLine;
    
    if (wasOffline && this.onlineStatus) {
      toast({
        title: "Conexão restabelecida",
        description: "Sincronizando dados...",
        duration: 3000,
      });
      
      await this.synchronize();
    } else if (!this.onlineStatus) {
      toast({
        title: "Modo offline ativado",
        description: "Suas alterações serão salvas e sincronizadas quando a conexão for restabelecida.",
        duration: 5000,
      });
    }
  }

  /**
   * Verifica o status da conexão fazendo uma pequena requisição
   */
  private async checkOnlineStatus(): Promise<boolean> {
    try {
      // Tenta fazer uma pequena requisição para verificar a conexão real
      const { data, error } = await supabase.rpc('ping', {}, { 
        count: 'exact' 
      }).timeout(3000);
      
      const isOnline = !error;
      
      // Se o status mudou, aciona o handler de mudança de status
      if (isOnline !== this.onlineStatus) {
        this.onlineStatus = isOnline;
        this.handleOnlineStatusChange();
      }
      
      return isOnline;
    } catch (error) {
      if (this.onlineStatus) {
        this.onlineStatus = false;
        this.handleOnlineStatusChange();
      }
      return false;
    }
  }

  /**
   * Inicia a sincronização periódica de operações pendentes
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(async () => {
      if (this.onlineStatus && this.queue.length > 0 && !this.isSyncing) {
        await this.synchronize();
      }
    }, SYNC_INTERVAL);
  }

  /**
   * Carrega a fila de operações do localStorage
   */
  private loadFromStorage(): void {
    try {
      const storedQueue = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (storedQueue) {
        this.queue = JSON.parse(storedQueue);
      }
    } catch (error) {
      console.error('Erro ao carregar fila offline:', error);
      // Se houver algum erro, inicia uma fila vazia
      this.queue = [];
    }
  }

  /**
   * Salva a fila de operações no localStorage
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Erro ao salvar fila offline:', error);
      toast({
        title: "Erro ao salvar operações offline",
        description: "Pode não ser possível recuperar operações pendentes se a página for fechada.",
        variant: "destructive",
      });
    }
  }

  /**
   * Enfileira uma operação para ser executada posteriormente
   * @param type Tipo da operação
   * @param data Dados da operação
   * @param table Tabela a ser afetada
   * @param options Opções de enfileiramento
   * @returns ID da operação enfileirada
   */
  public enqueue(
    type: OfflineOperationType, 
    data: any, 
    table: string, 
    options: EnqueueOptions = {}
  ): string {
    if (!this.isInitialized) {
      console.warn('Gerenciador offline não inicializado. Inicializando com usuário anônimo.');
      this.init('anonymous');
    }
    
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    const operation: OfflineOperation = {
      id,
      type,
      data,
      table,
      createdAt: Date.now(),
      priority: options.priority || 3, // Prioridade média por padrão
      retries: 0,
      status: 'pending'
    };
    
    // Adiciona à fila, ordenando por prioridade (mais alta primeiro)
    this.queue.push(operation);
    this.queue.sort((a, b) => a.priority - b.priority);
    
    // Salva no localStorage
    this.saveToStorage();
    
    console.log(`⏱️ Operação ${type} enfileirada para sincronização posterior:`, operation);
    
    // Se estiver online e for solicitada atualização otimista, sincroniza imediatamente
    if (this.onlineStatus && options.optimisticUpdate) {
      this.synchronize();
    }
    
    return id;
  }

  /**
   * Sincroniza todas as operações pendentes com o servidor
   */
  public async synchronize(): Promise<{ success: number; failed: number }> {
    if (!this.onlineStatus) {
      console.log('📶 Não é possível sincronizar no modo offline');
      return { success: 0, failed: 0 };
    }
    
    if (this.isSyncing) {
      console.log('🔄 Sincronização já em andamento');
      return { success: 0, failed: 0 };
    }
    
    this.isSyncing = true;
    let successCount = 0;
    let failedCount = 0;
    
    try {
      console.log(`🔄 Iniciando sincronização de ${this.queue.length} operações pendentes`);
      
      // Processa operações pendentes na ordem de prioridade
      for (const operation of [...this.queue]) {
        if (operation.status === 'pending' || (operation.status === 'failed' && operation.retries < MAX_RETRIES)) {
          operation.status = 'processing';
          this.saveToStorage();
          
          try {
            // Executa a operação no servidor
            await this.executeOperation(operation);
            
            // Marca como concluída e remove da fila
            this.queue = this.queue.filter(op => op.id !== operation.id);
            successCount++;
            
            console.log(`✅ Operação ${operation.type} sincronizada com sucesso:`, operation.id);
          } catch (error) {
            operation.status = 'failed';
            operation.retries += 1;
            operation.error = error instanceof Error ? error.message : String(error);
            failedCount++;
            
            console.error(`❌ Falha ao sincronizar operação ${operation.type}:`, error);
            
            // Se atingiu o número máximo de tentativas, move para o final da fila
            if (operation.retries >= MAX_RETRIES) {
              operation.priority = 5; // Baixa prioridade
            }
          }
        }
      }
      
      // Salva o estado atual no localStorage
      this.saveToStorage();
      
      // Notifica o usuário sobre o resultado da sincronização
      if (successCount > 0 || failedCount > 0) {
        let message = `${successCount} operação(ões) sincronizada(s)`;
        if (failedCount > 0) {
          message += `, ${failedCount} falha(s)`;
        }
        
        toast({
          title: "Sincronização concluída",
          description: message,
          duration: 3000,
        });
      }
      
      return { success: successCount, failed: failedCount };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Executa uma operação no servidor
   * @param operation Operação a ser executada
   */
  private async executeOperation(operation: OfflineOperation): Promise<void> {
    switch (operation.type) {
      case OfflineOperationType.CREATE:
        await this.executeCreate(operation);
        break;
      case OfflineOperationType.UPDATE:
        await this.executeUpdate(operation);
        break;
      case OfflineOperationType.DELETE:
        await this.executeDelete(operation);
        break;
      case OfflineOperationType.EXCHANGE:
        await this.executeExchange(operation);
        break;
      case OfflineOperationType.MARK_AS_READ:
        await this.executeMarkAsRead(operation);
        break;
      default:
        throw new Error(`Tipo de operação desconhecido: ${operation.type}`);
    }
    
    // Invalida o cache relacionado à operação
    advancedCache.invalidate(`${operation.table}_list`);
    advancedCache.invalidate(`${operation.table}_${operation.data.id}`);
  }

  /**
   * Executa uma operação de criação
   * @param operation Operação a ser executada
   */
  private async executeCreate(operation: OfflineOperation): Promise<void> {
    const { error } = await supabase
      .from(operation.table)
      .insert(operation.data);
      
    if (error) throw error;
  }

  /**
   * Executa uma operação de atualização
   * @param operation Operação a ser executada
   */
  private async executeUpdate(operation: OfflineOperation): Promise<void> {
    const { id, ...updateData } = operation.data;
    
    const { error } = await supabase
      .from(operation.table)
      .update(updateData)
      .eq('id', id);
      
    if (error) throw error;
  }

  /**
   * Executa uma operação de exclusão
   * @param operation Operação a ser executada
   */
  private async executeDelete(operation: OfflineOperation): Promise<void> {
    const { error } = await supabase
      .from(operation.table)
      .delete()
      .eq('id', operation.data.id);
      
    if (error) throw error;
  }

  /**
   * Executa uma operação de troca
   * @param operation Operação a ser executada
   */
  private async executeExchange(operation: OfflineOperation): Promise<void> {
    // Chama a função RPC de troca
    const { error } = await supabase
      .rpc('create_exchange', operation.data);
      
    if (error) throw error;
  }

  /**
   * Executa uma operação de marcar como lido
   * @param operation Operação a ser executada
   */
  private async executeMarkAsRead(operation: OfflineOperation): Promise<void> {
    const { error } = await supabase
      .rpc('mark_notification_as_read', {
        notification_id: operation.data.notificationId,
        p_user_id: this.userId,
      });
      
    if (error) throw error;
  }

  /**
   * Obtém todas as operações pendentes
   * @returns Lista de operações pendentes
   */
  public getPendingOperations(): OfflineOperation[] {
    return this.queue.filter(op => op.status === 'pending' || op.status === 'failed');
  }

  /**
   * Limpa todas as operações pendentes
   */
  public clearQueue(): void {
    this.queue = [];
    this.saveToStorage();
  }

  /**
   * Retorna o status atual da conexão
   * @returns true se estiver online, false se estiver offline
   */
  public isOnline(): boolean {
    return this.onlineStatus;
  }

  /**
   * Retorna o estado de inicialização do gerenciador
   * @returns true se inicializado, false caso contrário
   */
  public getInitializationStatus(): boolean {
    return this.isInitialized;
  }
}

// Exporta a instância singleton do gerenciador offline
export const OfflineManager = new OfflineManagerClass();

// Função helper para garantir que o OfflineManager esteja inicializado
export const ensureOfflineManagerInitialized = (userId?: string): void => {
  if (!OfflineManager.getInitializationStatus() && userId) {
    OfflineManager.init(userId);
  }
};

// Hook para monitorar o status de conexão
export const useOnlineStatus = (): boolean => {
  return OfflineManager.isOnline();
}; 