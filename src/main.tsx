import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { setupGlobalErrorHandling } from './lib/errorHandling';

// Configurar tratamento de erros global antes de renderizar a aplicação
setupGlobalErrorHandling();

// Iniciar a aplicação
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
