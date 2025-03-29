import { createClient } from '@supabase/supabase-js';

// Obter variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verificar se as variáveis de ambiente estão definidas
if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: Variáveis de ambiente do Supabase não estão definidas.');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Definido' : 'Indefinido');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseKey ? 'Definido' : 'Indefinido');
}

// Configurações avançadas do cliente Supabase
const supabaseOptions = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'sb-auth-token', // Chave de armazenamento personalizada
    storage: {
      getItem: (key) => {
        try {
          const item = localStorage.getItem(key);
          console.log(`Recuperando token [${key}]:`, item ? 'Encontrado' : 'Não encontrado');
          return item;
        } catch (e) {
          console.error('Erro ao recuperar token:', e);
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          console.log(`Salvando token [${key}]`);
          localStorage.setItem(key, value);
        } catch (e) {
          console.error('Erro ao salvar token:', e);
        }
      },
      removeItem: (key) => {
        try {
          console.log(`Removendo token [${key}]`);
          localStorage.removeItem(key);
        } catch (e) {
          console.error('Erro ao remover token:', e);
        }
      }
    }
  },
  global: {
    // Aumentar o timeout para 45 segundos (o padrão é 6s)
    fetch: (url: RequestInfo, options?: RequestInit) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      
      // Adicionar o sinal do AbortController às opções
      const fetchOptions = {
        ...options,
        signal: controller.signal,
        // Adicionar cabeçalhos para melhorar desempenho de cache
        headers: {
          ...options?.headers,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      };
      
      // Adicionar logs para debug
      console.log(`Iniciando fetch para ${typeof url === 'string' ? url : 'URL'}`);
      
      const fetchPromise = fetch(url, fetchOptions)
        .then(response => {
          console.log(`Resposta recebida de ${typeof url === 'string' ? url : 'URL'}: ${response.status}`);
          return response;
        })
        .catch(error => {
          console.error(`Erro no fetch para ${typeof url === 'string' ? url : 'URL'}:`, error);
          throw error;
        });
      
      fetchPromise.finally(() => {
        clearTimeout(timeoutId);
        console.log(`Finalizando fetch para ${typeof url === 'string' ? url : 'URL'}`);
      });
      
      return fetchPromise;
    }
  },
  // Habilitar logs detalhados em ambiente de desenvolvimento
  debug: import.meta.env.DEV,
  // Configuração de retentativas
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
};

// Criar o cliente do Supabase com as opções avançadas
export const supabase = createClient(supabaseUrl, supabaseKey, supabaseOptions);

console.log('Cliente Supabase inicializado com URL:', supabaseUrl);

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
  };
  
  products: {
    id: string;
    name: string;
    code: string;
    capacity: number;
    created_at: string;
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

// Função auxiliar para verificar se um usuário é administrador
// Esta função simula o procedimento RPC 'check_if_admin' enquanto ele não é criado no Supabase
export const checkIfUserIsAdmin = async (userId: string): Promise<boolean> => {
  try {
    console.log("Verificando permissões de administrador para usuário ID:", userId);
    
    // 1. Tentar buscar o usuário diretamente
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, email')
      .eq('id', userId)
      .single();
      
    if (!userError && userData && userData.role === 'admin') {
      console.log("Usuário encontrado na tabela users com papel de administrador");
      return true;
    }
    
    if (userData && ADMIN_EMAILS.includes(userData.email)) {
      console.log("Usuário encontrado na tabela users com email administrativo");
      return true;
    }
    
    // 2. Verificar via API de autenticação
    const { data: authData } = await supabase.auth.getUser();
    if (authData && authData.user) {
      const userMetadata = authData.user.user_metadata || {};
      
      if (userMetadata.role === 'admin') {
        console.log("Usuário tem papel de administrador nos metadados");
        return true;
      }
      
      if (ADMIN_EMAILS.includes(authData.user.email || '')) {
        console.log("Usuário tem email administrativo conhecido");
        return true;
      }
    }
    
    console.log("Não foi possível confirmar permissões administrativas pelo sistema auxiliar");
    return false;
  } catch (error) {
    console.error("Erro ao verificar permissões de administrador:", error);
    return false;
  }
};

// Extender a funcionalidade do supabase para incluir um simulador de RPC
// para o check_if_admin enquanto não criamos o procedimento real
const originalRpc = supabase.rpc.bind(supabase);
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

// Função de diagnóstico para verificar conectividade
export const testSupabaseConnection = async (): Promise<{
  authStatus: boolean;
  dbStatus: boolean;
  userTableStatus: boolean;
  storageStatus: boolean;
  details: string[];
}> => {
  const details: string[] = [];
  const result = {
    authStatus: false,
    dbStatus: false,
    userTableStatus: false,
    storageStatus: false,
    details
  };
  
  // Teste 1: Verificar API de autenticação
  try {
    const start = Date.now();
    const { data, error } = await supabase.auth.getSession();
    const elapsed = Date.now() - start;
    
    result.authStatus = !error;
    details.push(`Autenticação: ${!error ? 'OK' : 'Falha'} (${elapsed}ms)`);
    details.push(`- Sessão: ${data.session ? 'Ativa' : 'Inativa'}`);
    
    if (error) {
      details.push(`- Erro: ${error.message}`);
    }
  } catch (e) {
    details.push(`Autenticação: Exceção - ${e instanceof Error ? e.message : String(e)}`);
  }
  
  // Teste 2: Verificar acesso ao banco de dados (tabela simples)
  try {
    const start = Date.now();
    const { error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    const elapsed = Date.now() - start;
    
    result.dbStatus = !error;
    details.push(`Banco de dados: ${!error ? 'OK' : 'Falha'} (${elapsed}ms)`);
    
    if (error) {
      details.push(`- Erro: ${error.message}`);
    }
  } catch (e) {
    details.push(`Banco de dados: Exceção - ${e instanceof Error ? e.message : String(e)}`);
  }
  
  // Teste 3: Verificar acesso à tabela de usuários
  if (result.authStatus) {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (session.session) {
        const start = Date.now();
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('id', session.session.user.id)
          .single();
        const elapsed = Date.now() - start;
        
        result.userTableStatus = !error && !!data;
        details.push(`Tabela de usuários: ${!error && !!data ? 'OK' : 'Falha'} (${elapsed}ms)`);
        
        if (error) {
          details.push(`- Erro: ${error.message}`);
        }
      } else {
        details.push(`Tabela de usuários: Não testada (sem sessão)`);
      }
    } catch (e) {
      details.push(`Tabela de usuários: Exceção - ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    details.push(`Tabela de usuários: Não testada (autenticação falhou)`);
  }
  
  // Teste 4: Verificar acesso ao armazenamento
  try {
    const start = Date.now();
    const { data, error } = await supabase.storage.getBucket('exchanges');
    const elapsed = Date.now() - start;
    
    result.storageStatus = !error;
    details.push(`Armazenamento: ${!error ? 'OK' : 'Falha'} (${elapsed}ms)`);
    
    if (error) {
      details.push(`- Erro: ${error.message}`);
    }
  } catch (e) {
    details.push(`Armazenamento: Exceção - ${e instanceof Error ? e.message : String(e)}`);
  }
  
  return result;
};

// Adicionar função auxiliar para verificar latência do Supabase
export const measureSupabaseLatency = async (): Promise<number> => {
  try {
    const start = Date.now();
    await supabase.from('users').select('count', { count: 'exact', head: true });
    return Date.now() - start;
  } catch (e) {
    console.error('Erro ao medir latência:', e);
    return -1;
  }
};

// Adicionar cache em memória para resultados de pesquisas frequentes
const memoryCache: Record<string, {data: any, expiry: number}> = {};

// Função para retornar dados da cache ou buscar novos
export const getCachedOrFetch = async (
  key: string, 
  fetchFn: () => Promise<any>, 
  expirySeconds = 60
): Promise<any> => {
  const now = Date.now();
  
  // Verificar se temos em cache e se ainda é válido
  if (memoryCache[key] && memoryCache[key].expiry > now) {
    console.log(`Usando dados em cache para: ${key}`);
    return memoryCache[key].data;
  }
  
  // Caso contrário, buscar dados frescos
  console.log(`Buscando dados frescos para: ${key}`);
  try {
    const result = await fetchFn();
    
    // Armazenar em cache
    memoryCache[key] = {
      data: result,
      expiry: now + (expirySeconds * 1000)
    };
    
    return result;
  } catch (error) {
    console.error(`Erro ao buscar dados para ${key}:`, error);
    
    // Se temos dados em cache, mesmo expirados, usamos como fallback
    if (memoryCache[key]) {
      console.log(`Usando dados em cache expirados como fallback para: ${key}`);
      memoryCache[key].expiry = now + (30 * 1000); // Estender por mais 30 segundos
      return memoryCache[key].data;
    }
    
    throw error;
  }
}; 