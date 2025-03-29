-- Script para corrigir o login do administrador
-- Execute este script no SQL Editor do Supabase

-- 1. Buscar o ID do usuário admin com base no email
DO $$
DECLARE
  admin_id UUID;
  admin_auth_id UUID;
BEGIN
  -- Buscar ID na tabela auth.users (onde o email está armazenado)
  SELECT id INTO admin_auth_id
  FROM auth.users
  WHERE email = 'vidalkaique.az@gmail.com';
  
  IF admin_auth_id IS NULL THEN
    RAISE NOTICE 'Usuário com email vidalkaique.az@gmail.com não encontrado na tabela auth.users';
    RETURN;
  END IF;
  
  RAISE NOTICE 'ID do admin na tabela auth.users: %', admin_auth_id;
  
  -- Buscar na tabela public.users
  SELECT id INTO admin_id
  FROM public.users
  WHERE id = admin_auth_id;
  
  -- Verificar se existe na tabela public.users
  IF admin_id IS NULL THEN
    RAISE NOTICE 'Admin não encontrado na tabela public.users. Criando usuário...';
    
    -- Criar entrada na tabela public.users
    INSERT INTO public.users (id, name, registration, email, role, status)
    VALUES (
      admin_auth_id,
      'Administrador',
      '00123456',
      'vidalkaique.az@gmail.com',
      'admin',
      'active'
    );
    
    RAISE NOTICE 'Admin criado com sucesso na tabela public.users';
  ELSE
    RAISE NOTICE 'Admin já existe na tabela public.users com ID: %', admin_id;
    
    -- Atualizar para ter certeza que está com a role correta
    UPDATE public.users
    SET 
      role = 'admin',
      status = 'active',
      name = 'Administrador',
      registration = '00123456',
      email = 'vidalkaique.az@gmail.com'
    WHERE id = admin_id;
    
    RAISE NOTICE 'Dados do admin atualizados com sucesso';
  END IF;
END $$;

-- 2. Exibir os dados atualizados do admin
SELECT id, name, registration, email, role, status
FROM public.users
WHERE email = 'vidalkaique.az@gmail.com';

-- 3. Script para verificar produtos existentes (remover duplicidade de código)
SELECT id, name, code, capacity, created_at
FROM public.products
ORDER BY created_at DESC; 