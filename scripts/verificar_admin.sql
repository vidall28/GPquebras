-- Script para verificar e corrigir o status de administrador dos usuários
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar usuários existentes e seus roles
SELECT 
  id, 
  name, 
  registration, 
  email, 
  role, 
  status, 
  created_at
FROM 
  public.users
ORDER BY 
  role, created_at DESC;

-- 2. Definir usuário como administrador
-- Descomente e modifique conforme necessário
-- UPDATE public.users
-- SET role = 'admin'
-- WHERE registration = '00123456' -- Substitua pelo número de matrícula do usuário
-- RETURNING id, name, registration, email, role, status;

-- 3. Verificar permissões RLS (Row Level Security)
DO $$
BEGIN
  RAISE NOTICE '--- Verificando políticas RLS (Row Level Security) ---';
  
  -- Verificar se RLS está habilitado para tabela products
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'products' 
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE 'RLS está habilitado para a tabela products';
  ELSE
    RAISE NOTICE 'RLS NÃO está habilitado para a tabela products';
  END IF;
  
  -- Listar políticas existentes na tabela products
  RAISE NOTICE 'Políticas RLS para a tabela products:';
END $$;

SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
FROM 
  pg_policies
WHERE 
  schemaname = 'public' 
  AND tablename = 'products';

-- 4. Função para promover um usuário a administrador
CREATE OR REPLACE FUNCTION promote_to_admin(user_registration TEXT)
RETURNS TEXT AS $$
DECLARE
  target_user RECORD;
  result TEXT;
BEGIN
  -- Verificar se o usuário existe
  SELECT * INTO target_user 
  FROM public.users
  WHERE registration = user_registration;
  
  IF NOT FOUND THEN
    RETURN 'Usuário com matrícula ' || user_registration || ' não encontrado';
  END IF;
  
  -- Verificar se já é admin
  IF target_user.role = 'admin' THEN
    RETURN 'Usuário ' || target_user.name || ' (matrícula: ' || target_user.registration || ') já é administrador';
  END IF;
  
  -- Promover para admin
  UPDATE public.users
  SET role = 'admin'
  WHERE registration = user_registration;
  
  RETURN 'Usuário ' || target_user.name || ' (matrícula: ' || target_user.registration || ') promovido a administrador com sucesso';
END;
$$ LANGUAGE plpgsql;

-- Uso da função (descomente e modifique conforme necessário):
-- SELECT promote_to_admin('00123456'); 