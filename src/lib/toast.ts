import { toast as sonnerToast } from 'sonner';

interface ToastOptions {
  duration?: number;
}

// Wrap toast functions in try-catch to prevent errors
const safeSonnerCall = (fn: Function, message: string, options?: ToastOptions) => {
  try {
    return fn(message, options);
  } catch (error) {
    console.error('Erro ao exibir toast:', error);
    // Fallback to console
    console.log(`[Toast]: ${message}`);
    return null;
  }
};

// Export toast object with safe implementations
export const toast = {
  success: (message: string, options?: ToastOptions) => 
    safeSonnerCall(sonnerToast.success, message, options),
  
  error: (message: string, options?: ToastOptions) => 
    safeSonnerCall(sonnerToast.error, message, options),
  
  info: (message: string, options?: ToastOptions) => 
    safeSonnerCall(sonnerToast.info, message, options),
  
  message: (message: string, options?: ToastOptions) => 
    safeSonnerCall(sonnerToast, message, options),
  
  loading: (message: string, options?: ToastOptions) => 
    safeSonnerCall(sonnerToast.loading, message, options),
  
  dismiss: (toastId?: string) => {
    try {
      sonnerToast.dismiss(toastId);
    } catch (error) {
      console.error('Erro ao fechar toast:', error);
    }
  }
};
