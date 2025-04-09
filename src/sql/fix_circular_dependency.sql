-- Corrigir problema de dependência circular nas políticas RLS
-- Este problema ocorre quando as políticas verificam uma tabela que por sua vez tem políticas que dependem do resultado dessas primeiras políticas

-- 1. Remover todas as políticas de RLS existentes que podem estar causando problemas
DROP POLICY IF EXISTS "Only admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Only admins can update users" ON public.users;
DROP POLICY IF EXISTS "Only admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Only admins can update products" ON public.products;
DROP POLICY IF EXISTS "Only admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Only admins can update any exchange" ON public.exchanges;
DROP POLICY IF EXISTS "Only admins can delete exchanges" ON public.exchanges;
DROP POLICY IF EXISTS "Only admins can delete exchange items" ON public.exchange_items;
DROP POLICY IF EXISTS "Only admins can delete exchange photos" ON public.exchange_photos;

-- 2. Criar função simplificada para verificar admin que não depende de verificações na tabela users
CREATE OR REPLACE FUNCTION public.is_admin_simplified()
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar diretamente os metadados do usuário
  RETURN (SELECT raw_user_meta_data->>'role' = 'admin' 
          FROM auth.users 
          WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recriar as políticas sem a dependência circular, usando a função simplificada
CREATE POLICY "Only admins can insert users simplified" ON public.users
  FOR INSERT TO authenticated WITH CHECK (
    is_admin_simplified() OR id = auth.uid()
  );

CREATE POLICY "Only admins can update users simplified" ON public.users
  FOR UPDATE TO authenticated USING (
    is_admin_simplified() OR id = auth.uid()
  );

CREATE POLICY "Only admins can insert products simplified" ON public.products
  FOR INSERT TO authenticated WITH CHECK (
    is_admin_simplified()
  );

CREATE POLICY "Only admins can update products simplified" ON public.products
  FOR UPDATE TO authenticated USING (
    is_admin_simplified()
  );

CREATE POLICY "Only admins can delete products simplified" ON public.products
  FOR DELETE TO authenticated USING (
    is_admin_simplified()
  );

-- 4. Garantir que qualquer usuário possa ver qualquer registro
DROP POLICY IF EXISTS "Users can view all exchanges" ON public.exchanges;
CREATE POLICY "Users can view all exchanges" ON public.exchanges
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view all exchange items" ON public.exchange_items;
CREATE POLICY "Users can view all exchange items" ON public.exchange_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view all exchange photos" ON public.exchange_photos;
CREATE POLICY "Users can view all exchange photos" ON public.exchange_photos
  FOR SELECT TO authenticated USING (true);

-- 5. Permitir que usuários novos possam se registrar
DROP POLICY IF EXISTS "Users can register" ON public.users;
CREATE POLICY "Users can register" ON public.users
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- 6. Testar a função simplificada
DO $$
BEGIN
  RAISE NOTICE 'Status de admin simplificado: %', is_admin_simplified();
END $$; 