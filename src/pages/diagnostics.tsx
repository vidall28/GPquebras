import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  supabase, 
  testSupabaseConnection, 
  measureSupabaseLatency, 
  ADMIN_EMAILS,
  testSupabaseConfig,
  type SupabaseTestResult
} from '@/lib/supabase';
import { toast } from '@/lib/toast';

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

const DiagnosticsPage: React.FC = () => {
  const { user, isAdmin, isAuthenticated } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<any>(null);
  const [configTest, setConfigTest] = useState<SupabaseTestResult | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('connection');
  const [cacheClear, setCacheClear] = useState<boolean>(false);
  const [envVars, setEnvVars] = useState<{[key: string]: string}>({});

  // Executar diagnóstico de conexão
  const runConnectionTest = async () => {
    setIsLoading(true);
    try {
      const results = await testSupabaseConnection();
      setConnectionStatus(results);
      toast.success('Diagnóstico de conexão concluído');
    } catch (error) {
      console.error('Erro ao realizar diagnóstico:', error);
      toast.error('Erro ao testar conexão com o Supabase');
    } finally {
      setIsLoading(false);
    }
  };

  // Testar configuração do Supabase
  const testConfig = async () => {
    setIsLoading(true);
    try {
      // Capturar variáveis de ambiente disponíveis para diagnóstico
      const env: {[key: string]: string} = {};
      Object.keys(import.meta.env).forEach(key => {
        if (key.startsWith('VITE_')) {
          // Ocultar parte do valor para segurança, mostrando apenas início e fim
          const value = import.meta.env[key];
          if (typeof value === 'string' && value.length > 10) {
            env[key] = `${value.substring(0, 5)}...${value.substring(value.length - 5)}`;
          } else if (typeof value === 'string') {
            env[key] = `${value.substring(0, 2)}...`;
          } else {
            env[key] = typeof value;
          }
        }
      });
      
      setEnvVars(env);
      
      const result = await testSupabaseConfig();
      setConfigTest(result);
      
      if (result.success) {
        toast.success('Configuração do Supabase está correta');
      } else {
        toast.error(`Problema na configuração: ${result.message}`);
      }
    } catch (error) {
      console.error('Erro ao testar configuração:', error);
      toast.error('Erro ao testar configuração do Supabase');
    } finally {
      setIsLoading(false);
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
      // Verificar se é admin via email
      const isAdminByEmail = user?.email && ADMIN_EMAILS.includes(user.email);
      
      // Verificar via RPC
      let adminByRpc = false;
      try {
        const { data: adminCheck } = await supabase.rpc('check_if_admin', {
          user_id: user?.id 
        });
        adminByRpc = adminCheck === true;
      } catch (rpcError) {
        console.error("Erro ao verificar status de admin via RPC:", rpcError);
      }

      // Verificar via tabela de usuários
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user?.id || '')
        .single();

      setUserData({
        id: user?.id,
        email: user?.email,
        name: user?.name,
        role: user?.role,
        roleInDatabase: userData?.role || 'não encontrado',
        isAdminByEmail,
        isAdminByRpc: adminByRpc,
        isAdminInContext: isAdmin,
        adminEmails: ADMIN_EMAILS,
      });

      toast.success('Verificação de status de administrador concluída');
    } catch (error) {
      console.error('Erro ao verificar status de administrador:', error);
      toast.error('Erro ao verificar status de administrador');
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

  // Qualquer pessoa pode acessar esta página para diagnóstico
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-6">Diagnóstico do Sistema</h1>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="config">Configuração</TabsTrigger>
          <TabsTrigger value="connection">Conexão</TabsTrigger>
          <TabsTrigger value="admin">Status Admin</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
        </TabsList>
        
        {/* Aba de configuração do Supabase */}
        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>Configuração do Supabase</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4 mb-4">
                <Button onClick={testConfig} disabled={isLoading}>
                  {isLoading ? 'Testando...' : 'Testar Configuração'}
                </Button>
                
                <Button 
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      const reset = await resetSupabaseClient();
                      if (reset) {
                        // Testar a configuração novamente
                        await testConfig();
                      }
                    } catch (error) {
                      console.error('Erro ao reinicializar cliente:', error);
                      toast.error('Erro ao reinicializar cliente Supabase');
                    } finally {
                      setIsLoading(false);
                    }
                  }} 
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? 'Reinicializando...' : 'Reinicializar Cliente'}
                </Button>
              </div>
              
              {configTest && (
                <div>
                  <div className="mb-4">
                    <Alert variant={configTest.success ? "success" : "destructive"}>
                      <AlertTitle>{configTest.success ? 'Configuração OK' : 'Problema de Configuração'}</AlertTitle>
                      <AlertDescription>
                        {configTest.message}
                      </AlertDescription>
                    </Alert>
                  </div>
                  
                  <div className="mt-4">
                    <p className="font-semibold mb-2">Detalhes da Configuração:</p>
                    <div className="bg-muted p-3 rounded-md overflow-auto max-h-[200px]">
                      <p className="text-sm font-mono">URL do Supabase: {configTest.details.supabaseUrl}</p>
                      <p className="text-sm font-mono">API Key definida: {configTest.details.apiKeyDefined ? 'Sim' : 'Não'}</p>
                      <p className="text-sm font-mono">Comprimento da API Key: {configTest.details.apiKeyLength} caracteres</p>
                      
                      {configTest.details.error && (
                        <div className="mt-2 text-destructive">
                          <p className="font-semibold">Erro:</p>
                          <p className="text-sm">{configTest.details.error.message}</p>
                          <p className="text-sm">{configTest.details.error.hint}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <p className="font-semibold mb-2">Variáveis de Ambiente:</p>
                    <div className="bg-muted p-3 rounded-md overflow-auto max-h-[200px]">
                      {Object.keys(envVars).map(key => (
                        <p key={key} className="text-sm font-mono">
                          {key}: {envVars[key]}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Aba de diagnóstico de conexão */}
        <TabsContent value="connection">
          <Card>
            <CardHeader>
              <CardTitle>Status de Conexão</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4 mb-4">
                <Button onClick={runConnectionTest} disabled={isLoading}>
                  {isLoading ? 'Testando...' : 'Testar Conexão'}
                </Button>
                <Button onClick={checkLatency} disabled={isLoading} variant="outline">
                  {isLoading ? 'Verificando...' : 'Medir Latência'}
                </Button>
              </div>
              
              {latency !== null && (
                <div className="mb-4">
                  <p className="font-semibold">Latência:</p>
                  <Badge variant={latency < 500 ? "success" : latency < 1000 ? "warning" : "destructive"}>
                    {latency < 0 ? 'Erro ao medir' : `${latency}ms`}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-1">
                    {latency < 300 ? 'Excelente' : 
                     latency < 500 ? 'Boa' : 
                     latency < 1000 ? 'Regular' : 
                     'Ruim - Pode causar timeouts'}
                  </p>
                </div>
              )}
              
              {connectionStatus && (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="font-semibold mb-1">Autenticação:</p>
                      <Badge variant={connectionStatus.authStatus ? "success" : "destructive"}>
                        {connectionStatus.authStatus ? 'OK' : 'Falha'}
                      </Badge>
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Banco de Dados:</p>
                      <Badge variant={connectionStatus.dbStatus ? "success" : "destructive"}>
                        {connectionStatus.dbStatus ? 'OK' : 'Falha'}
                      </Badge>
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Tabela de Usuários:</p>
                      <Badge variant={connectionStatus.userTableStatus ? "success" : "destructive"}>
                        {connectionStatus.userTableStatus ? 'OK' : 'Falha'}
                      </Badge>
                    </div>
                    <div>
                      <p className="font-semibold mb-1">Armazenamento:</p>
                      <Badge variant={connectionStatus.storageStatus ? "success" : "destructive"}>
                        {connectionStatus.storageStatus ? 'OK' : 'Falha'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <p className="font-semibold mb-2">Detalhes:</p>
                    <div className="bg-muted p-3 rounded-md overflow-auto max-h-[300px]">
                      {connectionStatus.details.map((detail: string, index: number) => (
                        <p key={index} className="text-sm font-mono">
                          {detail}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Aba de status de administrador */}
        <TabsContent value="admin">
          <Card>
            <CardHeader>
              <CardTitle>Status de Administrador</CardTitle>
            </CardHeader>
            <CardContent>
              {!isAuthenticated ? (
                <Alert>
                  <AlertTitle>Não autenticado</AlertTitle>
                  <AlertDescription>
                    Faça login para verificar seu status de administrador.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Button onClick={checkAdminStatus} disabled={isLoading} className="mb-4">
                    {isLoading ? 'Verificando...' : 'Verificar Status Admin'}
                  </Button>
                  
                  {userData && (
                    <div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div>
                          <p className="font-semibold">ID:</p>
                          <p className="text-sm font-mono">{userData.id}</p>
                        </div>
                        <div>
                          <p className="font-semibold">Email:</p>
                          <p>{userData.email}</p>
                        </div>
                        <div>
                          <p className="font-semibold">Nome:</p>
                          <p>{userData.name}</p>
                        </div>
                        <div>
                          <p className="font-semibold">Papel na aplicação:</p>
                          <Badge variant={userData.role === 'admin' ? "success" : "default"}>
                            {userData.role}
                          </Badge>
                        </div>
                        <div>
                          <p className="font-semibold">Papel no banco de dados:</p>
                          <Badge variant={userData.roleInDatabase === 'admin' ? "success" : "default"}>
                            {userData.roleInDatabase}
                          </Badge>
                        </div>
                        <div>
                          <p className="font-semibold">Admin por email:</p>
                          <Badge variant={userData.isAdminByEmail ? "success" : "default"}>
                            {userData.isAdminByEmail ? 'Sim' : 'Não'}
                          </Badge>
                        </div>
                        <div>
                          <p className="font-semibold">Admin via RPC:</p>
                          <Badge variant={userData.isAdminByRpc ? "success" : "default"}>
                            {userData.isAdminByRpc ? 'Sim' : 'Não'}
                          </Badge>
                        </div>
                        <div>
                          <p className="font-semibold">Admin no contexto:</p>
                          <Badge variant={userData.isAdminInContext ? "success" : "default"}>
                            {userData.isAdminInContext ? 'Sim' : 'Não'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <p className="font-semibold mb-1">Emails de administradores configurados:</p>
                        <div className="bg-muted p-3 rounded-md">
                          <ul className="text-sm font-mono">
                            {userData.adminEmails.map((email: string, index: number) => (
                              <li key={index}>{email}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Aba de gerenciamento de cache */}
        <TabsContent value="cache">
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Cache</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                Limpar o cache local pode ajudar a resolver problemas de autenticação e sincronização de dados.
              </p>
              
              <Button 
                onClick={clearLocalCache} 
                variant={cacheClear ? "success" : "default"}
                disabled={cacheClear}
              >
                {cacheClear ? 'Cache Limpo!' : 'Limpar Cache Local'}
              </Button>
              
              <div className="mt-4">
                <p className="font-semibold mb-2">Quando limpar o cache:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Quando há problemas persistentes de login</li>
                  <li>Quando seu status de administrador não é reconhecido</li>
                  <li>Quando os dados não são atualizados corretamente</li>
                  <li>Antes de relatar problemas aos desenvolvedores</li>
                </ul>
              </div>
              
              <Alert className="mt-4">
                <AlertTitle>Nota</AlertTitle>
                <AlertDescription>
                  Limpar o cache irá fazer logout da sua sessão atual. Você precisará fazer login novamente.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DiagnosticsPage; 