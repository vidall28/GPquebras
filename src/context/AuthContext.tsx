import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/lib/toast';
import { supabase, User } from '@/lib/supabase';

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
            setTimeout(() => reject(new Error('Timeout ao buscar dados do usuário na verificação da sessão')), 5000)
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
            
            // Obter dados básicos do usuário diretamente do Auth
            const { data: authUser } = await supabase.auth.getUser();
            
            if (authUser?.user) {
              // Criar usuário mínimo com os dados disponíveis
              const fallbackUser: User = {
                id: session.user.id,
                name: authUser.user.user_metadata?.name || authUser.user.email?.split('@')[0] || 'Usuário',
                registration: authUser.user.user_metadata?.registration || '00000000',
                email: authUser.user.email || '',
                role: 'user', // Assume role padrão
                status: 'active'
              };
              
              console.log('Definindo usuário de contingência:', fallbackUser);
              setUser(fallbackUser);
              
              // Tentar corrigir os dados do usuário em background
              supabase.rpc('fix_user_data', {
                user_id: fallbackUser.id,
                user_name: fallbackUser.name,
                user_registration: fallbackUser.registration,
                user_email: fallbackUser.email
              }).then(({error}) => {
                if (error) {
                  console.error('Erro ao corrigir dados do usuário em background:', error);
                } else {
                  console.log('Dados do usuário corrigidos em background');
                }
              });
            } else {
              console.error('Falha na solução de contingência: não foi possível obter dados do usuário');
            }
          }
        } else {
          console.log("Nenhuma sessão ativa encontrada");
        }
      } catch (error) {
        console.error('Erro ao verificar sessão:', error);
      } finally {
        setIsLoading(false);
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
          setTimeout(() => reject(new Error('Timeout ao buscar dados do usuário no evento de autenticação')), 10000)
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
            console.error('Erro ao buscar dados do usuário no evento de autenticação:', userError);
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
            const adminEmails = ['admin@example.com']; // Adicione emails de administradores conhecidos
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
            
            // Criar usuário mínimo com os dados disponíveis
            const fallbackUser: User = {
              id: session.user.id,
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Usuário',
              registration: session.user.user_metadata?.registration || '00000000',
              email: session.user.email || '',
              role: shouldBeAdmin ? 'admin' : 'user', // Usa o resultado da verificação
              status: 'active'
            };
            
            console.log('Definindo usuário de contingência a partir do evento:', fallbackUser);
            setUser(fallbackUser);
            
            // Tentar corrigir os dados do usuário em background
            supabase.rpc('fix_user_data', {
              user_id: fallbackUser.id,
              user_name: fallbackUser.name,
              user_registration: fallbackUser.registration,
              user_email: fallbackUser.email,
              user_role: fallbackUser.role // Incluir a role que determinamos
            }).then(({error}) => {
              if (error) {
                console.error('Erro ao corrigir dados do usuário em background:', error);
              } else {
                console.log('Dados do usuário corrigidos em background a partir do evento');
              }
            });
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
        }
      } else if (event === 'SIGNED_OUT') {
        console.log("Evento de logout detectado");
        setUser(null);
      }
    });
    
    // Limpar subscription quando o componente for desmontado
    return () => {
      console.log("Limpando subscription de autenticação");
      subscription.unsubscribe();
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
      
      // Verificar informações de administrador antes de buscar dados completos
      const userMetadata = authData.user.user_metadata || {};
      const isAdminInMetadata = userMetadata.role === 'admin';
      
      // Lista de emails conhecidos de administradores
      const adminEmails = ['admin@example.com']; // Substitua pelos emails reais de administradores
      const isAdminByEmail = adminEmails.includes(email);
      
      console.log('Verificação preliminar de administrador:',
                 'Nos metadados:', isAdminInMetadata,
                 'Por email:', isAdminByEmail);
      
      // MODIFICAÇÃO: Adicionar um timeout para evitar deadlock no processo de login
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao buscar dados do usuário após login')), 10000)
      );
      
      try {
        // Buscar os dados completos do usuário na tabela users
        const userDataPromise = supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .eq('status', 'active')
          .single();
          
        // Usar Race para evitar ficar preso se a consulta não responder
        const { data: userData, error: userError } = await Promise.race([userDataPromise, timeoutPromise]) as any;
        
        console.log('Resposta da busca do usuário:', 
                   userData ? 'Dados encontrados' : 'Usuário não encontrado', 
                   userError ? `Erro: ${userError.message}` : 'Sem erros');
          
        if (userError) {
          throw userError; // Usar o tratamento de erro abaixo
        }
        
        if (!userData) {
          throw new Error('Usuário não encontrado na tabela users');
        }
        
        // Login bem-sucedido
        const currentUser: User = {
          id: userData.id,
          name: userData.name,
          registration: userData.registration,
          email: userData.email,
          role: userData.role,
          status: userData.status
        };
        
        console.log('Definindo usuário após login bem-sucedido:', currentUser);
        setUser(currentUser);
        toast.success('Login realizado com sucesso!');
        
        // Verificar a sessão após o login para garantir persistência
        const { data: sessionCheck } = await supabase.auth.getSession();
        console.log("Verificação de sessão após login:", 
                   sessionCheck?.session ? "Sessão ativa" : "Sessão não encontrada");
        
        // MODIFICAÇÃO: Garantir que navegue para o dashboard após definir o usuário
        window.setTimeout(() => {
          console.log('Redirecionando para o dashboard...');
          navigate('/dashboard');
        }, 500);
        
      } catch (userFetchError) {
        console.error('Erro ao buscar dados do usuário ou timeout:', userFetchError);
        
        // MODIFICAÇÃO: SOLUÇÃO DE CONTINGÊNCIA APRIMORADA para login
        console.log('Aplicando solução de contingência para continuar o login');
        
        // 5. Verificar carimbo de administrador diretamente pelo procedimento RPC
        let adminStatusFromDb = false;
        try {
          const { data: adminCheck } = await supabase.rpc('check_if_admin', {
            user_id: authData.user.id 
          });
          if (adminCheck === true) {
            adminStatusFromDb = true;
            console.log("Confirmação de admin obtida via procedimento RPC");
          }
        } catch (rpcError) {
          console.error("Erro ao verificar status de admin via RPC:", rpcError);
        }
        
        // Determinar role com base em todas as verificações
        const shouldBeAdmin = isAdminInMetadata || isAdminByEmail || adminStatusFromDb;
        console.log("Decisão final sobre status de admin:", shouldBeAdmin);
        
        const fallbackUser: User = {
          id: authData.user.id,
          name: authData.user.user_metadata?.name || authData.user.email?.split('@')[0] || 'Usuário',
          registration: authData.user.user_metadata?.registration || '00000000',
          email: authData.user.email || '',
          role: shouldBeAdmin ? 'admin' : 'user', // Usa o resultado da verificação
          status: 'active'
        };
        
        console.log('Definindo usuário de contingência:', fallbackUser);
        setUser(fallbackUser);
        toast.success('Login realizado com sucesso!');
        
        if (shouldBeAdmin) {
          toast.info('Acesso de administrador restaurado via sistema de contingência');
        } else {
          toast.info('Alguns dados do usuário podem estar incompletos');
        }
        
        // Tentar atualizar os dados do usuário em background
        supabase.rpc('fix_user_data', {
          user_id: fallbackUser.id,
          user_name: fallbackUser.name,
          user_registration: fallbackUser.registration,
          user_email: fallbackUser.email,
          user_role: fallbackUser.role
        }).then(({error}) => {
          if (error) {
            console.error('Erro ao corrigir dados do usuário:', error);
          } else {
            console.log('Dados do usuário corrigidos em background');
          }
        });
        
        // MODIFICAÇÃO: Garantir que navegue para o dashboard mesmo no caso de erro
        window.setTimeout(() => {
          console.log('Redirecionando para o dashboard após contingência...');
          navigate('/dashboard');
        }, 500);
      }
      
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      toast.error('Erro ao realizar login: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setIsLoading(false);
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
