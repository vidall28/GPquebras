import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { clearAppCacheAndReload } from '@/lib/errorHandling';
import { toast } from '@/lib/toast';

interface Props {
  children: ReactNode;
  componentName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Componente ErrorBoundary específico para lidar com erros do tipo "Qm is not a function"
 * e outros erros de renderização comuns em componentes React
 */
class ErrorBoundaryWrapper extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`Erro capturado em ${this.props.componentName || 'componente desconhecido'}:`, error);
    console.error('Informações adicionais:', errorInfo);
    
    // Registrar o erro
    this.setState({ errorInfo });
    
    // Verificar se é erro específico "X is not a function"
    // Incluir padrão para 'tv is not a function' e outros possíveis nomes de 2 letras
    const isNotFunctionError = error.message.match(/([A-Za-z][A-Za-z]?m?) is not a function/);
    
    if (isNotFunctionError) {
      console.log('Detectado erro específico de função não definida em componente React');
      
      try {
        // Extrair o nome da função
        const match = error.message.match(/([A-Za-z][A-Za-z]?m?) is not a function/);
        if (match && match[1]) {
          const functionName = match[1];
          console.log(`Tentando criar polyfill local para ${functionName}`);
          
          // Adicionar o polyfill no window apenas se ainda não existir
          if (typeof window !== 'undefined' && !(window as any)[functionName]) {
            (window as any)[functionName] = function() {
              console.log(`Polyfill para ${functionName} chamado`);
              return null;
            };
          }
        }
        
        // Notificar usuário discretamente
        toast.error(`Erro ao renderizar ${this.props.componentName || 'componente'}. Tentando recuperação...`);
        
        // Atualizar o estado para forçar nova renderização após adicionar polyfill
        setTimeout(() => {
          this.setState({ hasError: false });
        }, 100);
      } catch (e) {
        console.error('Falha ao tentar recuperar do erro:', e);
      }
    } else {
      toast.error(`Erro ao renderizar ${this.props.componentName || 'componente'}`);
    }
  }

  private handleReload = () => {
    clearAppCacheAndReload();
  }

  private handleDiagnostics = () => {
    window.location.href = '/diagnostico';
  }

  public render() {
    const { hasError } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Verificar se é um erro de função específica do React minificado
      // Incluir padrão para 'tv is not a function'
      const isNotFunctionError = this.state.error?.message.match(/([A-Za-z][A-Za-z]?m?) is not a function/);
      
      if (isNotFunctionError && typeof window !== 'undefined') {
        return (
          <div className="p-4 border border-amber-200 bg-amber-50 rounded-md">
            <h3 className="font-semibold text-amber-800">Carregando componente alternativo...</h3>
            <p className="text-sm text-amber-700">
              Este componente está sendo recarregado devido a um problema técnico.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-2 px-3 py-1 bg-amber-100 text-amber-800 text-sm rounded border border-amber-300"
            >
              Tentar novamente
            </button>
          </div>
        );
      }
      
      // Usar fallback personalizado se fornecido ou um simples
      if (fallback) {
        return fallback;
      }
      
      return (
        <div className="p-4 border border-red-200 bg-red-50 rounded-md">
          <h3 className="font-semibold text-red-800">Erro ao carregar componente</h3>
          <p className="text-sm text-red-700 mt-1">
            Ocorreu um erro ao renderizar este componente. 
            {this.props.componentName && ` (${this.props.componentName})`}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-3 py-1 bg-red-100 text-red-800 text-sm rounded border border-red-300"
          >
            Recarregar página
          </button>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundaryWrapper; 