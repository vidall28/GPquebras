interface Window {
  // Polyfills para funções minificadas que podem causar erros
  Qm?: () => any;
  Zm?: () => any;
  Jm?: () => any;
  tv?: () => any;
  [key: string]: any; // Para suportar outras funções específicas dinamicamente
  
  // Propriedades do React e ReactDOM que adicionamos
  React?: {
    Qm?: () => any;
    tv?: () => any;
    [key: string]: any;
  };
  ReactDOM?: {
    Qm?: () => any;
    tv?: () => any;
    [key: string]: any;
  };
} 