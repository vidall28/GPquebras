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
}

// Funções avançadas para o cliente Supabase
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

// CRIAR e EXPORTAR o cliente Supabase
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

// Tipos para as tabelas do Supabase
export type Tables = {
  users: {
    id: string;
    name: string;
    registration: string;
    email: string;
    role: 'admin' | 'user';
    status: 'active' | 'inactive';
    created_at: string;
    updated_at?: string;
  };
  
  products: {
    id: string;
    name: string;
    code: string;
    capacity: number;
    created_at: string;
    updated_at?: string;
  };
  
  exchanges: {
    id: string;
    user_id: string;
    label: string;
    type: 'exchange' | 'breakage';
    status: 'pending' | 'approved' | 'rejected';
    notes: string | null;
    created_at: string;
    updated_at: string | null;
    updated_by: string | null;
  };
  
  exchange_items: {
    id: string;
    exchange_id: string;
    product_id: string;
    quantity: number;
    reason: string;
    created_at: string;
  };
  
  exchange_photos: {
    id: string;
    exchange_item_id: string;
    photo_url: string;
    created_at: string;
  };

  notifications: {
    id: string;
    user_id: string;
    title: string;
    message: string;
    read: boolean;
    type: 'info' | 'warning' | 'error' | 'success';
    related_entity?: string;
    related_id?: string;
    created_at: string;
  };
};

// Método auxiliar para converter dados do Supabase para o formato da aplicação
export const mappers = {
  // Função para converter um produto do formato do Supabase para o formato da aplicação
  mapProductFromDB: (product: Tables['products']): Product => ({
    id: product.id,
    name: product.name,
    code: product.code,
    capacity: product.capacity,
  }),
  
  // Função para converter um usuário do formato do Supabase para o formato da aplicação
  mapUserFromDB: (user: Tables['users']): User => ({
    id: user.id,
    name: user.name,
    registration: user.registration,
    email: user.email,
    role: user.role,
    status: user.status,
  }),
};

// Lista de emails administrativos conhecidos
// Substitua por emails reais dos administradores do sistema
export const ADMIN_EMAILS = [
  'admin@example.com',
  'krawkzin69@gmail.com', // Adicionado como exemplo, ajuste conforme necessário
  // adicione mais emails aqui
];

// Função para verificar se o usuário é administrador com timeout
export const checkIfUserIsAdmin = async (userId: string): Promise<boolean> => {
  if (!userId) {
    console.error('checkIfUserIsAdmin: ID do usuário não fornecido');
    return false;
  }

  console.log(`Verificando se o usuário ${userId} é administrador...`);
  
  // Criar uma promessa que resolverá com o status de administrador ou rejeitará com timeout
  return new Promise((resolve) => {
    // Definir um timeout de 2 segundos para evitar bloqueio da interface
    const timeoutId = setTimeout(() => {
      console.warn(`Timeout ao verificar status de administrador para o usuário ${userId} (limite de 2 segundos)`);
      resolve(false); // Resolver com false em vez de rejeitar para não quebrar o fluxo
    }, 2000); // Reduzido para 2 segundos
    
    // Tentar verificar se é administrador através do RPC ou métodos alternativos
    (async () => {
      try {
        // Verificar primeiro métodos mais rápidos e diretos
        console.log(`Verificando admin para usuário ${userId} via métodos alternativos...`);
        
        // 1. Verificar via metadados do usuário autenticado
        try {
          const { data: authUser } = await supabase.auth.getUser();
          const userEmail = authUser?.user?.email;
          
          if (userEmail && ADMIN_EMAILS.includes(userEmail)) {
            console.log(`Usuário ${userId} é administrador via email`);
            clearTimeout(timeoutId);
            resolve(true);
            return;
          }
        } catch (e) {
          console.error('Erro ao verificar metadados do usuário:', e);
        }
        
        // 2. Verificar diretamente na tabela de usuários
        try {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', userId)
            .single();
            
          if (!userError && userData) {
            const isAdmin = userData.role === 'admin';
            console.log(`Usuário ${userId} ${isAdmin ? 'é' : 'não é'} administrador via tabela de usuários`);
            clearTimeout(timeoutId);
            resolve(isAdmin);
            return;
          }
        } catch (e) {
          console.error('Erro ao verificar tabela de usuários:', e);
        }
        
        // 3. Verificar via RPC (mais confiável, mas pode ser mais lento)
        try {
          const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin', {
            user_id: userId
          });
          
          if (!rpcError) {
            console.log(`Usuário ${userId} ${isAdmin ? 'é' : 'não é'} administrador via RPC`);
            clearTimeout(timeoutId);
            resolve(!!isAdmin);
            return;
          }
        } catch (e) {
          console.error('Erro ao verificar admin via RPC:', e);
        }
        
        // Se chegou aqui, nenhum método funcionou, mas o timeout ainda não acionou
        console.warn(`Nenhum método de verificação de admin funcionou para o usuário ${userId}`);
        clearTimeout(timeoutId);
        resolve(false);
      } catch (e) {
        console.error(`Erro geral ao verificar admin para ${userId}:`, e);
        clearTimeout(timeoutId);
        resolve(false);
      }
    })();
  });
};

// Extender a funcionalidade do supabase para incluir um simulador de RPC
// para o check_if_admin enquanto não criamos o procedimento real
const originalRpc = supabase.rpc.bind(supabase);
// Define o novo método rpc preservando a referência à instância exportada
export const originalSupabaseRpc = originalRpc;
// Sobrescreve o método rpc da instância exportada
supabase.rpc = (procedureName: string, params?: any, options?: any) => {
  if (procedureName === 'check_if_admin' && params?.user_id) {
    // Simular o procedimento check_if_admin
    console.log("Simulando procedimento check_if_admin");
    return new Promise(async (resolve) => {
      const isAdmin = await checkIfUserIsAdmin(params.user_id);
      resolve({ 
        data: isAdmin, 
        error: null 
      });
    }) as Promise<any>;
  }
  
  // Chamar a implementação original para outros procedimentos
  return originalRpc(procedureName, params, options);
};

// Interface do Produto
export interface Product {
  id: string;
  name: string;
  code: string;
  capacity: number;
}

// Interface do Usuário
export interface User {
  id: string;
  name: string;
  registration: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
}

// Interface do Item de Troca
export interface ExchangeItem {
  id: string;
  productId: string;
  quantity: number;
  reason: string;
  photos: string[];
}

// Interface da Troca/Quebra
export interface Exchange {
  id: string;
  userId: string;
  userName: string;
  userRegistration: string;
  label: string;
  type: 'exchange' | 'breakage';
  items: ExchangeItem[];
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
}

// Funções de diagnóstico e teste da conexão com o Supabase
export interface SupabaseTestResult {
  success: boolean;
  message: string;
  latency?: number;
  details?: any;
}

export const testSupabaseConnection = async (): Promise<SupabaseTestResult> => {
  try {
    const startTime = performance.now();
    
    // Teste simples para verificar conectividade básica
    const { data, error } = await supabase.rpc('ping');
    
    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);
    
    if (error) {
      return {
        success: false,
        message: `Erro na conexão: ${error.message}`,
        latency
      };
    }
    
    if (data !== 'pong') {
      return {
        success: false,
        message: `Resposta inesperada do servidor: ${data}`,
        latency
      };
    }
    
    // Conexão bem-sucedida
    return {
      success: true,
      message: `Conexão estabelecida com sucesso (${latency}ms)`,
      latency
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro ao testar conexão: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

export const measureSupabaseLatency = async (iterations = 3): Promise<SupabaseTestResult> => {
  try {
    const latencies: number[] = [];
    let successCount = 0;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        const { error } = await supabase.rpc('ping');
        const endTime = performance.now();
        
        if (!error) {
          successCount++;
          latencies.push(Math.round(endTime - startTime));
        }
      } catch (e) {
        // Ignorar erro e continuar com próximas iterações
      }
      
      // Pequena pausa entre as iterações
      if (i < iterations - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (latencies.length === 0) {
      return {
        success: false,
        message: 'Não foi possível medir a latência - todas as tentativas falharam'
      };
    }
    
    // Calcular média, mínimo e máximo
    const avgLatency = Math.round(latencies.reduce((sum, val) => sum + val, 0) / latencies.length);
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    
    return {
      success: true,
      message: `Latência média: ${avgLatency}ms (min: ${minLatency}ms, max: ${maxLatency}ms)`,
      latency: avgLatency,
      details: {
        successRate: `${Math.round((successCount / iterations) * 100)}%`,
        min: minLatency,
        max: maxLatency,
        values: latencies
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro ao medir latência: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

export const testSupabaseConfig = async (): Promise<SupabaseTestResult> => {
  try {
    // Verificar URL e chave do Supabase
    if (!supabaseUrl || !supabaseKey) {
      return {
        success: false,
        message: 'Configuração incompleta: URL ou chave do Supabase não definidas'
      };
    }
    
    // Verificar formato da URL (deve começar com https:// e terminar com .supabase.co)
    if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
      return {
        success: false,
        message: `URL do Supabase em formato inválido: ${supabaseUrl}`
      };
    }
    
    // Verificar formato da chave (deve ser uma string longa)
    if (supabaseKey.length < 30) {
      return {
        success: false,
        message: 'Chave API do Supabase parece ser muito curta'
      };
    }
    
    // Verificar se RLS está ativado (importante para segurança)
    const { data: rlsEnabled, error: rlsError } = await supabase.rpc('rls_enabled');
    
    if (rlsError) {
      return {
        success: false,
        message: `Erro ao verificar RLS: ${rlsError.message}`
      };
    }
    
    if (!rlsEnabled) {
      return {
        success: false,
        message: 'ALERTA DE SEGURANÇA: RLS (Row Level Security) está desativado!'
      };
    }
    
    // Tudo parece estar configurado corretamente
    return {
      success: true,
      message: 'Configuração do Supabase está correta',
      details: {
        url: `${supabaseUrl.substring(0, 15)}...`,
        keyLength: supabaseKey.length,
        rlsEnabled
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro ao testar configuração: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

export const quickConnectionCheck = async (): Promise<{ok: boolean, message: string, latency: number}> => {
  try {
    const startTime = performance.now();
    
    // Tentativa rápida de ping
    const { error } = await supabase.rpc('ping');
    
    const endTime = performance.now();
    const latency = Math.round(endTime - startTime);
    
    if (error) {
      if (error.message.includes('JWT')) {
        return { ok: false, message: 'Erro de autenticação JWT', latency };
      } else if (error.message.includes('API key')) {
        return { ok: false, message: 'Problema com a API key', latency };
      } else {
        return { ok: false, message: error.message, latency };
      }
    }
    
    if (latency > 5000) {
      return { ok: true, message: 'Conexão estabelecida, mas está lenta', latency };
    }
    
    return { ok: true, message: 'Conexão OK', latency };
  } catch (error) {
    return { 
      ok: false, 
      message: error instanceof Error ? error.message : 'Erro desconhecido', 
      latency: 0 
    };
  }
};

// Notificações
export interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  link?: string;
}

export interface NotificationCountResult {
  count: number;
  error: Error | null;
}

/**
 * Cria uma nova notificação para um usuário
 */
export const createNotification = async (params: CreateNotificationParams) => {
  try {
    const { data, error } = await supabase.rpc('create_notification', {
      p_user_id: params.userId,
      p_type: params.type,
      p_title: params.title,
      p_message: params.message,
      p_data: params.data,
      p_link: params.link
    });
    
    if (error) throw error;
    
    return {
      success: data?.success || false,
      notificationId: data?.notification_id,
      error: data?.error ? new Error(data.error) : null
    };
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    return {
      success: false,
      notificationId: null,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};

/**
 * Marca uma notificação como lida ou não lida
 */
export const markNotificationAsRead = async (notificationId: string, read: boolean = true) => {
  try {
    const { data, error } = await supabase.rpc('mark_notification_as_read', {
      p_notification_id: notificationId,
      p_read: read
    });
    
    if (error) throw error;
    
    return {
      success: data?.success || false,
      error: data?.error ? new Error(data.error) : null
    };
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};

/**
 * Marca todas as notificações de um usuário como lidas
 */
export const markAllNotificationsAsRead = async (userId?: string) => {
  try {
    const { data, error } = await supabase.rpc('mark_all_notifications_as_read', userId ? {
      p_user_id: userId
    } : {});
    
    if (error) throw error;
    
    return {
      success: data?.success || false,
      count: data?.count || 0,
      error: data?.error ? new Error(data.error) : null
    };
  } catch (error) {
    console.error('Erro ao marcar todas notificações como lidas:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};

/**
 * Exclui uma notificação
 */
export const deleteNotification = async (notificationId: string) => {
  try {
    const { data, error } = await supabase.rpc('delete_notification', {
      p_notification_id: notificationId
    });
    
    if (error) throw error;
    
    return {
      success: data?.success || false,
      error: data?.error ? new Error(data.error) : null
    };
  } catch (error) {
    console.error('Erro ao excluir notificação:', error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};

/**
 * Limpa todas as notificações de um usuário
 */
export const clearNotifications = async (userId?: string) => {
  try {
    const { data, error } = await supabase.rpc('clear_notifications', userId ? {
      p_user_id: userId
    } : {});
    
    if (error) throw error;
    
    return {
      success: data?.success || false,
      count: data?.count || 0,
      error: data?.error ? new Error(data.error) : null
    };
  } catch (error) {
    console.error('Erro ao limpar notificações:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};

/**
 * Conta notificações não lidas de um usuário
 */
export const countUnreadNotifications = async (userId?: string): Promise<NotificationCountResult> => {
  try {
    const { data, error } = await supabase.rpc('count_unread_notifications', userId ? {
      p_user_id: userId
    } : {});
    
    if (error) throw error;
    
    return {
      count: data || 0,
      error: null
    };
  } catch (error) {
    console.error('Erro ao contar notificações não lidas:', error);
    return {
      count: 0,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
};

// Re-exportação da função de cache e clearCache
export { clearCache } from './cache';

// Funções auxiliares para trabalhar com RPCs
export const rpc = {
  // Funções de administração
  isAdmin: async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('is_admin', { user_id: userId });
      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Erro ao verificar privilégios de administrador:', error);
      return false;
    }
  },

  promoteToAdmin: async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('promote_to_admin', { target_user_id: userId });
      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Erro ao promover usuário a administrador:', error);
      return false;
    }
  },

  // Funções relacionadas a trocas/quebras
  canUpdateExchange: async (exchangeId: string, userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('can_update_exchange', { 
        exchange_id: exchangeId,
        user_id: userId 
      });
      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Erro ao verificar permissões para atualizar troca:', error);
      return false;
    }
  },

  updateExchangeStatus: async (
    exchangeId: string, 
    newStatus: 'pending' | 'approved' | 'rejected', 
    notes?: string
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('update_exchange_status', { 
        exchange_id: exchangeId,
        new_status: newStatus,
        notes_text: notes || null
      });
      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Erro ao atualizar status da troca:', error);
      return false;
    }
  },

  emergencyUpdateExchange: async (
    exchangeId: string, 
    newStatus: 'pending' | 'approved' | 'rejected', 
    notes?: string,
    adminId?: string
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('emergency_update_exchange', { 
        exchange_id: exchangeId,
        new_status: newStatus,
        notes_text: notes || null,
        admin_id: adminId || null
      });
      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Erro ao realizar atualização de emergência da troca:', error);
      return false;
    }
  },

  // Funções relacionadas a usuário
  getUserById: async (userId: string): Promise<any> => {
    try {
      const { data, error } = await supabase.rpc('get_user_by_id', { user_id: userId });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar usuário por ID:', error);
      return null;
    }
  },

  fixUserData: async (userId: string, newEmail?: string, newName?: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('fix_user_data', { 
        user_id: userId,
        new_email: newEmail || null,
        new_name: newName || null
      });
      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Erro ao corrigir dados do usuário:', error);
      return false;
    }
  },

  // Funções de diagnóstico
  ping: async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('ping');
      if (error) throw error;
      return data === 'pong';
    } catch (error) {
      console.error('Erro ao verificar conectividade com o Supabase:', error);
      return false;
    }
  },

  rlsEnabled: async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('rls_enabled');
      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Erro ao verificar status do RLS:', error);
      return false;
    }
  },

  diagnoseRegistrationIssues: async (email?: string, registration?: string): Promise<any> => {
    try {
      const { data, error } = await supabase.rpc('diagnose_registration_issues', {
        email_to_check: email || null,
        registration_to_check: registration || null
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao diagnosticar problemas de registro:', error);
      return null;
    }
  },

  // Funções de notificação
  markAllNotificationsAsRead: async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('mark_all_notifications_as_read', {
        user_id: userId
      });
      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Erro ao marcar notificações como lidas:', error);
      return false;
    }
  },
};

// Função para criar ou atualizar um usuário se já existe (upsert)
export const upsertUser = async (user: User): Promise<{ success: boolean; error?: any }> => {
  try {
    console.log(`Tentando upsert para usuário: ${user.id}`);
    
    // Verificar se o usuário já existe
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
      
    if (checkError && !checkError.message.includes('No rows found')) {
      console.error('Erro ao verificar existência do usuário:', checkError);
      return { success: false, error: checkError };
    }
    
    if (existingUser) {
      // Atualizar usuário existente
      console.log('Atualizando usuário existente:', user.id);
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: user.name,
          registration: user.registration,
          email: user.email,
          role: user.role,
          status: user.status
        })
        .eq('id', user.id);
        
      if (updateError) {
        console.error('Erro ao atualizar usuário:', updateError);
        return { success: false, error: updateError };
      }
      
      console.log('Usuário atualizado com sucesso');
      return { success: true };
    } else {
      // Inserir novo usuário
      console.log('Criando novo usuário:', user.id);
      const { error: insertError } = await supabase
        .from('users')
        .insert([{
          id: user.id,
          name: user.name,
          registration: user.registration,
          email: user.email,
          role: user.role,
          status: user.status
        }]);
        
      if (insertError) {
        console.error('Erro ao criar usuário:', insertError);
        
        // Segunda tentativa: atualização direta
        console.log('Tentando atualização direta como alternativa...');
        try {
          const { error: updateError } = await supabase
            .from('users')
            .update({
              name: user.name,
              registration: user.registration,
              email: user.email,
              role: user.role,
              status: user.status
            })
            .eq('id', user.id);
          
          if (updateError) {
            console.error('Erro também na atualização alternativa:', updateError);
            return { success: false, error: updateError };
          }
          
          console.log('Usuário criado com sucesso via update');
          return { success: true };
        } catch (e) {
          console.error('Erro na tentativa alternativa:', e);
          return { success: false, error: e };
        }
      }
      
      console.log('Usuário inserido com sucesso');
      return { success: true };
    }
  } catch (error) {
    console.error('Erro durante upsert de usuário:', error);
    return { success: false, error };
  }
}; 