import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Trash2, 
  X,
  AlertTriangle,
  MessageSquare,
  PaperclipIcon
} from 'lucide-react';
import { useNotifications } from '@/lib/notifications';
import { useOnlineStatus } from '@/lib/offlineManager';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Notification, NotificationType } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

const MAX_VISIBLE_NOTIFICATIONS = 5;

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const getIconForType = (type: NotificationType) => {
  switch (type) {
    case 'system':
      return <Bell className="h-4 w-4 text-blue-500" />;
    case 'exchange':
      return <PaperclipIcon className="h-4 w-4 text-green-500" />;
    case 'error':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'message':
      return <MessageSquare className="h-4 w-4 text-purple-500" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
};

const NotificationItem: React.FC<NotificationItemProps> = ({ 
  notification, 
  onMarkAsRead, 
  onDelete 
}) => {
  const handleMarkAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onMarkAsRead(notification.id);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onDelete(notification.id);
  };

  return (
    <DropdownMenuItem
      className={cn(
        "flex flex-col items-start px-4 py-2 cursor-default",
        !notification.read && "bg-accent/20"
      )}
    >
      <div className="flex items-start gap-2 w-full">
        <div className="pt-0.5">
          {getIconForType(notification.type)}
        </div>
        <div className="flex-1 space-y-0.5">
          <div className="flex items-start justify-between w-full">
            <p className={cn(
              "text-sm leading-tight",
              !notification.read && "font-medium"
            )}>
              {notification.title}
            </p>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
              {formatDistanceToNow(new Date(notification.createdAt), { 
                addSuffix: true,
                locale: ptBR
              })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {notification.message}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-1 ml-auto">
        {!notification.read && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6" 
            onClick={handleMarkAsRead}
          >
            <Check className="h-3 w-3" />
            <span className="sr-only">Marcar como lida</span>
          </Button>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-destructive" 
          onClick={handleDelete}
        >
          <Trash2 className="h-3 w-3" />
          <span className="sr-only">Excluir</span>
        </Button>
      </div>
    </DropdownMenuItem>
  );
};

const EmptyNotificationsItem = () => (
  <div className="flex flex-col items-center justify-center py-4 px-1 text-center">
    <Bell className="h-8 w-8 text-muted-foreground/40 mb-2" />
    <p className="text-sm text-muted-foreground">Nenhuma notificação no momento</p>
  </div>
);

const NotificationDropdown: React.FC = () => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification, 
    refreshNotifications 
  } = useNotifications();
  
  const isOnline = useOnlineStatus();
  const [open, setOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const prevUnreadCountRef = useRef(unreadCount);
  
  // Detecta quando novas notificações chegam
  useEffect(() => {
    if (unreadCount > prevUnreadCountRef.current) {
      setHasNewNotifications(true);
    }
    prevUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

  // Atualiza notificações quando o dropdown é aberto
  useEffect(() => {
    if (open) {
      refreshNotifications();
      setHasNewNotifications(false);
    }
  }, [open, refreshNotifications]);

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await markAllAsRead();
      toast({
        description: "Todas as notificações foram marcadas como lidas",
      });
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível marcar todas as notificações como lidas",
      });
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id);
    } catch (error) {
      console.error("Erro ao marcar como lida:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível marcar a notificação como lida",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
    } catch (error) {
      console.error("Erro ao excluir notificação:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir a notificação",
      });
    }
  };

  // Filtra notificações para exibir as mais recentes primeiro, limitando o número mostrado
  const visibleNotifications = [...notifications]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_VISIBLE_NOTIFICATIONS);

  const hasNotifications = visibleNotifications.length > 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            "relative h-9 w-9",
            hasNewNotifications && "animate-pulse"
          )}
        >
          <Bell 
            className={cn(
              "h-5 w-5",
              hasNewNotifications && "text-primary"
            )} 
          />
          {unreadCount > 0 && (
            <Badge 
              className={cn(
                "absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px]",
                hasNewNotifications ? "bg-primary" : "bg-muted-foreground"
              )}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notificações</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="px-0 py-0 text-base font-normal flex items-center gap-1">
            Notificações
            {unreadCount > 0 && (
              <Badge variant="outline" className="ml-2 text-xs">
                {unreadCount} não {unreadCount === 1 ? 'lida' : 'lidas'}
              </Badge>
            )}
          </DropdownMenuLabel>
          {hasNotifications && unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs"
              onClick={handleMarkAllAsRead}
              disabled={!isOnline}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        
        <DropdownMenuSeparator />
        
        {!isOnline && (
          <div className="bg-yellow-50 text-yellow-800 rounded-md p-2 mb-2 text-xs flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-700 flex-shrink-0" />
            <span>Você está offline. Algumas operações podem estar limitadas.</span>
          </div>
        )}
        
        <ScrollArea className="h-[300px]">
          {!hasNotifications ? (
            <EmptyNotificationsItem />
          ) : (
            <div className="space-y-0.5">
              {visibleNotifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        
        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5">
          <Link 
            to="/notifications" 
            className="block w-full py-1.5 px-2 rounded-md text-sm text-center bg-accent/50 hover:bg-accent transition-colors"
            onClick={() => setOpen(false)}
          >
            Ver todas as notificações
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationDropdown; 