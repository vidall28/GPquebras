import { supabase } from '@/lib/supabaseClient';
import type { Tables, User } from '@/types/database';
import { clearCache } from '@/lib/cache'; // Importar clearCache se upsertUser o utiliza

// --- Funções RPC Individuais (Exemplo: verificação de admin, notificações) ---

// Interface para os parâmetros da RPC
interface CheckIfAdminParams {
  user_id: string; // Corrigido para user_id conforme a imagem
}

// Função para verificar se o usuário é administrador via RPC com timeout
export const checkIfUserIsAdmin = async (userId: string): Promise<boolean> => {
  if (!userId) {
    console.error('checkIfUserIsAdmin: ID do usuário não fornecido');
    return false;
  }

  console.log(`Verificando se o usuário ${userId} é administrador via RPC 'check_if_admin'...`);

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.warn(`Timeout (3s) ao verificar status de admin para ${userId} via RPC 'check_if_admin'`);
      resolve(false);
    }, 3000);

    (async () => {
      try {
        // Corrigido para usar user_id no parâmetro
        const params: CheckIfAdminParams = { user_id: userId }; 
        const { data: isAdmin, error: rpcError } = await supabase.rpc('check_if_admin', params); 

        clearTimeout(timeoutId);

        if (rpcError) {
          console.error(`Erro ao chamar RPC 'check_if_admin' para ${userId}:`, rpcError);
          resolve(false);
        } else {
          console.log(`Usuário ${userId} ${isAdmin ? 'é' : 'não é'} administrador (RPC 'check_if_admin')`);
          resolve(!!isAdmin);
        }
      } catch (e) {
        clearTimeout(timeoutId);
        console.error(`Erro geral ao verificar admin para ${userId} via RPC 'check_if_admin':`, e);
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
    
    // Limpar cache após a operação (chamadas separadas)
    clearCache('users'); 
    clearCache(`user_${user.id}`);

  } catch (error) {
    console.error('Erro ao fazer upsert do usuário:', error);
    // Re-lançar o erro pode ser útil se o chamador precisar saber
    // throw error;
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
  
  // Função RPC para ping (simples)
  async ping(): Promise<boolean> {
    try {
      // Assumindo que a função RPC se chama 'ping' e retorna algo (ex: true)
      const { data, error } = await supabase.rpc('ping');
      if (error) {
        console.error('Erro no RPC ping:', error);
        return false;
      }
      // Retorna true se a chamada RPC foi bem-sucedida (mesmo que data seja null)
      return true; 
    } catch (error) {
      console.error('Erro geral no RPC ping:', error);
      return false;
    }
  },
  
  // Função RPC para verificar RLS
  async rlsEnabled(): Promise<boolean> {
     try {
      // Assumindo que a função RPC se chama 'is_rls_enabled' e retorna boolean
      const { data, error } = await supabase.rpc('is_rls_enabled'); 
      if (error) {
        console.error('Erro no RPC is_rls_enabled:', error);
        return false; // Assume RLS como não habilitado ou erro
      }
      // Retorna o valor booleano diretamente
      return !!data;
    } catch (error) {
      console.error('Erro geral no RPC is_rls_enabled:', error);
      return false;
    }
  },
  
  // Função para atualizar o status de uma troca/quebra
  async updateExchangeStatus(id: string, status: 'pending' | 'approved' | 'rejected', notes?: string): Promise<boolean> {
    try {
      console.log(`Atualizando status da troca/quebra ${id} para ${status}`);
      
      // Em vez de chamar a RPC que retorna 404, vamos atualizar diretamente a tabela
      const { error } = await supabase
        .from('exchanges')
        .update({
          status: status,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) {
        console.error('Erro ao atualizar status diretamente:', error);
        return false;
      }
      
      console.log(`Status da troca/quebra ${id} atualizado com sucesso para ${status}`);
      return true;
    } catch (error) {
      console.error('Erro geral ao atualizar status da troca/quebra:', error);
      return false;
    }
  },
  
  // Função de atualização de emergência para admins
  async emergencyUpdateExchange(id: string, status: 'pending' | 'approved' | 'rejected', notes?: string, adminId?: string): Promise<boolean> {
    try {
      console.log(`Atualização de emergência da troca/quebra ${id} para ${status} pelo admin ${adminId}`);
      
      // Atualizar diretamente a tabela em vez de usar RPC
      const { error } = await supabase
        .from('exchanges')
        .update({
          status: status,
          notes: notes || null,
          updated_at: new Date().toISOString(),
          updated_by: adminId
        })
        .eq('id', id);
      
      if (error) {
        console.error('Erro na atualização de emergência:', error);
        return false;
      }
      
      console.log(`Atualização de emergência da troca/quebra ${id} realizada com sucesso`);
      return true;
    } catch (error) {
      console.error('Erro geral na atualização de emergência:', error);
      return false;
    }
  },
  
  // Adicione outras chamadas RPC aqui conforme necessário
}; 