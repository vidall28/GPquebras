import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  ArrowDown, 
  ArrowUp, 
  Clock, 
  Database, 
  HardDrive, 
  Layers, 
  RotateCw, 
  Server, 
  Signal, 
  Trash2, 
  Wifi, 
  WifiOff,
  LayoutDashboard,
  Save,
  Undo
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { advancedCache } from '@/lib/cache';
import { useOnlineStatus } from '@/lib/offlineManager';
import { useOfflineOperations } from '@/hooks/useOfflineOperations';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { cn } from '@/lib/utils';

type SystemInfo = {
  supabaseStatus: 'online' | 'offline' | 'error' | 'unknown';
  networkLatency: number | null;
  cacheSize: number;
  cacheItems: number;
  offlineMode: boolean;
  pendingOperations: number;
  lastSync: Date | null;
  browserInfo: {
    name: string;
    version: string;
    os: string;
    isMobile: boolean;
    isOnline: boolean;
  };
  deviceInfo: {
    memory: string;
    cores: number;
    storage: {
      quota: string;
      usage: string;
      percentUsed: number;
    } | null;
  };
};

const DiagnosticsPage: React.FC = () => {
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const { operations, stats, synchronize, isLoading: isSyncLoading } = useOfflineOperations();
  
  const [activeTab, setActiveTab] = useState('system');
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    supabaseStatus: 'unknown',
    networkLatency: null,
    cacheSize: 0,
    cacheItems: 0,
    offlineMode: !isOnline,
    pendingOperations: 0,
    lastSync: null,
    browserInfo: {
      name: navigator.userAgent,
      version: '',
      os: navigator.platform,
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      isOnline,
    },
    deviceInfo: {
      memory: 'Desconhecido',
      cores: navigator.hardwareConcurrency || 0,
      storage: null,
    },
  });
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  
  // Coletar informações do sistema
  useEffect(() => {
    const collectSystemInfo = async () => {
      setIsRefreshing(true);
      
      try {
        // Verifique a latência do Supabase
        const startTime = performance.now();
        let supabaseStatus: 'online' | 'offline' | 'error' | 'unknown' = 'unknown';
        let latency: number | null = null;
        
        if (isOnline) {
          try {
            const { data, error } = await supabase.from('health_check').select('*').limit(1).maybeSingle();
            const endTime = performance.now();
            latency = Math.round(endTime - startTime);
            supabaseStatus = error ? 'error' : 'online';
          } catch (e) {
            supabaseStatus = 'error';
          }
        } else {
          supabaseStatus = 'offline';
        }
        
        // Informações de armazenamento
        let storageInfo = null;
        if (navigator.storage && navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          const quota = estimate.quota || 0;
          const usage = estimate.usage || 0;
          const percentUsed = Math.round((usage / quota) * 100);
          
          storageInfo = {
            quota: formatBytes(quota),
            usage: formatBytes(usage),
            percentUsed
          };
        }
        
        // Informações de memória
        let memoryInfo = 'Desconhecido';
        if ((performance as any).memory) {
          memoryInfo = formatBytes((performance as any).memory.totalJSHeapSize);
        }
        
        // Estatísticas de cache
        const cacheStats = advancedCache.getStats();
        
        setSystemInfo({
          supabaseStatus,
          networkLatency: latency,
          cacheSize: cacheStats.totalSize,
          cacheItems: cacheStats.itemCount,
          offlineMode: !isOnline,
          pendingOperations: stats.totalOperations,
          lastSync: stats.lastSyncTime,
          browserInfo: {
            name: getBrowserInfo().name,
            version: getBrowserInfo().version,
            os: getOSInfo(),
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
            isOnline,
          },
          deviceInfo: {
            memory: memoryInfo,
            cores: navigator.hardwareConcurrency || 0,
            storage: storageInfo,
          },
        });
        
        setLastRefreshed(new Date());
      } catch (error) {
        console.error('Erro ao coletar informações de diagnóstico:', error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível coletar informações de diagnóstico.",
        });
      } finally {
        setIsRefreshing(false);
      }
    };
    
    collectSystemInfo();
    
    // Atualizar a cada 60 segundos
    const intervalId = setInterval(collectSystemInfo, 60000);
    return () => clearInterval(intervalId);
  }, [isOnline, toast, stats]);
  
  // Utilitários
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };
  
  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent;
    let name = 'Desconhecido';
    let version = '';
    
    if (userAgent.indexOf('Chrome') > -1) {
      name = 'Chrome';
      version = userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || '';
    } else if (userAgent.indexOf('Firefox') > -1) {
      name = 'Firefox';
      version = userAgent.match(/Firefox\/([0-9.]+)/)?.[1] || '';
    } else if (userAgent.indexOf('Safari') > -1) {
      name = 'Safari';
      version = userAgent.match(/Version\/([0-9.]+)/)?.[1] || '';
    } else if (userAgent.indexOf('Edge') > -1) {
      name = 'Edge';
      version = userAgent.match(/Edge\/([0-9.]+)/)?.[1] || '';
    } else if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident/') > -1) {
      name = 'Internet Explorer';
      version = userAgent.match(/(?:MSIE |rv:)([0-9.]+)/)?.[1] || '';
    }
    
    return { name, version };
  };
  
  const getOSInfo = () => {
    const userAgent = navigator.userAgent;
    
    if (userAgent.indexOf('Windows') > -1) return 'Windows';
    if (userAgent.indexOf('Mac') > -1) return 'macOS';
    if (userAgent.indexOf('Linux') > -1) return 'Linux';
    if (userAgent.indexOf('Android') > -1) return 'Android';
    if (userAgent.indexOf('iOS') > -1 || userAgent.indexOf('iPhone') > -1 || userAgent.indexOf('iPad') > -1) return 'iOS';
    
    return navigator.platform || 'Desconhecido';
  };
  
  const handleClearCache = () => {
    if (window.confirm('Tem certeza que deseja limpar todo o cache? Isso pode afetar o desempenho temporariamente.')) {
      advancedCache.clear();
      toast({
        description: "Cache limpo com sucesso.",
      });
      
      // Atualizar informações
      setSystemInfo(prev => ({
        ...prev,
        cacheSize: 0,
        cacheItems: 0,
      }));
    }
  };
  
  const handleForceSynchronize = async () => {
    if (!isOnline) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não é possível sincronizar quando está offline.",
      });
      return;
    }
    
    try {
      await synchronize();
      toast({
        description: "Sincronização forçada iniciada.",
      });
    } catch (error) {
      console.error('Erro ao forçar sincronização:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível forçar a sincronização.",
      });
    }
  };
  
  const handleRefresh = () => {
    window.location.reload();
  };
  
  return (
    <div className="container py-6 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            Diagnóstico do Sistema
          </h1>
          <p className="text-muted-foreground">
            Monitore o status do sistema e resolva problemas técnicos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-1"
            disabled={isRefreshing}
          >
            <RotateCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            Recarregar Página
          </Button>
          <ConnectionStatus showLabel size="sm" />
        </div>
      </div>
      
      {lastRefreshed && (
        <p className="text-xs text-muted-foreground mb-4">
          Última atualização: {lastRefreshed.toLocaleTimeString()}
        </p>
      )}
      
      <Tabs defaultValue="system" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="system" className="gap-1">
            <Server className="h-4 w-4" />
            <span className="hidden sm:inline">Sistema</span>
          </TabsTrigger>
          <TabsTrigger value="network" className="gap-1">
            <Signal className="h-4 w-4" />
            <span className="hidden sm:inline">Rede</span>
          </TabsTrigger>
          <TabsTrigger value="storage" className="gap-1">
            <HardDrive className="h-4 w-4" />
            <span className="hidden sm:inline">Armazenamento</span>
          </TabsTrigger>
          <TabsTrigger value="operations" className="gap-1">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Operações</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Tab de Visão Geral do Sistema */}
        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-1">
                  <Database className="h-4 w-4" />
                  Status do Banco de Dados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge 
                    className={cn(
                      systemInfo.supabaseStatus === 'online' && "bg-green-500",
                      systemInfo.supabaseStatus === 'offline' && "bg-red-500",
                      systemInfo.supabaseStatus === 'error' && "bg-amber-500",
                      systemInfo.supabaseStatus === 'unknown' && "bg-gray-500"
                    )}
                  >
                    {systemInfo.supabaseStatus === 'online' && 'Online'}
                    {systemInfo.supabaseStatus === 'offline' && 'Offline'}
                    {systemInfo.supabaseStatus === 'error' && 'Erro'}
                    {systemInfo.supabaseStatus === 'unknown' && 'Desconhecido'}
                  </Badge>
                  
                  {systemInfo.networkLatency !== null && (
                    <span className="text-sm">
                      Latência: {systemInfo.networkLatency}ms
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-1">
                  <Wifi className="h-4 w-4" />
                  Status de Conexão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {isOnline ? (
                    <>
                      <Badge className="bg-green-500">Online</Badge>
                      <span className="text-sm">Conectado ao servidor</span>
                    </>
                  ) : (
                    <>
                      <Badge className="bg-red-500">Offline</Badge>
                      <span className="text-sm">Modo offline ativado</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Última Sincronização
                </CardTitle>
              </CardHeader>
              <CardContent>
                {systemInfo.lastSync ? (
                  <span className="text-sm">
                    {systemInfo.lastSync.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Sem sincronização recente
                  </span>
                )}
              </CardContent>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações do Dispositivo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Navegador</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Nome:</div>
                    <div>{systemInfo.browserInfo.name}</div>
                    <div className="text-muted-foreground">Versão:</div>
                    <div>{systemInfo.browserInfo.version}</div>
                    <div className="text-muted-foreground">Sistema Operacional:</div>
                    <div>{systemInfo.browserInfo.os}</div>
                    <div className="text-muted-foreground">Dispositivo Móvel:</div>
                    <div>{systemInfo.browserInfo.isMobile ? 'Sim' : 'Não'}</div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-sm font-medium mb-2">Hardware</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Memória JS Heap:</div>
                    <div>{systemInfo.deviceInfo.memory}</div>
                    <div className="text-muted-foreground">Núcleos de CPU:</div>
                    <div>{systemInfo.deviceInfo.cores}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Status do Aplicativo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Operações Pendentes:</span>
                    <Badge variant={systemInfo.pendingOperations > 0 ? 'default' : 'outline'}>
                      {systemInfo.pendingOperations}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Itens em Cache:</span>
                    <span>{systemInfo.cacheItems}</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tamanho do Cache:</span>
                    <span>{formatBytes(systemInfo.cacheSize)}</span>
                  </div>
                  
                  {systemInfo.deviceInfo.storage && (
                    <div className="space-y-1 mt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Armazenamento:</span>
                        <span>
                          {systemInfo.deviceInfo.storage.usage} / {systemInfo.deviceInfo.storage.quota}
                        </span>
                      </div>
                      <Progress value={systemInfo.deviceInfo.storage.percentUsed} className="h-2" />
                      <p className="text-xs text-right text-muted-foreground">
                        {systemInfo.deviceInfo.storage.percentUsed}% utilizado
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleClearCache}
                    className="gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Limpar Cache
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleForceSynchronize}
                    disabled={!isOnline || isSyncLoading}
                    className="gap-1"
                  >
                    <RotateCw className={cn("h-4 w-4", isSyncLoading && "animate-spin")} />
                    Forçar Sincronização
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Tab de Rede */}
        <TabsContent value="network">
          <Card>
            <CardHeader>
              <CardTitle>Diagnóstico de Rede</CardTitle>
              <CardDescription>
                Informações sobre a conexão e comunicação com o servidor
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between bg-muted p-3 rounded-md">
                <div className="flex items-center gap-2">
                  {isOnline ? (
                    <Wifi className="h-5 w-5 text-green-500" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-red-500" />
                  )}
                  <div>
                    <p className="font-medium">Status de Conectividade</p>
                    <p className="text-sm text-muted-foreground">
                      {isOnline ? 'Conectado à Internet' : 'Sem conexão com a Internet'}
                    </p>
                  </div>
                </div>
                
                {systemInfo.networkLatency !== null && isOnline && (
                  <Badge variant="outline">
                    Latência: {systemInfo.networkLatency}ms
                  </Badge>
                )}
              </div>
              
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Detalhes da Conexão</h3>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recurso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Latência</TableHead>
                      <TableHead>Última Verificação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>API Supabase</TableCell>
                      <TableCell>
                        <Badge 
                          className={cn(
                            systemInfo.supabaseStatus === 'online' && "bg-green-500",
                            systemInfo.supabaseStatus === 'offline' && "bg-red-500",
                            systemInfo.supabaseStatus === 'error' && "bg-amber-500",
                            systemInfo.supabaseStatus === 'unknown' && "bg-gray-500"
                          )}
                        >
                          {systemInfo.supabaseStatus === 'online' && 'Online'}
                          {systemInfo.supabaseStatus === 'offline' && 'Offline'}
                          {systemInfo.supabaseStatus === 'error' && 'Erro'}
                          {systemInfo.supabaseStatus === 'unknown' && 'Desconhecido'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {systemInfo.networkLatency !== null ? `${systemInfo.networkLatency}ms` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {lastRefreshed?.toLocaleTimeString() || 'N/A'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              
              {!isOnline && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Sem Conexão</AlertTitle>
                  <AlertDescription>
                    Você está trabalhando em modo offline. Suas alterações serão sincronizadas automaticamente quando a conexão for restabelecida.
                  </AlertDescription>
                </Alert>
              )}
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRefreshing(true)}
                  disabled={isRefreshing}
                  className="gap-1"
                >
                  <RotateCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                  Verificar Conexão
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tab de Armazenamento */}
        <TabsContent value="storage">
          <Card>
            <CardHeader>
              <CardTitle>Armazenamento Local</CardTitle>
              <CardDescription>
                Informações sobre o uso de armazenamento no dispositivo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {systemInfo.deviceInfo.storage && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Espaço Utilizado</span>
                      <span>
                        {systemInfo.deviceInfo.storage.usage} / {systemInfo.deviceInfo.storage.quota}
                      </span>
                    </div>
                    <Progress value={systemInfo.deviceInfo.storage.percentUsed} className="h-2" />
                    <p className="text-xs text-right text-muted-foreground">
                      {systemInfo.deviceInfo.storage.percentUsed}% utilizado
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Cache do Aplicativo</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-muted-foreground">Itens Armazenados:</div>
                      <div>{systemInfo.cacheItems}</div>
                      <div className="text-muted-foreground">Tamanho Total:</div>
                      <div>{formatBytes(systemInfo.cacheSize)}</div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearCache}
                      className="gap-1"
                    >
                      <Trash2 className="h-4 w-4" />
                      Limpar Cache
                    </Button>
                  </div>
                </div>
              )}
              
              {!systemInfo.deviceInfo.storage && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Informação Indisponível</AlertTitle>
                  <AlertDescription>
                    Não foi possível obter informações de armazenamento neste navegador.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tab de Operações Offline */}
        <TabsContent value="operations">
          <Card>
            <CardHeader>
              <CardTitle>Operações Offline</CardTitle>
              <CardDescription>
                Detalhes das operações pendentes e histórico de sincronização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">Total Operações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalOperations}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">Pendentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.pendingOperations}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">Concluídas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.completedOperations}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-muted-foreground">Falhas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.failedOperations}</div>
                  </CardContent>
                </Card>
              </div>
              
              {stats.pendingOperations > 0 && (
                <Alert variant={isOnline ? "default" : "warning"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Operações Pendentes</AlertTitle>
                  <AlertDescription>
                    {isOnline
                      ? `Você tem ${stats.pendingOperations} operações pendentes de sincronização. Clique em Sincronizar Agora para enviá-las ao servidor.`
                      : `Você tem ${stats.pendingOperations} operações pendentes que serão sincronizadas quando estiver online.`
                    }
                  </AlertDescription>
                </Alert>
              )}
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Lista de Operações</h3>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleForceSynchronize}
                      disabled={!isOnline || isSyncLoading || stats.pendingOperations === 0}
                      className="gap-1 h-8 text-xs"
                    >
                      <RotateCw className={cn("h-3.5 w-3.5", isSyncLoading && "animate-spin")} />
                      Sincronizar Agora
                    </Button>
                  </div>
                </div>
                
                <ScrollArea className="h-[400px] border rounded-md">
                  {operations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-center text-muted-foreground">
                      <LayoutDashboard className="h-8 w-8 mb-2 opacity-20" />
                      <p>Nenhuma operação para exibir</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Tabela</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Criado em</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {operations.map(op => (
                          <TableRow key={op.id}>
                            <TableCell className="font-mono text-xs">
                              {op.id.substring(0, 8)}...
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  op.type === 'insert' && "border-green-500 text-green-600 bg-green-50",
                                  op.type === 'update' && "border-blue-500 text-blue-600 bg-blue-50",
                                  op.type === 'delete' && "border-red-500 text-red-600 bg-red-50"
                                )}
                              >
                                {op.type === 'insert' && (
                                  <ArrowDown className="mr-1 h-3 w-3" />
                                )}
                                {op.type === 'update' && (
                                  <RotateCw className="mr-1 h-3 w-3" />
                                )}
                                {op.type === 'delete' && (
                                  <Trash2 className="mr-1 h-3 w-3" />
                                )}
                                {op.type}
                              </Badge>
                            </TableCell>
                            <TableCell>{op.table}</TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  op.status === 'pending' && "border-amber-500 text-amber-600 bg-amber-50",
                                  op.status === 'processing' && "border-blue-500 text-blue-600 bg-blue-50",
                                  op.status === 'completed' && "border-green-500 text-green-600 bg-green-50",
                                  op.status === 'failed' && "border-red-500 text-red-600 bg-red-50"
                                )}
                              >
                                {op.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(op.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Visualizar detalhes"
                                >
                                  <Save className="h-3.5 w-3.5" />
                                  <span className="sr-only">Visualizar</span>
                                </Button>
                                {op.status === 'failed' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title="Tentar novamente"
                                  >
                                    <Undo className="h-3.5 w-3.5" />
                                    <span className="sr-only">Tentar novamente</span>
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DiagnosticsPage; 