import { supabase } from '@/lib/supabaseClient';
import type { Tables, User } from '@/types/database';
import { clearCache } from '@/lib/cache'; // Importar clearCache se upsertUser o utiliza

// --- Funções RPC Individuais (Exemplo: verificação de admin, notificações) ---

// Interface para os parâmetros da RPC 'is_admin'
interface IsAdminParams {
  user_id: string; // Verificar se este é o nome correto do parâmetro na sua definição de RPC
}

// Função para verificar se o usuário é administrador via RPC 'is_admin' com timeout
export const checkIfUserIsAdmin = async (userId: string): Promise<boolean> => {
  if (!userId) {
    console.error('checkIfUserIsAdmin: ID do usuário não fornecido');
    return false;
  }

  console.log(`Verificando se o usuário ${userId} é administrador via RPC 'is_admin'...`);

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.warn(`Timeout (3s) ao verificar status de admin para ${userId} via RPC 'is_admin'`);
      resolve(false);
    }, 3000);

    (async () => {
      try {
        const params: IsAdminParams = { user_id: userId };
        const { data: isAdmin, error: rpcError } = await supabase.rpc('is_admin', params);

        clearTimeout(timeoutId);

        if (rpcError) {
          console.error(`Erro ao chamar RPC 'is_admin' para ${userId}:`, rpcError);
          resolve(false);
        } else {
          console.log(`Usuário ${userId} ${isAdmin ? 'é' : 'não é'} administrador (RPC 'is_admin')`);
          resolve(!!isAdmin);
        }
      } catch (e) {
        clearTimeout(timeoutId);
        console.error(`Erro geral ao verificar admin para ${userId} via RPC 'is_admin':`, e);
        resolve(false);
      }
    })();
  });
};

// Função para marcar todas as notificações como lidas para um usuário
export const markAllNotificationsAsRead = async (userId: string): Promise<void> => {
  console.log(`Marcando todas as notificações como lidas para o usuário ${userId}`);
  try {
    const { error } = await supabase.rpc('mark_all_notifications_as_read', { p_user_id: userId });
    if (error) throw error;
    console.log(`Notificações marcadas como lidas com sucesso para ${userId}`);
  } catch (error) {
    console.error('Erro ao marcar notificações como lidas:', error);
  }
};

// --- Funções de Manipulação de Dados (Exemplo: upsertUser) ---

// Atualizar ou inserir dados do usuário na tabela 'users'
// Considerar usar supabase.from('users').upsert() como alternativa
export const upsertUser = async (user: User): Promise<void> => {
  console.log(`Upserting user ${user.id} (${user.email})...`);
  try {
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle(); // Use maybeSingle para não gerar erro se não encontrar

    if (selectError && selectError.code !== 'PGRST116') { // Ignorar erro "No rows found"
      throw selectError;
    }

    const userData: Omit<Tables['users'], 'created_at' | 'updated_at'> = {
      id: user.id,
      name: user.name,
      registration: user.registration,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    if (existingUser) {
      // Atualizar usuário existente
      console.log(`Updating existing user ${user.id}`);
      const { error: updateError } = await supabase
        .from('users')
        .update(userData)
        .eq('id', user.id);
      if (updateError) throw updateError;
      console.log(`User ${user.id} updated successfully.`);
    } else {
      // Inserir novo usuário
      console.log(`Inserting new user ${user.id}`);
      const { error: insertError } = await supabase
        .from('users')
        .insert(userData);
      if (insertError) throw insertError;
      console.log(`User ${user.id} inserted successfully.`);
    }
    
    // Limpar cache após a operação
    clearCache(['users', `user_${user.id}`]); 

  } catch (error) {
    console.error('Erro ao fazer upsert do usuário:', error);
  }
};


// --- Objeto RPC Helper (Opcional, pode ser removido se as funções acima forem suficientes) ---
// Este objeto pode ser útil se você tiver muitas RPCs e quiser agrupá-las
// Considere tipar os parâmetros e retornos como no exemplo checkIfUserIsAdmin
export const rpc = {
  async is_admin(userId: string): Promise<boolean> {
    return checkIfUserIsAdmin(userId); // Reutiliza a função já definida
  },
  
  // Exemplo de como adicionar outra RPC
  async get_user_by_id(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase.rpc('get_user_by_id', { user_id: userId });
      if (error) throw error;
      return data as User; // Adicionar validação/mapeamento se necessário
    } catch (error) {
      console.error('Erro ao chamar RPC get_user_by_id:', error);
      return null;
    }
  },
  
  // Adicione outras chamadas RPC aqui conforme necessário
}; 