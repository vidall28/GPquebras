import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): Pick<State, 'hasError' | 'error'> {
    // Atualiza o estado para que o próximo render mostre a UI alternativa
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Registrar o erro em um serviço de relatório
    console.error('Erro capturado pelo ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    // Limpar cache de localStorage que pode estar corrompido
    try {
      const keysToKeep = ['sb-auth-token', 'supabase.auth.token'];
      
      // Guarda as chaves de autenticação
      const authData: Record<string, string> = {};
      keysToKeep.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) authData[key] = value;
      });
      
      // Limpa localStorage
      localStorage.clear();
      
      // Restaura apenas as chaves de autenticação
      Object.entries(authData).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      
      console.log('Cache local limpo, mantendo autenticação');
    } catch (e) {
      console.error('Erro ao limpar cache:', e);
    }
    
    // Recarregar a página
    window.location.reload();
  }

  private handleLogout = () => {
    // Limpar todos os dados de autenticação e recarregar
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  }

  public render() {
    if (this.state.hasError) {
      // Se personalizado, usar o fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // UI de fallback padrão
      return (
        <div className="flex items-center justify-center min-h-screen bg-background p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-destructive">Ocorreu um erro</CardTitle>
              <CardDescription>
                Desculpe, algo inesperado aconteceu ao renderizar esta página.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Mensagem de erro: {this.state.error?.message || 'Erro desconhecido'}
                </p>
                <div className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-32">
                  <p className="font-mono">
                    {this.state.errorInfo?.componentStack?.toString().split('\n').slice(0, 5).join('\n')}
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={this.handleReload}
              >
                Recarregar aplicação
              </Button>
              <Button 
                variant="destructive" 
                onClick={this.handleLogout}
              >
                Sair e reconectar
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    // Se não houver erro, renderizar os filhos normalmente
    return this.props.children;
  }
}

export default ErrorBoundary; 