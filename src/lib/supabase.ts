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
    // Aumentar o timeout para 30 segundos (o padrão é 6s)
    fetch: (url: RequestInfo, options?: RequestInit) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      // Adicionar o sinal do AbortController às opções
      const fetchOptions = {
        ...options,
        signal: controller.signal
      };
      
      const fetchPromise = fetch(url, fetchOptions);
      
      fetchPromise.finally(() => clearTimeout(timeoutId));
      
      return fetchPromise;
    }
  },
  // Habilitar logs detalhados em ambiente de desenvolvimento
  debug: import.meta.env.DEV
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