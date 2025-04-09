/**
 * Sistema de Cache Avançado
 * 
 * Este sistema oferece:
 * - Cache em memória para acesso rápido
 * - Persistência opcional em localStorage
 * - Recuperação automática de falhas com versões expiradas
 * - Gerenciamento de expiração de dados
 * - Suporte a timeout em requisições
 */

// Interface para entradas no cache
interface CacheEntry<T> {
  data: T;
  expires: number;
  timestamp: number;
  source?: 'network' | 'cache' | 'stale';
}

// Interface para opções do cache
interface CacheOptions {
  ttl: number;           // Tempo de vida em segundos
  persist: boolean;      // Persistir em localStorage
  timeout?: number;      // Timeout para requisições (ms)
  staleIfError?: boolean; // Usar dados expirados em caso de erro
}

// Opções padrão
const DEFAULT_OPTIONS: CacheOptions = {
  ttl: 300,              // 5 minutos
  persist: true,
  timeout: 8000,         // 8 segundos
  staleIfError: true
};

/**
 * Cache avançado com suporte a persistência e recuperação de falhas
 */
export const advancedCache = {
  // Armazenamento em memória
  store: new Map<string, CacheEntry<any>>(),
  
  /**
   * Obtém dados do cache ou busca novos dados
   * 
   * @param key Chave única para identificar os dados
   * @param fetchFn Função que retorna uma Promise com os dados
   * @param options Opções de cache
   * @returns Promise com os dados
   */
  async get<T>(key: string, fetchFn: () => Promise<T>, options: Partial<CacheOptions> = {}): Promise<T> {
    // Mesclar opções com padrões
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const cacheKey = `cache:${key}`;
    const now = Date.now();
    
    // Verificar cache em memória
    if (this.store.has(cacheKey)) {
      const entry = this.store.get(cacheKey) as CacheEntry<T>;
      if (entry.expires > now) {
        console.log(`Usando dados em cache para: ${key}`);
        return entry.data;
      }
    }
    
    // Verificar cache persistente
    if (opts.persist) {
      const stored = localStorage.getItem(cacheKey);
      if (stored) {
        try {
          const entry = JSON.parse(stored) as CacheEntry<T>;
          if (entry.expires > now) {
            // Salvar também no cache em memória
            this.store.set(cacheKey, entry);
            console.log(`Usando dados do localStorage para: ${key}`);
            return entry.data;
          } else {
            // Manter para uso potencial como fallback
            console.log(`Cache expirado para: ${key}`);
          }
        } catch (e) {
          console.warn(`Erro ao ler cache de localStorage para ${key}:`, e);
        }
      }
    }
    
    // Buscar dados frescos com timeout
    try {
      console.log(`Buscando dados frescos para: ${key}`);
      
      // Função para buscar dados com timeout
      const fetchWithTimeout = async (): Promise<T> => {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Timeout (${opts.timeout}ms) ao buscar ${key}`)), 
                    opts.timeout);
        });
        
        return Promise.race([
          fetchFn(),
          timeoutPromise
        ]);
      };
      
      // Buscar dados frescos
      const data = await fetchWithTimeout();
      
      // Salvar no cache
      const entry: CacheEntry<T> = {
        data,
        expires: now + (opts.ttl * 1000),
        timestamp: now,
        source: 'network'
      };
      
      this.store.set(cacheKey, entry);
      
      if (opts.persist) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(entry));
        } catch (e) {
          console.warn(`Erro ao persistir cache para ${key}:`, e);
        }
      }
      
      return data;
    } catch (error) {
      console.error(`Erro ao buscar dados para ${key}:`, error);
      
      // Tentar usar dados expirados como fallback
      if (opts.staleIfError) {
        // Tentar o cache em memória primeiro
        const expired = this.store.get(cacheKey);
        if (expired) {
          console.warn(`Usando cache expirado (memória) para ${key} após erro`);
          expired.source = 'stale';
          return expired.data;
        }
        
        // Tentar localStorage
        if (opts.persist) {
          const stored = localStorage.getItem(cacheKey);
          if (stored) {
            try {
              const entry = JSON.parse(stored) as CacheEntry<T>;
              console.warn(`Usando cache expirado (localStorage) para ${key} após erro`);
              this.store.set(cacheKey, {...entry, source: 'stale'});
              return entry.data;
            } catch (e) {
              console.warn(`Erro ao ler cache expirado para ${key}:`, e);
            }
          }
        }
      }
      
      // Se não há fallback ou staleIfError é falso, propagar o erro
      throw error;
    }
  },
  
  /**
   * Define manualmente um valor no cache
   * 
   * @param key Chave do cache
   * @param data Dados a serem armazenados
   * @param options Opções de cache
   */
  set<T>(key: string, data: T, options: Partial<CacheOptions> = {}): void {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const cacheKey = `cache:${key}`;
    const now = Date.now();
    
    const entry: CacheEntry<T> = {
      data,
      expires: now + (opts.ttl * 1000),
      timestamp: now,
      source: 'network'
    };
    
    this.store.set(cacheKey, entry);
    
    if (opts.persist) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(entry));
      } catch (e) {
        console.warn(`Erro ao persistir cache para ${key}:`, e);
      }
    }
  },
  
  /**
   * Verifica se existe uma entrada válida no cache
   * 
   * @param key Chave do cache
   * @returns Verdadeiro se existe entrada válida
   */
  has(key: string): boolean {
    const cacheKey = `cache:${key}`;
    const now = Date.now();
    
    // Verificar cache em memória
    if (this.store.has(cacheKey)) {
      const entry = this.store.get(cacheKey);
      if (entry && entry.expires > now) {
        return true;
      }
    }
    
    // Verificar localStorage
    const stored = localStorage.getItem(cacheKey);
    if (stored) {
      try {
        const entry = JSON.parse(stored);
        return entry.expires > now;
      } catch (e) {
        return false;
      }
    }
    
    return false;
  },
  
  /**
   * Invalida uma entrada específica do cache
   * 
   * @param key Chave do cache a ser invalidada
   */
  invalidate(key: string): void {
    const cacheKey = `cache:${key}`;
    this.store.delete(cacheKey);
    localStorage.removeItem(cacheKey);
    console.log(`Cache invalidado para: ${key}`);
  },
  
  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.store.clear();
    
    // Limpar apenas os itens que começam com 'cache:'
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cache:')) {
        localStorage.removeItem(key);
      }
    }
    
    console.log('Cache limpo completamente');
  },
  
  /**
   * Limpa entradas expiradas do cache
   */
  purgeExpired(): void {
    const now = Date.now();
    
    // Limpar memória
    for (const [key, entry] of this.store.entries()) {
      if (entry.expires <= now) {
        this.store.delete(key);
      }
    }
    
    // Limpar localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cache:')) {
        try {
          const stored = localStorage.getItem(key);
          if (stored) {
            const entry = JSON.parse(stored);
            if (entry.expires <= now) {
              localStorage.removeItem(key);
            }
          }
        } catch (e) {
          // Ignorar erros, apenas continuar
        }
      }
    }
    
    console.log('Cache expirado removido');
  }
};

// Inicializar limpeza periódica do cache
// A cada 5 minutos, remove entradas expiradas para economizar memória
setInterval(() => {
  advancedCache.purgeExpired();
}, 300000);

// Exportar funções utilitárias de cache específicas para o contexto do aplicativo

/**
 * Função auxiliar para buscar produtos com cache
 */
export const getCachedProducts = async (forceRefresh = false) => {
  if (forceRefresh) {
    advancedCache.invalidate('products');
  }
  
  return advancedCache.get(
    'products',
    async () => {
      const { data, error } = await import('./supabase').then(
        module => module.supabase.from('products').select('*')
      );
      
      if (error) throw error;
      return data || [];
    },
    { ttl: 300 } // 5 minutos
  );
};

/**
 * Função auxiliar para buscar trocas de um usuário específico com cache
 */
export const getCachedUserExchanges = async (userId: string, forceRefresh = false) => {
  const cacheKey = `user_exchanges_${userId}`;
  
  if (forceRefresh) {
    advancedCache.invalidate(cacheKey);
  }
  
  return advancedCache.get(
    cacheKey,
    async () => {
      const { data, error } = await import('./supabase').then(
        module => module.supabase.from('exchanges')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      );
      
      if (error) throw error;
      return data || [];
    },
    { ttl: 120 } // 2 minutos
  );
};

// Função para limpar cache específico ou todos os caches
export const clearCache = (key?: string) => {
  if (key) {
    // Limpar cache específico
    localStorage.removeItem(`cache_${key}`);
    console.log(`Cache '${key}' limpo`);
  } else {
    // Limpar todos os caches relacionados a exchanges
    const keysToRemove: string[] = [];
    
    // Encontrar todas as chaves de cache relacionadas
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (storageKey && (
          storageKey.startsWith('cache_all_exchanges') || 
          storageKey.startsWith('cache_user_exchanges_') ||
          storageKey === 'cache_users_info'
        )) {
        keysToRemove.push(storageKey);
      }
    }
    
    // Remover as chaves encontradas
    keysToRemove.forEach(k => {
      localStorage.removeItem(k);
      console.log(`Cache '${k}' limpo`);
    });
    
    console.log(`${keysToRemove.length} caches limpos`);
  }
};

// Função para obter dados com cache
export const getCachedOrFetch = async <T>(
  key: string, 
  fetchFn: () => Promise<T>, 
  expirySeconds = 60
): Promise<T> => {
  // Prefixo padrão para as chaves de cache
  const cacheKey = `cache_${key}`;
  
  try {
    // Verificar se há dados em cache
    const cachedData = localStorage.getItem(cacheKey);
    
    if (cachedData) {
      try {
        const { data, expiry } = JSON.parse(cachedData);
        
        // Verificar se o cache ainda é válido
        if (expiry > Date.now()) {
          console.log(`Usando dados em cache para "${key}"`);
          return data as T;
        }
        
        console.log(`Cache para "${key}" expirado`);
      } catch (parseError) {
        console.error(`Erro ao analisar cache para "${key}":`, parseError);
        localStorage.removeItem(cacheKey);
      }
    }
    
    // Se não houver cache válido, buscar dados
    console.log(`Buscando dados frescos para "${key}"`);
    const freshData = await fetchFn();
    
    // Armazenar em cache
    localStorage.setItem(cacheKey, JSON.stringify({
      data: freshData,
      expiry: Date.now() + (expirySeconds * 1000)
    }));
    
    return freshData;
  } catch (error) {
    console.error(`Erro ao buscar/armazenar dados para "${key}":`, error);
    throw error;
  }
}; 