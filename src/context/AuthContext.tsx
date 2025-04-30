import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/lib/toast';
import { supabase, User, Tables } from '@/lib/supabase';
import { useNotifications } from '@/lib/notifications';
import { ensureOfflineManagerInitialized } from '@/lib/offlineManager';
import { Session } from '@supabase/supabase-js';

// Define auth context interface
interface AuthContextType {
  user: User | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<void>;
  register: (registration: string, name: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Função auxiliar para logar (mantida para debug)
  const logStateChange = (action: string, details: any = '') => {
      console.log(`[AuthContext Refactored] ${new Date().toISOString()} - ${action}`, details);
  };

  // Função para buscar dados do perfil do usuário
  const fetchUserProfile = useCallback(async (userId: string): Promise<User | null> => {
    logStateChange('fetchUserProfile: Called', `UserID: ${userId}`);
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) {
        logStateChange('fetchUserProfile: Error fetching profile', userError);
        toast.error(`Erro ao buscar perfil: ${userError.message}`);
        return null;
      }

      if (userData) {
        logStateChange('fetchUserProfile: Profile found', userData);
        const currentUser: User = {
          id: userData.id,
          name: userData.name,
          registration: userData.registration,
          email: userData.email,
          role: userData.role,
          status: userData.status
        };
        return currentUser;
      } else {
        logStateChange('fetchUserProfile: Profile not found in DB', `UserID: ${userId}`);
        
        // Em vez de mostrar toast de erro e retornar null, vamos tentar criar o perfil básico
        // Este trecho ajuda quando a autenticação funciona mas o perfil não existe no banco
        try {
          logStateChange('fetchUserProfile: Tentando criar perfil básico para o usuário', userId);
          const authUserResponse = await supabase.auth.getUser();
          
          if (authUserResponse.error) {
            logStateChange('fetchUserProfile: Erro ao obter dados do usuário autenticado', authUserResponse.error);
            return null;
          }
          
          const authUser = authUserResponse.data.user;
          if (!authUser || !authUser.email) {
            logStateChange('fetchUserProfile: Usuário autenticado sem email', authUser);
            return null;
          }
          
          // Criar um perfil básico
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: userId,
              email: authUser.email,
              name: authUser.email.split('@')[0], // Nome básico a partir do email
              registration: '0000000', // Matrícula padrão
              role: 'user',
              status: 'active'
            });
            
          if (insertError) {
            logStateChange('fetchUserProfile: Erro ao criar perfil básico', insertError);
            return null;
          }
          
          // Buscar o perfil recém-criado
          return {
            id: userId,
            email: authUser.email,
            name: authUser.email.split('@')[0],
            registration: '0000000',
            role: 'user',
            status: 'active'
          };
        } catch (createError) {
          logStateChange('fetchUserProfile: Erro ao criar perfil básico', createError);
          toast.error('Não foi possível criar seu perfil. Tente fazer logout e login novamente.');
          return null;
        }
      }
    } catch (error) {
      logStateChange('fetchUserProfile: Unexpected error', error);
      toast.error('Erro inesperado ao buscar perfil.');
      return null;
    }
  }, []); // useCallback para evitar recriação desnecessária

  // Listener principal (SIMPLIFICADO: A verificação inicial é feita pelo AppInitializer)
  useEffect(() => {
    let isMounted = true; // Flag para evitar atualizações de estado após desmontar
    logStateChange('useEffect[]: Setting up onAuthStateChange listener...');
    setIsLoading(true); // Começa como loading até o primeiro evento ser processado

    // Função para verificar a sessão atual e atualizar o estado
    const checkSessionStatus = async () => {
      if (!isMounted) return;
      
      logStateChange('checkSessionStatus: Verificando status da sessão atual');
      setIsLoading(true);
      
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          logStateChange('checkSessionStatus: Erro ao verificar sessão', error);
          setIsLoading(false);
          return;
        }
        
        if (!currentSession) {
          logStateChange('checkSessionStatus: Nenhuma sessão encontrada');
          setUser(null);
          setSession(null);
          setIsLoading(false);
          return;
        }
        
        setSession(currentSession);
        const userProfile = await fetchUserProfile(currentSession.user.id);
        
        if (userProfile) {
          setUser(userProfile);
        } else {
          setUser(null);
        }
      } catch (e) {
        logStateChange('checkSessionStatus: Erro inesperado', e);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    logStateChange('setupListener: Setting up onAuthStateChange...');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!isMounted) {
          logStateChange(`onAuthStateChange: ${event} received, but component unmounted. Ignoring.`);
          return;
        }

        logStateChange(`onAuthStateChange: Event received: ${event}`, currentSession ? `UserID: ${currentSession.user.id}` : 'No session');
        setSession(currentSession); // Atualiza a sessão do Supabase SEMPRE

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          if (currentSession) {
            setIsLoading(true); // Mostra loading enquanto busca perfil
            logStateChange(`onAuthStateChange ${event}: Fetching profile...`, `UserID: ${currentSession.user.id}`);
            const profile = await fetchUserProfile(currentSession.user.id);
            if (profile && isMounted) {
              setUser(profile);
              logStateChange(`onAuthStateChange ${event}: Profile loaded, user set.`);
              // Após login bem-sucedido, navegar para o dashboard
              if (event === 'SIGNED_IN') {
                navigate('/dashboard');
              }
            } else if (!profile && isMounted) {
              logStateChange(`onAuthStateChange ${event}: Profile not found after ${event}, signing out.`);
              toast.error('Falha ao carregar perfil após autenticação. Você será desconectado.');
              await supabase.auth.signOut(); // Listener pegará o SIGNED_OUT
            }
          }
          // Sempre definir isLoading como false após o processamento
          if (isMounted) {
            setIsLoading(false);
          }
        } else if (event === 'SIGNED_OUT') {
          logStateChange(`onAuthStateChange ${event}: Clearing user state.`);
          if (isMounted) {
            setUser(null);
            setSession(null);
            setIsLoading(false);
          }
        } else if (event === 'USER_UPDATED') {
          logStateChange(`onAuthStateChange ${event}: User updated, refreshing profile.`);
          if (currentSession && isMounted) {
            const profile = await fetchUserProfile(currentSession.user.id);
            if (profile) {
              setUser(profile);
            }
            setIsLoading(false);
          }
        } else if (event === 'PASSWORD_RECOVERY') {
          logStateChange(`onAuthStateChange ${event}: Password recovery - not handling specifically.`);
          if (isMounted) setIsLoading(false);
        }
      }
    );

    // Adicionar evento para quando o usuário retorna à página
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        logStateChange('handleVisibilityChange: Usuário retornou à página, verificando sessão...');
        checkSessionStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Verificar sessão inicial
    checkSessionStatus();

    // Limpar ao desmontar
    return () => {
      isMounted = false;
      logStateChange('useEffect[]: Cleaning up listeners...');
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };

  }, [fetchUserProfile, navigate]); // Dependências estáveis

  // Inicialização de sistemas dependentes (Notificações, Offline)
  useEffect(() => {
    if (user) {
      logStateChange('useEffect[user]: User authenticated, initializing dependent systems.', `User ID: ${user.id}`);
      // REMOVIDO: A inicialização de sistemas dependentes foi movida para o AppInitializer
      // para evitar dependências circulares e recursão infinita
    } else {
      logStateChange('useEffect[user]: User not authenticated, dependent systems inactive.');
      // Lógica de limpeza para notificações/offline se necessário
    }
  }, [user]);

  // --- Funções de Ação ---

  const login = useCallback(async (email: string, password: string) => {
    logStateChange('login: Attempting...', { email });
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        logStateChange('login: Auth error', error);
        // Erros comuns: Invalid login credentials, Email not confirmed
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Credenciais inválidas. Verifique seu email e senha.');
        } else if (error.message.includes('Email not confirmed')) {
           toast.error('Email não confirmado. Verifique sua caixa de entrada.');
        } else {
           toast.error(`Erro no login: ${error.message}`);
        }
        setIsLoading(false); // Termina loading no erro
      } else {
        logStateChange('login: Success. Waiting for onAuthStateChange.');
        toast.success('Login realizado com sucesso!');
        
        // Verificar se onAuthStateChange não está sendo chamado
        setTimeout(() => {
          if (isLoading) {
            logStateChange('login: Forçando finalização do login após timeout');
            
            // Verificar estado da sessão manualmente se o evento não foi processado
            supabase.auth.getSession().then(async ({ data }) => {
              if (data.session) {
                logStateChange('login: Sessão encontrada manualmente, buscando perfil...');
                const profile = await fetchUserProfile(data.session.user.id);
                if (profile) {
                  setUser(profile);
                  setSession(data.session);
                  navigate('/dashboard');
                }
              }
              setIsLoading(false);
            });
          }
        }, 3000); // 3 segundos de timeout para garantir que o processo de login seja concluído
      }
    } catch (error) {
      logStateChange('login: Unexpected error', error);
      toast.error('Erro inesperado durante o login.');
      setIsLoading(false); // Termina loading no erro
    }
    // Não colocar finally setIsLoading(false) aqui, pois o sucesso depende do onAuthStateChange
  }, [navigate, fetchUserProfile, isLoading]);

  const register = useCallback(async (
    registration: string,
    name: string,
    email: string,
    password: string,
    confirmPassword: string
  ) => {
    logStateChange('register: Attempting...', { email, name, registration });
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }
    setIsLoading(true);
    try {
       // 1. Registrar no Supabase Auth
       logStateChange('register: Calling supabase.auth.signUp...');
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Data pode ser usado para passar info que pode ser útil
          // em email templates ou functions/triggers após o signup.
          // NÃO use para dados de perfil que devem ir na tabela 'users'.
          data: {
             name: name, // Exemplo, pode não ser o ideal aqui
             registration: registration // Exemplo
          }
        }
      });

      if (signUpError) {
         logStateChange('register: Supabase signUp error', signUpError);
        if (signUpError.message.includes('User already registered')) {
          toast.error('Este email já está cadastrado.');
        } else if (signUpError.message.includes('Password should be at least 6 characters')) {
           toast.error('A senha deve ter pelo menos 6 caracteres.');
        } else {
          toast.error(`Erro no registro: ${signUpError.message}`);
        }
        setIsLoading(false);
        return;
      }

       logStateChange('register: Supabase signUp successful', signUpData);

       // Verificar se o usuário foi criado e se requer confirmação
       if (!signUpData.user) {
           logStateChange('register: signUp successful but no user object returned. Strange case.');
           toast.error('Erro inesperado no registro. Tente novamente.');
           setIsLoading(false);
           return;
       }

       // 2. Inserir/Atualizar na tabela 'users' (SE signUp bem-sucedido)
       // É importante que a tabela 'users' use o ID do supabase.auth.users como chave primária
       // e tenha políticas RLS configuradas corretamente.
       logStateChange('register: Upserting user profile data...', { userId: signUpData.user.id });
       const { error: profileError } = await supabase
         .from('users')
         .upsert({
           id: signUpData.user.id, // Chave estrangeira para auth.users.id
           registration,
           name,
           email, // Pode ser redundante se já estiver em auth.users
           role: 'user', // Definir role padrão
           status: 'ativo' // Definir status padrão
         });

       if (profileError) {
         logStateChange('register: Error upserting profile', profileError);
         toast.error(`Erro ao salvar perfil: ${profileError.message}`);
         // Considerar: deletar o usuário do auth se o perfil falhou? (rollback manual)
         // await supabase.auth.admin.deleteUser(signUpData.user.id); // Requer privilégios de admin
         toast.error('Registro parcial. Contate o suporte.');
         setIsLoading(false);
         return;
       }

       logStateChange('register: Profile upsert successful.');

       // Verificar se a confirmação de email é necessária
       const emailConfirmationNeeded = signUpData.user.identities?.length === 0; // Supabase pode retornar identities vazio se email não confirmado

       if (emailConfirmationNeeded || !signUpData.session) { // Ou se a sessão não foi criada automaticamente
           logStateChange('register: Email confirmation likely needed.');
           toast.success('Registro realizado! Verifique seu email para confirmação.');
           navigate('/login'); // Enviar para login após registro
       } else {
           logStateChange('register: SignUp seems complete (session created/no confirmation needed). Waiting for onAuthStateChange.');
           toast.success('Registro e login realizados com sucesso!');
           // onAuthStateChange deve pegar o SIGNED_IN agora
       }

    } catch (error) {
      logStateChange('register: Unexpected error', error);
      toast.error('Erro inesperado durante o registro.');
    } finally {
      // Definir isLoading como false no finally da função register,
      // pois onAuthStateChange pode ou não ser acionado dependendo da confirmação de email.
      setIsLoading(false);
      logStateChange('register: Finished.');
    }
  }, [navigate]);

  const logout = useCallback(async () => {
    logStateChange('logout: Executing...');
    setIsLoading(true);
    try {
      // Logout do Supabase Auth
      const { error } = await supabase.auth.signOut();
      
      // Limpar local storage e session storage de forma mais agressiva
      localStorage.removeItem('sb-auth-token');
      localStorage.removeItem('sb-refresh-token');
      localStorage.removeItem('supabase.auth.token');
      
      if (error) {
        logStateChange('logout: Error', error);
        toast.error(`Erro ao fazer logout: ${error.message}`);
      } else {
        logStateChange('logout: Success');
        toast.success('Logout realizado com sucesso!');
        
        // Forçar limpeza de estado e redirecionamento
        setUser(null);
        setSession(null);
        
        // Forçar redirecionamento para login
        setTimeout(() => {
          navigate('/login');
        }, 100);
      }
    } catch (error) {
      logStateChange('logout: Unexpected error', error);
      toast.error('Erro inesperado durante logout.');
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  const resetPassword = useCallback(async (email: string) => {
    logStateChange('resetPassword: Attempting...', { email });
    setIsLoading(true);
    try {
      // Nota: redirectTo deve apontar para a página onde o usuário definirá a nova senha.
      // O Supabase adicionará parâmetros à URL.
      const redirectTo = `${window.location.origin}/update-password`;
      logStateChange('resetPassword: Redirect URL set to', redirectTo);

      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        logStateChange('resetPassword: Error', error);
        toast.error(`Erro ao enviar email: ${error.message}`);
      } else {
        logStateChange('resetPassword: Email sent successfully.');
        toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.');
      }
    } catch (error) {
      logStateChange('resetPassword: Unexpected error', error);
      toast.error('Erro inesperado ao solicitar recuperação.');
    } finally {
      setIsLoading(false);
      logStateChange('resetPassword: Finished.');
    }
  }, []);

  // --- Valores Expostos ---

  const isAuthenticated = !!user && !!session; // Usuário logado E com perfil carregado
  const isAdmin = user?.role === 'admin'; // Verifica se o usuário tem a role 'admin'

  const value = {
    user,
    session,
    login,
    register,
    resetPassword,
    logout,
    isAuthenticated,
    isAdmin,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook para usar o contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Exportar tipos se necessário
export type { User }; // Exporta nosso tipo User customizado
