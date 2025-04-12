// Funções para tratamento global de erros na aplicação

/**
 * Funções de tratamento de erros para toda a aplicação
 */

/**
 * Configura tratamento de erros global para toda a aplicação
 */
export function setupGlobalErrorHandling() {
  // Configurar handler para promise não tratadas
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Promessa não tratada:', event.reason);
    // Você pode adicionar mais lógica aqui, como enviar para serviço de log
  });

  // Configurar outras interceptações de erro se necessário
  console.error = (...args) => {
    // Capturar erros do console para possível reporte
    const originalError = window.console.error;
    originalError.apply(console, args);
    
    // Opcionalmente registre erros em servidor ou analíticos
  };
}

/**
 * Limpa o cache local da aplicação e recarrega a página
 */
export function clearAppCacheAndReload() {
  try {
    // Limpar localStorage relacionado a erros
    localStorage.removeItem('error_handling_in_progress');
    localStorage.removeItem('recovery_mode');
    localStorage.removeItem('last_error');
    localStorage.removeItem('last_recovery_timestamp');
    
    // Limpar cache de aplicação se estiver usando Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
    }
    
    // Limpar cache de aplicação armazenado
    if ('caches' in window) {
      caches.keys().then((keyList) => {
        return Promise.all(keyList.map((key) => {
          return caches.delete(key);
        }));
      });
    }
    
    // Recarregar a página
    window.location.reload();
  } catch (e) {
    console.error('Erro ao limpar cache:', e);
    // Recarregar a página mesmo se houver erro
    window.location.reload();
  }
}

// Exportar outras funções relacionadas a tratamento de erros conforme necessário 