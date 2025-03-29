// Função para verificar a estrutura das tabelas no Supabase
import { supabase } from './supabase';

export const debugSupabaseSchema = async () => {
  // Verificar a estrutura da tabela users
  try {
    const { data: usersColumns, error: usersError } = await supabase.rpc(
      'select_columns',
      { table_name: 'users' }
    );

    if (usersError) {
      console.error('Erro ao verificar colunas da tabela users:', usersError);
      return;
    }

    console.log('Colunas da tabela users:', usersColumns);

    // Verificar dados de um usuário específico para diagnóstico
    const { data: userExample, error: userError } = await supabase
      .from('users')
      .select('*')
      .limit(1);

    if (userError) {
      console.error('Erro ao buscar exemplo de usuário:', userError);
      return;
    }

    console.log('Exemplo de usuário na tabela users:', userExample);
    
    return {
      usersColumns,
      userExample
    };
  } catch (error) {
    console.error('Erro ao executar diagnóstico do Supabase:', error);
  }
};

// Função para criar ou verificar a existência da stored procedure select_columns
export const setupDebugProcedure = async () => {
  try {
    // Esta stored procedure permite verificar as colunas de uma tabela
    const { error } = await supabase.rpc('rls_enabled');
    
    // Se a função não existir, criá-la
    if (error && error.message.includes('does not exist')) {
      console.log('Configurando função de debug para Supabase...');
      
      // Criar a função diretamente no SQL Editor
      console.log('Por favor, execute a seguinte SQL no Supabase SQL Editor:');
      console.log(`
        CREATE OR REPLACE FUNCTION select_columns(table_name text)
        RETURNS TABLE (column_name text, data_type text) AS $$
        BEGIN
          RETURN QUERY SELECT 
            cols.column_name::text, 
            cols.data_type::text
          FROM 
            information_schema.columns cols
          WHERE 
            cols.table_schema = 'public'
            AND cols.table_name = $1;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `);
    }
  } catch (error) {
    console.error('Erro ao configurar procedimento de debug:', error);
  }
};

// Função para verificar políticas de segurança (RLS)
export const checkRLSPolicies = async () => {
  try {
    // Execute uma query para verificar as políticas da tabela users
    const { data, error } = await supabase.rpc('rls_enabled');
    
    console.log('RLS está habilitado:', data);
    
    if (error) {
      console.error('Erro ao verificar RLS:', error);
    }
  } catch (error) {
    console.error('Erro ao verificar políticas de segurança:', error);
  }
};

// Função para testar a conexão e autenticação com o Supabase
export const testSupabaseConnection = async () => {
  try {
    // Testar a conexão básica
    const { data, error } = await supabase.from('users').select('count(*)');
    
    if (error) {
      console.error('Erro ao conectar ao Supabase:', error);
      return false;
    }
    
    console.log('Conexão com Supabase estabelecida com sucesso:', data);
    return true;
  } catch (error) {
    console.error('Erro ao testar conexão com Supabase:', error);
    return false;
  }
}; 