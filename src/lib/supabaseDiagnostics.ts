import { supabase } from '@/lib/supabaseClient';
import type { SupabaseTestResult, SupabaseLatencyStats } from '@/types/database';

// --- Funções de Diagnóstico e Teste --- 

export const testSupabaseConnection = async (): Promise<SupabaseTestResult> => {
  try {
    const startTime = performance.now();
    
    // Teste simples para verificar conectividade básica usando a RPC 'ping'
    const { data, error } = await supabase.rpc('ping');
    
    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);
    
    if (error) {
      console.error('testSupabaseConnection: Erro na RPC ping:', error);
      return {
        success: false,
        message: `Erro na conexão (RPC ping): ${error.message}`,
        latency,
        details: error
      };
    }
    
    // Verificar se a resposta do ping é a esperada (ex: 'pong' ou true)
    // Adapte esta verificação conforme a resposta real da sua RPC 'ping'
    const expectedResponse = 'pong'; // ou true, dependendo da sua RPC
    if (data === expectedResponse) {
      console.log(`testSupabaseConnection: Sucesso! Latência: ${latency}ms`);
      return {
        success: true,
        message: `Conexão bem-sucedida (Latência: ${latency}ms)`,
        latency
      };
    } else {
      console.warn('testSupabaseConnection: Resposta inesperada da RPC ping:', data);
      return {
        success: false,
        message: `Conexão estabelecida, mas resposta inesperada da RPC ping: ${JSON.stringify(data)}`,
        latency,
        details: data
      };
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('testSupabaseConnection: Erro geral:', error);
    return {
      success: false,
      message: `Erro inesperado durante o teste de conexão: ${message}`,
      details: error
    };
  }
};

// Armazenamento simples em memória para histórico de latência
let latencyHistory: number[] = [];
const MAX_HISTORY_SIZE = 50; // Manter histórico das últimas 50 medições

// Função para medir a latência da conexão com o Supabase
export const measureSupabaseLatency = async (): Promise<number | null> => {
  try {
    const startTime = performance.now();
    await supabase.rpc('ping'); // Usa a RPC ping para medir
    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);
    
    // Adicionar ao histórico
    latencyHistory.push(latency);
    if (latencyHistory.length > MAX_HISTORY_SIZE) {
      latencyHistory = latencyHistory.slice(-MAX_HISTORY_SIZE);
    }
    
    console.log(`measureSupabaseLatency: Latência medida: ${latency}ms`);
    return latency;
  } catch (error) {
    console.error('Erro ao medir a latência do Supabase:', error);
    return null;
  }
};

// Função para obter estatísticas de latência
export const getSupabaseLatencyStats = (): SupabaseLatencyStats => {
  const count = latencyHistory.length;
  if (count === 0) {
    return { average: 0, min: 0, max: 0, count: 0, history: [] };
  }
  
  const sum = latencyHistory.reduce((a, b) => a + b, 0);
  const average = Math.round(sum / count);
  const min = Math.min(...latencyHistory);
  const max = Math.max(...latencyHistory);
  
  return {
    average,
    min,
    max,
    count,
    history: [...latencyHistory] // Retorna uma cópia do histórico
  };
}; 