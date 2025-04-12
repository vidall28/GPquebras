import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { setupGlobalErrorHandling } from './lib/errorHandling';

// Verificar se estamos em modo de recuperação de erros anteriores
const recoveryMode = localStorage.getItem('recovery_mode') === 'true';
if (recoveryMode) {
  console.log('Iniciando em modo de recuperação de erro anterior');
}

// Configurar tratamento de erros globais
setupGlobalErrorHandling();

// Polyfill para funções possivelmente indefinidas (minificadas)
// Isso resolve problemas com bibliotecas de terceiros que podem estar usando
// funções com nomes minificados como Qm, Zm, Jm em produção
if (typeof window !== 'undefined') {
  // Verificar e adicionar polyfills se necessário
  if (typeof (window as any).Qm !== 'function') {
    (window as any).Qm = function() {
      console.warn('Função Qm chamada mas não implementada');
      return null;
    };
  }
  
  if (typeof (window as any).Zm !== 'function') {
    (window as any).Zm = function() {
      console.warn('Função Zm chamada mas não implementada');
      return null;
    };
  }
  
  if (typeof (window as any).Jm !== 'function') {
    (window as any).Jm = function() {
      console.warn('Função Jm chamada mas não implementada');
      return null;
    };
  }

  // Garantir que React e ReactDOM estejam disponíveis globalmente
  // Algumas bibliotecas de terceiros podem depender disso
  (window as any).React = React;
  (window as any).ReactDOM = ReactDOM;
}

// Tratamento de erros a nível de window para tipos específicos de erros
window.addEventListener('error', (event) => {
  // Verificar se o erro já foi capturado para evitar loops
  if (localStorage.getItem('error_handling_in_progress') === 'true') {
    return;
  }

  // Verificar se é um erro de função não definida (comum em código minificado)
  const errorMsg = event.error?.toString() || '';
  const isFunctionNotDefinedError = errorMsg.match(/[A-Za-z]m is not a function/);
  
  if (isFunctionNotDefinedError) {
    console.error('Erro específico detectado:', errorMsg);
    console.error('Tentando recuperação...');
    
    // Marcar que estamos tratando um erro para evitar loops
    localStorage.setItem('error_handling_in_progress', 'true');
    
    // Armazenar no localStorage que estamos em modo de recuperação
    localStorage.setItem('recovery_mode', 'true');
    localStorage.setItem('last_error', errorMsg);
    
    // Extrair o nome da função do erro
    const functionMatch = errorMsg.match(/([A-Za-z]m) is not a function/);
    if (functionMatch && functionMatch[1]) {
      const functionName = functionMatch[1];
      console.log(`Tentando criar polyfill para ${functionName}`);
      
      // Criar dinamicamente o polyfill para a função específica
      try {
        (window as any)[functionName] = function() { 
          console.log(`${functionName} polyfill chamado`); 
          return null; 
        };
      } catch (e) {
        console.error('Falha ao criar polyfill:', e);
      }
    }
    
    // Forçar recarregamento ou redirecionar
    const lastRecovery = localStorage.getItem('last_recovery_timestamp');
    const now = Date.now();
    
    if (!lastRecovery || (now - parseInt(lastRecovery, 10)) > 10000) {
      localStorage.setItem('last_recovery_timestamp', now.toString());
      
      // Em vez de redirecionar, recarregamos a página
      window.location.reload();
    } else {
      // Se tentou recuperar recentemente sem sucesso, redirecionar para tela segura
      console.error('Múltiplas tentativas de recuperação falhas. Redirecionando para página segura...');
      localStorage.removeItem('error_handling_in_progress');
      localStorage.setItem('recovery_mode', 'true');
      window.location.href = '/diagnostico?error=critical&cause=' + encodeURIComponent(errorMsg);
    }
    
    // Impedir a propagação do erro
    event.preventDefault();
    return false;
  }
});

// Adicionar funções de polyfill ao React para evitar o erro
try {
  if (window.React && !window.React.Qm) {
    window.React.Qm = function() { return null; };
  }
  if (window.ReactDOM && !window.ReactDOM.Qm) {
    window.ReactDOM.Qm = function() { return null; };
  }
} catch (e) {
  console.error('Erro ao adicionar polyfills:', e);
}

// Inicializar a aplicação
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
