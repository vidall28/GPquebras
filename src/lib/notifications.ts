/**
 * Sistema de Notificações
 * 
 * Este módulo fornece funcionalidades para gerenciar e exibir notificações
 * para o usuário, incluindo notificações do sistema, notificações em tempo real
 * via Supabase, e notificações push (quando disponível).
 */

import { toast } from './toast';

// Importação dinâmica do Supabase para evitar referências circulares
const getSupabase = async () => {
  const module = await import('./supabase');
  return module.supabase;
};

// Tipos de notificações
export enum NotificationType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  EXCHANGE_REQUEST = 'exchange_request',
  EXCHANGE_ACCEPTED = 'exchange_accepted',
  EXCHANGE_REJECTED = 'exchange_rejected',
  PRODUCT_UPDATE = 'product_update',
  SYSTEM = 'system'
}

// Interface para uma notificação
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  createdAt: Date;
  read: boolean;
  userId?: string;
  link?: string;
}

// Opções para criar uma notificação
export interface CreateNotificationOptions {
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  userId?: string;
  show?: boolean;
  link?: string;
  saveToDatabase?: boolean;
  sendPush?: boolean;
}

// Gerenciador de notificações
export const NotificationManager = {
  notifications: [] as Notification[],
  listeners: [] as ((notifications: Notification[]) => void)[],
  subscriptions: [] as (() => void)[],
  initialized: false,
  userId: null as string | null,
  
  /**
   * Inicializa o gerenciador de notificações
   * @param userId ID do usuário atual
   * @returns O gerenciador de notificações
   */
  init(userId?: string) {
    console.log('Inicializando sistema de notificações');
    
    if (this.initialized) {
      console.log('Sistema de notificações já inicializado');
      if (userId && userId !== this.userId) {
        console.log('Atualizando ID do usuário de', this.userId, 'para', userId);
        this.userId = userId;
        this.loadNotifications();
      }
      return this;
    }
    
    // Proteção contra inicializações simultâneas que poderiam causar recursão
    const initializationInProgress = localStorage.getItem('notifications_initializing');
    if (initializationInProgress) {
      console.log('Inicialização já em andamento. Evitando recursão.');
      return this;
    }
    
    try {
      localStorage.setItem('notifications_initializing', 'true');
      
      this.userId = userId || null;
      this.initialized = true;
      
      // Carregar notificações do localStorage
      this.loadFromLocalStorage();
      
      // Se houver um usuário, carregar notificações do banco de dados
      if (userId) {
        this.loadNotifications();
      }
      
      // Configurar assinatura em tempo real se houver um usuário
      if (userId) {
        this.setupRealtimeSubscription(userId);
      }
      
      // Verificar e configurar notificações push
      this.checkPushNotificationSupport();
      
      return this;
    } finally {
      // Remover sinalizador de inicialização
      localStorage.removeItem('notifications_initializing');
    }
  },
  
  /**
   * Carrega as notificações do localStorage
   */
  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Converter strings de data para objetos Date
        this.notifications = parsed.map((n: any) => ({
          ...n,
          createdAt: new Date(n.createdAt)
        }));
        console.log(`${this.notifications.length} notificações carregadas do localStorage`);
      }
    } catch (error) {
      console.error('Erro ao carregar notificações do localStorage:', error);
      this.notifications = [];
    }
  },
  
  /**
   * Salva as notificações no localStorage
   */
  saveToLocalStorage() {
    try {
      // Limitar a 50 notificações para não sobrecarregar o localStorage
      const notificationsToSave = this.notifications.slice(0, 50);
      localStorage.setItem('notifications', JSON.stringify(notificationsToSave));
    } catch (error) {
      console.error('Erro ao salvar notificações no localStorage:', error);
    }
  },
  
  /**
   * Carrega as notificações do banco de dados
   */
  async loadNotifications() {
    if (!this.userId) {
      console.warn('Tentativa de carregar notificações sem ID de usuário');
      return;
    }
    
    try {
      console.log('Carregando notificações do banco de dados para o usuário', this.userId);
      
      const supabase = await getSupabase();
      
      // Obter notificações não lidas ou lidas recentes (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', this.userId)
        .or(`read.eq.false,created_at.gt.${thirtyDaysAgo.toISOString()}`)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        // Converter do formato de banco de dados para o formato da aplicação
        const dbNotifications: Notification[] = data.map((n: any) => ({
          id: n.id,
          type: n.type as NotificationType,
          title: n.title,
          message: n.message,
          data: n.data,
          createdAt: new Date(n.created_at),
          read: n.read,
          userId: n.user_id,
          link: n.link
        }));
        
        // Mesclar com notificações locais, mantendo as mais recentes
        this.mergeNotifications(dbNotifications);
        
        console.log(`${data.length} notificações carregadas do banco de dados`);
      } else {
        console.log('Nenhuma notificação encontrada no banco de dados');
      }
    } catch (error) {
      console.error('Erro ao carregar notificações do banco de dados:', error);
    }
  },
  
  /**
   * Mescla notificações obtidas do banco de dados com as notificações locais
   * @param dbNotifications Notificações do banco de dados
   */
  mergeNotifications(dbNotifications: Notification[]) {
    // Criar mapa com notificações existentes por ID
    const existingMap = new Map<string, Notification>();
    this.notifications.forEach(n => existingMap.set(n.id, n));
    
    // Adicionar ou atualizar com notificações do banco de dados
    dbNotifications.forEach(dbNote => {
      const existing = existingMap.get(dbNote.id);
      
      if (!existing) {
        // Nova notificação
        this.notifications.push(dbNote);
      } else if (dbNote.read && !existing.read) {
        // Atualizar status de leitura
        existing.read = true;
      }
    });
    
    // Ordenar por data, mais recentes primeiro
    this.notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // Notificar ouvintes
    this.notifyListeners();
    
    // Salvar no localStorage
    this.saveToLocalStorage();
  },
  
  /**
   * Configura assinatura em tempo real para notificações
   * @param userId ID do usuário
   */
  async setupRealtimeSubscription(userId: string) {
    try {
      const supabase = await getSupabase();
      
      // Cancelar assinaturas anteriores
      this.clearSubscriptions();
      
      // Assinar a mudanças na tabela de notificações para este usuário
      const subscription = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log('Nova notificação recebida via realtime:', payload);
            this.handleRealtimeNotification(payload.new);
          }
        )
        .subscribe();
      
      // Armazenar função de limpeza
      this.subscriptions.push(() => {
        subscription.unsubscribe();
      });
      
      console.log('Assinatura em tempo real configurada para notificações');
    } catch (error) {
      console.error('Erro ao configurar assinatura em tempo real:', error);
    }
  },
  
  /**
   * Manipular notificação recebida em tempo real
   * @param data Dados da notificação
   */
  handleRealtimeNotification(data: any) {
    // Converter para o formato da aplicação
    const notification: Notification = {
      id: data.id,
      type: data.type as NotificationType,
      title: data.title,
      message: data.message,
      data: data.data,
      createdAt: new Date(data.created_at),
      read: false,
      userId: data.user_id,
      link: data.link
    };
    
    // Adicionar à lista de notificações
    this.notifications.unshift(notification);
    
    // Limitar o número de notificações (máximo 100)
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100);
    }
    
    // Notificar ouvintes
    this.notifyListeners();
    
    // Salvar no localStorage
    this.saveToLocalStorage();
    
    // Mostrar toast de notificação
    this.showToastForNotification(notification);
  },
  
  /**
   * Exibe um toast para uma notificação
   * @param notification Notificação a ser exibida
   */
  showToastForNotification(notification: Notification) {
    let toastType: 'success' | 'error' | 'info' | 'loading' | 'message' = 'info';
    
    // Mapear tipo de notificação para tipo de toast
    switch (notification.type) {
      case NotificationType.SUCCESS:
      case NotificationType.EXCHANGE_ACCEPTED:
        toastType = 'success';
        break;
      case NotificationType.ERROR:
      case NotificationType.EXCHANGE_REJECTED:
        toastType = 'error';
        break;
      default:
        toastType = 'info';
    }
    
    // Exibir toast
    toast[toastType](notification.title, {
      description: notification.message,
      action: notification.link ? {
        label: 'Ver detalhes',
        onClick: () => {
          window.location.href = notification.link!;
        }
      } : undefined
    });
  },
  
  /**
   * Cria uma nova notificação
   * @param options Opções para criar a notificação
   * @returns A notificação criada
   */
  async create(options: CreateNotificationOptions): Promise<Notification> {
    const id = `notification_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    const notification: Notification = {
      id,
      type: options.type,
      title: options.title,
      message: options.message,
      data: options.data,
      createdAt: new Date(),
      read: false,
      userId: options.userId || this.userId || undefined,
      link: options.link
    };
    
    // Adicionar à lista de notificações
    this.notifications.unshift(notification);
    
    // Limitar número de notificações
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100);
    }
    
    // Notificar ouvintes
    this.notifyListeners();
    
    // Salvar no localStorage
    this.saveToLocalStorage();
    
    // Mostrar toast se solicitado
    if (options.show !== false) {
      this.showToastForNotification(notification);
    }
    
    // Salvar no banco de dados se solicitado
    if (options.saveToDatabase && notification.userId) {
      this.saveNotificationToDatabase(notification);
    }
    
    // Enviar notificação push se solicitado
    if (options.sendPush && 'Notification' in window && Notification.permission === 'granted') {
      this.sendPushNotification(notification);
    }
    
    return notification;
  },
  
  /**
   * Salva uma notificação no banco de dados
   * @param notification Notificação a ser salva
   */
  async saveNotificationToDatabase(notification: Notification) {
    if (!notification.userId) {
      console.warn('Tentativa de salvar notificação sem ID de usuário');
      return;
    }
    
    try {
      const supabase = await getSupabase();
      
      const { error } = await supabase
        .from('notifications')
        .insert({
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          user_id: notification.userId,
          link: notification.link,
          read: notification.read,
          created_at: notification.createdAt.toISOString()
        });
      
      if (error) {
        throw error;
      }
      
      console.log('Notificação salva no banco de dados:', notification.id);
    } catch (error) {
      console.error('Erro ao salvar notificação no banco de dados:', error);
    }
  },
  
  /**
   * Marca uma notificação como lida
   * @param id ID da notificação
   * @param value Status de leitura (padrão: true)
   */
  async markAsRead(id: string, value: boolean = true) {
    // Atualizar localmente
    const notification = this.notifications.find(n => n.id === id);
    
    if (notification) {
      notification.read = value;
      
      // Notificar ouvintes
      this.notifyListeners();
      
      // Salvar no localStorage
      this.saveToLocalStorage();
      
      // Atualizar no banco de dados se houver userId
      if (notification.userId) {
        try {
          const supabase = await getSupabase();
          
          const { error } = await supabase
            .from('notifications')
            .update({ read: value })
            .eq('id', id);
          
          if (error) {
            throw error;
          }
          
          console.log(`Notificação ${id} marcada como ${value ? 'lida' : 'não lida'} no banco de dados`);
        } catch (error) {
          console.error('Erro ao atualizar status de leitura no banco de dados:', error);
        }
      }
    }
  },
  
  /**
   * Marca todas as notificações como lidas
   */
  async markAllAsRead() {
    // Filtrar notificações não lidas
    const unreadNotifications = this.notifications.filter(n => !n.read);
    
    if (unreadNotifications.length === 0) {
      return;
    }
    
    // Atualizar localmente
    unreadNotifications.forEach(n => n.read = true);
    
    // Notificar ouvintes
    this.notifyListeners();
    
    // Salvar no localStorage
    this.saveToLocalStorage();
    
    // Atualizar no banco de dados para o usuário atual
    if (this.userId) {
      try {
        const supabase = await getSupabase();
        
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', this.userId)
          .eq('read', false);
        
        if (error) {
          throw error;
        }
        
        console.log('Todas as notificações marcadas como lidas no banco de dados');
      } catch (error) {
        console.error('Erro ao marcar todas notificações como lidas no banco de dados:', error);
      }
    }
  },
  
  /**
   * Remove uma notificação
   * @param id ID da notificação
   */
  async remove(id: string) {
    // Remover localmente
    this.notifications = this.notifications.filter(n => n.id !== id);
    
    // Notificar ouvintes
    this.notifyListeners();
    
    // Salvar no localStorage
    this.saveToLocalStorage();
    
    // Remover do banco de dados
    try {
      const supabase = await getSupabase();
      
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      console.log('Notificação removida do banco de dados:', id);
    } catch (error) {
      console.error('Erro ao remover notificação do banco de dados:', error);
    }
  },
  
  /**
   * Limpa todas as notificações
   */
  async clearAll() {
    // Limpar localmente
    this.notifications = [];
    
    // Notificar ouvintes
    this.notifyListeners();
    
    // Salvar no localStorage
    this.saveToLocalStorage();
    
    // Remover do banco de dados para o usuário atual
    if (this.userId) {
      try {
        const supabase = await getSupabase();
        
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('user_id', this.userId);
        
        if (error) {
          throw error;
        }
        
        console.log('Todas as notificações removidas do banco de dados');
      } catch (error) {
        console.error('Erro ao remover todas as notificações do banco de dados:', error);
      }
    }
  },
  
  /**
   * Inscreve-se para receber atualizações de notificações
   * @param listener Função a ser chamada quando as notificações forem atualizadas
   * @returns Função para cancelar a inscrição
   */
  subscribe(listener: (notifications: Notification[]) => void) {
    this.listeners.push(listener);
    
    // Chamar imediatamente com as notificações atuais
    listener([...this.notifications]);
    
    // Retornar função para cancelar a inscrição
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  },
  
  /**
   * Notifica todos os ouvintes sobre mudanças nas notificações
   */
  notifyListeners() {
    // Copiar array para evitar que os ouvintes modifiquem o original
    const notificationsCopy = [...this.notifications];
    
    for (const listener of this.listeners) {
      try {
        listener(notificationsCopy);
      } catch (error) {
        console.error('Erro em ouvinte de notificações:', error);
      }
    }
  },
  
  /**
   * Limpa todas as assinaturas em tempo real
   */
  clearSubscriptions() {
    for (const unsubscribe of this.subscriptions) {
      try {
        unsubscribe();
      } catch (error) {
        console.error('Erro ao cancelar assinatura:', error);
      }
    }
    
    this.subscriptions = [];
  },
  
  /**
   * Obtém o número de notificações não lidas
   * @returns Número de notificações não lidas
   */
  getUnreadCount() {
    return this.notifications.filter(n => !n.read).length;
  },
  
  /**
   * Verifica se o navegador suporta notificações push e solicita permissão
   */
  async checkPushNotificationSupport() {
    if (!('Notification' in window)) {
      console.log('Este navegador não suporta notificações push');
      return false;
    }
    
    if (Notification.permission === 'granted') {
      console.log('Permissão para notificações push já concedida');
      return true;
    }
    
    if (Notification.permission !== 'denied') {
      console.log('Solicitando permissão para notificações push');
      
      try {
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
          console.log('Permissão para notificações push concedida');
          return true;
        } else {
          console.log('Permissão para notificações push negada');
          return false;
        }
      } catch (error) {
        console.error('Erro ao solicitar permissão para notificações push:', error);
        return false;
      }
    }
    
    return false;
  },
  
  /**
   * Envia uma notificação push
   * @param notification Notificação a ser enviada
   */
  sendPushNotification(notification: Notification) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    
    try {
      const options = {
        body: notification.message,
        icon: '/favicon.ico', // Ajustar para o ícone apropriado
        tag: notification.id,
        data: {
          url: notification.link || window.location.origin
        }
      };
      
      const pushNotification = new Notification(notification.title, options);
      
      pushNotification.onclick = function() {
        window.focus();
        if (this.data.url) {
          window.location.href = this.data.url;
        }
        this.close();
      };
      
      console.log('Notificação push enviada:', notification.title);
    } catch (error) {
      console.error('Erro ao enviar notificação push:', error);
    }
  }
};

// Exportar funções utilitárias
export const useNotifications = NotificationManager;

// Helper para criar notificações comuns
export const createExchangeNotification = async (
  userId: string,
  title: string,
  message: string,
  exchangeId: string,
  type: NotificationType = NotificationType.EXCHANGE_REQUEST
) => {
  return useNotifications.create({
    type,
    title,
    message,
    userId,
    link: `/exchange/${exchangeId}`,
    saveToDatabase: true,
    sendPush: true
  });
};

export default NotificationManager; 