import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/lib/toast';
import { supabase, User, Tables, upsertUser, checkIfUserIsAdmin } from '@/lib/supabase';
import { useNotifications } from '@/lib/notifications';
import { ensureOfflineManagerInitialized } from '@/lib/offlineManager';

// Função para recriar o cliente Supabase e tentar corrigir problemas de API key
const resetSupabaseClient = async () => {
  console.log('===== INICIANDO REINICIALIZAÇÃO DO CLIENTE SUPABASE =====');
  
  try {
    // Recuperar as variáveis de ambiente novamente
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Erro: Variáveis de ambiente ainda não estão disponíveis');
      toast.error('Erro na configuração do Supabase. Verifique as variáveis de ambiente.');
      return false;
    }
    
    console.log('URL da API:', supabaseUrl);
    console.log('Tamanho da API Key:', supabaseKey.length);
    
    // Limpar o cache de autenticação
    try {
      localStorage.removeItem('sb-auth-token');
      localStorage.removeItem('sb-auth-token-code-verifier');
      localStorage.removeItem('sb-refresh-token');
      localStorage.removeItem('auth_contingency_in_progress');
      console.log('Cache de autenticação limpo');
    } catch (e) {
      console.error('Erro ao limpar cache:', e);
    }
    
    // Atualizar headers globais para incluir a API key
    try {
      // @ts-ignore - Acessando propriedade interna do Supabase
      if (supabase.headers) {
        // @ts-ignore
        supabase.headers = {
          // @ts-ignore
          ...supabase.headers,
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        };
        console.log('Headers globais atualizados');
      } else {
        console.warn('Não foi possível acessar os headers globais');
      }
    } catch (headerError) {
      console.error('Erro ao atualizar headers globais:', headerError);
    }
    
    // Verificar se o cliente foi reinicializado corretamente com um teste simples
    try {
      const { error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Erro após reinicialização do cliente:', error);
        toast.error('Erro ao conectar com o Supabase: ' + error.message);
        return false;
      }
    } catch (sessionError) {
      console.error('Erro ao verificar sessão após reinicialização:', sessionError);
      return false;
    }
    
    console.log('Cliente Supabase reinicializado com sucesso');
    toast.success('Conexão com o Supabase restabelecida');
    
    return true;
  } catch (e) {
    console.error('Erro crítico ao reinicializar cliente Supabase:', e);
    toast.error('Erro ao reinicializar cliente Supabase');
    return false;
  }
};

// Define auth context interface
interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (registration: string, name: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  resetSupabaseClient: () => Promise<boolean>;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Verifica a sessão do usuário ao carregar
  useEffect(() => {
    const checkSession = async () => {
      try {
        setIsLoading(true);
        console.log("Verificando sessão do usuário...");
        
        // Verificar se o usuário já está autenticado no Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Erro ao obter sessão:", sessionError);
          setIsLoading(false);
          return;
        }
        
        console.log("Sessão atual:", session ? "Autenticado" : "Não autenticado");
        
        if (session) {
          console.log("Usuário autenticado, buscando dados...", session.user.id);
          
          // MODIFICAÇÃO: Adicionar timeout para evitar ficar preso na busca de dados
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout ao buscar dados do usuário na verificação da sessão')), 12000)
          );
          
          try {
            // Buscar os dados do usuário da tabela 'users'
            const userDataPromise = supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();
              
            // Usar Race para evitar ficar preso se a consulta não responder
            const { data: userData, error: userError } = await Promise.race([userDataPromise, timeoutPromise]) as any;
              
            if (userError) {
              console.error('Erro ao buscar dados do usuário:', userError);
              throw userError; // Passar para o tratamento de erro abaixo
            }
            
            if (userData) {
              console.log('Dados do usuário carregados da sessão:', userData);
              
              // MODIFICAÇÃO: Não substituir automaticamente o nome do usuário
              // Apenas verificar se o nome está vazio
              if (!userData.name || userData.name.trim() === '') {
                console.warn('Nome do usuário está vazio na sessão iniciada');
                
                // Obter metadados do usuário para verificar o nome correto
                const { data: authUser } = await supabase.auth.getUser();
                const correctName = authUser?.user?.user_metadata?.name || 'Novo Usuário';
                
                // Atualizar o nome apenas se estiver realmente vazio
                const { error: updateError } = await supabase
                  .from('users')
                  .update({ name: correctName })
                  .eq('id', userData.id);
                  
                if (updateError) {
                  console.error('Erro ao atualizar nome do usuário na sessão:', updateError);
                } else {
                  userData.name = correctName;
                  console.log('Nome do usuário atualizado para:', correctName);
                }
              }
              
              const currentUser: User = {
                id: userData.id,
                name: userData.name,
                registration: userData.registration,
                email: userData.email,
                role: userData.role,
                status: userData.status
              };
              
              console.log("Definindo usuário no estado:", currentUser);
              setUser(currentUser);
            } else {
              console.warn("Sessão encontrada, mas dados do usuário não existem na tabela users");
              throw new Error('Usuário não encontrado na tabela users'); // Passar para tratamento de erro
            }
          } catch (userFetchError) {
            // MODIFICAÇÃO: SOLUÇÃO DE CONTINGÊNCIA quando há problema na busca dos dados
            console.error('Erro ou timeout ao buscar dados do usuário:', userFetchError);
            console.log('Aplicando solução de contingência para manter a sessão ativa');
            
            // Verificar se já estamos tentando criar um usuário de contingência
            const isContingencyInProgress = localStorage.getItem('auth_contingency_in_progress');
            
            if (isContingencyInProgress) {
              console.log('Processo de contingência já em andamento, evitando duplicação');
            } else {
              // Marcar que estamos em processo de contingência
              localStorage.setItem('auth_contingency_in_progress', 'true');
              
              // Verificar se o usuário é administrador através do RPC (usando a função importada)
              let adminStatusFromRpc = false;
              try {
                // Usar a função checkIfUserIsAdmin importada
                adminStatusFromRpc = await checkIfUserIsAdmin(session.user.id);
                if (adminStatusFromRpc) {
                  console.log("Confirmação de admin obtida via RPC is_admin");
                }
              } catch (rpcError) {
                console.error("Erro ao verificar status de admin via RPC:", rpcError);
              }
              
              // Obter dados básicos do usuário diretamente do Auth
              const { data: authUser } = await supabase.auth.getUser();
              
              if (authUser?.user) {
                // Verificar metadados para administrador
                const userMetadata = authUser.user.user_metadata || {};
                const isAdminInMetadata = userMetadata.role === 'admin';
                
                // Determinar se é admin com base nas verificações restantes
                const shouldBeAdmin = isAdminInMetadata || adminStatusFromRpc;
                
                // Criar usuário mínimo com os dados disponíveis
                const fallbackUser: User = {
                  id: session.user.id,
                  name: authUser.user.user_metadata?.name || authUser.user.email?.split('@')[0] || 'Usuário',
                  registration: authUser.user.user_metadata?.registration || '00000000',
                  email: authUser.user.email || '',
                  role: shouldBeAdmin ? 'admin' : 'user', // Usa o resultado da verificação
                  status: 'active'
                };
                
                console.log('Definindo usuário de contingência:', fallbackUser);
                setUser(fallbackUser);
                
                // Garantir que temos um ID definido antes de prosseguir
                if (!fallbackUser.id) {
                  console.error('ID do usuário não está definido, não é possível salvar na tabela users');
                  setUser(fallbackUser);
                  return;
                }

                // 4. Tenta inserir ou atualizar o usuário na tabela de usuários
                try {
                  console.log("Tentando criar/atualizar registro na tabela users para evitar problemas futuros");
                  console.log("ID do usuário para atualização:", fallbackUser.id);
                  
                  // Verificar se o usuário já existe
                  const { data: existingUser, error: existingUserError } = await supabase
                    .from('users')
                    .select('id')
                    .eq('id', fallbackUser.id)
                    .single();
                    
                  if (existingUserError && !existingUserError.message.includes('No rows found')) {
                    console.error("Erro ao verificar existência do usuário:", existingUserError);
                    // Continuar mesmo com erro, para não bloquear o login
                  }
                    
                  if (existingUser) {
                    // Verificar e registrar todos os campos antes da atualização
                    console.log("Atualizando usuário existente com dados:", {
                      id: fallbackUser.id,
                      name: fallbackUser.name,
                      email: fallbackUser.email,
                      role: fallbackUser.role,
                      status: 'active'
                    });
                    
                    // Atualizar usuário existente
                    const { error: updateError } = await supabase
                      .from('users')
                      .update({
                        name: fallbackUser.name,
                        email: fallbackUser.email,
                        role: fallbackUser.role,
                        status: 'active'
                      })
                      .eq('id', fallbackUser.id);
                      
                    if (updateError) {
                      console.error("Erro ao atualizar usuário:", updateError);
                    } else {
                      console.log("Registro de usuário atualizado na tabela users");
                    }
                  } else {
                    // Verificar e registrar todos os campos antes da inserção
                    console.log("Criando novo usuário com dados:", {
                      id: fallbackUser.id,
                      name: fallbackUser.name,
                      registration: fallbackUser.registration,
                      email: fallbackUser.email,
                      role: fallbackUser.role,
                      status: 'active'
                    });
                    
                    // Criar novo usuário
                    const { error: insertError } = await supabase
                      .from('users')
                      .insert([{
                        id: fallbackUser.id,
                        name: fallbackUser.name,
                        registration: fallbackUser.registration,
                        email: fallbackUser.email,
                        role: fallbackUser.role,
                        status: 'active'
                      }]);
                      
                    if (insertError) {
                      console.error("Erro ao criar usuário:", insertError);
                    } else {
                      console.log("Novo registro de usuário criado na tabela users");
                    }
                  }
                } catch (error) {
                  console.error("Erro ao criar/atualizar usuário na tabela:", error);
                }
              } else {
                console.error('Falha na solução de contingência: não foi possível obter dados do usuário');
              }
              
              // Remover flag de contingência em andamento após 3 segundos
              setTimeout(() => {
                localStorage.removeItem('auth_contingency_in_progress');
                console.log("Flag de contingência removida");
              }, 3000);
            }
          }
        } else {
          console.log("Nenhuma sessão ativa encontrada");
        }
      } catch (error) {
        console.error('Erro ao verificar sessão:', error);
      } finally {
        setIsLoading(false);
        // Remover qualquer flag de contingência remanescente
        localStorage.removeItem('auth_contingency_in_progress');
      }
    };
    
    checkSession();
    
    // Configurar listener para mudanças na autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Evento de autenticação:", event, session ? "com sessão" : "sem sessão");
      
      if (event === 'SIGNED_IN' && session) {
        console.log("Usuário autenticado, ID:", session.user.id);
        
        // MODIFICAÇÃO: Aumentar timeout para 30 segundos para a busca de dados PÓS-EVENTO
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ao buscar dados do usuário no evento de autenticação')), 30000) // Aumentado para 30 segundos
        );
        
        try {
          // Buscar os dados do usuário
          console.log('Buscando dados detalhados do usuário após evento SIGNED_IN...');
          const userDataPromise = supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          // Usar Race para evitar ficar preso
          console.log('Aguardando dados do usuário ou timeout de 30s...');
          const { data: userData, error: userError } = await Promise.race([userDataPromise, timeoutPromise]) as any;
            
          if (userError) {
            console.error("Erro ao buscar dados do usuário no evento de autenticação:", userError);
            
            // Verificar se é um erro de API key e tentar corrigir
            if (userError.message === 'No API key found in request' || userError.message?.includes('API key')) {
              console.log("Detectado erro de API key, tentando reinicializar cliente Supabase...");
              const reset = await resetSupabaseClient();
              
              if (reset) {
                // Se conseguiu reinicializar, tentar buscar os dados novamente
                console.log("Cliente reinicializado, buscando dados do usuário novamente...");
                try {
                  const { data: retryData, error: retryError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                    
                  if (!retryError && retryData) {
                    console.log("Dados do usuário recuperados após reinicialização:", retryData);
                    return retryData;
                  }
                } catch (retryErr) {
                  console.error("Falha na segunda tentativa:", retryErr);
                }
              }
            }
            
            throw userError;
          }
          
          if (userData) {
            console.log('Dados do usuário carregados do evento de autenticação:', userData);
            
            // MODIFICAÇÃO: Não substituir automaticamente o nome do usuário
            // Apenas verificar se o nome está vazio
            if (!userData.name || userData.name.trim() === '') {
              console.warn('Nome do usuário está vazio no evento de autenticação');
              
              // Obter metadados do usuário para verificar o nome correto
              const { data: authUser } = await supabase.auth.getUser();
              const correctName = authUser?.user?.user_metadata?.name || 'Novo Usuário';
              
              // Atualizar o nome apenas se estiver realmente vazio
              const { error: updateError } = await supabase
                .from('users')
                .update({ name: correctName })
                .eq('id', userData.id);
                
              if (updateError) {
                console.error('Erro ao atualizar nome do usuário no evento:', updateError);
              } else {
                userData.name = correctName;
                console.log('Nome do usuário atualizado para:', correctName);
              }
            }
            
            const currentUser: User = {
              id: userData.id,
              name: userData.name,
              registration: userData.registration,
              email: userData.email,
              role: userData.role,
              status: userData.status
            };
            
            console.log("Atualizando usuário no estado a partir do evento:", currentUser);
            setUser(currentUser);
          } else {
            console.warn('Dados do usuário não encontrados no evento de autenticação');
            throw new Error('Usuário não encontrado na tabela users');
          }
        } catch (userFetchError) {
          // MODIFICAÇÃO: SOLUÇÃO DE CONTINGÊNCIA MELHORADA quando há problema na busca dos dados
          console.error('Erro ou timeout ao buscar dados do usuário no evento:', userFetchError);
          console.log('Aplicando solução de contingência para o evento de autenticação');
          
          // Verificar se já estamos tentando criar um usuário de contingência
          const isContingencyInProgress = localStorage.getItem('auth_contingency_in_progress');
          
          if (isContingencyInProgress) {
            console.log('Processo de contingência já em andamento, evitando duplicação');
          } else {
            // Marcar que estamos em processo de contingência
            localStorage.setItem('auth_contingency_in_progress', 'true');
            
            // Buscar informações adicionais diretamente da sessão e autenticação
            try {
              console.log("Tentando buscar dados do usuário direto da sessão e autenticação");
              
              // 1. Tentar obter informações dos metadados do usuário na sessão
              const userMetadata = session.user.user_metadata || {};
              console.log("Metadados do usuário na sessão:", userMetadata);
              
              // 2. Buscar informações adicionais da API de autenticação
              const { data: authData } = await supabase.auth.getUser();
              console.log("Dados de autenticação obtidos:", authData?.user?.user_metadata);
              
              // 3. Verificar se há alguma indicação de papel de administrador nos metadados
              // Isso pode variar de acordo com como sua aplicação armazena essas informações
              const isAdminInMetadata = 
                (userMetadata.role === 'admin') || 
                (authData?.user?.user_metadata?.role === 'admin');
              
              console.log("Encontrou indicação de administrador nos metadados?", isAdminInMetadata);
              
              // 4. Verificar carimbo de administrador em outros sistemas
              // Tentativa via RPC is_admin
              let adminStatusFromRpc = false;
              try {
                // Usar a função importada checkIfUserIsAdmin
                adminStatusFromRpc = await checkIfUserIsAdmin(session.user.id);
                if (adminStatusFromRpc === true) {
                  console.log("Confirmação de admin obtida via RPC is_admin");
                }
              } catch (rpcError) {
                console.error("Erro ao verificar status de admin via RPC:", rpcError);
              }
              
              // 5. Determinar se o usuário é admin baseado nas verificações restantes
              const shouldBeAdmin = isAdminInMetadata || adminStatusFromRpc;
              console.log("Decisão final sobre status de admin:", shouldBeAdmin);
              
              // 6. Tenta inserir ou atualizar o usuário na tabela users
              try {
                // Criar usuário mínimo com os dados disponíveis
                const fallbackUser: User = {
                  id: session.user.id,
                  name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário',
                  registration: session.user.user_metadata?.registration || '00000000',
                  email: session.user.email || '',
                  role: shouldBeAdmin ? 'admin' : 'user', // Usa o resultado da verificação
                  status: 'active'
                };
                
                console.log("Tentando criar/atualizar registro na tabela users para usuário de contingência");
                
                // Verificar se o usuário já existe
                const { data: existingUser } = await supabase
                  .from('users')
                  .select('id')
                  .eq('id', fallbackUser.id)
                  .single();
                  
                if (existingUser) {
                  // Atualizar usuário existente
                  await supabase
                    .from('users')
                    .update({
                      name: fallbackUser.name,
                      email: fallbackUser.email,
                      role: fallbackUser.role,
                      status: 'active'
                    })
                    .eq('id', fallbackUser.id);
                    
                  console.log("Registro de usuário atualizado na tabela users");
                } else {
                  // Inserir novo usuário
                  await supabase
                    .from('users')
                    .insert([{
                      id: fallbackUser.id,
                      name: fallbackUser.name,
                      registration: fallbackUser.registration,
                      email: fallbackUser.email,
                      role: fallbackUser.role,
                      status: 'active'
                    }]);
                    
                  console.log("Novo registro de usuário criado na tabela users");
                }
                
                console.log('Definindo usuário de contingência a partir do evento:', fallbackUser);
                setUser(fallbackUser);
              } catch (dbError) {
                console.error("Erro ao criar/atualizar usuário na tabela:", dbError);
                
                // Mesmo com erro, garantir um fallback mínimo
                const minimalFallback: User = {
                  id: session.user.id,
                  name: session.user.email?.split('@')[0] || 'Usuário',
                  registration: '00000000',
                  email: session.user.email || '',
                  role: shouldBeAdmin ? 'admin' : 'user',
                  status: 'active'
                };
                
                console.log('Definindo usuário com fallback mínimo:', minimalFallback);
                setUser(minimalFallback);
              }
            } catch (contingencyError) {
              console.error("Erro na solução de contingência:", contingencyError);
              
              // Mesmo com erro, garantir um fallback mínimo
              const minimalFallback: User = {
                id: session.user.id,
                name: session.user.email?.split('@')[0] || 'Usuário',
                registration: '00000000',
                email: session.user.email || '',
                role: 'user',
                status: 'active'
              };
              
              console.log('Definindo usuário com fallback mínimo:', minimalFallback);
              setUser(minimalFallback);
            }
            
            // Remover flag de contingência em andamento após 3 segundos
            setTimeout(() => {
              localStorage.removeItem('auth_contingency_in_progress');
              console.log("Flag de contingência removida");
            }, 3000);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        console.log("Evento SIGNED_OUT recebido");
        setUser(null);
        // Se necessário, limpar outros estados aqui
        // Não navegar automaticamente, pois o logout() já trata disso
      } else if (event === 'TOKEN_REFRESHED') {
        console.log("Token de autenticação atualizado");
        // Opcional: pode ser útil forçar uma revalidação de dados ou permissões
      } else if (event === 'PASSWORD_RECOVERY') {
        console.log("Evento de recuperação de senha");
        // Geralmente tratado em página específica, mas bom saber que ocorre
      } else {
        console.log(`Outro evento de autenticação: ${event}`);
      }
    });
    
    // Limpar subscription quando o componente for desmontado
    return () => {
      console.log("Limpando subscription de autenticação");
      subscription.unsubscribe();
      localStorage.removeItem('auth_contingency_in_progress');
    };
  }, []);

  useEffect(() => {
    if (user) {
      console.log("Usuário autenticado, inicializando sistemas avançados");
      // Inicializar o sistema de notificações quando o usuário estiver autenticado
      useNotifications.init(user.id);
      // Inicializar o gerenciador de modo offline
      ensureOfflineManagerInitialized(user.id);
      
      console.log('Sistemas de notificações e offline inicializados para o usuário:', user.id);
    }
  }, [user]);

  // Login function
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    localStorage.setItem('login_attempt_timestamp', Date.now().toString());
    
    try {
      console.log(`Iniciando processo de login para: ${email} às ${new Date().toISOString()}`);
      
      // Limpar qualquer resquício de sessão anterior
      console.log('Limpando dados residuais de sessão anterior');
      try {
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('sb-auth-token');
        localStorage.removeItem('sb-refresh-token');
        localStorage.removeItem('auth_contingency_in_progress');
        console.log('Limpeza de sessão anterior concluída');
      } catch (e) {
        console.warn('Erro ao limpar dados de sessão:', e);
      }
      
      // Configuração para persistência da sessão
      const persistenceOptions = {
        persistSession: true
      };
      
      console.log('Enviando requisição de login para o Supabase...');
      
      // Fazer login com timeout para evitar bloqueio indefinido
      const authPromise = supabase.auth.signInWithPassword({
        email: email,
        password: password
      });
      
      // Criar um timeout para a operação de login
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.error('TIMEOUT: A operação de login excedeu o limite de tempo');
          reject(new Error('Timeout ao fazer login'));
        }, 15000);
      });
      
      // Usar Promise.race para aplicar o timeout
      console.log('Aguardando resposta da autenticação com timeout de 15s...');
      const { data: authData, error: authError } = await Promise.race([
        authPromise,
        timeoutPromise.then(() => { 
          throw new Error('Timeout ao fazer login'); 
        })
      ]) as any;
      
      console.log('Resposta recebida da autenticação:', 
                 authData ? 'Autenticação bem-sucedida' : 'Sem dados de autenticação', 
                 authError ? `Erro: ${authError.message}` : 'Sem erros');
      
      if (authError || !authData?.user) {
        console.error('Erro ao fazer login:', authError ? authError.message : 'Usuário indefinido na resposta');
        toast.error(`Falha na autenticação: ${authError ? authError.message : 'Resposta inválida do servidor'}`);
        setIsLoading(false);
        return;
      }
      
      // Log para debugging dos metadados do usuário
      console.log('Metadados do usuário Auth:', authData.user.user_metadata);
      console.log('ID do usuário autenticado:', authData.user.id);
      
      // ABORDAGEM OTIMIZADA: 
      // 1. Criar usuário básico com dados garantidos IMEDIATAMENTE
      // 2. Redirecionar para dashboard imediatamente
      // 3. Buscar detalhes adicionais em segundo plano

      // Obter informações básicas dos metadados
      const userMetadata = authData.user.user_metadata || {};
      const userName = userMetadata.name || userMetadata.full_name || email.split('@')[0];
      const userRegistration = userMetadata.registration || '000000';
      
      // Criar usuário básico com dados GARANTIDOS disponíveis
      const basicUser: User = {
        id: authData.user.id,
        name: userName,
        registration: userRegistration,
        email: email,
        role: 'user', // Inicia como user, verifica admin em background
        status: 'active'
      };
      
      // IMPORTANTE: Definir o usuário IMEDIATAMENTE para desbloquear a interface
      console.log('Definindo usuário básico:', basicUser);
      setUser(basicUser);
      toast.success('Login realizado com sucesso!');
      localStorage.setItem('login_success_timestamp', Date.now().toString());
      
      // CRÍTICO: Redirecionar para o dashboard IMEDIATAMENTE
      console.log('Iniciando redirecionamento para dashboard...');
      navigate('/dashboard');
      
      // BACKGROUND: Operações adicionais em segundo plano para não bloquear a UI
      window.setTimeout(async () => {
        try {
          console.log('Executando operações em segundo plano...');
          
          // 1. Buscar perfil completo do usuário com timeout
          try {
            const userPromise = supabase
              .from('users')
              .select('*')
              .eq('id', basicUser.id)
              .maybeSingle();
            
            const userTimeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Timeout ao buscar perfil')), 5000);
            });
            
            const { data: userData, error: userError } = await Promise.race([
              userPromise,
              userTimeoutPromise
            ]) as any;
            
            if (userError) {
              console.warn('Erro ao buscar perfil do usuário:', userError);
            } else if (userData) {
              console.log('Perfil do usuário encontrado:', userData);
              
              // Atualizar o state com dados mais completos
              const updatedUser = {
                id: userData.id,
                name: userData.name || basicUser.name,
                registration: userData.registration || basicUser.registration,
                email: userData.email || basicUser.email,
                role: userData.role || basicUser.role,
                status: userData.status || basicUser.status
              };
              
              setUser(updatedUser);
              
              // Se o usuário agora é admin mas não era antes, mostrar mensagem
              if (updatedUser.role === 'admin' && basicUser.role !== 'admin') {
                toast.info('Permissões administrativas verificadas e atualizadas');
              }
            } else {
              // Usuário não existe no banco, criar um novo
              console.log('Perfil não encontrado, criando novo perfil');
              
              // Corrigir tratamento de upsertUser (usa try/catch)
              try {
                await upsertUser(basicUser);
                console.log('Perfil criado via upsertUser'); 
              } catch (createError) {
                console.warn('Exceção ao criar perfil via upsertUser:', createError);
                // Poderia adicionar um toast aqui se necessário
              }
            }
          } catch (profileError) {
            console.warn('Erro na operação de perfil em segundo plano:', profileError);
          }
          
          // 2. Verificar status de admin no banco (AGORA É A ÚNICA VERIFICAÇÃO)
          try {
            console.log('Verificando status de admin no banco...');
            const isAdminInDB = await checkIfUserIsAdmin(basicUser.id);
            
            if (isAdminInDB && basicUser.role !== 'admin') {
              console.log('Usuário identificado como admin no banco');
              
              // Atualizar o estado local se for admin
              setUser(prev => prev ? { ...prev, role: 'admin' } : null);
              
              // Atualizar o registro no banco também (opcional, mas bom para consistência)
              // Pode ser movido para dentro de upsertUser se preferir
              supabase.from('users').update({ role: 'admin' }).eq('id', basicUser.id).then(({ error }) => {
                if (error) console.warn("Erro ao atualizar role no DB:", error);
              });
              
              toast.info('Permissões administrativas concedidas');
            } else if (!isAdminInDB && basicUser.role === 'admin') {
               // Caso raro: metadados diziam admin, mas DB discorda. Usar DB como verdade.
               console.warn("Inconsistência: metadados indicavam admin, mas DB discorda. Revertendo para 'user'");
               setUser(prev => prev ? { ...prev, role: 'user' } : null);
               supabase.from('users').update({ role: 'user' }).eq('id', basicUser.id).then(({ error }) => {
                if (error) console.warn("Erro ao reverter role no DB:", error);
              });
            }
          } catch (adminError) {
            console.warn('Erro ao verificar status de admin:', adminError);
          }
          
        } catch (bgError) {
          console.warn('Erro geral nas operações em segundo plano:', bgError);
        } finally {
          // Garantir que o loading seja desligado
          setIsLoading(false);
        }
      }, 500);
    } catch (error) {
      console.error('Erro fatal ao fazer login:', error);
      
      // Mensagem de erro mais informativa
      let errorMessage = 'Erro ao realizar login';
      
      if (error instanceof Error) {
        if (error.message.includes('Timeout')) {
          errorMessage = 'O servidor demorou muito para responder. Verifique sua conexão.';
        } else if (error.message.includes('fetch')) {
          errorMessage = 'Erro de conexão. Verifique sua internet.';
        } else {
          errorMessage += ': ' + error.message;
        }
      }
      
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  // Register function
  const register = async (
    registration: string, 
    name: string, 
    email: string, 
    password: string, 
    confirmPassword: string
  ) => {
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    
    setIsLoading(true);
    let createdAuthUserId: string | null = null; // Para rollback se necessário

    try {
      console.log('Iniciando processo de registro para:', email);
      
      // Validações básicas
      if (!name || !email || !registration || !password) {
        toast.error('Todos os campos são obrigatórios');
        throw new Error('Campos obrigatórios não preenchidos.'); // Lança erro para o catch
      }
      if (password.length < 6) {
        toast.error('A senha deve ter pelo menos 6 caracteres.');
        throw new Error('Senha muito curta.'); // Lança erro para o catch
      }
      // Outras validações (matrícula, etc.) podem ser adicionadas aqui

      // Verificar se o email ou matrícula já existem (opcional, signUp pode falhar também)
      // ... (código de verificação de existência omitido por brevidade, mas pode ser mantido) ...

      // Criar usuário no Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: { // Metadados iniciais
            registration: registration.trim(),
            name: name.trim()
          }
        }
      });

      if (authError) {
        console.error('Erro ao criar usuário no Auth:', authError);
        if (authError.message.includes('User already registered')) {
           toast.error('Este email já está registrado.');
        } else {
           toast.error('Erro ao criar conta: ' + authError.message);
        }
        throw authError; // Lança para o catch principal
      }

      if (!authData.user) {
        toast.error('Erro inesperado: usuário não retornado após criação.');
        throw new Error('Usuário não retornado pelo Supabase Auth.'); // Lança para o catch
      }
      
      createdAuthUserId = authData.user.id; // Guarda ID para possível rollback
      console.log('Usuário criado com sucesso no Auth:', createdAuthUserId);

      // Inserir dados na tabela 'users'
      const userData = {
        id: createdAuthUserId,
        name: name.trim(),
        registration: registration.trim(),
        email: email,
        role: 'user', // Define role padrão
        status: 'active'
      };
      
      console.log('Tentando inserir dados na tabela users:', userData);
      const { error: insertError } = await supabase.from('users').insert([userData]);

      if (insertError) {
         console.error('Erro ao inserir dados do usuário na tabela users:', insertError);
         // Tentar rollback do usuário no Auth
         if (createdAuthUserId) {
           console.warn(`Tentando remover usuário ${createdAuthUserId} do Auth devido a falha na inserção no DB.`);
           try {
             // Nota: a chamada admin pode não estar disponível no frontend dependendo da config
             await supabase.auth.admin.deleteUser(createdAuthUserId); 
             console.log(`Usuário ${createdAuthUserId} removido do Auth.`);
           } catch (deleteError: any) {
             console.error(`Falha ao remover usuário ${createdAuthUserId} do Auth:`, deleteError.message);
             toast.info('Falha ao sincronizar dados. Contate o suporte se o problema persistir.');
           }
         }
         toast.error('Erro ao finalizar cadastro. Tente novamente.');
         throw insertError; // Lança para o catch principal
      }
      
      console.log('Dados do usuário inseridos com sucesso na tabela users.');
      toast.success('Cadastro realizado! Verifique seu e-mail para confirmação (se aplicável) e faça login.');
      navigate('/login'); // Redireciona para login após sucesso

    } catch (error) {
      // Erros específicos já mostraram toasts, aqui apenas logamos
      console.error('Erro geral no processo de registro:', error);
      // Se chegou aqui, um toast de erro já deve ter sido exibido
    } finally {
      setIsLoading(false);
    }
  };

  // Recuperação de senha
  const resetPassword = async (email: string) => {
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`, // Página para redefinir a senha
      });
      
      if (error) {
        console.error('Erro ao enviar email de recuperação:', error);
        toast.error('Erro ao enviar email de recuperação');
        return;
      }
      
      toast.success('Email de recuperação enviado com sucesso!');
      toast.info('Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.');
    } catch (error) {
      console.error('Erro ao solicitar recuperação de senha:', error);
      toast.error('Erro ao processar solicitação');
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      console.log("Iniciando processo de logout...");
      setIsLoading(true); // Ativar indicador de carregamento
      
      // Preparar-se para o logout
      const currentPath = window.location.pathname;
      console.log("Caminho atual antes do logout:", currentPath);
      
      // Limpar estado de usuário primeiro para uma resposta mais rápida na UI
      setUser(null);
      
      // Limpar todo o storage associado ao Supabase antes do logout
      console.log("Limpando dados de armazenamento local");
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.removeItem('supabase.auth.token');
      
      // Executar o logout no Supabase
      const { error } = await supabase.auth.signOut({
        scope: 'global' // Alterado para 'global' para garantir um logout completo
      });
      
      if (error) {
        console.error('Erro ao fazer logout no Supabase:', error);
        
        // Limpar todos os dados de sessão localmente
        try {
          console.log("Limpando dados de sessão manualmente");
          sessionStorage.clear();
          localStorage.clear(); // Limpar todo localStorage para garantir
          document.cookie.split(";").forEach((c) => {
            document.cookie = c
              .replace(/^ +/, "")
              .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
          });
        } catch (clearError) {
          console.error("Erro ao limpar dados locais:", clearError);
        }
        
        // Avisar o usuário, mas permitir que o logout prossiga
        toast.error('Houve um problema ao encerrar a sessão, mas você foi desconectado');
      } else {
        // Logout bem-sucedido
        console.log("Logout realizado com sucesso no Supabase");
        toast.info('Sessão encerrada com sucesso');
      }
      
      // Forçar navegação independente do resultado
      window.setTimeout(() => {
        window.location.href = '/login'; // Usar window.location para garantir uma recarga completa
      }, 500);
      
    } catch (error) {
      console.error('Erro não esperado durante logout:', error);
      
      // Tratamento de contingência: forçar o logout mesmo após erro
      setUser(null);
      
      try {
        // Limpar manualmente
        localStorage.clear();
        sessionStorage.clear();
        
        // Tentar novamente com opções simplificadas
        await supabase.auth.signOut();
      } catch (secondError) {
        console.error("Erro na segunda tentativa de logout:", secondError);
      }
      
      toast.error('Ocorreu um erro ao encerrar a sessão, mas você foi desconectado');
      
      // Forçar navegação para login com reload completo
      window.setTimeout(() => {
        window.location.href = '/login';
      }, 500);
      
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        resetPassword,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isLoading,
        resetSupabaseClient
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
