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

  // Principal listener para estado de autenticação
  useEffect(() => {
    console.log("Configurando listener onAuthStateChange...");
    setIsLoading(true); // Set loading true when listener setup begins

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`Evento de autenticação: ${event}${session ? ' com sessão' : ''}`);

      if (event === 'SIGNED_OUT') {
        console.log("Evento SIGNED_OUT recebido, limpando usuário.");
        setUser(null);
        setIsLoading(false);
        // O logout() já navega, não precisa aqui
        return;
      }

      if (session) {
        console.log(`Usuário autenticado (evento ${event}), ID: ${session.user.id}`);
        // Tentar buscar dados detalhados do usuário
        console.log(`Buscando dados detalhados do usuário após evento ${event}...`);
        // Não setar loading true aqui novamente, já está true desde o início do listener
        try {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout (10s) ao buscar dados do usuário no onAuthStateChange')), 10000)
          );
          
          const userDataPromise = supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          const { data: userData, error: userError } = await Promise.race([userDataPromise, timeoutPromise]) as any;

          if (userError) {
            console.error(`Erro ao buscar dados do usuário (evento ${event}):`, userError);
            // Se o erro for timeout ou específico, tentar fallback
            if (userError instanceof Error && userError.message.includes('Timeout')) {
               toast.error('Servidor demorou a responder. Verificando dados mínimos.');
            } else {
               toast.error('Erro ao carregar perfil completo.');
            }
            // Por agora, apenas deslogamos para evitar estado inconsistente
            console.warn("Falha ao buscar dados do usuário, deslogando para segurança.");
            await supabase.auth.signOut(); // Força logout
            setUser(null); 
            setIsLoading(false);
            // Considerar não navegar aqui, talvez mostrar mensagem na tela de login
            // navigate('/login'); 
            return;
          }

          if (userData) {
            console.log(`Dados do usuário carregados do evento de autenticação (${event}):`, userData);
            const currentUser: User = {
              id: userData.id,
              name: userData.name,
              registration: userData.registration,
              email: userData.email,
              role: userData.role,
              status: userData.status
            };
            console.log(`Atualizando usuário no estado a partir do evento (${event}):`, currentUser);
            // Verifica se o usuário realmente mudou para evitar re-renders desnecessários
            // Comparação simples (pode precisar ser mais robusta se objetos complexos)
            if (JSON.stringify(user) !== JSON.stringify(currentUser)) {
              setUser(currentUser);
            }
          } else {
            // Não encontrou usuário na tabela 'users', pode ser um problema
            console.warn(`Sessão válida (evento ${event}), mas usuário ${session.user.id} não encontrado na tabela 'users'.`);
            toast.error('Erro de sincronização de dados. Por favor, faça login novamente.');
            await supabase.auth.signOut();
            setUser(null);
            setIsLoading(false);
            // navigate('/login');
            return;
          }

        } catch (error) {
           console.error(`Erro inesperado no listener onAuthStateChange (evento ${event}):`, error);
           toast.error('Erro inesperado ao verificar sessão.');
           setUser(null); // Limpa usuário em caso de erro grave
        } finally {
          setIsLoading(false); // Garante que loading termina APÓS tentativa de buscar dados
        }
      } else if (event !== 'INITIAL_SESSION') {
        // Se não há sessão e não é a sessão inicial
        console.log(`Evento ${event} sem sessão, garantindo que usuário é nulo.`);
        setUser(null);
        setIsLoading(false);
      } else if (event === 'INITIAL_SESSION') {
         // Sessão inicial pode ou não ter usuário, se não tiver, termina o loading
         if (!session) {
            console.log("Sessão inicial sem usuário logado.")
            setIsLoading(false);
         }
         // Se tiver sessão, o bloco 'if (session)' acima tratará e definirá isLoading = false no finally
      }
    });

    console.log("Listener onAuthStateChange configurado.");

    // Limpar subscription quando o componente for desmontado
    return () => {
      console.log("Limpando subscription de autenticação onAuthStateChange");
      subscription?.unsubscribe();
    };
  }, []); // Executa apenas uma vez na montagem

  // useEffect para inicializar sistemas dependentes do usuário
  useEffect(() => {
    if (user) {
      console.log("Usuário autenticado, inicializando sistemas avançados (NOTIFICAÇÕES E OFFLINE TEMPORARIAMENTE DESABILITADOS PARA DEBUG)");
      
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
      console.log("Usuário não autenticado, garantindo que sistemas (notificações/offline) não estão ativos.");
      // Adicionar lógicas de limpeza aqui se necessário quando o usuário desloga
    }
  }, [user]); // Depende do estado 'user'

  // Login function (simplificada)
  const login = async (email: string, password: string) => {
    // Iniciar loading aqui
    setIsLoading(true); 
    localStorage.setItem('login_attempt_timestamp', Date.now().toString());
    
    try {
      console.log(`Iniciando processo de login para: ${email} às ${new Date().toISOString()}`);
      
      // Limpar qualquer resquício de sessão anterior (mantido)
      console.log('Limpando dados residuais de sessão anterior');
      try {
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('sb-auth-token');
        localStorage.removeItem('sb-refresh-token');
        localStorage.removeItem('auth_contingency_in_progress');
        console.log('Limpeza de sessão anterior concluída');
      } catch (e) { /* ignore */ }

      // Enviar requisição de login para o Supabase
      console.log('Enviando requisição de login para o Supabase...');
      const authPromise = supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      
      // Aplicar timeout (mantido)
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout (15s) ao fazer login')), 15000));
      
      // Aguardar resposta
      console.log('Aguardando resposta da autenticação com timeout de 15s...');
      const { data: authData, error: authError } = await Promise.race([
        authPromise,
        timeoutPromise
      ]) as any;
      
      console.log('Resposta recebida da autenticação:', 
                 authData?.session ? 'Login bem-sucedido' : 'Sem sessão', 
                 authError ? `Erro: ${authError.message}` : 'Sem erros');
      
      // TRATAMENTO DE ERRO NO LOGIN
      if (authError || !authData?.session) {
        console.error('Erro ao fazer login:', authError ? authError.message : 'Sessão indefinida na resposta');
        toast.error(`Falha na autenticação: ${authError ? authError.message : 'Resposta inválida do servidor'}`);
        setIsLoading(false); // Define loading false AQUI no erro
        return; // Sai da função login
      }
      
      // SUCESSO NO LOGIN (continua no onAuthStateChange)
      console.log('Login via signIn bem-sucedido. Aguardando onAuthStateChange para atualizar estado.');
      toast.success('Login realizado com sucesso! Carregando dados...'); 
      localStorage.setItem('login_success_timestamp', Date.now().toString());

    } catch (error) {
      console.error('Erro fatal ao fazer login:', error);
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
      setIsLoading(false); 
    } finally {
       // Remover setIsLoading(false) daqui.
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
