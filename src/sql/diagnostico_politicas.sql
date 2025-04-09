-- Script de diagnóstico para problemas de visibilidade
-- Execute no SQL Editor do Supabase para identificar o problema

-- 1. Verificar usuário atual
DO $$
DECLARE
    current_user_id UUID;
    user_role TEXT;
    user_name TEXT;
BEGIN
    SELECT auth.uid() INTO current_user_id;
    
    IF current_user_id IS NULL THEN
        RAISE NOTICE 'Nenhum usuário autenticado. Faça login e tente novamente.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Usuário autenticado com ID: %', current_user_id;
    
    -- Verificar dados do usuário na tabela users
    SELECT name, role INTO user_name, user_role
    FROM public.users
    WHERE id = current_user_id;
    
    IF user_name IS NULL THEN
        RAISE NOTICE 'PROBLEMA: Usuário não encontrado na tabela public.users!';
    ELSE
        RAISE NOTICE 'Nome do usuário: %, Papel: %', user_name, user_role;
    END IF;
END $$;

-- 2. Testar função de verificação de admin
DO $$
DECLARE
    admin_check BOOLEAN;
BEGIN
    SELECT is_admin_safe() INTO admin_check;
    RAISE NOTICE 'Resultado da função is_admin_safe(): %', admin_check;
END $$;

-- 3. Contar quantos registros deveriam estar visíveis na tabela exchanges
SELECT
    COUNT(*) AS total_exchanges,
    COUNT(*) FILTER (WHERE user_id = auth.uid()) AS my_exchanges
FROM
    public.exchanges;

-- 4. Verificar todas as políticas ativas na tabela exchanges
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual
FROM 
    pg_policies
WHERE 
    tablename = 'exchanges';

-- 5. Corrigir políticas para garantir visibilidade
-- Redefinir a política para permitir que TODOS OS USUÁRIOS vejam TODOS OS REGISTROS temporariamente
DROP POLICY IF EXISTS "Users can view all exchanges" ON public.exchanges;
CREATE POLICY "Users can view all exchanges" ON public.exchanges
    FOR SELECT TO authenticated
    USING (true);  -- Política mais permissiva

DROP POLICY IF EXISTS "Users can view all exchange items" ON public.exchange_items;
CREATE POLICY "Users can view all exchange items" ON public.exchange_items
    FOR SELECT TO authenticated
    USING (true);  -- Política mais permissiva

DROP POLICY IF EXISTS "Users can view all exchange photos" ON public.exchange_photos;
CREATE POLICY "Users can view all exchange photos" ON public.exchange_photos
    FOR SELECT TO authenticated
    USING (true);  -- Política mais permissiva

-- 6. Desabilitar temporariamente o RLS se necessário (use com cuidado, apenas para diagnóstico)
-- ALTER TABLE public.exchanges DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.exchange_items DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.exchange_photos DISABLE ROW LEVEL SECURITY;

-- 7. Verificar se a tabela exchanges tem dados
SELECT COUNT(*) FROM public.exchanges;

-- 8. Exibir alguns dados para verificar se existem
SELECT id, user_id, label, type, status, created_at 
FROM public.exchanges 
LIMIT 5; 