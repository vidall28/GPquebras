import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/lib/toast';
import { supabase, User, ADMIN_EMAILS, Tables } from '@/lib/supabase';

// Função para recriar o cliente Supabase e tentar corrigir problemas de API key
const resetSupabaseClient = async () => {
  console.log('===== TENTATIVA DE REINICIALIZAÇÃO DO CLIENTE SUPABASE =====');
  
  try {
    // Recuperar as variáveis de ambiente novamente
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Erro: Variáveis de ambiente ainda não estão disponíveis');
      toast.error('Erro na configuração do Supabase. Verifique as variáveis de ambiente.');
      return false;
    }
    
    console.log('API URL:', supabaseUrl);
    console.log('API Key length:', supabaseKey.length);
    
    // Limpar o cache de autenticação
    try {
      localStorage.removeItem('sb-auth-token');
      localStorage.removeItem('sb-auth-token-code-verifier');
      localStorage.removeItem('auth_contingency_in_progress');
      console.log('Cache de autenticação limpo');
    } catch (e) {
      console.error('Erro ao limpar cache:', e);
    }
    
    // Atualizar headers globais para incluir a API key
    supabase.headers = {
      ...supabase.headers,
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`
    };
    
    // Verificar se o cliente foi reinicializado corretamente com um teste simples
    const { error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Erro após reinicialização do cliente:', error);
      toast.error('Erro ao conectar com o Supabase: ' + error.message);
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
              
              // Verificar se o usuário é administrador através do RPC
              let adminStatusFromDb = false;
              try {
                const { data: adminCheck } = await supabase.rpc('check_if_admin', {
                  user_id: session.user.id 
                });
                if (adminCheck === true) {
                  adminStatusFromDb = true;
                  console.log("Confirmação de admin obtida via procedimento RPC");
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
                
                // Verificar email para administrador
                const adminEmails = ADMIN_EMAILS || ['admin@example.com']; // Usa ADMIN_EMAILS do supabase.ts
                const isAdminByEmail = adminEmails.includes(authUser.user.email || '');
                
                // Determinar se é admin com base em todas as verificações
                const shouldBeAdmin = isAdminInMetadata || isAdminByEmail || adminStatusFromDb;
                
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
        
        // MODIFICAÇÃO: Aumentar timeout para evitar ficar preso na busca dos dados
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ao buscar dados do usuário no evento de autenticação')), 15000)
        );
        
        try {
          // Buscar os dados do usuário
          const userDataPromise = supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          // Usar Race para evitar ficar preso
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
              
              // 4. Como última tentativa, verificar o email do usuário
              // Geralmente há um padrão de emails para administradores que podemos usar
              const adminEmails = ADMIN_EMAILS || ['admin@example.com']; // Usa ADMIN_EMAILS do supabase.ts
              const isAdminByEmail = adminEmails.includes(session.user.email || '');
              
              // 5. Verificar carimbo de administrador em outros sistemas
              // Tentativa direta via SQL para verificar status de admin (sem usar os níveis de abstração)
              let adminStatusFromDb = false;
              try {
                const { data: adminCheck } = await supabase.rpc('check_if_admin', {
                  user_id: session.user.id 
                });
                if (adminCheck === true) {
                  adminStatusFromDb = true;
                  console.log("Confirmação de admin obtida via procedimento RPC");
                }
              } catch (rpcError) {
                console.error("Erro ao verificar status de admin via RPC:", rpcError);
              }
              
              // 6. Determinar se o usuário é admin baseado em todas as verificações
              const shouldBeAdmin = isAdminInMetadata || isAdminByEmail || adminStatusFromDb;
              console.log("Decisão final sobre status de admin:", shouldBeAdmin);
              
              // 7. Tenta inserir ou atualizar o usuário na tabela users
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
        console.log("Evento de logout detectado");
        setUser(null);
        localStorage.removeItem('auth_contingency_in_progress');
      }
    });
    
    // Limpar subscription quando o componente for desmontado
    return () => {
      console.log("Limpando subscription de autenticação");
      subscription.unsubscribe();
      localStorage.removeItem('auth_contingency_in_progress');
    };
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      console.log(`Iniciando processo de login para: ${email}`);
      
      // Limpar qualquer resquício de sessão anterior
      console.log('Limpando dados residuais de sessão anterior');
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.removeItem('supabase.auth.token');
      
      // Configuração para persistência da sessão
      const persistenceOptions = {
        persistSession: true
      };
      
      // Fazer login diretamente com o Supabase Auth usando email
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
        options: persistenceOptions
      });
      
      console.log('Resposta da autenticação:', 
                 authData ? 'Autenticação bem-sucedida' : 'Sem dados de autenticação', 
                 authError ? `Erro: ${authError.message}` : 'Sem erros');
      
      if (authError || !authData.user) {
        console.error('Erro ao fazer login:', authError);
        toast.error('Credenciais inválidas');
        setIsLoading(false);
        return;
      }
      
      // Log para debugging dos metadados do usuário
      console.log('Metadados do usuário Auth:', authData.user.user_metadata);
      console.log('ID do usuário autenticado:', authData.user.id);
      
      // NOVA ABORDAGEM: Verificar se é admin e criar usuário básico imediatamente
      const userMetadata = authData.user.user_metadata || {};
      const isAdminInMetadata = userMetadata.role === 'admin';
      const isAdminByEmail = ADMIN_EMAILS.includes(email);
      const shouldBeAdmin = isAdminInMetadata || isAdminByEmail;
      
      // Criar usuário básico com dados disponíveis
      const basicUser: User = {
        id: authData.user.id,
        name: userMetadata.name || authData.user.email?.split('@')[0] || 'Usuário',
        registration: userMetadata.registration || '00000000',
        email: authData.user.email || email,
        role: shouldBeAdmin ? 'admin' : 'user',
        status: 'active'
      };
      
      // Definir o usuário imediatamente para melhorar a experiência
      console.log('Definindo usuário básico:', basicUser);
      setUser(basicUser);
      
      // Mostrar mensagem de sucesso
      toast.success('Login realizado com sucesso!');
      
      if (basicUser.role === 'admin') {
        toast.info('Acesso de administrador concedido');
      }
      
      // Verificar token rapidamente
      try {
        console.log('Verificando token após login...');
        const { data: sessionCheck, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Erro ao verificar sessão após login:', sessionError);
        } else if (!sessionCheck.session) {
          console.error('Sessão não encontrada após login bem-sucedido');
        } else {
          console.log('Token verificado com sucesso, expira em:', 
                     new Date(sessionCheck.session.expires_at * 1000).toLocaleString());
        }
      } catch (tokenError) {
        console.error('Erro ao validar token:', tokenError);
      }
      
      // Iniciar redirecionamento para o dashboard primeiro
      console.log('Iniciando redirecionamento para dashboard...');
      navigate('/dashboard');
      
      // Após redirecionar, tentar completar o perfil em segundo plano
      try {
        console.log('Tentando buscar perfil completo em segundo plano...');
        
        // Usando uma promise com timeout mais curto e tipagem correta
        const userPromise = new Promise<Tables['users'] | null>(async (resolve) => {
          try {
            // Tentar buscar o usuário da tabela
            const { data, error } = await supabase
              .from('users')
              .select('*')
              .eq('id', basicUser.id)
              .single();
              
            if (error) {
              console.warn('Erro ao buscar usuário completo:', error.message);
              resolve(null);
            } else {
              resolve(data);
            }
          } catch (e) {
            console.warn('Exceção ao buscar usuário:', e);
            resolve(null);
          }
        });
        
        // Definir timeout curto (3 segundos)
        const timeoutPromise = new Promise<null>((resolve) => {
          setTimeout(() => {
            console.log('Timeout na busca do perfil completo');
            resolve(null);
          }, 3000);
        });
        
        // Buscar o perfil com timeout
        const userData = await Promise.race([userPromise, timeoutPromise]) as Tables['users'] | null;
        
        if (userData) {
          console.log('Perfil completo obtido com sucesso:', userData);
          
          // Atualizar usuário no state com tipagem adequada
          const completeUser: User = {
            id: userData.id,
            name: userData.name || basicUser.name,
            registration: userData.registration || basicUser.registration,
            email: userData.email || basicUser.email,
            role: (userData.role as 'admin' | 'user') || basicUser.role,
            status: (userData.status as 'active' | 'inactive') || 'active'
          };
          
          console.log('Atualizando usuário com perfil completo:', completeUser);
          setUser(completeUser);
        } else {
          console.log('Perfil completo não encontrado, tentando criar perfil...');
          
          // Tentar criar o perfil sem bloquear o fluxo
          try {
            const { error: insertError } = await supabase
              .from('users')
              .insert([{
                id: basicUser.id,
                name: basicUser.name,
                registration: basicUser.registration,
                email: basicUser.email,
                role: basicUser.role,
                status: 'active'
              }]);
              
            if (insertError) {
              console.warn('Erro ao criar perfil em segundo plano:', insertError.message);
            } else {
              console.log('Perfil criado com sucesso em segundo plano');
            }
          } catch (e) {
            console.warn('Exceção ao criar perfil:', e);
          }
        }
      } catch (backgroundError) {
        console.warn('Erro em segundo plano:', backgroundError);
        // Não interferir na experiência do usuário com erros em segundo plano
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      toast.error('Erro ao realizar login: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setIsLoading(false);
      // Remover qualquer flag de contingência remanescente
      localStorage.removeItem('auth_contingency_in_progress');
    }
  };

  // Register function
  const register = async (registration: string, name: string, email: string, password: string, confirmPassword: string) => {
    setIsLoading(true);
    
    try {
      // Log de início de processo
      console.log('Iniciando processo de registro:', { registration, name, email });
      
      if (password !== confirmPassword) {
        toast.error('As senhas não coincidem');
        return;
      }
      
      if (registration.length !== 8 || !/^\d+$/.test(registration)) {
        toast.error('A matrícula deve conter 8 dígitos');
        return;
      }
      
      // Verificar entrada de nome
      if (!name || name.trim() === '') {
        toast.error('O nome não pode estar vazio');
        return;
      }
      
      // Verificações adicionais para matrícula
      if (!registration || registration.trim() === '') {
        toast.error('A matrícula não pode estar vazia');
        return;
      }
      
      // Verificar formato do email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast.error('Formato de email inválido');
        return;
      }
      
      // Verificar se o email já está cadastrado
      const { data: existingUsersByEmail, error: emailCheckError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email);
        
      if (emailCheckError) {
        console.error('Erro ao verificar email:', emailCheckError);
      } else if (existingUsersByEmail && existingUsersByEmail.length > 0) {
        toast.error('Email já cadastrado');
        return;
      }
      
      // Verificar se a matrícula já existe
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('registration', registration)
        .single();
        
      if (existingUser) {
        toast.error('Matrícula já cadastrada');
        return;
      }
      
      console.log('Dados do registro antes de criar usuário:', {
        registration: registration.trim(),
        name: name.trim(),
        email: email
      });
      
      // Criar usuário no Auth do Supabase usando o email fornecido
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            registration: registration.trim(),
            name: name.trim()
          }
        }
      });
      
      if (authError) {
        console.error('Erro ao criar usuário no Auth:', authError);
        toast.error('Erro ao criar conta: ' + authError.message);
        return;
      }
      
      if (!authData.user) {
        toast.error('Erro ao criar usuário');
        return;
      }
      
      console.log('Usuário criado com sucesso no Auth:', authData.user.id);
      
      // MODIFICAÇÃO: Adicionar um pequeno atraso para garantir que o usuário foi criado no Auth
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Preparar os dados do usuário para inserção
      const userData = {
        id: authData.user.id,
        name: name.trim(),
        registration: registration.trim(),
        email: email,
        role: 'user',
        status: 'active'
      };
      
      console.log('Tentando inserir dados na tabela users:', userData);
      
      // MODIFICAÇÃO: Verificar se o usuário já existe na tabela users antes de inserir
      const { data: existingUserData, error: existingUserError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();
        
      if (existingUserData) {
        console.log('Usuário já existe na tabela users, atualizando dados:', existingUserData);
        
        // Atualizar os dados do usuário existente
        const { error: updateError } = await supabase
          .from('users')
          .update({
            name: name.trim(),
            registration: registration.trim(),
            email: email,
            status: 'active'
          })
          .eq('id', authData.user.id);
          
        if (updateError) {
          console.error('Erro ao atualizar dados do usuário:', updateError);
          toast.error('Erro ao atualizar dados do usuário');
          return;
        }
        
        console.log('Dados do usuário atualizados com sucesso');
      } else {
        // Inserir dados do usuário na tabela users, incluindo o email
        const { error: insertError } = await supabase
          .from('users')
          .insert([userData]);
          
        if (insertError) {
          console.error('Erro ao inserir dados do usuário:', insertError);
          
          // MODIFICAÇÃO: Tentar uma abordagem direta via SQL se o insert falhar
          console.log('Tentando inserir usuário via SQL direto...');
          
          const sqlInsert = `
            INSERT INTO public.users (id, name, registration, email, role, status, created_at)
            VALUES ('${authData.user.id}', '${name.trim()}', '${registration.trim()}', '${email}', 'user', 'active', now())
          `;
          
          const { error: rpcError } = await supabase.rpc('execute_sql', { sql: sqlInsert });
          
          if (rpcError) {
            console.error('Erro ao inserir via SQL direto:', rpcError);
            
            // Se não conseguiu inserir, tentar remover o usuário do Auth
            try {
              await supabase.auth.admin.deleteUser(authData.user.id);
            } catch (deleteError) {
              console.error('Erro ao remover usuário do Auth:', deleteError);
            }
            
            toast.error('Erro ao cadastrar dados do usuário. Entre em contato com o suporte.');
            return;
          } else {
            console.log('Usuário inserido com sucesso via SQL direto');
          }
        }
      }
      
      // Verificar se os dados foram inseridos corretamente
      const { data: checkUserData, error: checkUserError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();
       
      if (checkUserError) {
        console.error('Erro ao verificar dados do usuário inserido:', checkUserError);
      } else {
        console.log('Dados do usuário inseridos com sucesso:', checkUserData);
        
        // Verificar se os dados salvos correspondem aos fornecidos
        if (checkUserData.name !== name.trim()) {
          console.warn('Nome salvo diferente:', {
            fornecido: name.trim(),
            salvo: checkUserData.name
          });
          
          // Tentar corrigir o nome
          const { error: nameUpdateError } = await supabase
            .from('users')
            .update({ name: name.trim() })
            .eq('id', authData.user.id);
            
          if (nameUpdateError) {
            console.error('Erro ao corrigir nome:', nameUpdateError);
          } else {
            console.log('Nome corrigido com sucesso');
          }
        }
        
        if (checkUserData.registration !== registration.trim()) {
          console.warn('Matrícula salva diferente:', {
            fornecida: registration.trim(),
            salva: checkUserData.registration
          });
          
          // Tentar corrigir a matrícula
          const { error: regUpdateError } = await supabase
            .from('users')
            .update({ registration: registration.trim() })
            .eq('id', authData.user.id);
            
          if (regUpdateError) {
            console.error('Erro ao corrigir matrícula:', regUpdateError);
          } else {
            console.log('Matrícula corrigida com sucesso');
          }
        }
        
        if (checkUserData.email !== email) {
          console.warn('Email salvo diferente:', {
            fornecido: email,
            salvo: checkUserData.email
          });
          
          // Tentar corrigir o email
          const { error: emailUpdateError } = await supabase
            .from('users')
            .update({ email: email })
            .eq('id', authData.user.id);
            
          if (emailUpdateError) {
            console.error('Erro ao corrigir email:', emailUpdateError);
          } else {
            console.log('Email corrigido com sucesso');
          }
        }
      }
      
      toast.success('Cadastro realizado com sucesso!');
      toast.info('Você já pode fazer login com suas credenciais');
      navigate('/login');
    } catch (error) {
      console.error('Erro no registro:', error);
      toast.error('Erro ao realizar cadastro: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
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
        isLoading
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
