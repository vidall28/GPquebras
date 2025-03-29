-- Script para corrigir políticas RLS (Row Level Security)
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar se o usuário atual é administrador
DO $$
DECLARE
  user_id UUID;
  user_role TEXT;
BEGIN
  -- Obter ID do usuário atual
  SELECT auth.uid() INTO user_id;
  
  -- Verificar se o ID foi obtido
  IF user_id IS NULL THEN
    RAISE NOTICE 'Você não está autenticado. Faça login e tente novamente.';
    RETURN;
  END IF;
  
  -- Verificar o papel do usuário
  SELECT role INTO user_role FROM public.users WHERE id = user_id;
  
  IF user_role = 'admin' THEN
    RAISE NOTICE 'Usuário atual é administrador (ID: %)', user_id;
  ELSE
    RAISE NOTICE 'Usuário atual NÃO é administrador (ID: %, Role: %)', user_id, user_role;
  END IF;
END $$;

-- 2. Exibir políticas existentes para a tabela products
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

-- 3. Remover e recriar as políticas para INSERT na tabela products
-- Primeiro, remover a política existente para INSERT (pode falhar se não existir, é normal)
DROP POLICY IF EXISTS "Only admins can insert products" ON public.products;

-- Recriar a política corretamente
CREATE POLICY "Only admins can insert products" ON public.products
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Verificar se o RLS está habilitado na tabela products
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'products' 
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE 'RLS está habilitado para a tabela products';
  ELSE
    RAISE NOTICE 'RLS NÃO está habilitado para a tabela products. Habilitando...';
    EXECUTE 'ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;';
    RAISE NOTICE 'RLS foi habilitado para a tabela products';
  END IF;
END $$;

-- 5. Listar as políticas atualizadas
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd
FROM 
  pg_policies
WHERE 
  schemaname = 'public' 
  AND tablename = 'products';

-- 6. Testar se o usuário atual tem permissão para inserir produtos
DO $$
DECLARE
  has_permission BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO has_permission;
  
  IF has_permission THEN
    RAISE NOTICE 'Você tem permissão para inserir produtos.';
  ELSE
    RAISE NOTICE 'Você NÃO tem permissão para inserir produtos.';
  END IF;
END $$; 