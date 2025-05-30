import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  supabase, 
  testSupabaseConnection,
  measureSupabaseLatency,
  type SupabaseTestResult,
  checkIfUserIsAdmin
} from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { useNavigate } from 'react-router-dom';
import { OfflineManager, useOnlineStatus } from '@/lib/offlineManager';
import { Loader2, RotateCw } from 'lucide-react';
import { AlertCircle } from 'lucide-react';
import { clearRecursionDiagnostics } from '@/lib/recursionGuard';

// Função para reinicializar o cliente Supabase em caso de problemas
const resetSupabaseClient = async () => {
  console.log('===== TENTATIVA DE REINICIALIZAÇÃO DO CLIENTE SUPABASE =====');
  
  try {
    // Recuperar as variáveis de ambiente novamente
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Erro: Variáveis de ambiente ainda não estão disponíveis');
      toast.error('Erro na configuração do Supabase. Verifique as variáveis de ambiente.');
      return false;
    }
    
    console.log('API URL:', supabaseUrl);
    console.log('API Key length:', supabaseKey.length);
    
    // Limpar o cache de autenticação
    try {
      localStorage.removeItem('sb-auth-token');
      localStorage.removeItem('sb-auth-token-code-verifier');
      localStorage.removeItem('auth_contingency_in_progress');
      console.log('Cache de autenticação limpo');
    } catch (e) {
      console.error('Erro ao limpar cache:', e);
    }
    
    // Atualizar headers globais para incluir a API key
    supabase.headers = {
      ...supabase.headers,
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    };
    
    // Verificar se o cliente foi reinicializado corretamente com um teste simples
    const { error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Erro após reinicialização do cliente:', error);
      toast.error('Erro ao conectar com o Supabase: ' + error.message);
      return false;
    }
    
    console.log('Cliente Supabase reinicializado com sucesso');
    toast.success('Conexão com o Supabase restabelecida');
    return true;
  } catch (e) {
    console.error('Erro crítico ao reinicializar cliente Supabase:', e);
    toast.error('Erro ao reinicializar cliente Supabase');
    return false;
  }
};

// Verifica as configurações do Supabase no ambiente
const checkSupabaseConfig = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  const hasUrl = !!url;
  const hasKey = !!key;
  const urlMasked = hasUrl ? `${url.substring(0, 8)}...${url.substring(url.length - 8)}` : 'Não configurado';
  const keyMasked = hasKey ? `${key.substring(0, 6)}...${key.substring(key.length - 6)}` : 'Não configurado';
  
  return {
    hasUrl,
    hasKey,
    urlMasked,
    keyMasked,
    isConfigured: hasUrl && hasKey,
    config: {
      url: urlMasked,
      key: keyMasked
    }
  };
};

// Componente para resolver problemas de login
const LoginTroubleshooting = () => {
  const { resetSupabaseClient } = useAuth();
  const [isResetting, setIsResetting] = useState(false);
  
  const handleResetClient = async () => {
    setIsResetting(true);
    try {
      await resetSupabaseClient();
      toast.success('Cliente Supabase reinicializado. Tente fazer login novamente.');
    } catch (error) {
      console.error('Erro ao reiniciar cliente:', error);
      toast.error('Erro ao reiniciar cliente');
    } finally {
      setIsResetting(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Soluções para Problemas de Login</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTitle>Está tendo problemas para fazer login?</AlertTitle>
          <AlertDescription>
            Listamos abaixo as principais soluções para problemas comuns de login.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-2">1. Reinicializar o cliente</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Isso pode resolver problemas de API key, timeout ou configuração.
            </p>
            <Button 
              onClick={handleResetClient} 
              disabled={isResetting}
            >
              {isResetting ? 'Reinicializando...' : 'Reinicializar Cliente Supabase'}
            </Button>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">2. Limpar o cache do navegador</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Problemas de cookie ou armazenamento local podem afetar o login.
            </p>
            <Button 
              onClick={clearLocalCache} 
              variant="outline"
            >
              Limpar Cache Local
            </Button>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">3. Verificar a conexão</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Problemas de rede podem causar timeouts durante o login.
            </p>
            <Button 
              onClick={runConnectionTest} 
              variant="outline"
            >
              Testar Conexão
            </Button>
          </div>
          
          <Alert variant="warning">
            <AlertTitle>Ainda não consegue entrar?</AlertTitle>
            <AlertDescription>
              <ol className="list-decimal pl-5 space-y-1 mt-2">
                <li>Verifique se você está usando o email e senha corretos</li>
                <li>Tente usar uma rede de internet diferente</li>
                <li>Desative extensões de bloqueio de cookies e rastreamento</li>
                <li>Tente um navegador diferente</li>
                <li>Se o problema persistir, entre em contato com o suporte técnico</li>
              </ol>
            </AlertDescription>
          </Alert>
          
          <div className="bg-muted p-4 rounded-md">
            <h4 className="font-semibold mb-2">Mensagens comuns de erro:</h4>
            <ul className="space-y-2">
              <li>
                <Badge variant="outline">Timeout ao buscar dados do usuário</Badge>
                <p className="text-sm mt-1">Problema de conexão com o banco de dados. Reinicie o cliente e tente novamente.</p>
              </li>
              <li>
                <Badge variant="outline">No API key found</Badge>
                <p className="text-sm mt-1">Problema com a autenticação da API. Use o botão de reiniciar cliente.</p>
              </li>
              <li>
                <Badge variant="outline">JWT expired</Badge>
                <p className="text-sm mt-1">O token de autenticação expirou. Limpe o cache e tente novamente.</p>
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Adicionar nova seção para Diagnóstico de Sincronização
function SynchronizationStatus() {
  const isOnline = useOnlineStatus();
  const [pendingOperations, setPendingOperations] = useState([]);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  useEffect(() => {
    // Atualiza a lista de operações pendentes a cada 5 segundos
    const timer = setInterval(() => {
      const operations = OfflineManager.getPendingOperations();
      setPendingOperations(operations);
    }, 5000);
    
    // Carrega a lista inicial
    setPendingOperations(OfflineManager.getPendingOperations());
    
    return () => clearInterval(timer);
  }, []);
  
  const handleForceSync = async () => {
    if (!isOnline) {
      toast({
        title: "Erro de sincronização",
        description: "Você está offline. Não é possível sincronizar.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSyncing(true);
      setSyncStatus('syncing');
      
      const result = await OfflineManager.synchronize();
      
      setLastSync(new Date());
      setSyncStatus('success');
      toast({
        title: "Sincronização concluída",
        description: `${result.success} operações sincronizadas, ${result.failed} falhas.`,
        variant: result.failed > 0 ? "destructive" : "default",
      });
      
      // Atualiza a lista após a sincronização
      setPendingOperations(OfflineManager.getPendingOperations());
    } catch (error) {
      setSyncStatus('error');
      console.error('Erro ao sincronizar:', error);
      toast({
        title: "Erro de sincronização",
        description: "Ocorreu um erro ao sincronizar os dados. Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };
  
  const handleClearQueue = () => {
    if (window.confirm('Tem certeza que deseja limpar todas as operações pendentes? Esta ação não pode ser desfeita.')) {
      OfflineManager.clearQueue();
      setPendingOperations([]);
      toast({
        title: "Fila limpa",
        description: "Todas as operações pendentes foram removidas.",
      });
    }
  };
  
  // Agrupar operações por tipo
  const operationsByType = pendingOperations.reduce((acc, op) => {
    const type = op.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(op);
    return acc;
  }, {});
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Estado de Sincronização</h3>
        <Badge variant={isOnline ? "default" : "outline"}>
          {isOnline ? "Online" : "Offline"}
        </Badge>
      </div>
      
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Operações Pendentes</CardTitle>
            <CardDescription>
              Operações que serão sincronizadas quando você estiver online
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingOperations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma operação pendente</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(operationsByType).map(([type, operations]) => (
                  <div key={type} className="space-y-2">
                    <h4 className="text-sm font-medium">{type.toUpperCase()} ({operations.length})</h4>
                    <ul className="space-y-1">
                      {operations.slice(0, 5).map((op) => (
                        <li key={op.id} className="text-xs text-muted-foreground flex items-center justify-between">
                          <span>
                            {op.table}: {new Date(op.createdAt).toLocaleString()}
                          </span>
                          <Badge 
                            variant={op.status === 'failed' ? "destructive" : "outline"}
                            className="text-[10px]"
                          >
                            {op.status} {op.retries > 0 && `(${op.retries})`}
                          </Badge>
                        </li>
                      ))}
                      {operations.length > 5 && (
                        <li className="text-xs text-muted-foreground text-center">
                          + {operations.length - 5} outras operações
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearQueue}
              disabled={pendingOperations.length === 0}
            >
              Limpar Fila
            </Button>
            <div className="text-xs text-muted-foreground">
              Total: {pendingOperations.length} operações
            </div>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Sincronização Manual</CardTitle>
            <CardDescription>
              Force a sincronização de operações pendentes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status:</span>
                <Badge variant={
                  syncStatus === 'idle' ? "outline" : 
                  syncStatus === 'syncing' ? "default" : 
                  syncStatus === 'success' ? "success" : "destructive"
                }>
                  {syncStatus === 'idle' ? "Aguardando" : 
                   syncStatus === 'syncing' ? "Sincronizando" : 
                   syncStatus === 'success' ? "Sincronizado" : "Erro"}
                </Badge>
              </div>
              
              {lastSync && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Última sincronização:</span>
                  <span className="text-xs text-muted-foreground">
                    {lastSync.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Dica</AlertTitle>
              <AlertDescription>
                A sincronização acontece automaticamente quando você fica online, mas você também pode forçá-la manualmente.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleForceSync} 
              disabled={!isOnline || isSyncing || pendingOperations.length === 0}
              className="w-full"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RotateCw className="mr-2 h-4 w-4" />
                  Forçar Sincronização
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

const DiagnosticsPage: React.FC = () => {
  const { user, isAdmin, isAuthenticated, resetSupabaseClient } = useAuth();
  const navigate = useNavigate();
  const [connectionStatus, setConnectionStatus] = useState<{success: boolean, message: string, latency: number, details: string} | null>(null);
  const [configTest, setConfigTest] = useState<SupabaseTestResult | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('connection');
  const [cacheClear, setCacheClear] = useState<boolean>(false);
  const [envVars, setEnvVars] = useState<{[key: string]: string}>({});
  const [adminStatus, setAdminStatus] = useState<boolean | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [supabaseConfig, setSupabaseConfig] = useState(checkSupabaseConfig());
  const [localStorageContent, setLocalStorageContent] = useState<Record<string, any>>({});
  const [hasAttemptedFix, setHasAttemptedFix] = useState(false);
  const [fixResults, setFixResults] = useState<string[]>([]);

  // Função para executar teste de conexão
  const runConnectionTest = async () => {
    setIsLoading(true);
    const result = await testSupabaseConnection();
    setConnectionStatus(result);
    setIsLoading(false);
  };

  // Testar configuração do Supabase
  const testConfig = async () => {
    setIsTestingConfig(true);
    setConfigTestResult(null);
    try {
      // Corrigir a chamada para usar checkSupabaseConfig
      const result = checkSupabaseConfig(); 
      setConfigTestResult(result);
    } catch (error) {
       console.error("Erro ao verificar config:", error);
       // Tratar erro se necessário
    } finally {
      setIsTestingConfig(false);
    }
  };

  // Medir a latência da conexão
  const checkLatency = async () => {
    setIsLoading(true);
    try {
      const latencyMs = await measureSupabaseLatency();
      setLatency(latencyMs);
      toast.success('Medição de latência concluída');
    } catch (error) {
      console.error('Erro ao medir latência:', error);
      toast.error('Erro ao verificar latência');
    } finally {
      setIsLoading(false);
    }
  };

  // Verificar status de administrador
  const checkAdminStatus = async () => {
    setIsLoading(true);
    try {
      const isAdmin = await checkIfUserIsAdmin(user?.id || '');
      setAdminStatus(isAdmin);
    } catch (error) {
      console.error('Erro ao verificar status de admin:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Limpar cache local
  const clearLocalCache = () => {
    try {
      // Limpar localStorage relacionado ao Supabase
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-'))) {
          keys.push(key);
        }
      }
      
      keys.forEach(key => localStorage.removeItem(key));
      
      // Limpar auth_contingency_in_progress
      localStorage.removeItem('auth_contingency_in_progress');
      
      setCacheClear(true);
      setTimeout(() => setCacheClear(false), 2000);
      
      toast.success(`${keys.length} itens de cache removidos`);
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
      toast.error('Erro ao limpar cache local');
    }
  };

  // Função para reiniciar cliente Supabase
  const handleResetClient = async () => {
    try {
      setIsResetting(true);
      await resetSupabaseClient();
      alert('Cliente Supabase reiniciado com sucesso.');
      // Executar teste de conexão para verificar se funcionou
      runConnectionTest();
    } catch (error) {
      console.error('Erro ao reiniciar cliente:', error);
      alert(`Erro ao reiniciar cliente: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setIsResetting(false);
    }
  };

  // Verificar todos os aspectos quando a página carrega
  useEffect(() => {
    // Este diagnóstico deve funcionar mesmo sem login para ajudar a resolver problemas 
    // de conexão que impedem o login
    testConfig();
    
    if (isAuthenticated && isAdmin) {
      runConnectionTest();
      checkLatency();
      checkAdminStatus();
    }
  }, [isAuthenticated, isAdmin]);

  useEffect(() => {
    loadLocalStorageContent();
  }, []);
  
  const loadLocalStorageContent = () => {
    const content: Record<string, any> = {};
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          try {
            const value = localStorage.getItem(key);
            if (value) {
              try {
                content[key] = JSON.parse(value);
              } catch {
                content[key] = value;
              }
            }
          } catch (e) {
            content[key] = "Error reading value";
          }
        }
      }
    } catch (e) {
      console.error("Error loading localStorage:", e);
    }
    
    setLocalStorageContent(content);
  };
  
  const clearAllStorage = () => {
    if (confirm('Isso limpará todos os dados do navegador. Você precisará fazer login novamente. Continuar?')) {
      localStorage.clear();
      sessionStorage.clear();
      loadLocalStorageContent();
      setFixResults(['Todos os dados do navegador foram limpos. Você será redirecionado para a página de login.']);
      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
    }
  };
  
  const detectRecursionIssues = () => {
    const issues: string[] = [];
    
    // Verificar erros de recursão registrados
    const recursionErrors = localStorageContent['recursion_errors'];
    if (recursionErrors && Array.isArray(recursionErrors) && recursionErrors.length > 0) {
      issues.push(`Detectados ${recursionErrors.length} erros de recursão.`);
    }
    
    // Verificar item de inicialização de notificações
    if (localStorageContent['notifications_initializing'] === 'true') {
      issues.push('Sistema de notificações travado em estado de inicialização.');
    }
    
    // Verificar estado de recuperação
    if (localStorageContent['recovery_mode'] === 'true') {
      issues.push('Aplicação está em modo de recuperação.');
    }
    
    return issues;
  };
  
  const attemptAutoFix = () => {
    const results: string[] = [];
    
    // Limpar flags de inicialização
    if (localStorage.getItem('notifications_initializing') === 'true') {
      localStorage.removeItem('notifications_initializing');
      results.push('Removido flag de inicialização de notificações.');
    }
    
    // Limpar sinalizadores de recursão
    clearRecursionDiagnostics();
    results.push('Dados de diagnóstico de recursão limpos.');
    
    // Desativar modo de recuperação
    if (localStorage.getItem('recovery_mode') === 'true') {
      localStorage.removeItem('recovery_mode');
      results.push('Modo de recuperação desativado.');
    }
    
    setHasAttemptedFix(true);
    setFixResults(results);
    loadLocalStorageContent();
  };
  
  const issues = detectRecursionIssues();

  // Qualquer pessoa pode acessar esta página para diagnóstico
  return (
    <div className="container space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Diagnóstico do Sistema</h2>
          <p className="text-muted-foreground">
            Ferramentas para verificar e resolver problemas no sistema
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="connection">
        <TabsList>
          <TabsTrigger value="connection">Conexão</TabsTrigger>
          <TabsTrigger value="sync">Sincronização</TabsTrigger>
          <TabsTrigger value="login">Problemas de Login</TabsTrigger>
        </TabsList>
        
        <TabsContent value="connection" className="space-y-4">
          <ConnectionTest />
        </TabsContent>
        
        <TabsContent value="sync" className="space-y-4">
          <SynchronizationStatus />
        </TabsContent>
        
        <TabsContent value="login" className="space-y-4">
          <LoginTroubleshooting />
        </TabsContent>
      </Tabs>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Problemas Detectados</CardTitle>
            <CardDescription>Lista de problemas encontrados no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {issues.length > 0 ? (
              <div className="space-y-2">
                {issues.map((issue, index) => (
                  <div key={index} className="p-3 bg-red-50 text-red-700 rounded-md">
                    {issue}
                  </div>
                ))}
                
                <div className="mt-4">
                  <Button 
                    onClick={attemptAutoFix} 
                    variant="default"
                    disabled={hasAttemptedFix && fixResults.length === 0}
                  >
                    Corrigir Automaticamente
                  </Button>
                </div>
                
                {hasAttemptedFix && (
                  <div className="mt-4 space-y-2">
                    <h3 className="font-medium">Resultados da correção:</h3>
                    {fixResults.map((result, index) => (
                      <div key={index} className="p-2 bg-green-50 text-green-700 rounded-md">
                        {result}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-green-50 text-green-700 rounded-md">
                Nenhum problema detectado no momento.
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Ações de Recuperação</CardTitle>
            <CardDescription>Ações para recuperar o sistema em caso de problemas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={loadLocalStorageContent} variant="outline" className="w-full">
              Atualizar Dados
            </Button>
            
            <Button 
              onClick={() => {
                localStorage.removeItem('sb-auth-token');
                localStorage.removeItem('sb-refresh-token');
                loadLocalStorageContent();
                setFixResults(['Sessão de autenticação encerrada.']);
              }} 
              variant="outline" 
              className="w-full"
            >
              Limpar Dados de Autenticação
            </Button>
            
            <Button onClick={clearAllStorage} variant="destructive" className="w-full">
              Limpar Todos os Dados
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Dados do LocalStorage</CardTitle>
          <CardDescription>Inspeção do armazenamento local</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-slate-50 p-4 rounded overflow-auto max-h-[400px] text-xs">
            {JSON.stringify(localStorageContent, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

export default DiagnosticsPage; 