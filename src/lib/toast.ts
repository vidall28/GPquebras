import { toast as sonnerToast } from 'sonner';

interface ToastOptions {
  duration?: number;
}

// Implementação direta sem usar intermediários que podem causar o erro "e is not a function"
export const toast = {
  success: (message: string, options?: ToastOptions) => {
    try {
      return sonnerToast.success(message, options);
    } catch (error) {
      console.error('Erro ao mostrar toast de sucesso:', error);
      console.log(`[Toast Success]: ${message}`);
      return null;
    }
  },
  
  error: (message: string, options?: ToastOptions) => {
    try {
      return sonnerToast.error(message, options);
    } catch (error) {
      console.error('Erro ao mostrar toast de erro:', error);
      console.log(`[Toast Error]: ${message}`);
      return null;
    }
  },
  
  info: (message: string, options?: ToastOptions) => {
    try {
      // Verificar explicitamente se a função existe
      if (typeof sonnerToast.info === 'function') {
        return sonnerToast.info(message, options);
      } else {
        // Fallback para o toast padrão se .info não existir
        return sonnerToast(message, { ...options, icon: 'ℹ️' });
      }
    } catch (error) {
      console.error('Erro ao mostrar toast informativo:', error);
      console.log(`[Toast Info]: ${message}`);
      return null;
    }
  },
  
  message: (message: string, options?: ToastOptions) => {
    try {
      return sonnerToast(message, options);
    } catch (error) {
      console.error('Erro ao mostrar toast de mensagem:', error);
      console.log(`[Toast Message]: ${message}`);
      return null;
    }
  },
  
  loading: (message: string, options?: ToastOptions) => {
    try {
      if (typeof sonnerToast.loading === 'function') {
        return sonnerToast.loading(message, options);
      } else {
        // Fallback para o toast padrão se .loading não existir
        return sonnerToast(message, { ...options, icon: '⏳' });
      }
    } catch (error) {
      console.error('Erro ao mostrar toast de carregamento:', error);
      console.log(`[Toast Loading]: ${message}`);
      return null;
    }
  },
  
  dismiss: (toastId?: string) => {
    try {
      if (typeof sonnerToast.dismiss === 'function') {
        sonnerToast.dismiss(toastId);
      }
    } catch (error) {
      console.error('Erro ao fechar toast:', error);
    }
  }
};
