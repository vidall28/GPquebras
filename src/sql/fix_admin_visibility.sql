-- Garantir que administradores possam ver todos os registros
-- Este script corrige especificamente o problema de visibilidade para administradores

-- 1. Criar função para verificar com segurança se o usuário atual é administrador
CREATE OR REPLACE FUNCTION public.is_admin_safe()
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
    is_admin BOOLEAN;
BEGIN
    -- Verificar primeiro na tabela de usuários
    SELECT (role = 'admin') INTO is_admin
    FROM public.users
    WHERE id = auth.uid();
    
    -- Se não encontrou na tabela users, verificar nos metadados
    IF is_admin IS NULL THEN
        SELECT (raw_user_meta_data->>'role' = 'admin') INTO is_admin
        FROM auth.users
        WHERE id = auth.uid();
    END IF;
    
    RETURN COALESCE(is_admin, false);
END;
$$ LANGUAGE plpgsql;

-- 2. Testar a função para o usuário atual
DO $$
BEGIN
    RAISE NOTICE 'Usuário atual é administrador: %', is_admin_safe();
END $$;

-- 3. Remover e recriar as políticas relacionadas à visualização de registros
-- Exchanges (Trocas)
DROP POLICY IF EXISTS "Users can view all exchanges" ON public.exchanges;
CREATE POLICY "Users can view all exchanges" ON public.exchanges
    FOR SELECT TO authenticated
    USING (
        -- Administradores podem ver todos os registros
        is_admin_safe() 
        -- Usuários comuns podem ver apenas seus próprios registros
        OR user_id = auth.uid()
    );

-- Exchange Items (Itens de Troca)
DROP POLICY IF EXISTS "Users can view all exchange items" ON public.exchange_items;
CREATE POLICY "Users can view all exchange items" ON public.exchange_items
    FOR SELECT TO authenticated
    USING (
        is_admin_safe() 
        OR EXISTS (
            SELECT 1 FROM public.exchanges e
            WHERE e.id = exchange_id AND e.user_id = auth.uid()
        )
    );

-- Exchange Photos (Fotos de Itens de Troca)
DROP POLICY IF EXISTS "Users can view all exchange photos" ON public.exchange_photos;
CREATE POLICY "Users can view all exchange photos" ON public.exchange_photos
    FOR SELECT TO authenticated
    USING (
        is_admin_safe()
        OR EXISTS (
            SELECT 1 FROM public.exchange_items ei
            JOIN public.exchanges e ON ei.exchange_id = e.id
            WHERE ei.id = exchange_item_id AND e.user_id = auth.uid()
        )
    );

-- 4. Otimizar consultas relacionadas com índices
-- Criar índices para melhorar o desempenho das consultas nas políticas
DO $$
BEGIN
    -- Índices da tabela exchanges
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_exchanges_user_id') THEN
        CREATE INDEX idx_exchanges_user_id ON public.exchanges(user_id);
        RAISE NOTICE 'Índice idx_exchanges_user_id criado';
    END IF;
    
    -- Índices da tabela exchange_items
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_exchange_items_exchange_id') THEN
        CREATE INDEX idx_exchange_items_exchange_id ON public.exchange_items(exchange_id);
        RAISE NOTICE 'Índice idx_exchange_items_exchange_id criado';
    END IF;
    
    -- Índices da tabela exchange_photos
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_exchange_photos_item_id') THEN
        CREATE INDEX idx_exchange_photos_item_id ON public.exchange_photos(exchange_item_id);
        RAISE NOTICE 'Índice idx_exchange_photos_item_id criado';
    END IF;
END $$;

-- 5. Verificar se o usuário está autenticado e mostrar seu ID
DO $$
DECLARE
    current_user_id UUID;
BEGIN
    SELECT auth.uid() INTO current_user_id;
    IF current_user_id IS NOT NULL THEN
        RAISE NOTICE 'Usuário autenticado com ID: %', current_user_id;
    ELSE
        RAISE NOTICE 'Nenhum usuário autenticado';
    END IF;
END $$; 