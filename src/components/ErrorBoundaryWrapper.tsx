import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { clearAppCacheAndReload } from '@/lib/errorHandling';

interface Props {
  children: ReactNode;
  componentName: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundaryWrapper - Um wrapper específico para componentes que podem ter problemas
 * Este componente é especialmente projetado para tratar o erro "Jm is not a function"
 * e outros problemas comuns de renderização
 */
class ErrorBoundaryWrapper extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): Pick<State, 'hasError' | 'error'> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Registrar o erro 
    console.error(`Erro capturado em ${this.props.componentName}:`, error, errorInfo);
    
    // Tentar detectar o erro específico "Jm is not a function"
    if (error.toString().includes('is not a function')) {
      // Salvar informações do erro para diagnóstico
      try {
        localStorage.setItem('component_error', JSON.stringify({
          component: this.props.componentName,
          message: error.toString(),
          time: new Date().toISOString(),
        }));
      } catch (e) {
        console.error('Erro ao salvar detalhes do erro:', e);
      }
    }
  }

  private handleReload = () => {
    clearAppCacheAndReload();
  }

  private handleDiagnostics = () => {
    window.location.href = '/diagnostico';
  }

  public render() {
    if (this.state.hasError) {
      // Se personalizado, usar o fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // UI de fallback padrão
      return (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-destructive">Problema ao carregar componente</CardTitle>
            <CardDescription>
              Não foi possível renderizar o componente {this.props.componentName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Erro: {this.state.error?.message || 'Erro desconhecido'}
              </p>
              <div className="bg-muted p-2 rounded-lg text-xs overflow-auto max-h-24">
                <p className="font-mono">
                  {this.state.error?.toString()}
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={this.handleReload}
            >
              Recarregar
            </Button>
            <Button 
              variant="outline" 
              onClick={this.handleDiagnostics}
            >
              Ir para Diagnósticos
            </Button>
          </CardFooter>
        </Card>
      );
    }

    // Se não houver erro, renderizar os filhos normalmente
    return this.props.children;
  }
}

export default ErrorBoundaryWrapper; 