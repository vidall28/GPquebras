-- Funções auxiliares para diagnóstico de banco de dados no Supabase

-- Função para listar colunas de uma tabela
CREATE OR REPLACE FUNCTION table_columns_info(table_name text)
RETURNS TABLE (column_name text, data_type text, is_nullable boolean) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    cols.column_name::text, 
    cols.data_type::text,
    cols.is_nullable::boolean
  FROM 
    information_schema.columns cols
  WHERE 
    cols.table_schema = 'public'
    AND cols.table_name = table_name
  ORDER BY
    cols.ordinal_position;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar se o RLS está habilitado
CREATE OR REPLACE FUNCTION rls_enabled()
RETURNS TABLE (table_name text, rls_enabled boolean)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tables.table_name::text,
    tables.row_level_security::boolean
  FROM
    information_schema.tables tables
  WHERE
    tables.table_schema = 'public'
  ORDER BY
    tables.table_name;
END;
$$ LANGUAGE plpgsql;

-- Função para sincronizar emails entre auth.users e public.users
CREATE OR REPLACE FUNCTION sync_auth_emails()
RETURNS TABLE (user_id text, email text, success boolean)
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  auth_email TEXT;
  success BOOLEAN;
BEGIN
  -- Criar visualização temporária para acesso à tabela auth.users (se não existir)
  CREATE OR REPLACE VIEW auth_users_view AS 
    SELECT id, email FROM auth.users;
  
  -- Iterando sobre cada usuário na tabela users
  FOR user_record IN 
    SELECT id, email, registration 
    FROM public.users 
    WHERE email IS NULL OR email = ''
  LOOP
    -- Buscando email da tabela auth.users
    SELECT email INTO auth_email 
    FROM auth_users_view 
    WHERE id = user_record.id;
    
    -- Tentando atualizar o registro com o email encontrado
    IF auth_email IS NOT NULL AND auth_email != '' THEN
      UPDATE public.users 
      SET email = auth_email 
      WHERE id = user_record.id;
      
      -- Verificar se a atualização foi bem-sucedida
      success := FOUND;
    ELSE
      -- Se não encontrou na tabela auth.users, tentar usar o formato padrão
      auth_email := user_record.registration || '@example.com';
      
      UPDATE public.users 
      SET email = auth_email 
      WHERE id = user_record.id;
      
      success := FOUND;
    END IF;
    
    -- Retornar o resultado para o cliente
    user_id := user_record.id;
    email := auth_email;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Função para diagnosticar problemas de registro
CREATE OR REPLACE FUNCTION diagnose_registration_issues()
RETURNS TEXT
SECURITY DEFINER
AS $$
DECLARE
  output TEXT := '';
  missing_email_count INTEGER;
  auth_mismatch_count INTEGER;
  missing_column BOOLEAN := FALSE;
BEGIN
  -- Verificar se a coluna email existe
  PERFORM 1 
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'email';
  
  IF NOT FOUND THEN
    output := output || 'PROBLEMA CRÍTICO: Coluna email não existe na tabela users.' || E'\n';
    missing_column := TRUE;
  ELSE
    output := output || 'OK: Coluna email existe na tabela users.' || E'\n';
  END IF;
  
  -- Verificar registros sem email (apenas se a coluna existir)
  IF NOT missing_column THEN
    SELECT COUNT(*) INTO missing_email_count
    FROM public.users
    WHERE email IS NULL OR email = '';
    
    IF missing_email_count > 0 THEN
      output := output || 'PROBLEMA: ' || missing_email_count || ' usuários sem email definido.' || E'\n';
    ELSE
      output := output || 'OK: Todos os usuários têm email definido.' || E'\n';
    END IF;
  END IF;
  
  -- Verificar correspondência entre auth.users e public.users
  CREATE TEMP TABLE IF NOT EXISTS temp_auth_users AS
  SELECT id, email FROM auth.users;
  
  SELECT COUNT(*) INTO auth_mismatch_count
  FROM temp_auth_users au
  LEFT JOIN public.users pu ON au.id = pu.id
  WHERE pu.id IS NULL;
  
  IF auth_mismatch_count > 0 THEN
    output := output || 'PROBLEMA: ' || auth_mismatch_count || ' usuários na auth.users sem correspondência em public.users.' || E'\n';
  ELSE
    output := output || 'OK: Todos os usuários de auth.users têm correspondência em public.users.' || E'\n';
  END IF;
  
  -- Adicionar recomendações
  output := output || E'\n' || 'RECOMENDAÇÕES:' || E'\n';
  
  IF missing_column THEN
    output := output || '- Execute o script para adicionar a coluna email à tabela users.' || E'\n';
  END IF;
  
  IF missing_email_count > 0 THEN
    output := output || '- Execute a função sync_auth_emails() para sincronizar emails faltantes.' || E'\n';
  END IF;
  
  IF auth_mismatch_count > 0 THEN
    output := output || '- Verifique os usuários em auth.users que não possuem entrada em public.users.' || E'\n';
  END IF;
  
  -- Limpar tabela temporária
  DROP TABLE IF EXISTS temp_auth_users;
  
  RETURN output;
END;
$$ LANGUAGE plpgsql;

-- Função para execução de SQL direto (com limitações de segurança)
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS VOID
SECURITY DEFINER
AS $$
BEGIN
  -- Verifica se a consulta é segura (não permite operações DROP ou TRUNCATE)
  IF position('DROP ' in UPPER(sql)) > 0 OR position('TRUNCATE ' in UPPER(sql)) > 0 THEN
    RAISE EXCEPTION 'Operação não permitida: DROP ou TRUNCATE não são permitidas';
  END IF;
  
  -- Executa o SQL fornecido
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar diretamente um usuário específico (mais seguro que execute_sql)
CREATE OR REPLACE FUNCTION fix_user_data(
  user_id uuid, 
  user_name text, 
  user_registration text, 
  user_email text
)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
  success BOOLEAN;
BEGIN
  UPDATE public.users 
  SET 
    name = user_name,
    registration = user_registration,
    email = user_email
  WHERE id = user_id;
  
  success := FOUND;
  RETURN success;
END;
$$ LANGUAGE plpgsql; 