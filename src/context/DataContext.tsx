import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { supabase, User, Tables, mappers, rpc } from '@/lib/supabase';
import { getCachedOrFetch, clearCache } from '@/lib/cache';
import { useAuth } from './AuthContext';

// Define interfaces
export interface Product {
  id: string;
  name: string;
  code: string;
  capacity: number; // in ml
}

export interface ExchangeItem {
  id: string;
  productId: string;
  quantity: number;
  reason: string;
  photos: string[]; // Base64 encoded images
}

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

interface DataContextType {
  // Products
  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  getProduct: (id: string) => Product | undefined;
  exportProductsToCSV: () => void;
  importProductsFromCSV: (csvData: string) => Promise<{ success: number; errors: number; errorDetails: string[] }>;
  reloadProducts: () => Promise<void>;
  
  // Exchanges
  exchanges: Exchange[];
  addExchange: (exchange: Omit<Exchange, 'id' | 'createdAt'>) => Promise<string | null>;
  updateExchange: (id: string, status: 'pending' | 'approved' | 'rejected', notes?: string, updatedBy?: string) => Promise<void>;
  deleteExchange: (id: string) => Promise<void>;
  getExchange: (id: string) => Exchange | undefined;
  fetchExchanges: (forceRefresh?: boolean) => Promise<void>;
  forceRefreshExchanges: (specificExchangeId?: string) => Promise<boolean>;
  
  // Users (only for admin)
  users: User[];
  updateUserStatus: (id: string, status: 'active' | 'inactive') => Promise<void>;
  updateUserRole: (id: string, role: 'admin' | 'user') => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  
  // Loading state
  isLoading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAdmin, isAuthenticated } = useAuth();

  // Função para carregar produtos do Supabase
  const fetchProducts = async () => {
    console.log('========== INICIANDO CARREGAMENTO DE PRODUTOS ==========');
    setIsLoading(true);
    
    try {
      // Usar o sistema de cache para produtos
      const result = await getCachedOrFetch('products', async () => {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .order('name');
          
        if (error) {
          throw error;
        }
        
        return data || [];
      }, 120); // Cache válido por 2 minutos
      
      console.log(`Carregados ${result.length} produtos`);
      setProducts(result);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast.error('Erro ao carregar lista de produtos');
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar produtos do Supabase
  useEffect(() => {
    if (isAuthenticated) {
      // Aguardar um curto período para garantir que o usuário esteja carregado
      const timer = setTimeout(() => {
        if (user) {
          fetchProducts();
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user]);

  // Carregar exchanges do Supabase
  const fetchExchanges = async (forceRefresh = false) => {
    if (!user) {
      console.log('Não há usuário autenticado, ignorando fetchExchanges');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const cacheKey = isAdmin ? 'all_exchanges' : `user_exchanges_${user.id}`;
      const isMobile = isMobileDevice();
      
      // Verificar se há uma conexão lenta para aplicar otimizações adicionais
      const isSlowConnection = (window as any).isSlowConnection;
      
      // Forçar limpeza de cache se solicitado ou primeira carga em móveis
      let shouldRefresh = forceRefresh;
      
      // Usar sessionStorage para evitar refreshes desnecessários em dispositivos móveis
      if (isMobile) {
        const lastRefresh = sessionStorage.getItem('lastExchangeRefresh');
        const now = Date.now();
        
        // Só forçar refresh em mobile se a última atualização foi há mais de 2 minutos
        if (!lastRefresh || (now - parseInt(lastRefresh)) > 120000) {
          shouldRefresh = true;
          sessionStorage.setItem('lastExchangeRefresh', now.toString());
          console.log('[DataContext] Forçando atualização no mobile após tempo limite');
        } else {
          console.log('[DataContext] Usando cache recente para mobile');
        }
      }
      
      if (shouldRefresh) {
        console.log(`[DataContext] Limpando cache. Dispositivo móvel: ${isMobile ? 'sim' : 'não'}, Conexão lenta: ${isSlowConnection ? 'sim' : 'não'}`);
        clearCache(cacheKey);
      }
      
      // Tempos de cache adaptados à velocidade da conexão
      let cacheTime = 60; // Padrão: 1 minuto
      
      if (isMobile) {
        // Mobile padrão: 30 segundos
        cacheTime = 30;
        
        // Conexão lenta: 2 minutos para reduzir chamadas ao servidor
        if (isSlowConnection) {
          cacheTime = 120;
          console.log('[DataContext] Usando tempo de cache estendido para conexão lenta');
        }
      }
      
      // Limitar campos em conexões lentas para melhorar desempenho
      let selectQuery = `
        *,
        exchange_items (
          *,
          exchange_photos (*)
        )
      `;
      
      // Em conexões lentas, buscar menos dados inicialmente
      if (isSlowConnection) {
        selectQuery = `
          id, user_id, label, type, status, notes, created_at, updated_at, updated_by,
          exchange_items (
            id, product_id, quantity, reason
          )
        `;
        console.log('[DataContext] Usando consulta otimizada para conexão lenta');
      }
      
      const result = await getCachedOrFetch(cacheKey, async () => {
        // Criar a consulta base com seleção adaptada
        let query = supabase
          .from('exchanges')
          .select(selectQuery);
          
        // Filtrar por usuário se não for admin
        if (!isAdmin) {
          query = query.eq('user_id', user.id);
        }
        
        // Em conexões lentas, limitar o número de registros para carregamento inicial
        if (isSlowConnection) {
          query = query.limit(10);
          console.log('[DataContext] Limitando registros para conexão lenta');
        }
        
        // Ordenar por data de criação (mais recentes primeiro)
        query = query.order('created_at', { ascending: false });
        
        console.log('[DataContext] Consultando trocas/quebras. Usuário é admin?', isAdmin);
        const { data, error } = await query;
        
        if (error) {
          console.error('[DataContext] Erro ao buscar trocas/quebras:', error);
          throw error;
        }
        
        console.log(`[DataContext] Encontradas ${data?.length || 0} trocas/quebras`);
        
        // Processar os dados para o formato da aplicação
        const processedExchanges: Exchange[] = data?.map(exchange => {
          // Para conexões lentas, garantir estrutura consistente mesmo com dados limitados
          const items = exchange.exchange_items.map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            quantity: item.quantity,
            reason: item.reason,
            photos: item.exchange_photos ? item.exchange_photos.map((photo: any) => photo.photo_url) : []
          }));
          
          return {
            id: exchange.id,
            userId: exchange.user_id,
            userName: '', // será preenchido mais tarde
            userRegistration: '', // será preenchido mais tarde
            label: exchange.label,
            type: exchange.type,
            status: exchange.status,
            notes: exchange.notes || '',
            items: items,
            createdAt: exchange.created_at,
            updatedAt: exchange.updated_at || '',
            updatedBy: exchange.updated_by || ''
          };
        }) || [];
        
        return processedExchanges;
      }, cacheTime);
      
      // Buscar informações dos usuários se tivermos trocas
      if (result.length > 0) {
        // Coletar IDs únicos de usuários
        const userIds = [...new Set(result.map(exchange => exchange.userId))];
        
        // Buscar informações de usuários
        const usersResult = await getCachedOrFetch('users_info', async () => {
          const { data: usersData, error: usersError } = await supabase
            .from('users')
            .select('id, name, registration')
            .in('id', userIds);
            
          if (usersError) {
            throw usersError;
          }
          
          // Criar um mapa para acesso rápido
          const usersMap: Record<string, {name: string, registration: string}> = {};
          
          usersData?.forEach((user: any) => {
            usersMap[user.id] = {
              name: user.name,
              registration: user.registration
            };
          });
          
          return usersMap;
        }, 30); // Reduzir tempo de cache para 30 segundos (era 300) para garantir dados mais atualizados
        
        // Adicionar informações de usuários às trocas
        const exchangesWithUserInfo = result.map(exchange => {
          // Tentar obter informações do usuário novamente se não encontrado no cache
          if (!usersResult[exchange.userId]) {
            console.log(`Usuário não encontrado no cache para ID: ${exchange.userId}, tentando buscar individualmente`);
            // Buscar dados individualmente se não encontrado no cache
            supabase
              .from('users')
              .select('id, name, registration')
              .eq('id', exchange.userId)
              .single()
              .then(({ data }) => {
                if (data) {
                  // Armazenar no local para futuras referências
                  usersResult[exchange.userId] = {
                    name: data.name,
                    registration: data.registration
                  };
                }
              })
              .catch(err => console.error(`Erro ao buscar usuário individual: ${err}`));
          }
          
          const userInfo = usersResult[exchange.userId] || { 
            name: `Usuário (${exchange.userId?.slice(0, 8)})`, 
            registration: exchange.userRegistration || '00000000' 
          };
          
          return {
            ...exchange,
            userName: userInfo.name,
            userRegistration: userInfo.registration
          };
        });
        
        console.log(`Carregadas ${exchangesWithUserInfo.length} trocas/quebras`);
        setExchanges(exchangesWithUserInfo);
      } else {
        console.log('Nenhuma troca/quebra encontrada');
        setExchanges([]);
      }
    } catch (error) {
      console.error('Erro ao carregar trocas/quebras:', error);
      toast.error('Erro ao carregar histórico de trocas/quebras');
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar usuários do Supabase (somente para admin)
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user || user.role !== 'admin') return;
      
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('name');
          
        if (error) {
          throw error;
        }
        
        if (data) {
          console.log('Dados brutos dos usuários do Supabase:', data);
          const mappedUsers = data.map(mappers.mapUserFromDB);
          console.log('Usuários mapeados após transformação:', mappedUsers);
          setUsers(mappedUsers);
        }
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        toast.error('Erro ao carregar lista de usuários');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUsers();
  }, [user]);

  // Efeito para carregar trocas quando o usuário muda ou o isAdmin muda
  useEffect(() => {
    if (user) {
      console.log('Usuário autenticado, carregando trocas/quebras...');
      // Forçar atualização para garantir dados atualizados
      fetchExchanges(true);
    }
  }, [user, isAdmin]); // Adicionamos isAdmin para recarregar quando o status de admin mudar

  // Products methods
  const addProduct = async (product: Omit<Product, 'id'>) => {
    try {
      setIsLoading(true);
      
      console.log('========== INICIANDO ADIÇÃO DE PRODUTO ==========');
      console.log('Dados do produto:', product);
      console.log('Usuário atual:', user);
      
      // Validações adicionais
      if (!product.name || !product.code || !product.capacity) {
        console.error('Dados do produto incompletos:', product);
        throw new Error('Todos os campos do produto são obrigatórios');
      }
      
      if (!user) {
        console.error('Usuário não autenticado');
        throw new Error('Você precisa estar autenticado para adicionar produtos');
      }
      
      if (user.role !== 'admin') {
        console.error('Usuário não é administrador:', user);
        throw new Error('Apenas administradores podem adicionar produtos');
      }

      // Verificação adicional de sessão
      console.log('Verificando sessão antes de adicionar produto...');
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Erro ao verificar sessão:', sessionError);
        throw new Error('Erro ao verificar sua sessão. Tente fazer login novamente.');
      }
      
      if (!sessionData.session) {
        console.error('Sessão inválida ou expirada');
        throw new Error('Sua sessão expirou. Por favor, faça login novamente.');
      }
      
      console.log('Sessão válida encontrada:', sessionData.session.user.id);
      console.log('Iniciando requisição ao Supabase para adicionar produto');
      
      // Inserir produto no Supabase com timeout mais longo e verificação detalhada de erros
      console.log('Enviando dados para o Supabase:', {
        name: product.name,
        code: product.code,
        capacity: product.capacity
      });
      
      // Inserir produto no Supabase com timeout mais longo
      const { data, error } = await Promise.race([
        supabase
          .from('products')
          .insert([{
            name: product.name,
            code: product.code,
            capacity: product.capacity
          }])
          .select()
          .single(),
        new Promise<{data: null, error: Error}>((resolve) => 
          setTimeout(() => resolve({
            data: null, 
            error: new Error('Timeout ao adicionar produto')
          }), 15000)
        )
      ]) as any;
        
      if (error) {
        console.error('Erro detalhado do Supabase:', error);
        console.log('Código do erro:', error.code);
        console.log('Mensagem do erro:', error.message);
        console.log('Detalhes do erro:', error.details);
        
        // Verificar o tipo de erro para dar feedback mais preciso
        if (error.code === '42501') {
          throw new Error(`Erro de permissão: Você não tem permissão para adicionar produtos. Certifique-se de que seu usuário tem a role 'admin'.`);
        } else if (error.code === '23505') {
          throw new Error(`Já existe um produto com este código: ${product.code}`);
        } else if (error.message?.includes('timeout')) {
          throw new Error('A operação demorou muito tempo. Verifique sua conexão com o Supabase.');
        } else {
          throw error;
        }
      }
      
      // Adicionar ao state
      if (data) {
        console.log('Produto adicionado com sucesso:', data);
        const newProduct = mappers.mapProductFromDB(data);
        setProducts(prev => [...prev, newProduct]);
        
        // Tentar buscar produtos novamente para garantir sincronização
        console.log('Atualizando lista de produtos após adição...');
        try {
          const { data: refreshData, error: refreshError } = await supabase
            .from('products')
            .select('*')
            .order('name');
            
          if (refreshError) {
            console.error('Erro ao atualizar lista de produtos:', refreshError);
          } else if (refreshData) {
            console.log(`Lista atualizada: ${refreshData.length} produtos encontrados`);
            const mappedProducts = refreshData.map(mappers.mapProductFromDB);
            setProducts(mappedProducts);
          }
        } catch (refreshError) {
          console.error('Erro ao atualizar lista de produtos:', refreshError);
        }
        
        toast.success('Produto adicionado com sucesso');
      } else {
        console.error('Erro: Produto não foi adicionado (sem dados retornados)');
        throw new Error('Erro ao adicionar produto: Nenhum dado retornado do servidor');
      }
      
      console.log('========== FIM DA ADIÇÃO DE PRODUTO ==========');
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
      console.trace('Stack trace completo:');
      
      // Mostrar mensagem de erro mais detalhada para o usuário
      if (error instanceof Error) {
        toast.error(`Erro ao adicionar produto: ${error.message}`);
      } else {
        toast.error('Erro desconhecido ao adicionar produto');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateProduct = async (id: string, product: Partial<Product>) => {
    try {
      setIsLoading(true);
      console.log(`[DEBUG] Iniciando atualização do produto ID: ${id}`, product);
      
      // Verificar se o usuário é administrador
      if (!user || user.role !== 'admin') {
        console.error('Tentativa de atualização sem permissão de administrador');
        toast.error('Apenas administradores podem atualizar produtos');
        return;
      }
      
      // Atualizar produto no Supabase
      console.log(`[DEBUG] Enviando atualização para o Supabase...`);
      const { error } = await supabase
        .from('products')
        .update({
          name: product.name,
          code: product.code,
          capacity: product.capacity
        })
        .eq('id', id);
        
      if (error) {
        console.error('Erro na operação de atualização:', error);
        
        // Verificar se é um erro de permissão
        if (error.message.includes('permission') || error.message.includes('policy')) {
          toast.error('Erro de permissão: Verifique se você tem o papel de administrador corretamente configurado');
          console.error('Detalhes do erro de permissão:', error.message, error.details);
        } else if (error.message.includes('duplicate') || error.message.includes('unique')) {
          toast.error('Já existe um produto com este código');
        } else {
          toast.error(`Erro ao atualizar produto: ${error.message}`);
        }
        
        throw error;
      }
      
      // Atualizar no state
      setProducts(prev => 
        prev.map(p => p.id === id ? { ...p, ...product } : p)
      );
      
      console.log(`[DEBUG] Produto atualizado com sucesso`);
      toast.success('Produto atualizado com sucesso');
    } catch (error) {
      console.error('Erro detalhado na atualização do produto:', error);
      toast.error('Erro ao atualizar produto. Verifique o console para mais detalhes.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const deleteProduct = async (id: string) => {
    try {
      setIsLoading(true);
      console.log(`[DEBUG] Iniciando exclusão do produto ID: ${id}`);
      
      // Verificar se o usuário é administrador
      if (!user || user.role !== 'admin') {
        console.error('Tentativa de exclusão sem permissão de administrador');
        toast.error('Apenas administradores podem excluir produtos');
        return;
      }
      
      // Verificar se o produto está sendo usado em alguma troca
      console.log(`[DEBUG] Verificando uso do produto em trocas...`);
      const { data: usedItems, error: checkError } = await supabase
        .from('exchange_items')
        .select('id')
        .eq('product_id', id)
        .limit(1);
        
      if (checkError) {
        console.error('Erro ao verificar uso do produto:', checkError);
        throw checkError;
      }
      
      if (usedItems && usedItems.length > 0) {
        console.log(`[DEBUG] Produto em uso em ${usedItems.length} trocas`);
        toast.error('Não é possível excluir este produto pois ele está sendo usado em registros de trocas');
        return;
      }
      
      // Excluir produto do Supabase
      console.log(`[DEBUG] Executando exclusão do produto...`);
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Erro na operação de exclusão:', error);
        
        // Verificar se é um erro de permissão
        if (error.message.includes('permission') || error.message.includes('policy')) {
          toast.error('Erro de permissão: Verifique se você tem o papel de administrador corretamente configurado');
          console.error('Detalhes do erro de permissão:', error.message, error.details);
        } else {
          toast.error(`Erro ao excluir produto: ${error.message}`);
        }
        
        throw error;
      }
      
      // Remover do state
      setProducts(prev => prev.filter(p => p.id !== id));
      console.log(`[DEBUG] Produto excluído com sucesso`);
      toast.success('Produto removido com sucesso');
    } catch (error) {
      console.error('Erro detalhado na exclusão do produto:', error);
      toast.error('Erro ao excluir produto. Verifique o console para mais detalhes.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const getProduct = (id: string) => products.find(p => p.id === id);

  const exportProductsToCSV = () => {
    try {
      // Criar cabeçalho
      let csvContent = 'nome,codigo,capacidade_ml\n';
      
      // Adicionar dados de produtos
      products.forEach(product => {
        // Escapar vírgulas e aspas para formato CSV correto
        const name = `"${product.name.replace(/"/g, '""')}"`;
        const code = `"${product.code.replace(/"/g, '""')}"`;
        
        const row = [
          name,
          code,
          product.capacity
        ].join(',');
        
        csvContent += row + '\n';
      });
      
      // Criar e baixar o arquivo CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `produtos_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Lista de produtos exportada com sucesso');
    } catch (error) {
      console.error('Erro ao exportar produtos:', error);
      toast.error('Erro ao exportar produtos');
    }
  };
  
  const importProductsFromCSV = async (csvData: string): Promise<{ success: number; errors: number; errorDetails: string[] }> => {
    try {
      setIsLoading(true);
      
      const lines = csvData.split('\n');
      const header = lines[0].toLowerCase();
      
      // Verificar se o cabeçalho está no formato esperado
      if (!header.includes('nome') || !header.includes('codigo') || 
          !(header.includes('capacidade') || header.includes('capacidade_ml'))) {
        throw new Error('Formato de CSV inválido. O cabeçalho deve conter: nome, codigo, capacidade_ml');
      }
      
      // Preparar para processar
      const results = {
        success: 0,
        errors: 0,
        errorDetails: [] as string[]
      };
      
      // Encontrar índices das colunas
      const headerCols = header.split(',');
      const nameIndex = headerCols.findIndex(col => col.trim() === 'nome');
      const codeIndex = headerCols.findIndex(col => col.includes('codigo'));
      const capacityIndex = headerCols.findIndex(col => 
        col.includes('capacidade') || col.includes('capacidade_ml'));
      
      if (nameIndex === -1 || codeIndex === -1 || capacityIndex === -1) {
        throw new Error('Colunas obrigatórias não encontradas no CSV');
      }
      
      // Processar produtos - pulando o cabeçalho
      const productsToAdd = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Pular linhas vazias
        
        try {
          // Dividir linha do CSV corretamente, lidando com campos que têm aspas e vírgulas
          let fields: string[] = [];
          let inQuotes = false;
          let currentField = '';
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              fields.push(currentField);
              currentField = '';
            } else {
              currentField += char;
            }
          }
          fields.push(currentField); // Adicionar o último campo
          
          // Extrair dados
          const name = fields[nameIndex].replace(/^"|"$/g, '').replace(/""/g, '"').trim();
          const code = fields[codeIndex].replace(/^"|"$/g, '').replace(/""/g, '"').trim();
          const capacityStr = fields[capacityIndex].replace(/^"|"$/g, '').trim();
          
          if (!name || !code || !capacityStr) {
            throw new Error(`Linha ${i+1}: Campos obrigatórios ausentes`);
          }
          
          // Converter capacidade para número
          let capacity = parseInt(capacityStr);
          if (isNaN(capacity) || capacity <= 0) {
            throw new Error(`Linha ${i+1}: Capacidade inválida: ${capacityStr}`);
          }
          
          // Verificar se o código já existe nos produtos existentes
          if (products.some(p => p.code === code)) {
            throw new Error(`Linha ${i+1}: Código '${code}' já existe`);
          }
          
          // Verificar se o código já existe nos produtos a serem adicionados
          if (productsToAdd.some(p => p.code === code)) {
            throw new Error(`Linha ${i+1}: Código '${code}' duplicado na planilha`);
          }
          
          // Produto validado, adicionar à lista
          productsToAdd.push({
            name, 
            code, 
            capacity
          });
        } catch (error: any) {
          results.errors++;
          results.errorDetails.push(error.message || `Erro ao processar linha ${i+1}`);
        }
      }
      
      // Se tiver produtos para adicionar, fazer o insert em lote
      if (productsToAdd.length > 0) {
        const { data, error } = await supabase
          .from('products')
          .insert(productsToAdd)
          .select();
        
        if (error) {
          console.error('Erro ao inserir produtos:', error);
          throw new Error(`Erro ao inserir produtos: ${error.message}`);
        }
        
        // Adicionar produtos ao state local
        if (data) {
          const newProducts = data.map(mappers.mapProductFromDB);
          setProducts(prev => [...prev, ...newProducts]);
          results.success = newProducts.length;
        }
      }
      
      // Mostrar resultado
      if (results.success > 0) {
        toast.success(`${results.success} produtos importados com sucesso`);
      }
      
      if (results.errors > 0) {
        toast.error(`${results.errors} erros encontrados durante a importação`);
      }
      
      return results;
    } catch (error) {
      console.error('Erro ao importar produtos:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao importar produtos';
      toast.error(errorMessage);
      return {
        success: 0,
        errors: 1,
        errorDetails: [errorMessage]
      };
    } finally {
      setIsLoading(false);
    }
  };
  
  // Função auxiliar para buscar uma troca completa e atualizar o state
  const fetchExchangeAndUpdateState = async (exchangeId: string) => {
    try {
      // Buscar a troca
      const { data: exchangeData, error: exchangeError } = await supabase
        .from('exchanges')
        .select('*')
        .eq('id', exchangeId)
        .single();
        
      if (exchangeError) {
        throw exchangeError;
      }
      
      // Buscar dados do usuário
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, registration')
        .eq('id', exchangeData.user_id)
        .single();
        
      if (userError) {
        console.error(`Erro ao buscar dados do usuário ${exchangeData.user_id}:`, userError);
        // Continuar com valores padrão
      }
      
      // Buscar os itens
      const { data: itemsData, error: itemsError } = await supabase
        .from('exchange_items')
        .select('*')
        .eq('exchange_id', exchangeId);
        
      if (itemsError) {
        throw itemsError;
      }
      
      // Para cada item, buscar as fotos
      const itemsWithPhotos = await Promise.all(
        itemsData.map(async (item) => {
          const { data: photosData, error: photosError } = await supabase
            .from('exchange_photos')
            .select('photo_url')
            .eq('exchange_item_id', item.id);
            
          if (photosError) {
            console.error('Erro ao buscar fotos do item:', photosError);
            return {
              id: item.id,
              productId: item.product_id,
              quantity: item.quantity,
              reason: item.reason,
              photos: []
            };
          }
          
          return {
            id: item.id,
            productId: item.product_id,
            quantity: item.quantity,
            reason: item.reason,
            photos: photosData.map(photo => photo.photo_url)
          };
        })
      );
      
      // Criar objeto de troca completo
      const completeExchange: Exchange = {
        id: exchangeData.id,
        userId: exchangeData.user_id,
        userName: userData?.name || 'Usuário Desconhecido',
        userRegistration: userData?.registration || 'N/A',
        label: exchangeData.label,
        type: exchangeData.type,
        status: exchangeData.status,
        notes: exchangeData.notes || undefined,
        createdAt: exchangeData.created_at,
        updatedAt: exchangeData.updated_at || undefined,
        updatedBy: exchangeData.updated_by || undefined,
        items: itemsWithPhotos as ExchangeItem[]
      };
      
      // Atualizar o state
      setExchanges(prev => {
        const existingIndex = prev.findIndex(e => e.id === exchangeId);
        if (existingIndex >= 0) {
          // Substituir o existente
          const newExchanges = [...prev];
          newExchanges[existingIndex] = completeExchange;
          return newExchanges;
        } else {
          // Adicionar o novo
          return [completeExchange, ...prev];
        }
      });
    } catch (error) {
      console.error('Erro ao buscar troca completa:', error);
      throw error;
    }
  };
  
  // Atualizar troca/quebra (aprovação ou rejeição)
  const updateExchange = async (id: string, status: 'pending' | 'approved' | 'rejected', notes?: string, updatedBy?: string) => {
    setIsLoading(true);
    
    try {
      // Usar a função RPC para atualizar o status
      const success = await rpc.updateExchangeStatus(id, status, notes);
      
      if (!success) {
        throw new Error('Falha ao atualizar status');
      }
      
      // Atualizar o estado local
      setExchanges(prevExchanges => 
        prevExchanges.map(exchange => 
          exchange.id === id 
            ? { 
                ...exchange, 
                status, 
                notes: notes || exchange.notes, 
                updatedAt: new Date().toISOString(),
                updatedBy: updatedBy || user?.id || ''
              } 
            : exchange
        )
      );
      
      // Limpar cache para forçar recarregamento em outras sessões
      clearCache('all_exchanges');
      clearCache(`user_exchanges_${exchanges.find(e => e.id === id)?.userId}`);
      
      toast.success('Status atualizado com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar status da troca/quebra:', error);
      toast.error('Erro ao atualizar status');
      
      // Tentar uma atualização de emergência se normal falhar (apenas para admins)
      if (isAdmin && user) {
        try {
          console.log('Tentando atualização de emergência como admin');
          const success = await rpc.emergencyUpdateExchange(id, status, notes, user.id);
          
          if (success) {
            // Atualizar o estado local
            setExchanges(prevExchanges => 
              prevExchanges.map(exchange => 
                exchange.id === id 
                  ? { 
                      ...exchange, 
                      status, 
                      notes: notes || exchange.notes, 
                      updatedAt: new Date().toISOString(),
                      updatedBy: user.id
                    } 
                  : exchange
              )
            );
            
            clearCache('all_exchanges');
            toast.success('Atualização de emergência realizada');
          } else {
            toast.error('Falha na atualização de emergência');
          }
        } catch (emergencyError) {
          console.error('Erro na atualização de emergência:', emergencyError);
          toast.error('Falha na atualização de emergência');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const deleteExchange = async (id: string) => {
    try {
      setIsLoading(true);
      
      // Buscar todos os itens da troca
      const { data: items, error: itemsError } = await supabase
        .from('exchange_items')
        .select('id')
        .eq('exchange_id', id);
        
      if (itemsError) {
        throw itemsError;
      }
      
      // Excluir todas as fotos de cada item
      for (const item of items) {
        const { error: photosError } = await supabase
          .from('exchange_photos')
          .delete()
          .eq('exchange_item_id', item.id);
          
        if (photosError) {
          throw photosError;
        }
      }
      
      // Excluir todos os itens
      const { error: deleteItemsError } = await supabase
        .from('exchange_items')
        .delete()
        .eq('exchange_id', id);
        
      if (deleteItemsError) {
        throw deleteItemsError;
      }
      
      // Excluir a troca principal
      const { error: deleteExchangeError } = await supabase
        .from('exchanges')
        .delete()
        .eq('id', id);
        
      if (deleteExchangeError) {
        throw deleteExchangeError;
      }
      
      // Atualizar o state
      setExchanges(prev => prev.filter(e => e.id !== id));
      
      toast.success('Registro removido com sucesso');
    } catch (error) {
      console.error('Erro ao excluir registro:', error);
      toast.error('Erro ao excluir registro');
    } finally {
      setIsLoading(false);
    }
  };
  
  const getExchange = (id: string) => exchanges.find(e => e.id === id);

  // Users methods (admin only)
  const updateUserStatus = async (id: string, status: 'active' | 'inactive') => {
    try {
      setIsLoading(true);
      console.log(`[DEBUG] Iniciando atualização de status do usuário ID: ${id} para ${status}`);
      
      // Verificar se o usuário é administrador
      if (!user || user.role !== 'admin') {
        console.error('Tentativa de atualização de usuário sem permissão de administrador');
        toast.error('Apenas administradores podem atualizar usuários');
        return;
      }
      
      // Atualizar status no Supabase
      console.log(`[DEBUG] Enviando atualização para o Supabase...`);
      const { error } = await supabase
        .from('users')
        .update({ status })
        .eq('id', id);
        
      if (error) {
        console.error('Erro na operação de atualização de usuário:', error);
        
        // Verificar se é um erro de permissão
        if (error.message.includes('permission') || error.message.includes('policy')) {
          toast.error('Erro de permissão: Verifique se você tem o papel de administrador corretamente configurado');
          console.error('Detalhes do erro de permissão:', error.message, error.details);
        } else {
          toast.error(`Erro ao atualizar status do usuário: ${error.message}`);
        }
        
        throw error;
      }
      
      // Atualizar no state
      setUsers(prev => prev.map(u => u.id === id ? { ...u, status } : u));
      
      console.log(`[DEBUG] Status do usuário atualizado com sucesso`);
      toast.success(`Usuário ${status === 'active' ? 'ativado' : 'desativado'} com sucesso`);
    } catch (error) {
      console.error('Erro detalhado na atualização de status do usuário:', error);
      toast.error('Erro ao atualizar status do usuário. Verifique o console para mais detalhes.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateUserRole = async (id: string, role: 'admin' | 'user') => {
    try {
      setIsLoading(true);
      console.log(`[DEBUG] Iniciando atualização de papel do usuário ID: ${id} para ${role}`);
      
      // Verificar se o usuário é administrador
      if (!user || user.role !== 'admin') {
        console.error('Tentativa de atualização de usuário sem permissão de administrador');
        toast.error('Apenas administradores podem atualizar usuários');
        return;
      }
      
      // Atualizar papel no Supabase
      console.log(`[DEBUG] Enviando atualização para o Supabase...`);
      const { error } = await supabase
        .from('users')
        .update({ role })
        .eq('id', id);
        
      if (error) {
        console.error('Erro na operação de atualização de papel:', error);
        
        // Verificar se é um erro de permissão
        if (error.message.includes('permission') || error.message.includes('policy')) {
          toast.error('Erro de permissão: Verifique se você tem o papel de administrador corretamente configurado');
          console.error('Detalhes do erro de permissão:', error.message, error.details);
        } else {
          toast.error(`Erro ao atualizar papel do usuário: ${error.message}`);
        }
        
        throw error;
      }
      
      // Atualizar no state
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u));
      
      console.log(`[DEBUG] Papel do usuário atualizado com sucesso`);
      toast.success(`Perfil do usuário alterado para ${role === 'admin' ? 'Administrador' : 'Usuário'}`);
    } catch (error) {
      console.error('Erro detalhado na atualização de papel do usuário:', error);
      toast.error('Erro ao atualizar perfil do usuário. Verifique o console para mais detalhes.');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para excluir usuário
  const deleteUser = async (id: string) => {
    try {
      setIsLoading(true);
      console.log(`[DEBUG] Iniciando exclusão do usuário ID: ${id}`);
      
      // Verificar se o usuário é administrador
      if (!user || user.role !== 'admin') {
        console.error('Tentativa de exclusão de usuário sem permissão de administrador');
        toast.error('Apenas administradores podem excluir usuários');
        return;
      }
      
      // Verificar se está tentando excluir o próprio usuário
      if (id === user.id) {
        console.error('Tentativa de excluir o próprio usuário');
        toast.error('Você não pode excluir seu próprio usuário');
        return;
      }
      
      // Verificar se o usuário tem trocas/quebras associadas
      console.log(`[DEBUG] Verificando se o usuário tem trocas/quebras...`);
      const { data: userExchanges, error: checkError } = await supabase
        .from('exchanges')
        .select('id')
        .eq('user_id', id)
        .limit(1);
        
      if (checkError) {
        console.error('Erro ao verificar trocas do usuário:', checkError);
        throw checkError;
      }
      
      if (userExchanges && userExchanges.length > 0) {
        console.log(`[DEBUG] Usuário tem ${userExchanges.length} trocas/quebras`);
        toast.error('Não é possível excluir este usuário pois ele possui registros de trocas/quebras no sistema');
        return;
      }
      
      // Excluir usuário no Supabase
      console.log(`[DEBUG] Executando exclusão do usuário...`);
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Erro na operação de exclusão de usuário:', error);
        
        // Verificar se é um erro de permissão
        if (error.message.includes('permission') || error.message.includes('policy')) {
          toast.error('Erro de permissão: Verifique se você tem o papel de administrador corretamente configurado');
          console.error('Detalhes do erro de permissão:', error.message, error.details);
        } else if (error.message.includes('foreign key constraint') || error.message.includes('violates foreign key')) {
          toast.error('Não é possível excluir este usuário pois ele está vinculado a outros registros no sistema');
        } else {
          toast.error(`Erro ao excluir usuário: ${error.message}`);
        }
        
        throw error;
      }
      
      // Remover do state
      setUsers(prev => prev.filter(u => u.id !== id));
      console.log(`[DEBUG] Usuário excluído com sucesso`);
      toast.success('Usuário removido com sucesso');
    } catch (error) {
      console.error('Erro detalhado na exclusão do usuário:', error);
      toast.error('Erro ao excluir usuário. Verifique o console para mais detalhes.');
    } finally {
      setIsLoading(false);
    }
  };

  // Exchanges methods
  const addExchange = async (exchange: Omit<Exchange, 'id' | 'createdAt'>) => {
    try {
      setIsLoading(true);
      console.log('[DataContext] Iniciando adição de troca/quebra:', { 
        label: exchange.label, 
        type: exchange.type, 
        itensCount: exchange.items.length,
        plataforma: isMobileDevice() ? 'mobile' : 'desktop'
      });
      
      // Verificar se o dispositivo é móvel para otimizar o processo
      const isMobile = isMobileDevice();
      
      // Em dispositivos móveis, otimizar o processo sem limitar o número de fotos
      if (isMobile) {
        console.log('[DataContext] Processando em dispositivo móvel, otimizando imagens');
        // Removida a limitação do número de fotos
      }
      
      // 1. Inserir a troca principal
      const { data: exchangeData, error: exchangeError } = await supabase
        .from('exchanges')
        .insert([{
          user_id: exchange.userId,
          label: exchange.label,
          type: exchange.type,
          status: exchange.status,
          notes: exchange.notes || null
        }])
        .select()
        .single();
        
      if (exchangeError) {
        console.error('[DataContext] Erro ao criar registro de troca:', exchangeError);
        throw exchangeError;
      }
      
      if (!exchangeData) {
        console.error('[DataContext] Nenhum dado retornado ao criar troca');
        throw new Error('Erro ao criar registro de troca');
      }
      
      console.log(`[DataContext] Troca criada com sucesso, ID: ${exchangeData.id}`);
      
      // 2. Inserir os itens da troca
      const itemsWithErrors: string[] = [];
      const successfulExchangeItems: Array<{id: string, photos: string[]}> = [];
      
      for (let i = 0; i < exchange.items.length; i++) {
        const item = exchange.items[i];
        try {
          console.log(`[DataContext] Processando item ${i+1}/${exchange.items.length}:`, {
            productId: item.productId,
            quantity: item.quantity,
            photosCount: item.photos.length
          });
          
          // Inserir o item
          const { data: itemData, error: itemError } = await supabase
            .from('exchange_items')
            .insert([{
              exchange_id: exchangeData.id,
              product_id: item.productId,
              quantity: item.quantity,
              reason: item.reason
            }])
            .select()
            .single();
            
          if (itemError) {
            console.error(`[DataContext] Erro ao inserir item ${i+1}:`, itemError);
            itemsWithErrors.push(`Item ${i+1}`);
            continue; // Continuar para o próximo item mesmo com erro
          }
          
          if (!itemData) {
            console.error(`[DataContext] Nenhum dado retornado ao criar item ${i+1}`);
            itemsWithErrors.push(`Item ${i+1}`);
            continue;
          }
          
          console.log(`[DataContext] Item ${i+1} criado com sucesso, ID: ${itemData.id}`);
          
          // Rastrear itens criados com sucesso para garantir que seja adicionado ao state
          successfulExchangeItems.push({
            id: itemData.id,
            photos: [...item.photos]
          });
          
          // Inserir as fotos do item com tratamento de erro por foto
          // Em dispositivos móveis, processar fotos em lotes menores para evitar timeout
          const photoErrors: string[] = [];
          const batchSize = isMobile ? 2 : 3; // Aumentado de 1 para 2 fotos por vez em dispositivos móveis
          
          for (let j = 0; j < item.photos.length; j += batchSize) {
            const batch = item.photos.slice(j, j + batchSize);
            const batchPromises = batch.map(async (photoUrl, batchIndex) => {
              const photoIndex = j + batchIndex;
              try {
                console.log(`[DataContext] Processando foto ${photoIndex+1}/${item.photos.length} do item ${i+1}`);
                
                const { error: photoError } = await supabase
                  .from('exchange_photos')
                  .insert([{
                    exchange_item_id: itemData.id,
                    photo_url: photoUrl
                  }]);
                  
                if (photoError) {
                  console.error(`[DataContext] Erro ao inserir foto ${photoIndex+1} do item ${i+1}:`, photoError);
                  return `Foto ${photoIndex+1}`;
                }
                
                console.log(`[DataContext] Foto ${photoIndex+1} do item ${i+1} salva com sucesso`);
                return null;
              } catch (photoException) {
                console.error(`[DataContext] Exceção ao processar foto ${photoIndex+1} do item ${i+1}:`, photoException);
                return `Foto ${photoIndex+1}`;
              }
            });
            
            // Aguardar o processamento do lote atual antes de continuar
            const batchResults = await Promise.all(batchPromises);
            photoErrors.push(...batchResults.filter(Boolean) as string[]);
            
            // Em dispositivos móveis, adicionar uma pequena pausa entre os lotes para evitar sobrecarga
            if (isMobile && j + batchSize < item.photos.length) {
              await new Promise(resolve => setTimeout(resolve, 100)); // Reduzido de 200ms para 100ms
            }
          }
          
          if (photoErrors.length > 0) {
            console.warn(`[DataContext] Item ${i+1} foi salvo, mas ${photoErrors.length} fotos tiveram erro:`, photoErrors);
            toast.info(`Algumas fotos do item ${i+1} não puderam ser salvas.`);
          }
        } catch (itemException) {
          console.error(`[DataContext] Exceção ao processar item ${i+1}:`, itemException);
          itemsWithErrors.push(`Item ${i+1}`);
        }
      }
      
      if (itemsWithErrors.length > 0) {
        console.warn(`[DataContext] Troca criada, mas ${itemsWithErrors.length} itens tiveram erro:`, itemsWithErrors);
        toast.info(`Registro salvo, mas alguns itens podem estar incompletos.`);
      }
      
      // 3. Buscar a troca completa para atualizar o state e certificar que aparece no histórico
      try {
        console.log('[DataContext] Atualizando state com nova troca...');
        await fetchExchangeAndUpdateState(exchangeData.id);
        
        // Verificar se a troca foi realmente adicionada ao state
        const exchangeInState = exchanges.find(e => e.id === exchangeData.id);
        if (!exchangeInState) {
          console.warn('[DataContext] Troca não encontrada no state após fetchExchangeAndUpdateState. Adicionando manualmente.');
          
          // Se não estiver no state após fetchExchangeAndUpdateState, criar manualmente
          // uma versão simplificada para garantir que apareça no histórico
          const manualExchange: Exchange = {
            id: exchangeData.id,
            userId: exchange.userId,
            userName: exchange.userName,
            userRegistration: exchange.userRegistration,
            label: exchange.label,
            type: exchange.type,
            items: exchange.items.map((item, idx) => ({
              ...item,
              id: successfulExchangeItems[idx]?.id || `temp-${Date.now()}-${idx}`
            })),
            status: exchange.status,
            notes: exchange.notes,
            createdAt: new Date().toISOString(),
          };
          
          // Adicionar ao state manualmente
          setExchanges(prev => {
            // Verificar se já não existe para evitar duplicatas
            if (prev.some(e => e.id === manualExchange.id)) return prev;
            return [manualExchange, ...prev];
          });
        }
      } catch (stateError) {
        console.error('[DataContext] Erro ao atualizar state com nova troca:', stateError);
        
        // Ainda assim, fazer uma tentativa final de recarregar todas as trocas
        setTimeout(() => {
          fetchExchanges(true).catch(e => 
            console.error('[DataContext] Erro no recarregamento final de trocas:', e)
          );
        }, 2000);
      }
      
      // Mensagem de sucesso baseada em se houve erros parciais
      if (itemsWithErrors.length === 0) {
        toast.success('Registro adicionado com sucesso');
      } else {
        toast.success('Registro adicionado, porém com alguns problemas');
      }
      
      console.log('[DataContext] Processo de adição de troca finalizado');
      
      // Para dispositivos móveis, forçar uma atualização de dados depois de um período
      // para garantir que a lista de trocas será atualizada
      if (isMobile) {
        // Primeiro timer para atualizar rápido
        setTimeout(() => {
          console.log('[DataContext] Primeira atualização após adição em dispositivo móvel');
          forceRefreshExchanges().catch(e => 
            console.error('[DataContext] Erro na primeira atualização após adição:', e)
          );
        }, 2000); // Reduzir para 2 segundos
        
        // Segundo timer para garantir que os dados foram sincronizados
        setTimeout(() => {
          console.log('[DataContext] Segunda atualização após adição em dispositivo móvel');
          forceRefreshExchanges().catch(e => 
            console.error('[DataContext] Erro na segunda atualização após adição:', e)
          );
        }, 6000); // 6 segundos
      }
      
      return exchangeData.id;
    } catch (error) {
      console.error('[DataContext] Erro crítico ao adicionar registro de troca:', error);
      toast.error('Erro ao adicionar registro');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const reloadProducts = async () => {
    try {
      console.log('Solicitação explícita para recarregar produtos');
      // Recarregar produtos do Supabase
      await fetchProducts();
      toast.success('Lista de produtos atualizada');
    } catch (error) {
      console.error('Erro ao recarregar produtos:', error);
      toast.error('Erro ao recarregar produtos');
    }
  };

  // Função para forçar a atualização da lista de trocas/quebras
  const forceRefreshExchanges = async (specificExchangeId?: string) => {
    if (!user) return false;
    
    console.log(`[DataContext] Forçando atualização completa de registros${specificExchangeId ? ` (foco no ID: ${specificExchangeId})` : ''}`);
    
    try {
      // Se um ID específico foi fornecido, verificar esse registro primeiro
      if (specificExchangeId) {
        const verified = await verifyAndLoadExchange(specificExchangeId);
        if (verified) {
          console.log(`[DataContext] Registro específico ${specificExchangeId} verificado e atualizado com sucesso`);
        } else {
          console.warn(`[DataContext] Não foi possível verificar o registro específico ${specificExchangeId}`);
        }
      }
      
      // Limpar todos os caches relacionados a trocas
      const cacheKey = isAdmin ? 'all_exchanges' : `user_exchanges_${user.id}`;
      clearCache(cacheKey);
      clearCache('users_info');
      
      // Fazer a requisição sem cache
      await fetchExchanges(true);
      
      // Se for um administrador, verificar especificamente os registros pendentes
      if (isAdmin) {
        try {
          console.log('[DataContext] Verificando registros pendentes para administrador');
          const { data: pendingData, error: pendingError } = await supabase
            .from('exchanges')
            .select('id')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
            
          if (pendingError) {
            console.error('[DataContext] Erro ao verificar registros pendentes:', pendingError);
          } else if (pendingData && pendingData.length > 0) {
            console.log(`[DataContext] Encontrados ${pendingData.length} registros pendentes para verificação`);
            
            // Verificar até 3 registros mais recentes
            for (let i = 0; i < Math.min(pendingData.length, 3); i++) {
              await verifyAndLoadExchange(pendingData[i].id);
            }
          }
        } catch (pendingError) {
          console.error('[DataContext] Erro ao processar registros pendentes:', pendingError);
        }
      }
      
      console.log('[DataContext] Atualização forçada concluída');
      return true;
    } catch (error) {
      console.error('[DataContext] Erro na atualização forçada:', error);
      return false;
    }
  };

  // Função para verificar e garantir que um registro específico exista
  const verifyAndLoadExchange = async (exchangeId: string): Promise<boolean> => {
    if (!exchangeId || !user) return false;
    
    console.log(`[DataContext] Verificando registro específico: ${exchangeId}`);
    
    try {
      // Buscar diretamente do banco de dados, ignorando cache
      const { data: exchangeData, error } = await supabase
        .from('exchanges')
        .select('*')
        .eq('id', exchangeId)
        .single();
      
      if (error) {
        console.error(`[DataContext] Erro ao verificar registro ${exchangeId}:`, error);
        return false;
      }
      
      if (!exchangeData) {
        console.log(`[DataContext] Registro ${exchangeId} não encontrado no banco`);
        return false;
      }
      
      console.log(`[DataContext] Registro ${exchangeId} encontrado no banco:`, exchangeData);
      
      // Atualizar explicitamente este registro no state
      await fetchExchangeAndUpdateState(exchangeId);
      
      // Verificar se foi adicionado ao state local
      const isInState = exchanges.some(e => e.id === exchangeId);
      console.log(`[DataContext] Registro está no state local? ${isInState ? 'Sim' : 'Não'}`);
      
      return true;
    } catch (e) {
      console.error(`[DataContext] Erro ao verificar registro ${exchangeId}:`, e);
      return false;
    }
  };

  return (
    <DataContext.Provider
      value={{
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        getProduct,
        exportProductsToCSV,
        importProductsFromCSV,
        reloadProducts,
        
        exchanges,
        addExchange,
        updateExchange,
        deleteExchange,
        getExchange,
        fetchExchanges,
        forceRefreshExchanges,
        
        users,
        updateUserStatus,
        updateUserRole,
        deleteUser,
        
        isLoading
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

// Custom hook to use data context
export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

// Melhorar a detecção de dispositivos móveis
const isMobileDevice = (): boolean => {
  try {
    // Detectar por User Agent (mais confiável)
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    const isMobileByAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet|ipad/i.test(userAgent.toLowerCase());
    
    // Detectar por tamanho da tela (backup)
    const isMobileBySize = window.innerWidth <= 768 || window.innerHeight <= 600;
    
    // Detectar por recursos específicos de dispositivos móveis
    const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Verificar se a conexão é lenta (para otimizações)
    const connection = (navigator as any).connection;
    const isSlowConnection = connection && 
      (connection.type === 'cellular' || connection.effectiveType === 'slow-2g' || 
       connection.effectiveType === '2g' || connection.saveData === true);
    
    // Log detalhado para diagnóstico
    console.log(`[DetectorMobile] Detecção: UA=${isMobileByAgent}, Tamanho=${isMobileBySize}, Touch=${hasTouchSupport}, ConexãoLenta=${isSlowConnection || 'desconhecido'}`);
    
    // Se a conexão for lenta, definir uma flag global para outras otimizações
    if (isSlowConnection) {
      (window as any).isSlowConnection = true;
      console.log('[DetectorMobile] Conexão lenta detectada - ativando otimizações');
    }
    
    // Armazenar o resultado no sessionStorage para consistência entre carregamentos
    const result = isMobileByAgent || isMobileBySize || hasTouchSupport;
    try {
      sessionStorage.setItem('isMobileDevice', result ? 'true' : 'false');
    } catch (e) {
      console.error('[DetectorMobile] Erro ao armazenar no sessionStorage:', e);
    }
    
    return result;
  } catch (error) {
    console.error('[DetectorMobile] Erro na detecção de dispositivo móvel:', error);
    // Em caso de erro, usar um fallback baseado apenas no tamanho da tela
    return window.innerWidth <= 768;
  }
};
