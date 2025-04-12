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
        toast.error('Perfil de usuário não encontrado na base de dados.');
        return null;
      }
    } catch (error) {
      logStateChange('fetchUserProfile: Unexpected error', error);
      toast.error('Erro inesperado ao buscar perfil.');
      return null;
    }
  }, []); // useCallback para evitar recriação desnecessária

  // Listener principal e verificação inicial
  useEffect(() => {
    let isMounted = true; // Flag para evitar atualizações de estado após desmontar
    logStateChange('useEffect[]: Mounting and checking initial session...');
    setIsLoading(true);

    const checkSessionAndSetupListener = async () => {
      logStateChange('checkSession: Attempting to get current session...');
      const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        logStateChange('checkSession: Error getting initial session', sessionError);
        toast.error(`Erro ao verificar sessão: ${sessionError.message}`);
        // Mesmo com erro, continuamos para configurar o listener
      }

      if (initialSession && isMounted) {
        logStateChange('checkSession: Initial session found', `UserID: ${initialSession.user.id}`);
        setSession(initialSession);
        const profile = await fetchUserProfile(initialSession.user.id);
        if (profile && isMounted) {
          setUser(profile);
        } else if (!profile) {
          // Se temos sessão mas não perfil, algo está errado, deslogar
          logStateChange('checkSession: Profile not found for initial session, signing out.');
          await supabase.auth.signOut(); // Não precisa setar user/session aqui, o listener fará
        }
      } else {
         logStateChange('checkSession: No initial session found.');
         // Garante que user e session estão nulos se não houver sessão inicial
         if (isMounted) {
           setUser(null);
           setSession(null);
         }
      }

      // Configura o listener DEPOIS de verificar a sessão inicial
      logStateChange('setupListener: Setting up onAuthStateChange...');
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, currentSession) => {
          if (!isMounted) {
            logStateChange(`onAuthStateChange: ${event} received, but component unmounted. Ignoring.`);
            return;
          }

          logStateChange(`onAuthStateChange: Event received: ${event}`, currentSession ? `UserID: ${currentSession.user.id}` : 'No session');
          setSession(currentSession); // Atualiza a sessão do Supabase

          if (event === 'SIGNED_IN' && currentSession) {
            setIsLoading(true); // Mostra loading enquanto busca perfil
            const profile = await fetchUserProfile(currentSession.user.id);
            if (profile && isMounted) {
              setUser(profile);
            } else if (!profile && isMounted) {
              // Se logou mas não achou perfil, deslogar
              logStateChange('onAuthStateChange SIGNED_IN: Profile not found, signing out.');
              toast.error('Falha ao carregar perfil após login. Desconectando.');
              await supabase.auth.signOut(); // Listener pegará o SIGNED_OUT
            }
            setIsLoading(false);
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setSession(null);
            // Limpar sistemas dependentes se necessário
            logStateChange('onAuthStateChange SIGNED_OUT: User state cleared.');
            setIsLoading(false); // Garante que o loading termina no logout
          } else if (event === 'USER_UPDATED' && currentSession) {
             // Opcional: Recarregar perfil se dados relevantes no Supabase Auth mudaram
             logStateChange('onAuthStateChange USER_UPDATED: Re-fetching profile...');
             setIsLoading(true);
             const profile = await fetchUserProfile(currentSession.user.id);
             if (profile && isMounted) setUser(profile);
             setIsLoading(false);
          } else if (event === 'TOKEN_REFRESHED') {
             logStateChange('onAuthStateChange TOKEN_REFRESHED: Session updated.');
             // A sessão já foi atualizada pelo setSession(currentSession)
             // Não precisa fazer mais nada geralmente, a menos que precise revalidar algo
          } else if (event === 'PASSWORD_RECOVERY') {
             logStateChange('onAuthStateChange PASSWORD_RECOVERY: User needs to set a new password.');
             // Pode redirecionar para uma página de redefinição de senha aqui
             navigate('/reset-password'); // Exemplo
          }
        }
      );

      // Define isLoading como false APÓS a verificação inicial e configuração do listener
      if (isMounted) {
        logStateChange('useEffect[]: Initial check complete, setting isLoading=false.');
        setIsLoading(false);
      }

      // Função de limpeza
      return () => {
        logStateChange('useEffect[]: Unmounting. Cleaning up subscription.');
        isMounted = false;
        subscription?.unsubscribe();
      };
    };

    checkSessionAndSetupListener();

    // Retorna a função de limpeza do useEffect principal
    // (a função retornada por checkSessionAndSetupListener será chamada na desmontagem)
    return () => {
        logStateChange('useEffect[] Cleanup Function Execution');
        isMounted = false;
        // A limpeza da subscription é tratada dentro do checkSessionAndSetupListener
    };

  }, [fetchUserProfile, navigate]); // Adicionar dependências estáveis

  // Inicialização de sistemas dependentes (Notificações, Offline)
  useEffect(() => {
    if (user) {
      logStateChange('useEffect[user]: User authenticated, initializing dependent systems.', `User ID: ${user.id}`);
      // try {
      //   useNotifications.init(user.id);
      //   ensureOfflineManagerInitialized(user.id);
      // } catch (e) {
      //   logStateChange('useEffect[user]: Error initializing dependent systems', e);
      // }
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
        toast.success('Login iniciado...'); // onAuthStateChange cuidará do resto
        // setIsLoading será false quando onAuthStateChange buscar o perfil
      }
    } catch (error) {
      logStateChange('login: Unexpected error', error);
      toast.error('Erro inesperado durante o login.');
      setIsLoading(false); // Termina loading no erro
    }
    // Não colocar finally setIsLoading(false) aqui, pois o sucesso depende do onAuthStateChange
  }, []);

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
         toast.warning('Registro parcial. Contate o suporte.');
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
    logStateChange('logout: Attempting...');
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        logStateChange('logout: Error during signOut', error);
        toast.error(`Erro ao sair: ${error.message}`);
        // Mesmo com erro, tentar limpar localmente e navegar
        setUser(null);
        setSession(null);
        navigate('/login');
      } else {
        logStateChange('logout: signOut successful. Waiting for onAuthStateChange.');
        // setUser(null) e setSession(null) serão feitos pelo onAuthStateChange
      }
    } catch (error) {
      logStateChange('logout: Unexpected error', error);
      toast.error('Erro inesperado ao sair.');
       // Garantir limpeza local em caso de erro catastrófico
       setUser(null);
       setSession(null);
       navigate('/login');
    } finally {
       // O isLoading será definido como false pelo onAuthStateChange (SIGNED_OUT)
       // Mas podemos adicionar aqui por segurança se o evento falhar
       setIsLoading(false);
       logStateChange('logout: Finished.');
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
