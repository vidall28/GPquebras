import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Check, X, Filter, MailOpen, Trash2 } from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle,
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Alert,
  AlertDescription,
  AlertTitle,
  Switch,
  Separator
} from '@/components/ui';
import { NotificationManager, Notification, NotificationType } from '@/lib/notifications';
import { useAuth } from '@/context/AuthContext';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const { user } = useAuth();

  // Carregar notificações
  useEffect(() => {
    const unsubscribe = NotificationManager.subscribe((updatedNotifications) => {
      setNotifications(updatedNotifications);
      setLoading(false);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Aplicar filtros
  const filteredNotifications = notifications.filter(notification => {
    // Filtro de não lidas
    if (showOnlyUnread && notification.read) {
      return false;
    }
    
    // Filtro por tipo
    if (selectedFilter && notification.type !== selectedFilter) {
      return false;
    }
    
    return true;
  });

  // Agrupar notificações por data
  const groupedNotifications = filteredNotifications.reduce<Record<string, Notification[]>>((groups, notification) => {
    const date = new Date(notification.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let groupKey: string;
    
    if (date.toDateString() === today.toDateString()) {
      groupKey = 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = 'Ontem';
    } else {
      groupKey = date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    
    groups[groupKey].push(notification);
    return groups;
  }, {});

  // Ordenar datas (hoje, ontem, datas mais recentes primeiro)
  const sortedDateGroups = Object.keys(groupedNotifications).sort((a, b) => {
    if (a === 'Hoje') return -1;
    if (b === 'Hoje') return 1;
    if (a === 'Ontem') return -1;
    if (b === 'Ontem') return 1;
    
    const dateA = a.split('/').reverse().join('-');
    const dateB = b.split('/').reverse().join('-');
    return dateB.localeCompare(dateA);
  });

  // Marcar todas as notificações como lidas
  const handleMarkAllAsRead = () => {
    NotificationManager.markAllAsRead();
  };

  // Remover todas as notificações
  const handleClearAll = () => {
    if (window.confirm('Tem certeza que deseja remover todas as notificações?')) {
      NotificationManager.clearAll();
    }
  };

  // Marcar uma notificação como lida
  const handleMarkAsRead = (id: string) => {
    NotificationManager.markAsRead(id);
  };

  // Remover uma notificação
  const handleRemove = (id: string) => {
    NotificationManager.remove(id);
  };

  // Obter ícone para o tipo de notificação
  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case NotificationType.EXCHANGE_ACCEPTED:
        return <Check className="h-5 w-5 text-green-500" />;
      case NotificationType.EXCHANGE_REJECTED:
        return <X className="h-5 w-5 text-red-500" />;
      case NotificationType.EXCHANGE_REQUEST:
        return <MailOpen className="h-5 w-5 text-blue-500" />;
      case NotificationType.SUCCESS:
        return <Check className="h-5 w-5 text-green-500" />;
      case NotificationType.ERROR:
        return <X className="h-5 w-5 text-red-500" />;
      default:
        return null;
    }
  };

  // Obter todas as categorias disponíveis
  const categories = Array.from(new Set(notifications.map(n => n.type)));

  return (
    <>
      <Helmet>
        <title>Notificações | GP Quebras e Trocas</title>
      </Helmet>
      
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
            <p className="text-muted-foreground">
              Gerencie suas notificações e fique por dentro das atualizações
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={handleMarkAllAsRead}
              disabled={!notifications.some(n => !n.read)}
            >
              <Check className="mr-2 h-4 w-4" />
              Marcar todas como lidas
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleClearAll}
              disabled={notifications.length === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Limpar tudo
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-start">
          {/* Filtros */}
          <Card className="w-full md:w-64 md:sticky md:top-20">
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">Apenas não lidas</div>
                  <div className="text-xs text-muted-foreground">
                    Mostrar apenas notificações não lidas
                  </div>
                </div>
                <Switch 
                  checked={showOnlyUnread} 
                  onCheckedChange={setShowOnlyUnread}
                />
              </div>
              
              <Separator />
              
              <div>
                <div className="mb-2 font-medium">Categorias</div>
                <div className="space-y-2">
                  <Button 
                    variant={selectedFilter === null ? "default" : "outline"} 
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setSelectedFilter(null)}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Todas
                  </Button>
                  
                  {categories.map(category => (
                    <Button 
                      key={category}
                      variant={selectedFilter === category ? "default" : "outline"} 
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setSelectedFilter(category)}
                    >
                      {getNotificationIcon(category as NotificationType)}
                      <span className="ml-2">
                        {category === NotificationType.EXCHANGE_REQUEST ? 'Solicitações' : 
                         category === NotificationType.EXCHANGE_ACCEPTED ? 'Aceitas' :
                         category === NotificationType.EXCHANGE_REJECTED ? 'Rejeitadas' :
                         category === NotificationType.PRODUCT_UPDATE ? 'Atualizações' :
                         category === NotificationType.SYSTEM ? 'Sistema' :
                         category}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Lista de notificações */}
          <div className="flex-1 w-full">
            {loading ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="animate-pulse">Carregando notificações...</div>
                </CardContent>
              </Card>
            ) : filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground mb-2">
                    {notifications.length === 0 
                      ? 'Você não tem notificações' 
                      : 'Nenhuma notificação corresponde aos filtros aplicados'}
                  </p>
                  {notifications.length > 0 && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowOnlyUnread(false);
                        setSelectedFilter(null);
                      }}
                    >
                      Limpar filtros
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {sortedDateGroups.map(dateGroup => (
                  <div key={dateGroup}>
                    <h2 className="text-sm font-medium text-muted-foreground mb-3">{dateGroup}</h2>
                    <div className="space-y-3">
                      {groupedNotifications[dateGroup].map(notification => (
                        <Card 
                          key={notification.id} 
                          className={`transition-colors ${!notification.read ? 'bg-accent/30' : ''}`}
                        >
                          <CardHeader className="p-4 pb-2 flex flex-row items-start gap-3">
                            <div className="mt-1">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1">
                              <CardTitle className="text-lg">{notification.title}</CardTitle>
                              <CardDescription className="text-sm">
                                {new Date(notification.createdAt).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </CardDescription>
                            </div>
                          </CardHeader>
                          <CardContent className="p-4 pt-1">
                            <p>{notification.message}</p>
                          </CardContent>
                          <CardFooter className="p-4 pt-2 flex justify-between">
                            <div>
                              {notification.link && (
                                <Button 
                                  variant="ghost" 
                                  onClick={() => {
                                    window.location.href = notification.link!;
                                    NotificationManager.markAsRead(notification.id);
                                  }}
                                  size="sm"
                                >
                                  Ver detalhes
                                </Button>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {!notification.read && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleMarkAsRead(notification.id)}
                                >
                                  <Check className="mr-1 h-4 w-4" />
                                  Marcar como lida
                                </Button>
                              )}
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleRemove(notification.id)}
                              >
                                <Trash2 className="mr-1 h-4 w-4" />
                                Remover
                              </Button>
                            </div>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
} 