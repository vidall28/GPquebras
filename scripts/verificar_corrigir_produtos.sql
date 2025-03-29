-- Script para verificar e corrigir problemas na edição/exclusão de produtos
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar usuário atual e se é administrador
DO $$
DECLARE
  current_user_id UUID;
  user_role TEXT;
BEGIN
  -- Obter ID do usuário atual
  SELECT auth.uid() INTO current_user_id;
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE 'Você não está autenticado. Faça login e tente novamente.';
    RETURN;
  END IF;
  
  -- Verificar papel do usuário
  SELECT role INTO user_role FROM public.users WHERE id = current_user_id;
  
  RAISE NOTICE 'Usuário atual: ID=%', current_user_id;
  RAISE NOTICE 'Papel do usuário: %', user_role;
  
  IF user_role = 'admin' THEN
    RAISE NOTICE 'O usuário é administrador e deve ter permissão para gerenciar produtos';
  ELSE
    RAISE NOTICE 'O usuário NÃO é administrador e não deve ter permissão para gerenciar produtos';
  END IF;
END $$;

-- 2. Verificar todas as políticas RLS existentes para a tabela products
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

-- 3. Verificar se RLS está habilitado para a tabela products
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
    RAISE NOTICE 'RLS habilitado para a tabela products';
  END IF;
END $$;

-- 4. Corrigir políticas de RLS para produtos
-- Remover todas as políticas existentes para products
DROP POLICY IF EXISTS "Users can view all products" ON public.products;
DROP POLICY IF EXISTS "Only admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Only admins can update products" ON public.products;
DROP POLICY IF EXISTS "Only admins can delete products" ON public.products;

-- Recriar todas as políticas corretamente
-- Política para SELECT (leitura) - todos os usuários autenticados podem ler
CREATE POLICY "Users can view all products" ON public.products
  FOR SELECT TO authenticated USING (true);

-- Política para INSERT - apenas administradores podem inserir
CREATE POLICY "Only admins can insert products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para UPDATE - apenas administradores podem atualizar
CREATE POLICY "Only admins can update products" ON public.products
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para DELETE - apenas administradores podem excluir
CREATE POLICY "Only admins can delete products" ON public.products
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 5. Testar permissões de edição/exclusão para o usuário atual
DO $$
DECLARE
  test_product_id UUID;
  current_user_id UUID;
  can_edit BOOLEAN;
  can_delete BOOLEAN;
BEGIN
  -- Obter ID do usuário atual
  SELECT auth.uid() INTO current_user_id;
  
  -- Verificar se o usuário tem permissão para edição
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = current_user_id AND role = 'admin'
  ) INTO can_edit;
  
  -- Verificar se o usuário tem permissão para exclusão
  can_delete := can_edit; -- Mesma lógica
  
  RAISE NOTICE 'Permissão para editar produtos: %', CASE WHEN can_edit THEN 'SIM' ELSE 'NÃO' END;
  RAISE NOTICE 'Permissão para excluir produtos: %', CASE WHEN can_delete THEN 'SIM' ELSE 'NÃO' END;
  
  -- Se o usuário não for admin, pode apresentar o caminho para se tornar admin
  IF NOT can_edit THEN
    RAISE NOTICE 'Para obter permissões de administrador, execute:';
    RAISE NOTICE 'UPDATE public.users SET role = ''admin'' WHERE id = ''%'';', current_user_id;
  END IF;
END $$;

-- 6. Verificar estatísticas de uso de produtos em trocas
SELECT p.id, p.name, p.code, COUNT(ei.id) as usage_count
FROM public.products p
LEFT JOIN public.exchange_items ei ON p.id = ei.product_id
GROUP BY p.id, p.name, p.code
ORDER BY usage_count DESC;

-- 7. Verificar e corrigir problemas no gerenciamento de transações/sessions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role; 