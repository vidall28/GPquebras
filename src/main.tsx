import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { setupGlobalErrorHandling } from './lib/errorHandling';

// Tratamento de erros a nível de window para tipos específicos de erros
window.addEventListener('error', (event) => {
  // Detectar erros "is not a function" em bibliotecas minificadas do React
  if (event.error && 
     event.error.toString().match(/[A-Za-z]m is not a function/)) {
    console.error('Erro específico detectado:', event.error.toString());
    console.error('Tentando recuperação...');
    
    // Armazenar no localStorage que estamos em modo de recuperação
    localStorage.setItem('recovery_mode', 'true');
    localStorage.setItem('last_error', event.error.toString());
    
    // Salvar timestamp para evitar loop de redirecionamento
    const lastRecovery = localStorage.getItem('last_recovery_timestamp');
    const now = Date.now();
    if (!lastRecovery || (now - parseInt(lastRecovery, 10)) > 10000) {
      localStorage.setItem('last_recovery_timestamp', now.toString());
      
      // Redirecionar para a página de diagnóstico para recuperação
      window.location.href = '/diagnostico?recovery=true&error=' + 
        encodeURIComponent(event.error.toString());
    } else {
      console.error('Múltiplas tentativas de recuperação em curto período. Redirecionando para login...');
      localStorage.clear();
      window.location.href = '/login?error=critical';
    }
    
    // Impedir a propagação do erro
    event.preventDefault();
    return false;
  }
});

// Configurar tratamento de erros global
setupGlobalErrorHandling();

// Iniciar a aplicação
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
