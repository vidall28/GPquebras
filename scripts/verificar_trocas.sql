-- Script para verificar e diagnosticar problemas com trocas/quebras
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar a estrutura das tabelas relacionadas a trocas/quebras
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name IN ('exchanges', 'exchange_items', 'exchange_photos')
ORDER BY 
    table_name, ordinal_position;

-- 2. Verificar políticas RLS para as tabelas de trocas
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
    AND tablename IN ('exchanges', 'exchange_items', 'exchange_photos');

-- 3. Contar o número total de trocas/quebras registradas no sistema
SELECT 
    COUNT(*) as total_exchanges,
    COUNT(*) FILTER (WHERE type = 'exchange') as total_troca,
    COUNT(*) FILTER (WHERE type = 'breakage') as total_quebra,
    COUNT(*) FILTER (WHERE status = 'pending') as total_pendente,
    COUNT(*) FILTER (WHERE status = 'approved') as total_aprovada,
    COUNT(*) FILTER (WHERE status = 'rejected') as total_rejeitada
FROM 
    public.exchanges;

-- 4. Verificar trocas/quebras registradas (últimas 20)
SELECT 
    e.id,
    e.label,
    e.type, 
    e.status,
    e.created_at,
    u.name as usuario_nome,
    u.registration as usuario_matricula,
    COUNT(ei.id) as quantidade_itens
FROM 
    public.exchanges e
LEFT JOIN 
    public.users u ON e.user_id = u.id
LEFT JOIN 
    public.exchange_items ei ON e.id = ei.exchange_id
GROUP BY 
    e.id, e.label, e.type, e.status, e.created_at, u.name, u.registration
ORDER BY 
    e.created_at DESC
LIMIT 20;

-- 5. Verificar usuário atual e suas permissões
DO $$
DECLARE
    current_user_id UUID;
    user_role TEXT;
BEGIN
    -- Obter ID do usuário atual
    SELECT auth.uid() INTO current_user_id;
    
    IF current_user_id IS NULL THEN
        RAISE NOTICE 'Você não está autenticado ou sua sessão expirou';
        RETURN;
    END IF;
    
    -- Verificar o papel do usuário
    SELECT role INTO user_role FROM public.users WHERE id = current_user_id;
    
    RAISE NOTICE 'Usuário autenticado: ID = %, Role = %', current_user_id, user_role;
    
    -- Verificar permissões do usuário para visualizar trocas
    IF user_role = 'admin' THEN
        RAISE NOTICE 'Como administrador, você deve ver TODAS as trocas/quebras';
    ELSE
        RAISE NOTICE 'Como usuário comum, você deve ver APENAS suas próprias trocas/quebras';
    END IF;
END $$;

-- 6. Corrigir políticas RLS para visualização de trocas
-- Remover e recriar políticas para SELECT na tabela exchanges
DROP POLICY IF EXISTS "Users can view all exchanges" ON public.exchanges;

-- Recriar a política para permitir que administradores vejam todas as trocas
-- e usuários comuns vejam apenas suas próprias trocas
CREATE POLICY "Users can view their own or all exchanges if admin" ON public.exchanges
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
    
-- 7. Verificar se existem trocas para o usuário atual
DO $$
DECLARE
    user_exchanges INT;
    current_user_id UUID;
BEGIN
    -- Obter ID do usuário atual
    SELECT auth.uid() INTO current_user_id;
    
    IF current_user_id IS NULL THEN
        RAISE NOTICE 'Você não está autenticado';
        RETURN;
    END IF;
    
    -- Contar trocas do usuário atual
    SELECT COUNT(*) INTO user_exchanges
    FROM public.exchanges
    WHERE user_id = current_user_id;
    
    RAISE NOTICE 'O usuário atual tem % trocas/quebras registradas', user_exchanges;
END $$; 