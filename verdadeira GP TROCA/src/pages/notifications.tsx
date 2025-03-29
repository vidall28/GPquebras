import React, { useState, useEffect } from 'react';
import { useNotifications } from '@/lib/notifications';
import { 
  Bell, 
  Check, 
  Filter, 
  RotateCw, 
  Trash2, 
  X, 
  BookOpenCheck,
  CalendarDays,
  Clock,
  SlidersHorizontal,
  AlertTriangle,
  MessageSquare,
  PaperclipIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import { useOnlineStatus } from '@/lib/offlineManager';
import { Notification } from '@/lib/notifications';
import { cn } from '@/lib/utils';

// Componente de cabeçalho com título e controles
const NotificationsHeader = ({ 
  onMarkAllAsRead, 
  onClearAll, 
  isLoading, 
  hasNotifications,
  unreadCount
}: {
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  isLoading: boolean;
  hasNotifications: boolean;
  unreadCount: number;
}) => {
  const isOnline = useOnlineStatus();
  
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notificações</h1>
        <p className="text-muted-foreground">
          Gerencie suas notificações e fique por dentro de atualizações importantes
        </p>
      </div>
      <div className="flex items-center gap-2">
        {!isOnline && (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
            Modo Offline
          </Badge>
        )}
        {unreadCount > 0 && (
          <Badge variant="default" className="bg-primary">
            {unreadCount} não lida{unreadCount !== 1 ? 's' : ''}
          </Badge>
        )}
        <Button 
          variant="outline" 
          size="sm"
          disabled={isLoading || !hasNotifications || !unreadCount || !isOnline}
          onClick={onMarkAllAsRead}
        >
          <Check className="mr-2 h-4 w-4" />
          Marcar todas como lidas
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          disabled={isLoading || !hasNotifications || !isOnline}
          onClick={onClearAll}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Limpar todas
        </Button>
      </div>
    </div>
  );
};

// Componente para filtros
const NotificationFilters = ({ 
  searchTerm, 
  onSearchChange,
  filters,
  onFilterChange,
  onClearFilters
}: {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filters: Record<string, boolean>;
  onFilterChange: (key: string, value: boolean) => void;
  onClearFilters: () => void;
}) => {
  const filterCount = Object.values(filters).filter(Boolean).length;
  
  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <CardTitle className="text-lg flex items-center gap-1">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
          {filterCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClearFilters}
              className="h-8 text-xs"
            >
              Limpar filtros ({filterCount})
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por título ou conteúdo..."
                className="w-full pl-8"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-9 w-9"
                  onClick={() => onSearchChange('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Filtros
                  {filterCount > 0 && (
                    <Badge className="ml-2 h-5 min-w-[20px] bg-primary" variant="default">
                      {filterCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={filters.unread}
                  onCheckedChange={(checked) => onFilterChange('unread', checked)}
                >
                  Não lidas
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filters.read}
                  onCheckedChange={(checked) => onFilterChange('read', checked)}
                >
                  Lidas
                </DropdownMenuCheckboxItem>
                
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Tipo</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={filters.system}
                  onCheckedChange={(checked) => onFilterChange('system', checked)}
                >
                  Sistema
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filters.exchange}
                  onCheckedChange={(checked) => onFilterChange('exchange', checked)}
                >
                  Trocas e Quebras
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filters.error}
                  onCheckedChange={(checked) => onFilterChange('error', checked)}
                >
                  Alertas e Erros
                </DropdownMenuCheckboxItem>
                
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Período</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={filters.today}
                  onCheckedChange={(checked) => onFilterChange('today', checked)}
                >
                  Hoje
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filters.week}
                  onCheckedChange={(checked) => onFilterChange('week', checked)}
                >
                  Esta semana
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filters.month}
                  onCheckedChange={(checked) => onFilterChange('month', checked)}
                >
                  Este mês
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Componente para cada notificação
const NotificationItem = ({
  notification,
  onMarkAsRead,
  onDelete
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  // Ícones para diferentes tipos de notificações
  const getIcon = () => {
    switch (notification.type) {
      case 'system':
        return <Bell className="h-5 w-5 text-blue-500" />;
      case 'exchange':
        return <PaperclipIcon className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'message':
        return <MessageSquare className="h-5 w-5 text-purple-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };
  
  return (
    <div className={cn(
      "p-4 rounded-lg mb-3 transition-colors",
      notification.read 
        ? "bg-card hover:bg-accent/50" 
        : "bg-accent/20 hover:bg-accent/30"
    )}>
      <div className="flex gap-3">
        <div className="mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-start justify-between">
            <h3 className={cn(
              "font-medium leading-none",
              !notification.read && "font-semibold"
            )}>
              {notification.title}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(notification.created_at), { 
                  addSuffix: true,
                  locale: ptBR 
                })}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {notification.message}
          </p>
          
          {notification.data && Object.keys(notification.data).length > 0 && (
            <div className="mt-2 p-2 rounded bg-muted text-xs">
              <pre className="whitespace-pre-wrap text-muted-foreground overflow-hidden">
                {typeof notification.data === 'object' 
                  ? JSON.stringify(notification.data, null, 2) 
                  : String(notification.data)
                }
              </pre>
            </div>
          )}
          
          <div className="flex items-center justify-between mt-3">
            {notification.link && (
              <a 
                href={notification.link} 
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Ver detalhes
              </a>
            )}
            
            <div className="flex gap-2 ml-auto">
              {!notification.read && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2 text-xs"
                  onClick={() => onMarkAsRead(notification.id)}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Marcar como lida
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => onDelete(notification.id)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Excluir
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente para exibir quando não há notificações
const EmptyNotifications = ({ type }: { type: string }) => {
  let title = 'Nenhuma notificação';
  let description = 'Você não tem notificações no momento.';
  let icon = <Bell className="h-12 w-12 text-muted-foreground opacity-50" />;
  
  if (type === 'unread') {
    title = 'Sem notificações não lidas';
    description = 'Todas as suas notificações foram lidas.';
    icon = <BookOpenCheck className="h-12 w-12 text-muted-foreground opacity-50" />;
  } else if (type === 'filtered') {
    title = 'Nenhuma notificação corresponde aos filtros';
    description = 'Tente ajustar os critérios de busca ou filtros.';
    icon = <Filter className="h-12 w-12 text-muted-foreground opacity-50" />;
  }
  
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon}
      <h3 className="mt-4 text-lg font-medium">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
};

const Search = ({ className, ...props }: React.ComponentProps<'svg'>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('lucide lucide-search', className)}
    {...props}
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

// Página principal de Notificações
const NotificationsPage: React.FC = () => {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    deleteNotification, 
    clearAllNotifications, 
    markAllAsRead, 
    isLoading, 
    refreshNotifications 
  } = useNotifications();
  
  const isOnline = useOnlineStatus();
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    unread: false,
    read: false,
    system: false,
    exchange: false,
    error: false,
    today: false,
    week: false,
    month: false
  });
  
  // Atualiza as notificações quando a página carrega
  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);
  
  // Manipuladores de eventos
  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id);
      toast({
        description: "Notificação marcada como lida",
      });
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
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
      toast({
        description: "Notificação excluída",
      });
    } catch (error) {
      console.error('Erro ao excluir notificação:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível excluir a notificação",
      });
    }
  };
  
  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      toast({
        description: "Todas as notificações foram marcadas como lidas",
      });
    } catch (error) {
      console.error('Erro ao marcar todas notificações como lidas:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível marcar todas as notificações como lidas",
      });
    }
  };
  
  const handleClearAll = async () => {
    if (window.confirm('Tem certeza que deseja excluir todas as notificações? Esta ação não pode ser desfeita.')) {
      try {
        await clearAllNotifications();
        toast({
          description: "Todas as notificações foram excluídas",
        });
      } catch (error) {
        console.error('Erro ao excluir todas as notificações:', error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível excluir todas as notificações",
        });
      }
    }
  };
  
  const handleFilterChange = (key: string, value: boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const handleClearFilters = () => {
    setFilters({
      unread: false,
      read: false,
      system: false,
      exchange: false,
      error: false,
      today: false,
      week: false,
      month: false
    });
    setSearchTerm('');
  };
  
  // Filtra notificações com base nos critérios selecionados
  const filterNotifications = (notificationList: Notification[]) => {
    let filtered = notificationList;
    
    // Filtrar por aba selecionada
    if (activeTab === 'unread') {
      filtered = filtered.filter(n => !n.read);
    }
    
    // Filtrar por status de leitura
    if (filters.unread && !filters.read) {
      filtered = filtered.filter(n => !n.read);
    } else if (!filters.unread && filters.read) {
      filtered = filtered.filter(n => n.read);
    }
    
    // Filtrar por tipo
    if (filters.system || filters.exchange || filters.error) {
      filtered = filtered.filter(n => 
        (filters.system && n.type === 'system') ||
        (filters.exchange && n.type === 'exchange') ||
        (filters.error && (n.type === 'error' || n.type === 'warning'))
      );
    }
    
    // Filtrar por período
    const now = new Date();
    if (filters.today) {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(n => new Date(n.created_at) >= startOfDay);
    } else if (filters.week) {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      filtered = filtered.filter(n => new Date(n.created_at) >= startOfWeek);
    } else if (filters.month) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter(n => new Date(n.created_at) >= startOfMonth);
    }
    
    // Filtrar por termo de busca
    if (searchTerm.trim() !== '') {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(search) ||
        n.message.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  };
  
  const filteredNotifications = filterNotifications(notifications);
  const hasNotifications = notifications.length > 0;
  const hasFilteredNotifications = filteredNotifications.length > 0;
  
  return (
    <div className="container py-6 max-w-5xl">
      <NotificationsHeader 
        onMarkAllAsRead={handleMarkAllAsRead}
        onClearAll={handleClearAll}
        isLoading={isLoading}
        hasNotifications={hasNotifications}
        unreadCount={unreadCount}
      />
      
      <NotificationFilters 
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
      />
      
      {!isOnline && (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Você está offline</AlertTitle>
          <AlertDescription>
            Algumas funcionalidades podem estar limitadas. As mudanças serão sincronizadas quando você estiver online novamente.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="mb-6">
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-between items-center border-b">
            <TabsList className="w-auto">
              <TabsTrigger value="all" className="px-4">
                Todas
                {notifications.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {notifications.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="unread" className="px-4">
                Não lidas
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-1"
              onClick={refreshNotifications}
              disabled={isLoading}
            >
              <RotateCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
          
          <TabsContent value="all" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <RotateCw className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Carregando notificações...</span>
              </div>
            ) : !hasNotifications ? (
              <EmptyNotifications type="all" />
            ) : !hasFilteredNotifications ? (
              <EmptyNotifications type="filtered" />
            ) : (
              <ScrollArea className="h-[calc(100vh-400px)] pr-4">
                <div className="space-y-1">
                  {filteredNotifications.map(notification => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkAsRead={handleMarkAsRead}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
          
          <TabsContent value="unread" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <RotateCw className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Carregando notificações...</span>
              </div>
            ) : unreadCount === 0 ? (
              <EmptyNotifications type="unread" />
            ) : !hasFilteredNotifications ? (
              <EmptyNotifications type="filtered" />
            ) : (
              <ScrollArea className="h-[calc(100vh-400px)] pr-4">
                <div className="space-y-1">
                  {filteredNotifications
                    .filter(n => !n.read)
                    .map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkAsRead={handleMarkAsRead}
                        onDelete={handleDelete}
                      />
                    ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      {notifications.length > 0 && filteredNotifications.length > 0 && (
        <div className="flex justify-between items-center text-sm text-muted-foreground border-t pt-4">
          <div>
            Exibindo {filteredNotifications.length} de {notifications.length} notificações
          </div>
          <div>
            <Button 
              variant="link" 
              size="sm" 
              onClick={refreshNotifications}
              className="text-xs"
            >
              Atualizar lista
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage; 