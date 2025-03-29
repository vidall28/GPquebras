import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, ShieldCheck, Lock, Database } from 'lucide-react';

// Definições de testes
interface TestResult {
  name: string;
  status: 'success' | 'error' | 'pending';
  message: string;
  details?: any;
}

const DiagnosticsPage = () => {
  const { user, isAdmin } = useAuth();
  const [results, setResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (result: TestResult) => {
    setResults(prev => [...prev, result]);
  };

  const testConnection = async () => {
    try {
      const startTime = Date.now();
      const { data, error } = await supabase.from('products').select('count').limit(1);
      const endTime = Date.now();
      
      if (error) {
        addResult({
          name: 'Conexão com o Supabase',
          status: 'error',
          message: `Erro ao conectar: ${error.message}`,
          details: error
        });
      } else {
        addResult({
          name: 'Conexão com o Supabase',
          status: 'success',
          message: `Conexão estabelecida (${endTime - startTime}ms)`,
          details: data
        });
      }
    } catch (error) {
      addResult({
        name: 'Conexão com o Supabase',
        status: 'error',
        message: `Exceção: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        details: error
      });
    }
  };

  const testSession = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        addResult({
          name: 'Sessão atual',
          status: 'error',
          message: `Erro ao verificar sessão: ${error.message}`,
          details: error
        });
      } else if (!data.session) {
        addResult({
          name: 'Sessão atual',
          status: 'error',
          message: 'Nenhuma sessão ativa encontrada',
          details: data
        });
      } else {
        addResult({
          name: 'Sessão atual',
          status: 'success',
          message: `Sessão ativa (${data.session.user.email})`,
          details: {
            id: data.session.user.id,
            email: data.session.user.email,
            expiresAt: new Date(data.session.expires_at * 1000).toLocaleString()
          }
        });
      }
    } catch (error) {
      addResult({
        name: 'Sessão atual',
        status: 'error',
        message: `Exceção: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        details: error
      });
    }
  };

  const testUserPermissions = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        addResult({
          name: 'Permissões do usuário',
          status: 'error',
          message: 'Não há sessão ativa para testar permissões',
          details: null
        });
        return;
      }
      
      const userId = sessionData.session.user.id;
      
      // Verificar dados do usuário
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (userError) {
        addResult({
          name: 'Leitura de dados do usuário',
          status: 'error',
          message: `Erro ao ler dados do usuário: ${userError.message}`,
          details: userError
        });
      } else {
        addResult({
          name: 'Leitura de dados do usuário',
          status: 'success',
          message: `Dados do usuário lidos com sucesso (${userData.name})`,
          details: {
            id: userData.id,
            name: userData.name,
            registration: userData.registration,
            role: userData.role,
            status: userData.status
          }
        });
      }
    } catch (error) {
      addResult({
        name: 'Permissões do usuário',
        status: 'error',
        message: `Exceção: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        details: error
      });
    }
  };

  const testProductOperations = async () => {
    // Verificar se tem permissão para ler produtos
    try {
      const { data: products, error: readError } = await supabase
        .from('products')
        .select('*')
        .limit(5);
        
      if (readError) {
        addResult({
          name: 'Leitura de produtos',
          status: 'error',
          message: `Erro ao ler produtos: ${readError.message}`,
          details: readError
        });
      } else {
        addResult({
          name: 'Leitura de produtos',
          status: 'success',
          message: `${products.length} produtos lidos com sucesso`,
          details: products
        });
        
        // Se a leitura foi bem-sucedida, tentar inserir um produto de teste
        if (isAdmin) {
          try {
            const testProduct = {
              name: `Produto Teste ${Date.now()}`,
              code: `TEST${Date.now()}`,
              capacity: 1000
            };
            
            const { data: insertData, error: insertError } = await supabase
              .from('products')
              .insert([testProduct])
              .select()
              .single();
              
            if (insertError) {
              addResult({
                name: 'Inserção de produto',
                status: 'error',
                message: `Erro ao inserir produto: ${insertError.message}`,
                details: {
                  error: insertError,
                  product: testProduct
                }
              });
            } else {
              addResult({
                name: 'Inserção de produto',
                status: 'success',
                message: `Produto inserido com sucesso (ID: ${insertData.id})`,
                details: insertData
              });
              
              // Se a inserção foi bem-sucedida, tentar excluir o produto
              try {
                const { error: deleteError } = await supabase
                  .from('products')
                  .delete()
                  .eq('id', insertData.id);
                  
                if (deleteError) {
                  addResult({
                    name: 'Exclusão de produto',
                    status: 'error',
                    message: `Erro ao excluir produto: ${deleteError.message}`,
                    details: deleteError
                  });
                } else {
                  addResult({
                    name: 'Exclusão de produto',
                    status: 'success',
                    message: 'Produto excluído com sucesso',
                    details: null
                  });
                }
              } catch (deleteError) {
                addResult({
                  name: 'Exclusão de produto',
                  status: 'error',
                  message: `Exceção ao excluir: ${deleteError instanceof Error ? deleteError.message : 'Erro desconhecido'}`,
                  details: deleteError
                });
              }
            }
          } catch (insertError) {
            addResult({
              name: 'Inserção de produto',
              status: 'error',
              message: `Exceção ao inserir: ${insertError instanceof Error ? insertError.message : 'Erro desconhecido'}`,
              details: insertError
            });
          }
        } else {
          addResult({
            name: 'Inserção de produto',
            status: 'pending',
            message: 'Teste de inserção ignorado (usuário não é administrador)',
            details: null
          });
        }
      }
    } catch (error) {
      addResult({
        name: 'Operações de produtos',
        status: 'error',
        message: `Exceção: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        details: error
      });
    }
  };

  const runAllTests = async () => {
    setIsLoading(true);
    setResults([]);
    
    try {
      await testConnection();
      await testSession();
      await testUserPermissions();
      await testProductOperations();
    } catch (error) {
      console.error('Erro ao executar testes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Renderizar ícone baseado no status
  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Diagnóstico</h1>
          <p className="text-muted-foreground mt-1">
            Ferramentas para verificar o status da conexão e permissões no Supabase
          </p>
        </div>
        <Button
          onClick={runAllTests}
          disabled={isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Database className="h-4 w-4" />
          )}
          {isLoading ? 'Executando testes...' : 'Executar todos os testes'}
        </Button>
      </div>

      {!isAdmin && (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>
            Alguns testes de diagnóstico só estão disponíveis para administradores
          </AlertDescription>
        </Alert>
      )}
      
      <div className="grid gap-4 md:grid-cols-2">
        {results.map((result, index) => (
          <Card key={index} className={result.status === 'error' ? 'border-red-300' : result.status === 'success' ? 'border-green-300' : 'border-yellow-300'}>
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <StatusIcon status={result.status} />
              <div>
                <CardTitle className="text-lg">{result.name}</CardTitle>
                <CardDescription>
                  {result.status === 'success' ? 'Sucesso' : result.status === 'error' ? 'Erro' : 'Pendente'}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <p>{result.message}</p>
            </CardContent>
            {result.details && (
              <CardFooter className="pt-0">
                <details className="text-xs w-full">
                  <summary className="cursor-pointer text-muted-foreground">
                    Detalhes
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded-md overflow-auto">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </details>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
      
      {results.length === 0 && !isLoading && (
        <div className="text-center p-12">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">Nenhum teste executado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Clique no botão "Executar todos os testes" para verificar a conexão e permissões.
          </p>
        </div>
      )}
    </div>
  );
};

export default DiagnosticsPage; 