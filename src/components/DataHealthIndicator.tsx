import React, { useState, useEffect } from 'react';
import { Database, AlertTriangle, CheckCircle2, Clock, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Tipo para rastrear as operações de banco de dados
interface DatabaseOperation {
  id: string;
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete' | 'rpc';
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
  query?: string;
}

// Função para registrar operações de banco de dados
export const registerDbOperation = (
  operation: Omit<DatabaseOperation, 'id' | 'timestamp'>
): void => {
  const newOperation: DatabaseOperation = {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
    ...operation
  };
  
  // Obter operações existentes
  const currentOpsJson = localStorage.getItem('db_operations');
  const currentOps: DatabaseOperation[] = currentOpsJson 
    ? JSON.parse(currentOpsJson) 
    : [];
  
  // Adicionar nova operação
  const updatedOps = [newOperation, ...currentOps].slice(0, 100); // Manter apenas as 100 operações mais recentes
  
  // Salvar no localStorage
  localStorage.setItem('db_operations', JSON.stringify(updatedOps));
  
  // Acionar evento personalizado para notificar componentes interessados
  window.dispatchEvent(new CustomEvent('db-operation', { detail: newOperation }));
};

export function DataHealthIndicator() {
  const [operations, setOperations] = useState<DatabaseOperation[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [healthScore, setHealthScore] = useState(100);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Carregar operações salvas
  useEffect(() => {
    const loadOperations = () => {
      const savedOps = localStorage.getItem('db_operations');
      if (savedOps) {
        try {
          const parsedOps: DatabaseOperation[] = JSON.parse(savedOps);
          setOperations(parsedOps);
          updateHealthScore(parsedOps);
        } catch (error) {
          console.error('Erro ao carregar operações de banco de dados:', error);
        }
      }
      setLastUpdate(new Date());
    };
    
    // Carregar inicialmente
    loadOperations();
    
    // Configurar listener para novas operações
    const handleNewOperation = (event: CustomEvent) => {
      loadOperations();
    };
    
    window.addEventListener('db-operation', handleNewOperation as EventListener);
    
    // Também atualizar periodicamente
    const interval = setInterval(loadOperations, 30000);
    
    return () => {
      window.removeEventListener('db-operation', handleNewOperation as EventListener);
      clearInterval(interval);
    };
  }, []);
  
  // Calcular pontuação de saúde com base nas operações recentes
  const updateHealthScore = (ops: DatabaseOperation[]) => {
    // Pegar apenas operações das últimas 24 horas
    const recentOps = ops.filter(op => 
      Date.now() - op.timestamp < 24 * 60 * 60 * 1000
    );
    
    if (recentOps.length === 0) {
      setHealthScore(100);
      return;
    }
    
    // Contar operações bem-sucedidas e com falha
    const successCount = recentOps.filter(op => op.success).length;
    const totalCount = recentOps.length;
    
    // Calcular pontuação básica baseada em sucesso/falha
    let score = Math.round((successCount / totalCount) * 100);
    
    // Penalizar por operações lentas (mais de 2 segundos)
    const slowOps = recentOps.filter(op => op.duration > 2000).length;
    score -= Math.min(20, slowOps * 2); // Máximo de 20 pontos de penalidade
    
    // Garantir que a pontuação esteja entre 0 e 100
    score = Math.max(0, Math.min(100, score));
    
    setHealthScore(score);
  };
  
  // Obter status de saúde com base na pontuação
  const getHealthStatus = () => {
    if (healthScore >= 90) return { label: 'Excelente', color: 'green' };
    if (healthScore >= 75) return { label: 'Bom', color: 'blue' };
    if (healthScore >= 50) return { label: 'Regular', color: 'yellow' };
    return { label: 'Ruim', color: 'red' };
  };
  
  // Resumo das operações recentes
  const getOperationsSummary = () => {
    // Pegar apenas operações das últimas 2 horas
    const recentOps = operations.filter(op => 
      Date.now() - op.timestamp < 2 * 60 * 60 * 1000
    );
    
    const summary = {
      total: recentOps.length,
      success: recentOps.filter(op => op.success).length,
      failed: recentOps.filter(op => !op.success).length,
      select: recentOps.filter(op => op.operation === 'select').length,
      insert: recentOps.filter(op => op.operation === 'insert').length,
      update: recentOps.filter(op => op.operation === 'update').length,
      delete: recentOps.filter(op => op.operation === 'delete').length,
      rpc: recentOps.filter(op => op.operation === 'rpc').length,
      avgDuration: recentOps.length > 0 
        ? Math.round(recentOps.reduce((acc, op) => acc + op.duration, 0) / recentOps.length) 
        : 0
    };
    
    return summary;
  };
  
  const summary = getOperationsSummary();
  const healthStatus = getHealthStatus();
  
  return (
    <Card className={expanded ? "w-96" : "w-64"}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-1">
            <Database className="h-4 w-4" />
            Saúde dos Dados
          </CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6" 
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <CheckCircle2 className="h-4 w-4" /> : <BarChart2 className="h-4 w-4" />}
          </Button>
        </div>
        <CardDescription className="text-xs">
          {lastUpdate 
            ? `Atualizado: ${lastUpdate.toLocaleTimeString()}` 
            : 'Analisando operações...'}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pb-2">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">Pontuação:</span>
              <Badge variant={
                healthScore >= 90 ? "success" : 
                healthScore >= 75 ? "default" : 
                healthScore >= 50 ? "warning" : "destructive"
              }>
                {healthStatus.label}
              </Badge>
            </div>
            <span className="text-sm font-medium">{healthScore}%</span>
          </div>
          
          <Progress value={healthScore} className="h-2" />
        </div>
        
        {expanded && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <div className="text-muted-foreground">Total de Ops (2h):</div>
                <div className="font-medium">{summary.total}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Tempo Médio:</div>
                <div className="font-medium">{summary.avgDuration}ms</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Sucesso:</div>
                <div className="font-medium text-green-600">{summary.success}</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground">Falhas:</div>
                <div className="font-medium text-red-600">{summary.failed}</div>
              </div>
            </div>
            
            <div className="text-xs font-medium mt-2 mb-1">Operações por tipo:</div>
            <div className="grid grid-cols-5 gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="flex flex-col py-1 h-auto">
                      <span className="text-xs">SEL</span>
                      <span className="text-xs font-bold">{summary.select}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Select: {summary.select}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="flex flex-col py-1 h-auto">
                      <span className="text-xs">INS</span>
                      <span className="text-xs font-bold">{summary.insert}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Insert: {summary.insert}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="flex flex-col py-1 h-auto">
                      <span className="text-xs">UPD</span>
                      <span className="text-xs font-bold">{summary.update}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Update: {summary.update}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="flex flex-col py-1 h-auto">
                      <span className="text-xs">DEL</span>
                      <span className="text-xs font-bold">{summary.delete}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete: {summary.delete}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="flex flex-col py-1 h-auto">
                      <span className="text-xs">RPC</span>
                      <span className="text-xs font-bold">{summary.rpc}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>RPC Calls: {summary.rpc}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            {operations.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-medium mb-1">Últimas operações:</div>
                <div className="max-h-32 overflow-y-auto text-xs">
                  {operations.slice(0, 5).map(op => (
                    <div 
                      key={op.id} 
                      className="flex items-center justify-between py-1 border-b border-border last:border-0"
                    >
                      <div className="flex items-center gap-1">
                        {op.success ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                        )}
                        <span>
                          {op.operation.toUpperCase()} {op.table}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className={op.duration > 1000 ? "text-amber-500" : ""}>
                          {op.duration}ms
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-0">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-xs w-full"
          onClick={() => {
            localStorage.removeItem('db_operations');
            setOperations([]);
            setHealthScore(100);
            setLastUpdate(new Date());
          }}
        >
          Limpar Estatísticas
        </Button>
      </CardFooter>
    </Card>
  );
} 