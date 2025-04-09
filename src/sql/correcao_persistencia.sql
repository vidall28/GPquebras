-- Script de correção para o problema de persistência dos registros após logout/login
-- Este script resolve o problema onde os registros desaparecem após um novo login

-- 1. Verificar e resetar as políticas RLS de forma mais agressiva
-- Remover TODAS as políticas existentes para as tabelas relevantes
DO $$
DECLARE
    policy_rec RECORD;
BEGIN
    -- Listar e remover todas as políticas existentes para a tabela exchanges
    FOR policy_rec IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'exchanges'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_rec.policyname || '" ON public.exchanges';
        RAISE NOTICE 'Removida política: % da tabela exchanges', policy_rec.policyname;
    END LOOP;
    
    -- Listar e remover todas as políticas existentes para a tabela exchange_items
    FOR policy_rec IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'exchange_items'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_rec.policyname || '" ON public.exchange_items';
        RAISE NOTICE 'Removida política: % da tabela exchange_items', policy_rec.policyname;
    END LOOP;
    
    -- Listar e remover todas as políticas existentes para a tabela exchange_photos
    FOR policy_rec IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'exchange_photos'
    ) LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_rec.policyname || '" ON public.exchange_photos';
        RAISE NOTICE 'Removida política: % da tabela exchange_photos', policy_rec.policyname;
    END LOOP;
END $$;

-- 2. Verificar o estado do RLS para cada tabela
SELECT 
    tablename, 
    rowsecurity AS rls_enabled
FROM 
    pg_tables
WHERE 
    schemaname = 'public'
    AND tablename IN ('exchanges', 'exchange_items', 'exchange_photos');

-- 3. Garantir que o RLS está habilitado para todas as tabelas
ALTER TABLE public.exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_photos ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas UNIVERSAIS para que TODOS vejam TUDO (abordagem mais permissiva)
-- Política para a tabela exchanges
CREATE POLICY "Any authenticated user can see any exchange" 
    ON public.exchanges
    FOR SELECT TO authenticated
    USING (true);

-- Política para a tabela exchange_items
CREATE POLICY "Any authenticated user can see any exchange item" 
    ON public.exchange_items
    FOR SELECT TO authenticated
    USING (true);

-- Política para a tabela exchange_photos
CREATE POLICY "Any authenticated user can see any exchange photo" 
    ON public.exchange_photos
    FOR SELECT TO authenticated
    USING (true);

-- 5. Criar políticas específicas para INSERT que sejam permissivas o suficiente
CREATE POLICY "Users can create exchanges" 
    ON public.exchanges
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can insert exchange items" 
    ON public.exchange_items
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Users can insert exchange photos" 
    ON public.exchange_photos
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- 6. Criar políticas para UPDATE e DELETE que sigam as regras de negócio
-- Apenas proprietários e admins podem atualizar/excluir
CREATE POLICY "Users can update own exchanges or admins can update any" 
    ON public.exchanges
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can delete own exchanges or admins can delete any" 
    ON public.exchanges
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- 7. Verificar se existem dados nas tabelas (confirmação)
SELECT 
    'exchanges' AS table_name, COUNT(*) AS record_count FROM public.exchanges
UNION ALL
SELECT 
    'exchange_items' AS table_name, COUNT(*) AS record_count FROM public.exchange_items
UNION ALL
SELECT 
    'exchange_photos' AS table_name, COUNT(*) AS record_count FROM public.exchange_photos;

-- 8. Verificar a permissão explícita para o usuário atual
DO $$
DECLARE
    current_user_id UUID;
    exchange_count INTEGER;
BEGIN
    SELECT auth.uid() INTO current_user_id;
    
    IF current_user_id IS NULL THEN
        RAISE NOTICE 'Nenhum usuário autenticado. Faça login e tente novamente.';
        RETURN;
    END IF;
    
    -- Verificar explicitamente quantas trocas o usuário atual pode ver
    SELECT COUNT(*) INTO exchange_count
    FROM public.exchanges;
    
    RAISE NOTICE 'Usuário % pode ver % registros na tabela exchanges', current_user_id, exchange_count;
END $$; 