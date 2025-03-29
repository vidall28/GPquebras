import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, X, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useToast } from './ui/use-toast';
import { useNotifications } from '@/lib/notifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OfflineManager, OfflineOperationType, useOnlineStatus } from '@/lib/offlineManager';
import { cn } from '@/lib/utils';

// Ícones para diferentes tipos de notificações
const NotificationIcons: Record<string, React.ReactNode> = {
  'system': <AlertCircle className="h-4 w-4 text-blue-500" />,
  'exchange': <ExternalLink className="h-4 w-4 text-green-500" />,
  'error': <AlertCircle className="h-4 w-4 text-red-500" />,
  'warning': <AlertCircle className="h-4 w-4 text-yellow-500" />,
  'default': <Bell className="h-4 w-4 text-muted-foreground" />
};

export function NotificationDropdown() {
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    deleteNotification, 
    clearAllNotifications,
    isLoading
  } = useNotifications();
  const [open, setOpen] = useState(false);
  
  // Efeito para atualizar a contagem de notificações no título
  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) GP Quebras e Trocas`;
    } else {
      document.title = 'GP Quebras e Trocas';
    }
  }, [unreadCount]);

  // Função para marcar notificação como lida
  const handleMarkAsRead = async (id: string) => {
    try {
      if (isOnline) {
        await markAsRead(id);
        toast({
          description: "Notificação marcada como lida",
        });
      } else {
        // Enfileira a operação para quando estiver online
        OfflineManager.enqueue(
          OfflineOperationType.MARK_AS_READ,
          { notificationId: id },
          'notifications'
        );
        toast({
          description: "Ação enfileirada para quando ficar online",
        });
      }
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível marcar a notificação como lida",
      });
    }
  };

  // Função para excluir notificação
  const handleDeleteNotification = async (id: string) => {
    try {
      if (isOnline) {
        await deleteNotification(id);
        toast({
          description: "Notificação excluída",
        });
      } else {
        // Enfileira a operação para quando estiver online
        OfflineManager.enqueue(
          OfflineOperationType.DELETE,
          { id },
          'notifications'
        );
        toast({
          description: "Ação enfileirada para quando ficar online",
        });
      }
    } catch (error) {
      console.error('Erro ao excluir notificação:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir a notificação",
      });
    }
  };

  // Agrupar notificações por data
  const groupNotificationsByDate = () => {
    const groups: Record<string, typeof notifications> = {
      'Hoje': [],
      'Esta semana': [],
      'Este mês': [],
      'Anteriores': [],
    };
    
    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;
    
    notifications.forEach(notification => {
      const notificationDate = new Date(notification.created_at);
      const diff = now.getTime() - notificationDate.getTime();
      
      if (diff < oneDay) {
        groups['Hoje'].push(notification);
      } else if (diff < oneWeek) {
        groups['Esta semana'].push(notification);
      } else if (diff < oneMonth) {
        groups['Este mês'].push(notification);
      } else {
        groups['Anteriores'].push(notification);
      }
    });
    
    return groups;
  };

  const notificationGroups = groupNotificationsByDate();
  
  // Renderizar grupos de notificações
  const renderNotificationGroups = () => {
    return Object.entries(notificationGroups).map(([groupName, groupNotifications]) => {
      if (groupNotifications.length === 0) return null;
      
      return (
        <div key={groupName} className="mb-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">{groupName}</h4>
          {groupNotifications.map(notification => (
            <div 
              key={notification.id} 
              className={cn(
                "mb-2 p-3 rounded-md transition-colors",
                notification.read 
                  ? "bg-background hover:bg-accent/50" 
                  : "bg-accent/30 hover:bg-accent/50"
              )}
            >
              <div className="flex items-start gap-2">
                <div className="mt-0.5">
                  {NotificationIcons[notification.type] || NotificationIcons.default}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium leading-none">
                      {notification.title}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.created_at), { 
                        addSuffix: true,
                        locale: ptBR 
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {notification.message}
                  </p>
                  {notification.link && (
                    <a 
                      href={notification.link}
                      className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver detalhes
                    </a>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-1 mt-2">
                {!notification.read && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleMarkAsRead(notification.id)}
                    title="Marcar como lida"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleDeleteNotification(notification.id)}
                  title="Excluir notificação"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
          <Separator className="my-2" />
        </div>
      );
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-[1.2rem] w-[1.2rem]" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1.5 -right-1.5 flex items-center justify-center h-5 min-w-[20px] bg-red-500"
              variant="destructive"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-2 border-b">
          <h3 className="font-semibold">Notificações</h3>
          <div className="flex items-center gap-1">
            {!isOnline && (
              <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800">
                Offline
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="all">
          <div className="border-b px-2">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">
                Todas
              </TabsTrigger>
              <TabsTrigger value="unread" className="flex-1">
                Não lidas {unreadCount > 0 && `(${unreadCount})`}
              </TabsTrigger>
            </TabsList>
          </div>
          
          <ScrollArea className="h-[300px]">
            <TabsContent value="all" className="p-2">
              {isLoading ? (
                <div className="flex justify-center items-center h-[200px]">
                  <p className="text-sm text-muted-foreground">Carregando notificações...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-[200px] gap-2">
                  <Bell className="h-8 w-8 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                </div>
              ) : (
                <>
                  {renderNotificationGroups()}
                  
                  <div className="flex justify-center my-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-xs"
                      onClick={clearAllNotifications}
                      disabled={notifications.length === 0 || !isOnline}
                    >
                      Limpar todas
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
            
            <TabsContent value="unread" className="p-2">
              {isLoading ? (
                <div className="flex justify-center items-center h-[200px]">
                  <p className="text-sm text-muted-foreground">Carregando notificações...</p>
                </div>
              ) : notifications.filter(n => !n.read).length === 0 ? (
                <div className="flex flex-col justify-center items-center h-[200px] gap-2">
                  <Check className="h-8 w-8 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">Nenhuma notificação não lida</p>
                </div>
              ) : (
                <>
                  {Object.entries(notificationGroups).map(([groupName, groupNotifications]) => {
                    const unreadNotifications = groupNotifications.filter(n => !n.read);
                    if (unreadNotifications.length === 0) return null;
                    
                    return (
                      <div key={groupName} className="mb-4">
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">{groupName}</h4>
                        {unreadNotifications.map(notification => (
                          <div 
                            key={notification.id} 
                            className="mb-2 p-3 rounded-md bg-accent/30 hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5">
                                {NotificationIcons[notification.type] || NotificationIcons.default}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-start justify-between">
                                  <p className="text-sm font-medium leading-none">
                                    {notification.title}
                                  </p>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(notification.created_at), { 
                                      addSuffix: true,
                                      locale: ptBR 
                                    })}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {notification.message}
                                </p>
                                {notification.link && (
                                  <a 
                                    href={notification.link}
                                    className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Ver detalhes
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-end gap-1 mt-2">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleMarkAsRead(notification.id)}
                                title="Marcar como lida"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleDeleteNotification(notification.id)}
                                title="Excluir notificação"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Separator className="my-2" />
                      </div>
                    );
                  })}
                  
                  <div className="flex justify-center my-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        const unreadIds = notifications
                          .filter(n => !n.read)
                          .map(n => n.id);
                          
                        Promise.all(unreadIds.map(id => handleMarkAsRead(id)));
                      }}
                      disabled={notifications.filter(n => !n.read).length === 0 || !isOnline}
                    >
                      Marcar todas como lidas
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
} 