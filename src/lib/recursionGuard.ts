/**
 * Utilitário para prevenir recursões infinitas
 * 
 * Esta ferramenta ajuda a detectar e prevenir recursões infinitas que podem
 * ocorrer durante a inicialização de sistemas dependentes como notificações,
 * autenticação e gerenciador offline.
 */

// Contador de chamadas recursivas por tipo
const recursionCounts: Record<string, number> = {};

// Limite de chamadas recursivas para cada tipo
const RECURSION_THRESHOLDS: Record<string, number> = {
  default: 5,
  auth: 3,
  notifications: 3,
  offlineManager: 3
};

// Armazenar tokens de prevenção de recursão
const preventionTokens: Record<string, boolean> = {};

/**
 * Verifica se uma operação está causando recursão excessiva
 * @param type Tipo da operação (ex: 'auth', 'notifications')
 * @param context Contexto adicional para logging
 * @returns true se for seguro continuar, false se for detectada possível recursão
 */
export function checkRecursion(type: string, context: string = ''): boolean {
  const threshold = RECURSION_THRESHOLDS[type] || RECURSION_THRESHOLDS.default;
  
  // Incrementar contador
  recursionCounts[type] = (recursionCounts[type] || 0) + 1;
  
  // Verificar se está abaixo do limite
  const count = recursionCounts[type];
  const isSafe = count <= threshold;
  
  // Log se estiver próximo ou acima do limite
  if (count >= threshold - 1) {
    console.warn(`⚠️ Possível recursão detectada: ${type} (${count}/${threshold}) - ${context}`);
    
    if (count === threshold) {
      console.error(`🚨 Limite de recursão atingido: ${type} - ${context}`);
      // Registrar no localStorage para diagnóstico
      try {
        const recursionErrors = JSON.parse(localStorage.getItem('recursion_errors') || '[]');
        recursionErrors.push({
          type,
          count,
          threshold,
          context,
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('recursion_errors', JSON.stringify(recursionErrors.slice(-20)));
      } catch (e) {
        // Ignorar erros ao salvar
      }
    }
  }
  
  // Resetar contador depois de um tempo
  setTimeout(() => {
    if (recursionCounts[type] === count) {
      recursionCounts[type] = 0;
    }
  }, 3000);
  
  return isSafe;
}

/**
 * Define um token de prevenção de recursão
 * @param key Chave única
 * @returns true se o token foi definido com sucesso, false se já existir
 */
export function setRecursionPreventionToken(key: string): boolean {
  if (preventionTokens[key]) {
    return false;
  }
  preventionTokens[key] = true;
  return true;
}

/**
 * Remove um token de prevenção de recursão
 * @param key Chave única
 */
export function clearRecursionPreventionToken(key: string): void {
  delete preventionTokens[key];
}

/**
 * Wrapper de função com proteção contra recursão
 * @param fn Função a ser executada
 * @param type Tipo para tracking de recursão
 * @param context Contexto adicional
 * @returns Função com proteção contra recursão
 */
export function withRecursionGuard<T extends (...args: any[]) => any>(
  fn: T, 
  type: string, 
  context: string = ''
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    if (!checkRecursion(type, context)) {
      console.error(`🛑 Execução bloqueada para evitar recursão: ${type} - ${context}`);
      return undefined;
    }
    return fn(...args);
  };
}

/**
 * Limpa os dados de diagnóstico de recursão
 */
export function clearRecursionDiagnostics(): void {
  Object.keys(recursionCounts).forEach(key => {
    recursionCounts[key] = 0;
  });
  Object.keys(preventionTokens).forEach(key => {
    delete preventionTokens[key];
  });
  localStorage.removeItem('recursion_errors');
}

export default {
  checkRecursion,
  setRecursionPreventionToken,
  clearRecursionPreventionToken,
  withRecursionGuard,
  clearRecursionDiagnostics
}; 