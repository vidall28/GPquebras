// Funções para tratamento global de erros na aplicação

/**
 * Configura tratamento global de erros para a aplicação
 * Captura erros críticos e tenta realizar recuperação ou feedback ao usuário
 */
export function setupGlobalErrorHandling() {
  // Capturar erros de renderização não tratados
  window.addEventListener('error', (event) => {
    console.error('Erro global capturado:', event.error);
    
    // Verificar se é um erro de função indefinida no React
    if (event.error && 
        (event.error.toString().includes('is not a function') || 
         event.error.toString().includes('is not defined'))) {
      
      console.log('Detectado erro de função indefinida, tentando recuperar...');
      
      // Salvar informações sobre o erro para diagnóstico
      try {
        localStorage.setItem('last_error', JSON.stringify({
          message: event.error.toString(),
          time: new Date().toISOString(),
          location: window.location.pathname
        }));
      } catch (e) {
        console.error('Erro ao salvar detalhes do erro:', e);
      }
      
      // Limpar cache que pode estar causando o problema (exceto dados de autenticação)
      try {
        const keysToKeep = ['sb-auth-token', 'supabase.auth.token'];
        
        // Guardar as chaves de autenticação
        const authData: Record<string, string> = {};
        keysToKeep.forEach(key => {
          const value = localStorage.getItem(key);
          if (value) authData[key] = value;
        });
        
        // Limpar alguns caches específicos mas não todo o localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && !keysToKeep.includes(key) && 
              (key.includes('cache_') || key.startsWith('app_'))) {
            localStorage.removeItem(key);
          }
        }
        
        console.log('Cache problemático limpo, mantendo autenticação');
      } catch (e) {
        console.error('Erro ao limpar cache:', e);
      }
      
      // Verificar se estamos na página de dashboard para evitar redirect loop
      if (window.location.pathname === '/dashboard') {
        // Redirecionar para a página de diagnóstico
        window.location.href = '/diagnostico?error=render_error'; 
      } else if (window.location.pathname !== '/diagnostico') {
        // Se não estamos no dashboard nem na página de diagnóstico, voltar para o login
        window.location.href = '/login?error=app_error';
      } else {
        // Estamos já na página de diagnóstico, apenas recarregar
        window.location.reload();
      }
      
      // Impedir que o erro seja propagado
      event.preventDefault();
      return false;
    }
  });

  // Capturar rejeições de promessas não tratadas
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Promessa rejeitada não tratada:', event.reason);
    
    // Apenas logar, sem ação adicional para não interromper o fluxo
    if (event.reason && typeof event.reason.toString === 'function') {
      console.error('Detalhes da rejeição:', event.reason.toString());
    }
  });
  
  console.log('Tratamento global de erros configurado');
}

/**
 * Remove manualmente os caches da aplicação e recarrega
 * Útil como função de emergência para o usuário
 */
export function clearAppCacheAndReload() {
  console.log('Limpando cache da aplicação...');
  
  try {
    // Limpar caches específicos da aplicação
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !key.includes('auth') && !key.includes('token')) {
        keysToRemove.push(key);
      }
    }
    
    // Remover chaves identificadas (de forma segura)
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`${keysToRemove.length} itens de cache removidos`);
  } catch (e) {
    console.error('Erro ao limpar cache:', e);
  }
  
  // Recarregar a aplicação
  window.location.reload();
}

// Exportar outras funções relacionadas a tratamento de erros conforme necessário 