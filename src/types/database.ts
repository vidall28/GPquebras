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
  productId: string; // Note que usamos productId aqui, mas na tabela é product_id
  quantity: number;
  reason: string;
  photos: string[]; // Photos é derivado de exchange_photos
}

// Interface da Troca/Quebra
export interface Exchange {
  id: string;
  userId: string;
  userName: string;        // Derivado da junção com users
  userRegistration: string;// Derivado da junção com users
  label: string;
  type: 'exchange' | 'breakage';
  items: ExchangeItem[];
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;       // Pode ser um ID de usuário ou nome
}

// Interface para o resultado do teste de conexão Supabase
export interface SupabaseTestResult {
  success: boolean;
  message: string;
  latency?: number;
  details?: any;
}

// Interface para estatísticas de latência Supabase
export interface SupabaseLatencyStats {
  average: number;
  min: number;
  max: number;
  count: number;
  history: number[];
} 