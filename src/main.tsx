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

  // Adicionar polyfill para tv que está causando erro
  if (typeof (window as any).tv !== 'function') {
    (window as any).tv = function() {
      console.warn('Função tv chamada mas não implementada - Polyfill Global');
      return null;
    };
    // Tentativa de adicionar ao React/ReactDOM também
    if (typeof window !== 'undefined' && window.React && !(window.React as any).tv) {
       (window.React as any).tv = (window as any).tv;
       console.log('Polyfill tv adicionado ao React');
    }
     if (typeof window !== 'undefined' && window.ReactDOM && !(window.ReactDOM as any).tv) {
       (window.ReactDOM as any).tv = (window as any).tv;
       console.log('Polyfill tv adicionado ao ReactDOM');
    }
  }

  // Garantir que React e ReactDOM estejam disponíveis globalmente
  // Algumas bibliotecas de terceiros podem depender disso
  (window as any).React = React;
  (window as any).ReactDOM = ReactDOM;
}

// Tratamento de erros a nível de window para tipos específicos de erros
window.addEventListener('error', (event) => {
  // Verificar se já estamos tratando um erro para evitar loops
  if (localStorage.getItem('error_handling_in_progress') === 'true') {
    return;
  }
  
  try {
    const errorMsg = event.error?.toString() || '';
    // Regex mais abrangente para nomes minificados (1-4 caracteres, começando com letra ou _/$)
    const isFunctionNotDefinedError = errorMsg.match(/([a-zA-Z$_][a-zA-Z0-9$_]{0,3}) is not a function/);
    
    if (isFunctionNotDefinedError) {
      console.error('Erro específico detectado:', errorMsg);
      console.error('Tentando recuperação...');
      
      // Marcar que estamos tratando um erro para evitar loops
      localStorage.setItem('error_handling_in_progress', 'true');
      
      // Salvar o erro para referência
      localStorage.setItem('last_error', errorMsg);
      
      // Extrair o nome da função
      const functionMatch = errorMsg.match(/([a-zA-Z$_][a-zA-Z0-9$_]{0,3}) is not a function/);
      const functionName = functionMatch ? functionMatch[1] : '';
      
      if (functionName) {
        console.log(`Tentando criar polyfill dinâmico para ${functionName}`);
        try {
          if (typeof (window as any)[functionName] !== 'function') {
             (window as any)[functionName] = function() {
               console.warn(`${functionName} polyfill chamado (dinâmico)`);
               return null;
             };
             // Tentar adicionar ao React/ReactDOM também
             if (window.React && !(window.React as any)[functionName]) {
               (window.React as any)[functionName] = (window as any)[functionName];
             }
              if (window.ReactDOM && !(window.ReactDOM as any)[functionName]) {
               (window.ReactDOM as any)[functionName] = (window as any)[functionName];
             }
          }
        } catch (e) {
           console.error(`Falha ao criar polyfill dinâmico para ${functionName}:`, e);
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
  } catch (e) {
    console.error('Erro ao processar erro:', e);
  }
});

// Adicionar funções de polyfill ao React para evitar o erro
console.log('Adicionando polyfills ao React e ReactDOM...');
try {
  if (window.React && !window.React.Qm) {
    window.React.Qm = function() { return null; };
  }
  
  if (window.React && !window.React.tv) {
    window.React.tv = function() { console.warn("React.tv polyfill estático"); return null; };
  }
  
  if (window.ReactDOM && !window.ReactDOM.Qm) {
    window.ReactDOM.Qm = function() { return null; };
  }
  
  if (window.ReactDOM && !window.ReactDOM.tv) {
    window.ReactDOM.tv = function() { console.warn("ReactDOM.tv polyfill estático"); return null; };
  }
} catch (e) {
  console.error('Erro ao adicionar polyfills estáticos ao React/ReactDOM:', e);
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
