-- Script para verificar e corrigir problemas nas operações de gerenciamento de usuários
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
    RAISE NOTICE 'O usuário é administrador e deve ter permissão para gerenciar outros usuários';
  ELSE
    RAISE NOTICE 'O usuário NÃO é administrador e não deve ter permissão para gerenciar outros usuários';
  END IF;
END $$;

-- 2. Verificar políticas RLS existentes para a tabela users
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
  AND tablename = 'users';

-- 3. Verificar se RLS está habilitado para a tabela users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE 'RLS está habilitado para a tabela users';
  ELSE
    RAISE NOTICE 'RLS NÃO está habilitado para a tabela users. Habilitando...';
    EXECUTE 'ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;';
    RAISE NOTICE 'RLS habilitado para a tabela users';
  END IF;
END $$;

-- 4. Corrigir políticas de RLS para usuários
-- Remover todas as políticas existentes para users
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Only admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Only admins can update users" ON public.users;
DROP POLICY IF EXISTS "Only admins can delete users" ON public.users;

-- Recriar todas as políticas corretamente
-- Política para SELECT (leitura) - todos os usuários autenticados podem ler
CREATE POLICY "Users can view all users" ON public.users
  FOR SELECT TO authenticated USING (true);

-- Política para INSERT - apenas administradores podem inserir
CREATE POLICY "Only admins can insert users" ON public.users
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para UPDATE - apenas administradores podem atualizar
CREATE POLICY "Only admins can update users" ON public.users
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para DELETE - apenas administradores podem excluir
CREATE POLICY "Only admins can delete users" ON public.users
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 5. Verificar se há problemas com os gatilhos (triggers) na tabela users
DO $$
DECLARE
  trigger_count INT;
  trig RECORD;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE event_object_schema = 'public'
  AND event_object_table = 'users';
  
  RAISE NOTICE 'Triggers encontrados na tabela users: %', trigger_count;
  
  IF trigger_count > 0 THEN
    RAISE NOTICE 'Lista de triggers:';
    FOR trig IN
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
      AND event_object_table = 'users'
    LOOP
      RAISE NOTICE 'Nome: %, Evento: %, Ação: %', 
        trig.trigger_name, trig.event_manipulation, trig.action_statement;
    END LOOP;
  END IF;
END $$;

-- 6. Adicionar permissão explícita para role 'service_role' operar na tabela users
GRANT ALL PRIVILEGES ON TABLE public.users TO service_role;

-- 7. Testar operação de atualização com um usuário
DO $$
DECLARE
  test_user_id UUID;
  current_user_id UUID;
  success BOOLEAN := false;
BEGIN
  -- Obter ID do usuário atual
  SELECT auth.uid() INTO current_user_id;
  
  -- Obter um usuário para teste (não o próprio usuário atual)
  SELECT id INTO test_user_id
  FROM public.users
  WHERE id != current_user_id
  LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'Não foi possível encontrar um usuário de teste.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Testando atualização para o usuário ID: %', test_user_id;
  
  -- Verificar permissões antes de tentar atualizar
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = current_user_id AND role = 'admin'
  ) THEN
    -- Tentar atualizar o usuário (sem alterar nada de fato)
    BEGIN
      UPDATE public.users
      SET updated_at = updated_at
      WHERE id = test_user_id;
      
      GET DIAGNOSTICS success = ROW_COUNT;
      
      IF success THEN
        RAISE NOTICE 'TESTE BEM-SUCEDIDO: Você tem permissão para atualizar usuários.';
      ELSE
        RAISE NOTICE 'TESTE FALHOU: Não foi possível atualizar o usuário, mesmo tendo permissão.';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ERRO AO TENTAR ATUALIZAR: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'Você não é administrador e não deve ter permissão para atualizar usuários.';
  END IF;
END $$;

-- 8. Verificar estatísticas sobre usuários no sistema
SELECT 
  role, 
  status, 
  COUNT(*) AS total 
FROM 
  public.users 
GROUP BY 
  role, status
ORDER BY 
  role, status; 