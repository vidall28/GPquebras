import { createClient } from '@supabase/supabase-js';
import { registerDbOperation } from '@/components/DataHealthIndicator';

// Obter variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verificações de segurança e log - mais detalhados
console.log('Configuração do Supabase:');
console.log('URL:', supabaseUrl);
console.log('API Key:', supabaseKey ? `${supabaseKey.substring(0, 5)}...${supabaseKey.substring(supabaseKey.length - 5)}` : 'Indefinida');

// Alertar sobre problemas com a configuração
if (!supabaseUrl || !supabaseKey) {
  console.error('ERRO CRÍTICO: Configuração do Supabase incompleta!');
  // Poderia lançar um erro aqui ou exibir uma mensagem mais visível ao usuário
}

// Funções avançadas para o cliente Supabase
// Inclui um fetch interceptor para registrar operações e duração
export const supabaseConfig = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: async (url: RequestInfo | URL, options?: RequestInit) => {
      const startTime = performance.now();
      
      // Extrair informações sobre o tipo de operação
      let operationType: 'select' | 'insert' | 'update' | 'delete' | 'rpc' = 'select';
      let tableName = 'unknown';
      
      const urlString = url.toString();
      if (urlString.includes('/rest/v1/rpc/')) {
        operationType = 'rpc';
        const matches = urlString.match(/\/rest\/v1\/rpc\/([^?]+)/);
        tableName = matches ? matches[1] : 'unknown';
      } else if (urlString.includes('/rest/v1/')) {
        const matches = urlString.match(/\/rest\/v1\/([^?]+)/);
        tableName = matches ? matches[1] : 'unknown';
        
        if (options?.method === 'POST') operationType = 'insert';
        else if (options?.method === 'PATCH' || options?.method === 'PUT') operationType = 'update';
        else if (options?.method === 'DELETE') operationType = 'delete';
      }
      
      try {
        // Log para debug
        if (import.meta.env.DEV) {
          console.log(`Supabase ${operationType.toUpperCase()} ${tableName} request:`, {
            url: urlString,
            method: options?.method || 'GET'
          });
        }
        
        // Adicionar headers necessários
        options = options || {};
        options.headers = options.headers || {};
        
        // Garantir que a API key e a autorização estão presentes nos headers
        if (!options.headers['apikey'] && supabaseUrl && supabaseKey) {
          options.headers['apikey'] = supabaseKey;
        }
        
        // Fazer a requisição
        const response = await fetch(url, options);
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        // Verificar se a resposta é uma falha
        const isSuccess = response.ok;
        
        // Registrar a operação
        registerDbOperation({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          table: tableName,
          operation: operationType,
          duration,
          timestamp: Date.now(),
          success: isSuccess,
          error: isSuccess ? undefined : `HTTP ${response.status}: ${response.statusText}`
        });
        
        // Log para debug
        if (import.meta.env.DEV) {
          console.log(`Supabase ${operationType.toUpperCase()} ${tableName} response:`, {
            status: response.status,
            duration: `${duration}ms`,
            success: isSuccess
          });
        }
        
        return response;
      } catch (error) {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);
        
        // Registrar a operação com falha
        registerDbOperation({
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          table: tableName,
          operation: operationType,
          duration,
          timestamp: Date.now(),
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
        
        console.error(`Erro na requisição Supabase ${operationType} ${tableName}:`, error);
        throw error;
      }
    }
  }
};

// Criar função para limpar sessões inválidas
export const clearInvalidSessions = async () => {
  // Se estamos em uma página de autenticação, não interferir
  const currentPath = window.location.pathname;
  if (currentPath === '/login' || currentPath === '/register') {
    console.log('[supabaseClient] Página de autenticação, não verificando sessões');
    return;
  }
  
  console.log('[supabaseClient] Verificando validade da sessão armazenada...');
  try {
    // Tentar obter a sessão atual
    const { data: { session }, error } = await supabase.auth.getSession();
    
    // Se houver erro ou não houver sessão, limpar o armazenamento local
    if (error || !session) {
      console.log('[supabaseClient] Sessão inválida ou não encontrada, redirecionando para login');
      localStorage.removeItem('sb-auth-token');
      localStorage.removeItem('sb-refresh-token');
      
      // Se não estamos na página de login, redirecionar
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return;
    }
    
    console.log('[supabaseClient] Sessão válida encontrada para usuário:', session.user.email);
    
    // Verificar se a sessão está prestes a expirar (menos de 15 minutos)
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    const now = Date.now();
    const timeLeft = expiresAt - now;
    
    if (timeLeft < 15 * 60 * 1000) { // menos de 15 minutos
      console.log('[supabaseClient] Sessão expira em breve, tentando renovar...');
      await supabase.auth.refreshSession();
    }
  } catch (e) {
    console.error('[supabaseClient] Erro ao verificar sessão:', e);
  }
};

// Verificar sessão quando o arquivo for carregado (na recarga da página)
if (typeof window !== 'undefined') {
  clearInvalidSessions();
  
  // Também verificar quando a visibilidade da página mudar
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('[supabaseClient] Página visível novamente, verificando sessão...');
      clearInvalidSessions();
    }
  });
}

// CRIAR e EXPORTAR o cliente Supabase
// Certifique-se que as variáveis de ambiente estão definidas
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL and Key must be defined in environment variables");
}
export const supabase = createClient(supabaseUrl, supabaseKey, supabaseConfig);

// Log de confirmação
console.log('Cliente Supabase inicializado com URL:', supabaseUrl);

// Adicionar hook para salvar o token quando for obtido
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Mudança de estado de autenticação:', event);
  
  if (session && session.access_token) {
    console.log('Salvando token [sb-auth-token]');
    
    // Salvar token em formato que podemos recuperar facilmente
    const tokenData = {
      access_token: session.access_token,
      expires_at: session.expires_at,
      refresh_token: session.refresh_token
    };
    
    localStorage.setItem('sb-auth-token', JSON.stringify(tokenData));
    
    if (session.refresh_token) {
      localStorage.setItem('sb-refresh-token', session.refresh_token);
    }
  } else if (event === 'SIGNED_OUT') {
    console.log('Limpando tokens armazenados');
    localStorage.removeItem('sb-auth-token');
    localStorage.removeItem('sb-refresh-token');
  }
}); 