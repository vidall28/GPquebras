import { useState, useEffect } from 'react';
import { Bell, Check, X, ExternalLink } from 'lucide-react';
import { 
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui';
import { useNavigate } from 'react-router-dom';
import { NotificationManager, Notification, NotificationType } from '@/lib/notifications';

const MAX_NOTIFICATIONS_SHOWN = 5;

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  
  // Inscrever-se para atualizações de notificações
  useEffect(() => {
    const unsubscribe = NotificationManager.subscribe((updatedNotifications) => {
      setNotifications(updatedNotifications);
      setUnreadCount(NotificationManager.getUnreadCount());
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  const handleNotificationClick = (notification: Notification) => {
    // Marcar como lida
    NotificationManager.markAsRead(notification.id);
    
    // Fechar dropdown
    setOpen(false);
    
    // Navegar para o link se existir
    if (notification.link) {
      navigate(notification.link);
    }
  };
  
  const markAllAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    NotificationManager.markAllAsRead();
  };
  
  const viewAllNotifications = () => {
    navigate('/notifications');
    setOpen(false);
  };
  
  // Ícones específicos para diferentes tipos de notificações
  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case NotificationType.EXCHANGE_ACCEPTED:
        return <Check className="h-4 w-4 text-green-500" />;
      case NotificationType.EXCHANGE_REJECTED:
        return <X className="h-4 w-4 text-red-500" />;
      case NotificationType.EXCHANGE_REQUEST:
        return <ExternalLink className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };
  
  // Formatação de data relativa (ex: "há 3 horas")
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'agora mesmo';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `há ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
    }
  };
  
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between p-2">
          <DropdownMenuLabel>Notificações</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="h-8 text-xs"
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
        
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            Você não tem notificações
          </div>
        ) : (
          <>
            {notifications
              .slice(0, MAX_NOTIFICATIONS_SHOWN)
              .map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`flex flex-col p-3 cursor-pointer ${
                    !notification.read ? 'bg-muted/50' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-2 w-full">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 overflow-hidden">
                      <div className="font-medium">{notification.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {notification.message}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatRelativeTime(notification.createdAt)}
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="h-2 w-2 rounded-full bg-primary mt-1" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            
            {notifications.length > MAX_NOTIFICATIONS_SHOWN && (
              <DropdownMenuSeparator />
            )}
            
            {notifications.length > MAX_NOTIFICATIONS_SHOWN && (
              <Button 
                variant="ghost" 
                className="w-full h-10 mt-1" 
                onClick={viewAllNotifications}
              >
                Ver todas ({notifications.length})
              </Button>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 