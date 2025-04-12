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
  const [isLoading, setIsLoading] = useState(true); // Initialize as true
  const navigate = useNavigate();

  // Função auxiliar para logar mudanças de estado
  const logStateChange = (action: string, details: any = '') => {
      console.log(`[AuthContext State Change] ${new Date().toISOString()} - ${action}`, details);
  };

  // Principal listener para estado de autenticação
  useEffect(() => {
    logStateChange("Setting up onAuthStateChange listener...");
    // Set loading true when listener setup begins - LOGGING BEFORE
    logStateChange("Initial listener setup: Setting isLoading=true");
    setIsLoading(true); 

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logStateChange(`AUTH EVENT RECEIVED: ${event}`, session ? `Session User ID: ${session.user.id}` : 'No session');
      
      // Sempre iniciar como loading quando um evento relevante acontece
      // Exceto para SIGNED_OUT que já define isLoading=false
      if (event !== 'SIGNED_OUT') {
          // LOGGING BEFORE
          logStateChange(`Event ${event}: Setting isLoading=true before processing`);
          setIsLoading(true);
      }

      if (event === 'SIGNED_OUT') {
        logStateChange("Event SIGNED_OUT: Clearing user and setting isLoading=false");
        setUser(null);
        setIsLoading(false);
        return;
      }

      if (session) {
        logStateChange(`Event ${event}: Processing session...`, `User ID: ${session.user.id}`);
        try {
          // Busca sempre os dados mais recentes do usuário na tabela 'users'
          logStateChange(`Event ${event}: Fetching detailed user data...`);
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (userError) {
            logStateChange(`Event ${event}: Error fetching user data`, userError);
            toast.error('Erro ao carregar dados do perfil. Saindo...');
            await supabase.auth.signOut(); // Força logout em caso de erro
            logStateChange(`Event ${event}: Setting user=null after fetch error`);
            setUser(null); 
            // LOGGING BEFORE - Moved to finally
            // setIsLoading(false); 
            return;
          }

          if (userData) {
            const currentUser: User = {
              id: userData.id,
              name: userData.name,
              registration: userData.registration,
              email: userData.email,
              role: userData.role,
              status: userData.status
            };
            logStateChange(`Event ${event}: Updating user state with fetched data`, currentUser);
            setUser(currentUser); // Define o usuário diretamente
          } else {
            logStateChange(`Event ${event}: Session valid, but user not found in DB. Signing out.`, `User ID: ${session.user.id}`);
            toast.error('Erro de sincronização de dados. Por favor, faça login novamente.');
            await supabase.auth.signOut();
            logStateChange(`Event ${event}: Setting user=null after user not found`);
            setUser(null);
          }

        } catch (error) {
           logStateChange(`Event ${event}: Unexpected error in listener`, error);
           toast.error('Erro inesperado ao verificar sessão. Saindo...');
           await supabase.auth.signOut(); // Força logout em erro grave
           logStateChange(`Event ${event}: Setting user=null after unexpected error`);
           setUser(null); 
        } finally {
          // Definir loading false SEMPRE que o processo terminar (sucesso ou falha na busca)
          // LOGGING BEFORE
          logStateChange(`Event ${event}: FINALLY block - Setting isLoading=false`);
          setIsLoading(false); 
        }
      } else {
        // Nenhum usuário logado (ex: após SIGNED_OUT ou INITIAL_SESSION sem usuário)
        logStateChange(`Event ${event}: No session, setting user=null and isLoading=false`);
        setUser(null);
        setIsLoading(false);
      }
    });

    logStateChange("onAuthStateChange listener configured.");

    // Limpar subscription quando o componente for desmontado
    return () => {
      logStateChange("Cleaning up auth subscription...");
      subscription?.unsubscribe();
    };
  }, []); // Executa apenas uma vez na montagem

  // useEffect para inicializar sistemas dependentes do usuário
  useEffect(() => {
    if (user) {
      logStateChange("User authenticated, initializing dependent systems (Notifications/Offline disabled for debug)", `User ID: ${user.id}`);
      // TEMPORARIAMENTE COMENTADO PARA DEBUG DE RECURSÃO:
      // try {
      //   useNotifications.init(user.id);
      // } catch (e) {
      //   console.error("Erro ao inicializar notificações:", e);
      // }
      // try {
      //   ensureOfflineManagerInitialized(user.id);
      // } catch (e) {
      //   console.error("Erro ao inicializar offline manager:", e);
      // }
      
      // console.log('Sistemas de notificações e offline inicializados para o usuário:', user.id);
    } else {
      logStateChange("User not authenticated, ensuring dependent systems are inactive.");
      // Adicionar lógicas de limpeza aqui se necessário quando o usuário desloga
    }
  }, [user]); // Depende do estado 'user'

  // Login function (simplificada)
  const login = async (email: string, password: string) => {
    // Iniciar loading aqui
    logStateChange("Login function called: Setting isLoading=true");
    setIsLoading(true); 
    localStorage.setItem('login_attempt_timestamp', Date.now().toString());
    
    try {
      logStateChange(`Login attempt for: ${email}`);
      
      // Limpar qualquer resquício de sessão anterior (mantido)
      logStateChange('Login: Clearing previous session tokens');
      try {
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('sb-auth-token');
        localStorage.removeItem('sb-refresh-token');
        localStorage.removeItem('auth_contingency_in_progress');
        logStateChange('Login: Previous tokens cleared');
      } catch (e) { /* ignore */ }

      // Enviar requisição de login para o Supabase
      logStateChange('Login: Sending signInWithPassword request...');
      const authPromise = supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      
      // Aplicar timeout (mantido)
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout (15s) ao fazer login')), 15000));
      
      // Aguardar resposta
      logStateChange('Login: Awaiting auth response (15s timeout)...');
      const { data: authData, error: authError } = await Promise.race([
        authPromise,
        timeoutPromise
      ]) as any;
      
      logStateChange('Login: Auth response received', { hasSession: !!authData?.session, error: authError?.message });
      
      // TRATAMENTO DE ERRO NO LOGIN
      if (authError || !authData?.session) {
        logStateChange('Login: Auth failed', authError ? authError.message : 'Undefined session');
        toast.error(`Falha na autenticação: ${authError ? authError.message : 'Resposta inválida do servidor'}`);
        // LOGGING BEFORE
        logStateChange("Login: Setting isLoading=false due to auth error");
        setIsLoading(false); // Define loading false AQUI no erro
        return; // Sai da função login
      }
      
      // SUCESSO NO LOGIN (continua no onAuthStateChange)
      logStateChange('Login: signIn successful. Waiting for onAuthStateChange.');
      toast.success('Login realizado com sucesso! Carregando dados...'); 
      localStorage.setItem('login_success_timestamp', Date.now().toString());
      //isLoading será definido como false pelo onAuthStateChange

    } catch (error) {
      logStateChange('Login: Fatal error during login process', error);
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
      // Definir isLoading como false AQUI também em caso de erro geral
      // LOGGING BEFORE
      logStateChange("Login: Setting isLoading=false due to catch block error");
      setIsLoading(false); 
    } 
    // O finally foi removido pois isLoading agora é gerenciado pelo onAuthStateChange ou pelos blocos de erro
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
    
    logStateChange("Register function called: Setting isLoading=true");
    setIsLoading(true);
    let createdAuthUserId: string | null = null; // Para rollback se necessário

    try {
      logStateChange('Register: Starting registration process', { email });
      
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
      logStateChange('Register: General error during registration', error);
      // Se chegou aqui, um toast de erro já deve ter sido exibido
    } finally {
      logStateChange("Register: FINALLY block - Setting isLoading=false");
      setIsLoading(false);
    }
  };

  // Recuperação de senha
  const resetPassword = async (email: string) => {
    logStateChange("ResetPassword function called: Setting isLoading=true");
    setIsLoading(true);
    
    try {
      logStateChange('ResetPassword: Sending request for email', { email });
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`, // Página para redefinir a senha
      });
      
      if (error) {
        logStateChange('ResetPassword: Error during request', error);
        toast.error('Erro ao enviar email de recuperação');
        return;
      }
      
      logStateChange('ResetPassword: Email sent successfully');
      toast.success('Email de recuperação enviado com sucesso!');
      toast.info('Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.');
    } catch (error) {
      logStateChange('ResetPassword: Error during request', error);
      toast.error('Erro ao processar solicitação');
    } finally {
      logStateChange("ResetPassword: FINALLY block - Setting isLoading=false");
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      logStateChange("Logout function called: Setting isLoading=true");
      setIsLoading(true); // Ativar indicador de carregamento
      
      // Preparar-se para o logout
      const currentPath = window.location.pathname;
      logStateChange("Logout: Current path", currentPath);
      
      // Limpar estado de usuário primeiro para uma resposta mais rápida na UI
      logStateChange("Logout: Setting user=null (UI update)");
      setUser(null);
      
      // Limpar todo o storage associado ao Supabase antes do logout
      logStateChange("Logout: Clearing local storage");
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.removeItem('supabase.auth.token');
      
      // Executar o logout no Supabase
      logStateChange("Logout: Calling supabase.auth.signOut...");
      const { error } = await supabase.auth.signOut({
        scope: 'global' // Alterado para 'global' para garantir um logout completo
      });
      
      if (error) {
        logStateChange('Logout: Error during supabase.auth.signOut', error);
        
        // Limpar todos os dados de sessão localmente
        try {
          logStateChange("Logout: Manually clearing storage due to signOut error");
          sessionStorage.clear();
          localStorage.clear(); // Limpar todo localStorage para garantir
          document.cookie.split(";").forEach((c) => {
            document.cookie = c
              .replace(/^ +/, "")
              .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
          });
        } catch (clearError) {
          logStateChange("Logout: Error clearing local data manually", clearError);
        }
        
        // Avisar o usuário, mas permitir que o logout prossiga
        toast.error('Houve um problema ao encerrar a sessão, mas você foi desconectado');
      } else {
        // Logout bem-sucedido
        logStateChange("Logout: supabase.auth.signOut successful");
        toast.info('Sessão encerrada com sucesso');
      }
      
      // Forçar navegação independente do resultado
      logStateChange("Logout: Navigating to /login via window.location.href after 500ms");
      window.setTimeout(() => {
        window.location.href = '/login'; // Usar window.location para garantir uma recarga completa
      }, 500);
      
    } catch (error) {
      logStateChange('Logout: Unexpected error during logout', error);
      
      // Tratamento de contingência: forçar o logout mesmo após erro
      logStateChange("Logout: Setting user=null in catch block");
      setUser(null);
      
      try {
        // Limpar manualmente
        logStateChange("Logout: Manually clearing storage in catch block");
        localStorage.clear();
        sessionStorage.clear();
        
        // Tentar novamente com opções simplificadas
        logStateChange("Logout: Retrying signOut in catch block");
        await supabase.auth.signOut();
      } catch (secondError) {
        logStateChange("Logout: Error during second signOut attempt", secondError);
      }
      
      toast.error('Ocorreu um erro ao encerrar a sessão, mas você foi desconectado');
      
      // Forçar navegação para login com reload completo
      logStateChange("Logout: Navigating to /login via window.location.href after 500ms (from catch)");
      window.setTimeout(() => {
        window.location.href = '/login';
      }, 500);
      
    } finally {
      // LOGGING BEFORE
      logStateChange("Logout: FINALLY block - Setting isLoading=false");
      setIsLoading(false); // Garantir que loading seja false ao final do processo
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
