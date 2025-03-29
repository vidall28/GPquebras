import { createClient } from '@supabase/supabase-js';

// Obter variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verificar se as variáveis de ambiente estão definidas
if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: Variáveis de ambiente do Supabase não estão definidas.');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Definido' : 'Indefinido');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseKey ? 'Definido' : 'Indefinido');
  
  // Usar valores padrão definidos diretamente para debug
  // IMPORTANTE: Remover esta parte em produção
  console.warn('Usando valores padrão para desenvolvimento - NÃO USE EM PRODUÇÃO!');
}

// Log para debug dos valores de configuração (valores parciais para segurança)
console.log('Configuração do Supabase:');
console.log('URL:', supabaseUrl);
console.log('API Key:', supabaseKey ? `${supabaseKey.substring(0, 5)}...${supabaseKey.substring(supabaseKey.length - 5)}` : 'Indefinida');

// Configurar o cliente Supabase com opções mais robustas
// No início do arquivo, onde inicializa o cliente Supabase:

// Obter as configurações do Supabase
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verificar e logar as configurações
console.log('Configuração do Supabase:');
console.log('URL:', supabaseUrl);
console.log('API Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 5)}...${supabaseAnonKey.substring(supabaseAnonKey.length - 5)}` : 'Não definida');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('ERRO CRÍTICO: Configuração do Supabase incompleta!');
}

// Configurações avançadas para o cliente
const supabaseOptions = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'quebras-trocas-gp',
      'apikey': supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    fetch: async (url: string, options: any = {}) => {
      // Assegurar que o cabeçalho Authorization esteja presente
      if (!options.headers) {
        options.headers = {};
      }
      
      // Logar informações importantes para debug
      console.log('Iniciando fetch para', url);
      
      // Recuperar token salvo
      const savedToken = localStorage.getItem('sb-auth-token');
      console.log('Recuperando token [sb-auth-token]:', savedToken ? 'Encontrado' : 'Não encontrado');
      
      // Se tivermos um token salvo, incluí-lo manualmente
      if (savedToken) {
        try {
          const tokenData = JSON.parse(savedToken);
          if (tokenData && tokenData.access_token) {
            options.headers['Authorization'] = `Bearer ${tokenData.access_token}`;
          }
        } catch (e) {
          console.error('Erro ao processar token salvo:', e);
        }
      }
      
      // Se não há Authorization header, adicionar ao menos a API key
      if (!options.headers['Authorization']) {
        options.headers['Authorization'] = `Bearer ${supabaseAnonKey}`;
      }
      
      // Garantir que a API key esteja presente
      options.headers['apikey'] = supabaseAnonKey;
      
      // Executar o fetch original
      try {
        const response = await fetch(url, options);
        console.log('Resposta recebida de', url + ':', response.status);
        
        if (response.status === 403) {
          console.warn('Resposta 403 Forbidden recebida. Verificar token de autenticação.');
        }
        
        // Se for uma resposta 401/403, tentar salvar o token atualizado
        if (response.status === 401 || response.status === 403) {
          try {
            // Tentar obter sessão novamente
            const authUrl = `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`;
            const refreshToken = localStorage.getItem('sb-refresh-token');
            
            if (refreshToken) {
              console.log('Tentando renovar token com refresh token');
              const refreshResponse = await fetch(authUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': supabaseAnonKey
                },
                body: JSON.stringify({ refresh_token: refreshToken })
              });
              
              if (refreshResponse.ok) {
                const newTokenData = await refreshResponse.json();
                localStorage.setItem('sb-auth-token', JSON.stringify(newTokenData));
                console.log('Token renovado com sucesso');
              }
            }
          } catch (refreshError) {
            console.error('Erro ao tentar renovar token:', refreshError);
          }
        }
        
        console.log('Finalizando fetch para', url);
        return response;
      } catch (error) {
        console.error('Erro no fetch para', url, error);
        throw error;
      }
    }
  }
};

// Criar o cliente com as opções avançadas e exportá-lo para uso em outros arquivos
export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseOptions);

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

// Função para testar explicitamente a configuração e conexão com Supabase
export const testSupabaseConfig = async (): Promise<{
  success: boolean;
  message: string;
  details: Record<string, any>;
}> => {
  console.log('Testando configuração do Supabase...');
  
  const details: Record<string, any> = {
    supabaseUrl: supabaseUrl || 'Não definido',
    apiKeyLength: supabaseKey ? supabaseKey.length : 0,
    apiKeyDefined: !!supabaseKey,
  };
  
  try {
    // Teste 1: Verificar se as variáveis de ambiente estão definidas
    if (!supabaseUrl || !supabaseKey) {
      return {
        success: false,
        message: 'Variáveis de ambiente do Supabase não estão definidas corretamente',
        details
      };
    }
    
    // Teste 2: Fazer uma requisição simples para verificar a autenticação
    console.log('Fazendo teste de requisição básica ao Supabase...');
    
    // Criamos uma nova instância do cliente para testar explicitamente
    const testClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    // Tentar fazer uma requisição simples
    const { error } = await testClient
      .from('users')
      .select('count', { count: 'exact', head: true });
      
    if (error) {
      console.error('Erro na requisição de teste:', error);
      details.error = error;
      
      // Verificar se é um erro de API key
      if (error.message?.includes('API key') || error.code === '401') {
        return {
          success: false,
          message: 'Chave API do Supabase inválida ou não está sendo enviada corretamente',
          details
        };
      }
      
      return {
        success: false,
        message: `Erro ao conectar ao Supabase: ${error.message}`,
        details
      };
    }
    
    // Teste 3: Verificar autenticação
    const { data: authData, error: authError } = await testClient.auth.getSession();
    
    details.sessionExists = !!authData?.session;
    
    if (authError) {
      console.error('Erro ao verificar autenticação:', authError);
      details.authError = authError;
    }
    
    return {
      success: true,
      message: 'Configuração do Supabase parece estar correta',
      details
    };
  } catch (e) {
    console.error('Erro grave ao testar configuração do Supabase:', e);
    details.criticalError = e instanceof Error ? e.message : String(e);
    
    return {
      success: false,
      message: 'Erro grave ao testar configuração do Supabase',
      details
    };
  }
};

// Exportar tipo de retorno da função de teste
export type SupabaseTestResult = Awaited<ReturnType<typeof testSupabaseConfig>>;

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
        
        // Segunda tentativa com merge
        console.log('Tentando inserção com merge...');
        const { error: mergeError } = await supabase
          .from('users')
          .insert([{
            id: user.id,
            name: user.name,
            registration: user.registration,
            email: user.email,
            role: user.role,
            status: user.status
          }])
          .onConflict('id')
          .merge();
          
        if (mergeError) {
          console.error('Erro também na inserção com merge:', mergeError);
          return { success: false, error: mergeError };
        }
        
        console.log('Usuário inserido com sucesso usando merge');
        return { success: true };
      }
      
      console.log('Usuário inserido com sucesso');
      return { success: true };
    }
  } catch (error) {
    console.error('Erro durante upsert de usuário:', error);
    return { success: false, error };
  }
}; 