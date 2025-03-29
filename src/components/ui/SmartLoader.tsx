import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Button } from './button';
import { Link } from 'react-router-dom';

// Tipos de operações comuns para mensagens personalizadas
export type OperationType = 
  | 'login'
  | 'data-fetch'
  | 'saving'
  | 'processing'
  | 'upload'
  | 'download'
  | 'generic';

// Props para o componente
interface SmartLoaderProps {
  operationType?: OperationType;
  customMessage?: string;
  timeoutThreshold?: number;  // Tempo em ms para mostrar aviso de operação lenta
  criticalThreshold?: number; // Tempo em ms para mostrar aviso crítico
  onRetry?: () => void;       // Callback para tentar novamente
  fullPage?: boolean;         // Se deve ocupar a página inteira
  size?: 'sm' | 'md' | 'lg';  // Tamanho do loader
  isError?: boolean;          // Se está em estado de erro
  errorMessage?: string;      // Mensagem de erro personalizada
}

/**
 * Componente avançado para exibir estados de carregamento com feedback contextual
 */
export const SmartLoader: React.FC<SmartLoaderProps> = ({
  operationType = 'generic',
  customMessage,
  timeoutThreshold = 3000,
  criticalThreshold = 10000,
  onRetry,
  fullPage = false,
  size = 'md',
  isError = false,
  errorMessage
}) => {
  const [showSlow, setShowSlow] = useState(false);
  const [showCritical, setShowCritical] = useState(false);
  const [showOfflineWarning, setShowOfflineWarning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  
  // Verificar se está offline
  useEffect(() => {
    const handleOnlineStatusChange = () => {
      setShowOfflineWarning(!navigator.onLine);
    };
    
    // Configurar listeners de status online
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    
    // Verificar status atual
    setShowOfflineWarning(!navigator.onLine);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatusChange);
      window.removeEventListener('offline', handleOnlineStatusChange);
    };
  }, []);
  
  // Monitorar tempo decorrido para avisos de operação lenta
  useEffect(() => {
    if (isError) return;
    
    const startTime = Date.now();
    
    // Timer para mensagem de operação lenta
    const slowTimer = setTimeout(() => {
      setShowSlow(true);
    }, timeoutThreshold);
    
    // Timer para mensagem crítica
    const criticalTimer = setTimeout(() => {
      setShowCritical(true);
    }, criticalThreshold);
    
    // Atualizar tempo decorrido
    const elapsedTimer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => {
      clearTimeout(slowTimer);
      clearTimeout(criticalTimer);
      clearInterval(elapsedTimer);
    };
  }, [timeoutThreshold, criticalThreshold, isError]);
  
  // Obter mensagem apropriada para o tipo de operação
  const getMessage = (): string => {
    if (customMessage) return customMessage;
    
    switch (operationType) {
      case 'login':
        return 'Autenticando usuário...';
      case 'data-fetch':
        return 'Carregando dados...';
      case 'saving':
        return 'Salvando alterações...';
      case 'processing':
        return 'Processando solicitação...';
      case 'upload':
        return 'Enviando arquivos...';
      case 'download':
        return 'Baixando arquivos...';
      default:
        return 'Carregando...';
    }
  };
  
  // Obter dica para operação lenta
  const getSlowTip = (): string => {
    if (showOfflineWarning) {
      return 'Você parece estar offline. Verifique sua conexão com a internet.';
    }
    
    switch (operationType) {
      case 'login':
        return 'O login está demorando mais que o esperado. Sua conexão pode estar lenta ou o servidor pode estar sobrecarregado.';
      case 'data-fetch':
        return 'O carregamento dos dados está demorando mais que o esperado. Isso pode ocorrer se o volume de dados for grande.';
      case 'saving':
        return 'O salvamento está demorando mais que o esperado. Não feche esta janela.';
      default:
        return 'Esta operação está demorando mais que o esperado.';
    }
  };
  
  // Determinar tamanho do loader
  const getLoaderSize = (): number => {
    switch (size) {
      case 'sm': return 16;
      case 'md': return 24;
      case 'lg': return 32;
      default: return 24;
    }
  };
  
  // Construir a classe CSS para o container
  const containerClass = `flex flex-col items-center justify-center ${
    fullPage ? 'min-h-screen' : 'py-8'
  } ${isError ? 'text-destructive' : ''}`;
  
  // Componente para ações de resolução
  const TroubleshootingActions = () => (
    <div className="flex flex-col gap-2 mt-4 w-full max-w-xs">
      {onRetry && (
        <Button onClick={onRetry} className="w-full" variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      )}
      
      {operationType === 'login' && (
        <Button asChild variant="ghost" className="w-full">
          <Link to="/diagnostico">
            <AlertCircle className="mr-2 h-4 w-4" />
            Verificar diagnóstico
          </Link>
        </Button>
      )}
      
      {showOfflineWarning && (
        <Alert variant="warning" className="mt-2">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Sem conexão</AlertTitle>
          <AlertDescription>
            Você parece estar offline. Verifique sua internet e tente novamente.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
  
  // Renderizar estado de erro
  if (isError) {
    return (
      <div className={containerClass}>
        <AlertCircle className="h-8 w-8 text-destructive mb-4" />
        <h3 className="text-lg font-medium mb-2 text-center">
          {errorMessage || 'Ocorreu um erro durante a operação'}
        </h3>
        <TroubleshootingActions />
      </div>
    );
  }
  
  // Renderizar estado de carregamento
  return (
    <div className={containerClass}>
      {!showOfflineWarning ? (
        <Loader2 className={`h-${getLoaderSize()} w-${getLoaderSize()} animate-spin mb-4`} />
      ) : (
        <WifiOff className={`h-${getLoaderSize()} w-${getLoaderSize()} mb-4`} />
      )}
      
      <h3 className="text-lg font-medium mb-2 text-center">{getMessage()}</h3>
      
      {elapsed > 0 && (
        <p className="text-sm text-muted-foreground mb-4">
          Tempo decorrido: {elapsed} {elapsed === 1 ? 'segundo' : 'segundos'}
        </p>
      )}
      
      {(showSlow || showOfflineWarning) && (
        <Alert 
          variant={showCritical ? "destructive" : "warning"}
          className="mt-2 max-w-md"
        >
          <AlertTitle>
            {showCritical ? 'Operação muito lenta' : 'Operação lenta'}
          </AlertTitle>
          <AlertDescription>
            {getSlowTip()}
          </AlertDescription>
        </Alert>
      )}
      
      {(showCritical || showOfflineWarning) && <TroubleshootingActions />}
    </div>
  );
};

export default SmartLoader; 