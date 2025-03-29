import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useOnlineStatus } from '@/lib/offlineManager';
import { advancedCache } from '@/lib/cache';
import { v4 as uuidv4 } from 'uuid';

export type NotificationType = 'system' | 'error' | 'warning' | 'exchange' | 'message';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string; // ISO date string
  link?: string;
  data?: Record<string, any>;
}

// Interface para o contexto global de notificações
interface NotificationsContextData {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'userId' | 'createdAt' | 'read'>) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  isLoading: boolean;
  initialized: boolean;
}

// Sistema de cache para notificações
const NOTIFICATIONS_CACHE_KEY = 'user_notifications';
const STORAGE_KEY = 'quebras_trocas_notifications';

// Gerenciamento local para quando o usuário estiver offline
const getLocalNotifications = (userId: string): Notification[] => {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Erro ao recuperar notificações locais:', e);
  }
  return [];
};

const saveLocalNotifications = (userId: string, notifications: Notification[]): void => {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(notifications));
  } catch (e) {
    console.error('Erro ao salvar notificações locais:', e);
  }
};

// Hook principal para gerenciar notificações
export const useNotifications = (): NotificationsContextData => {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Função para buscar notificações do backend
  const fetchNotifications = useCallback(async (): Promise<Notification[]> => {
    if (!user?.id) return [];

    try {
      // Tenta buscar do cache primeiro
      const cached = advancedCache.get<Notification[]>(
        `${NOTIFICATIONS_CACHE_KEY}_${user.id}`,
        async () => {
          if (!isOnline) {
            return getLocalNotifications(user.id);
          }

          const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (error) {
            console.error('Erro ao buscar notificações:', error);
            return getLocalNotifications(user.id);
          }

          // Converter do formato do banco para o formato da aplicação
          return data.map((item: any): Notification => ({
            id: item.id,
            userId: item.user_id,
            title: item.title,
            message: item.message,
            type: item.type,
            read: item.read,
            createdAt: item.created_at,
            link: item.link,
            data: item.data,
          }));
        },
        { ttl: 300, persist: true }
      );

      return cached || [];
    } catch (error) {
      console.error('Erro ao recuperar notificações:', error);
      return getLocalNotifications(user.id);
    }
  }, [user, isOnline]);

  // Calcular o número de notificações não lidas
  const calculateUnreadCount = useCallback((notificationsList: Notification[]) => {
    const count = notificationsList.filter(n => !n.read).length;
    setUnreadCount(count);
    return count;
  }, []);

  // Carregar notificações iniciais
  const refreshNotifications = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const fetchedNotifications = await fetchNotifications();
      setNotifications(fetchedNotifications);
      calculateUnreadCount(fetchedNotifications);
      
      if (isOnline) {
        saveLocalNotifications(user.id, fetchedNotifications);
      }
      
      setInitialized(true);
    } catch (error) {
      console.error('Erro ao atualizar notificações:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, fetchNotifications, calculateUnreadCount, isOnline]);

  // Inicialização
  useEffect(() => {
    if (user?.id && !initialized) {
      refreshNotifications();
    } else if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setInitialized(false);
    }
  }, [user, initialized, refreshNotifications]);

  // Marcar uma notificação como lida
  const markAsRead = useCallback(async (id: string) => {
    if (!user?.id) return;

    // Atualiza o estado local imediatamente para feedback rápido
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );

    // Recalcula contagem de não lidas
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    calculateUnreadCount(updated);
    
    // Atualiza o cache
    advancedCache.invalidate(`${NOTIFICATIONS_CACHE_KEY}_${user.id}`);
    
    // Persiste localmente
    saveLocalNotifications(user.id, updated);

    // Sincroniza com o backend se estiver online
    if (isOnline) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) {
          console.error('Erro ao marcar notificação como lida:', error);
          throw error;
        }
      } catch (error) {
        // Em caso de erro, registra para sincronização posterior
        console.error('Erro ao sincronizar status de leitura:', error);
        // Aqui poderíamos adicionar à fila de operações offline
      }
    }
  }, [user, notifications, calculateUnreadCount, isOnline]);

  // Marcar todas as notificações como lidas
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;

    // Atualiza o estado local imediatamente
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
    setUnreadCount(0);
    
    // Atualiza o cache
    advancedCache.invalidate(`${NOTIFICATIONS_CACHE_KEY}_${user.id}`);
    
    // Persiste localmente
    saveLocalNotifications(user.id, notifications.map(n => ({ ...n, read: true })));

    // Sincroniza com o backend se estiver online
    if (isOnline) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user.id)
          .is('read', false);

        if (error) {
          console.error('Erro ao marcar todas notificações como lidas:', error);
          throw error;
        }
      } catch (error) {
        console.error('Erro ao sincronizar status de leitura em massa:', error);
      }
    }
  }, [user, notifications, isOnline]);

  // Excluir uma notificação
  const deleteNotification = useCallback(async (id: string) => {
    if (!user?.id) return;

    // Atualiza o estado local imediatamente
    const updatedNotifications = notifications.filter(n => n.id !== id);
    setNotifications(updatedNotifications);
    calculateUnreadCount(updatedNotifications);
    
    // Atualiza o cache
    advancedCache.invalidate(`${NOTIFICATIONS_CACHE_KEY}_${user.id}`);
    
    // Persiste localmente
    saveLocalNotifications(user.id, updatedNotifications);

    // Sincroniza com o backend se estiver online
    if (isOnline) {
      try {
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) {
          console.error('Erro ao excluir notificação:', error);
          throw error;
        }
      } catch (error) {
        console.error('Erro ao sincronizar exclusão:', error);
      }
    }
  }, [user, notifications, calculateUnreadCount, isOnline]);

  // Limpar todas as notificações
  const clearAllNotifications = useCallback(async () => {
    if (!user?.id) return;

    // Atualiza o estado local imediatamente
    setNotifications([]);
    setUnreadCount(0);
    
    // Atualiza o cache
    advancedCache.invalidate(`${NOTIFICATIONS_CACHE_KEY}_${user.id}`);
    
    // Persiste localmente
    saveLocalNotifications(user.id, []);

    // Sincroniza com o backend se estiver online
    if (isOnline) {
      try {
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('user_id', user.id);

        if (error) {
          console.error('Erro ao limpar notificações:', error);
          throw error;
        }
      } catch (error) {
        console.error('Erro ao sincronizar limpeza de notificações:', error);
      }
    }
  }, [user, isOnline]);

  // Adicionar uma nova notificação
  const addNotification = useCallback(async (notification: Omit<Notification, 'id' | 'userId' | 'createdAt' | 'read'>) => {
    if (!user?.id) return;

    const newNotification: Notification = {
      id: uuidv4(),
      userId: user.id,
      createdAt: new Date().toISOString(),
      read: false,
      ...notification
    };

    // Atualiza o estado local imediatamente
    const updatedNotifications = [newNotification, ...notifications];
    setNotifications(updatedNotifications);
    setUnreadCount(prev => prev + 1);
    
    // Atualiza o cache
    advancedCache.invalidate(`${NOTIFICATIONS_CACHE_KEY}_${user.id}`);
    
    // Persiste localmente
    saveLocalNotifications(user.id, updatedNotifications);

    // Sincroniza com o backend se estiver online
    if (isOnline) {
      try {
        const { error } = await supabase
          .from('notifications')
          .insert({
            id: newNotification.id,
            user_id: user.id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            read: false,
            created_at: newNotification.createdAt,
            link: notification.link,
            data: notification.data
          });

        if (error) {
          console.error('Erro ao criar notificação:', error);
          throw error;
        }
      } catch (error) {
        console.error('Erro ao sincronizar nova notificação:', error);
      }
    }
  }, [user, notifications, isOnline]);

  // Função para enviar uma notificação push (mock para demonstração)
  const sendPushNotification = (notification: Notification) => {
    // Verifica se as notificações push estão habilitadas
    if (!('Notification' in window)) {
      console.warn('Este navegador não suporta notificações push');
      return;
    }

    // Verifica se o usuário já deu permissão
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/logo.png',
      });
    } 
    // Solicita permissão se o status for "default"
    else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/logo.png',
          });
        }
      });
    }
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    addNotification,
    refreshNotifications,
    isLoading,
    initialized,
    sendPushNotification
  };
};

// Contexto global para as notificações
const notificationsSystem = {
  notifications: [] as Notification[],
  listeners: [] as ((notifications: Notification[]) => void)[],
  subscriptions: [] as (() => void)[],
  initialized: false,
  userId: null as string | null,

  // Inicializa o sistema com ID do usuário
  init(userId?: string) {
    if (userId) {
      this.userId = userId;
      this.notifications = getLocalNotifications(userId);
      this.notifyListeners();
      this.initialized = true;
    }
    return this;
  },

  // Adiciona uma notificação global
  addNotification(notification: Omit<Notification, 'id' | 'userId' | 'createdAt' | 'read'>) {
    if (!this.userId) return null;

    const newNotification: Notification = {
      id: uuidv4(),
      userId: this.userId,
      createdAt: new Date().toISOString(),
      read: false,
      ...notification
    };

    this.notifications = [newNotification, ...this.notifications];
    saveLocalNotifications(this.userId, this.notifications);
    this.notifyListeners();
    return newNotification;
  },

  // Marca uma notificação como lida
  markAsRead(id: string) {
    if (!this.userId) return;
    
    this.notifications = this.notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    );
    
    saveLocalNotifications(this.userId, this.notifications);
    this.notifyListeners();
  },

  // Marca todas as notificações como lidas
  markAllAsRead() {
    if (!this.userId) return;
    
    this.notifications = this.notifications.map(n => ({ ...n, read: true }));
    saveLocalNotifications(this.userId, this.notifications);
    this.notifyListeners();
  },

  // Exclui uma notificação
  deleteNotification(id: string) {
    if (!this.userId) return;
    
    this.notifications = this.notifications.filter(n => n.id !== id);
    saveLocalNotifications(this.userId, this.notifications);
    this.notifyListeners();
  },

  // Limpa todas as notificações
  clearAll() {
    if (!this.userId) return;
    
    this.notifications = [];
    saveLocalNotifications(this.userId, []);
    this.notifyListeners();
  },

  // Atualiza lista de notificações do servidor
  async refreshFromServer() {
    if (!this.userId) return;
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar notificações:', error);
        return;
      }

      this.notifications = data.map((item: any): Notification => ({
        id: item.id,
        userId: item.user_id,
        title: item.title,
        message: item.message,
        type: item.type,
        read: item.read,
        createdAt: item.created_at,
        link: item.link,
        data: item.data,
      }));
      
      saveLocalNotifications(this.userId, this.notifications);
      this.notifyListeners();
    } catch (error) {
      console.error('Erro ao recuperar notificações:', error);
    }
  },

  // Obtém contagem de não lidas
  getUnreadCount() {
    return this.notifications.filter(n => !n.read).length;
  },

  // Sistema de inscrição para notificações em tempo real
  subscribe(callback: (notifications: Notification[]) => void) {
    this.listeners.push(callback);
    
    // Notifica o novo assinante com os dados atuais
    callback(this.notifications);
    
    // Retorna função para cancelar inscrição
    const unsubscribe = () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
    
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  },

  // Notifica todos os inscritos
  notifyListeners() {
    this.listeners.forEach(listener => listener(this.notifications));
  },

  // Utilidades para enviar notificações
  sendSystemNotification(title: string, message: string, data?: Record<string, any>, link?: string) {
    return this.addNotification({
      title,
      message,
      type: 'system',
      data,
      link
    });
  },

  sendErrorNotification(title: string, message: string, data?: Record<string, any>, link?: string) {
    return this.addNotification({
      title,
      message,
      type: 'error',
      data,
      link
    });
  },

  sendExchangeNotification(title: string, message: string, data?: Record<string, any>, link?: string) {
    return this.addNotification({
      title,
      message,
      type: 'exchange',
      data,
      link
    });
  },

  // Envia uma notificação push
  sendPushNotification(notification: Notification) {
    if (!('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/logo.png',
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/logo.png',
          });
        }
      });
    }
  }
};

export default notificationsSystem; 