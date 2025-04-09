-- Script de correção final para o problema de visibilidade
-- Este script garante que todos os usuários possam ver registros relevantes

-- 1. Remover todas as políticas problemáticas
DROP POLICY IF EXISTS "Users can view all exchanges" ON public.exchanges;
DROP POLICY IF EXISTS "Users can view all exchange items" ON public.exchange_items;
DROP POLICY IF EXISTS "Users can view all exchange photos" ON public.exchange_photos;

-- 2. Verificar se o RLS está habilitado (mas não desabilitar)
DO $$
BEGIN
    RAISE NOTICE 'Status RLS - exchanges: %', 
        (SELECT rowsecurity FROM pg_tables WHERE tablename = 'exchanges' AND schemaname = 'public');
    RAISE NOTICE 'Status RLS - exchange_items: %', 
        (SELECT rowsecurity FROM pg_tables WHERE tablename = 'exchange_items' AND schemaname = 'public');
    RAISE NOTICE 'Status RLS - exchange_photos: %', 
        (SELECT rowsecurity FROM pg_tables WHERE tablename = 'exchange_photos' AND schemaname = 'public');
END $$;

-- 3. Corrigir a função para identificar administradores (SIMPLIFICADA)
CREATE OR REPLACE FUNCTION public.is_admin_v2()
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
BEGIN
    -- Versão simplificada: verificar apenas a tabela users 
    -- para evitar problemas de dependência circular
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql;

-- 4. Criar políticas de visualização permanentes
-- POLÍTICA PRINCIPAL: Permitir que TODOS os usuários vejam TODOS os registros
CREATE POLICY "Everyone can view all exchanges" ON public.exchanges
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Everyone can view all exchange items" ON public.exchange_items
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Everyone can view all exchange photos" ON public.exchange_photos
    FOR SELECT TO authenticated
    USING (true);

-- 5. Políticas de modificação (mantém a segurança)
-- Apenas o proprietário (ou admin) pode modificar seus registros
CREATE POLICY "Users can update own exchanges" ON public.exchanges
    FOR UPDATE TO authenticated
    USING (
        user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Users can delete own exchanges" ON public.exchanges
    FOR DELETE TO authenticated
    USING (
        user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
    );

-- 6. Verificar as políticas criadas
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd
FROM 
    pg_policies
WHERE 
    tablename IN ('exchanges', 'exchange_items', 'exchange_photos')
ORDER BY 
    tablename, cmd; 