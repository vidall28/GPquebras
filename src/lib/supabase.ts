import { createClient } from '@supabase/supabase-js';

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
      'apikey': supabaseKey,
      'Content-Type': 'application/json',
    },
    fetch: async (url: string, options: any = {}) => {
      // Logs importantes para debug
      console.log('Iniciando fetch para', url);
      
      // Assegurar que headers existam
      if (!options.headers) {
        options.headers = {};
      }
      
      // Garantir que a API key esteja presente
      if (!options.headers['apikey']) {
        options.headers['apikey'] = supabaseKey;
      }
      
      // Garantir que Authorization esteja presente
      if (!options.headers['Authorization']) {
        options.headers['Authorization'] = `Bearer ${supabaseKey}`;
      }
      
      // Logs de debugging para headers mais importantes
      console.log('Headers da requisição:');
      console.log('- API Key:', options.headers['apikey'] ? 'Configurada' : 'Não configurada');
      console.log('- Authorization:', options.headers['Authorization'] ? 'Configurada' : 'Não configurada');
      
      // Executar o fetch original
      try {
        const response = await fetch(url, options);
        console.log('Resposta recebida de', url + ':', response.status);
        return response;
      } catch (error) {
        console.error('Erro no fetch para', url, error);
        throw error;
      }
    }
  }
};

// CRIAR e EXPORTAR o cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseKey, supabaseOptions);

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
            console.log(`Usuário ${userId} identificado como admin via email: ${userEmail}`);
            clearTimeout(timeoutId);
            return resolve(true);
          }
          
          const userMeta = authUser?.user?.user_metadata;
          if (userMeta && userMeta.role === 'admin') {
            console.log(`Usuário ${userId} identificado como admin via metadados`);
            clearTimeout(timeoutId);
            return resolve(true);
          }
        } catch (metaError) {
          console.error('Erro ao verificar admin via metadados:', metaError);
        }
        
        // 2. Verificar diretamente na tabela de usuários (mais rápido que RPC)
        try {
          console.log(`Verificando admin para usuário ${userId} via tabela users...`);
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', userId)
            .maybeSingle();
          
          if (!userError && userData && userData.role === 'admin') {
            console.log(`Usuário ${userId} identificado como admin via tabela users`);
            clearTimeout(timeoutId);
            return resolve(true);
          }
        } catch (dbError) {
          console.error('Erro ao verificar admin via tabela users:', dbError);
        }
        
        // 3. Por último, tentar o RPC (pode ser mais lento)
        console.log(`Chamando o procedimento check_if_admin para o usuário ${userId}`);
        const { data, error } = await supabase.rpc('check_if_admin', { user_id: userId });
        
        // Limpar o timeout, pois a requisição foi concluída
        clearTimeout(timeoutId);
        
        if (error) {
          console.error('Erro ao verificar status de administrador via RPC:', error);
          return resolve(false);
        }
        
        console.log(`Resultado da verificação de admin para o usuário ${userId}:`, data);
        return resolve(!!data);
      } catch (error) {
        // Limpar o timeout em caso de erro
        clearTimeout(timeoutId);
        console.error('Exceção ao verificar status de administrador:', error);
        return resolve(false);
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

// Função para verificar rapidamente a conexão com o Supabase
export const quickConnectionCheck = async (): Promise<{ ok: boolean, latency: number, message: string }> => {
  console.log('Executando verificação rápida de conexão com Supabase...');
  
  try {
    const startTime = Date.now();
    
    // Verificar se temos as configurações básicas
    if (!supabaseUrl || !supabaseKey) {
      return {
        ok: false,
        latency: -1,
        message: 'Configurações do Supabase não encontradas'
      };
    }
    
    // Fazer uma requisição simples que não exige autenticação
    const { error } = await supabase
      .from('users')
      .select('count', { count: 'exact', head: true })
      .limit(1);
    
    const endTime = Date.now();
    const latency = endTime - startTime;
    
    if (error) {
      console.error('Erro na verificação rápida de conexão:', error);
      
      // Verificar se é um erro de API key
      if (error.message?.includes('JWT') || error.message?.includes('key') || error.code === '401') {
        return {
          ok: false,
          latency,
          message: `Erro de API key: ${error.message}`
        };
      }
      
      // Verificar se é um erro de conexão
      if (error.message?.includes('fetch') || error.message?.includes('network') || error.code === 'NETWORK_ERROR') {
        return {
          ok: false,
          latency,
          message: `Erro de conexão: ${error.message}`
        };
      }
      
      return {
        ok: false,
        latency,
        message: `Erro: ${error.message}`
      };
    }
    
    return {
      ok: true,
      latency,
      message: `Conexão OK (${latency}ms)`
    };
  } catch (error) {
    console.error('Exceção na verificação rápida de conexão:', error);
    return {
      ok: false,
      latency: -1,
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}; 