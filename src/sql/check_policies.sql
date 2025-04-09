-- Verificar as políticas existentes na tabela exchanges

-- 1. Políticas na tabela exchanges
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
FROM pg_policies 
WHERE tablename = 'exchanges';

-- 2. Verificar se há políticas que poderiam estar restringindo a visibilidade
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
FROM pg_policies 
WHERE cmd = 'SELECT' AND tablename IN ('exchanges', 'exchange_items', 'exchange_photos');

-- 3. Verificar tabelas com RLS ativado (corrigido)
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename IN ('exchanges', 'exchange_items', 'exchange_photos', 'users', 'products');

-- 4. Verificar função is_admin 
SELECT 
  routine_schema,
  routine_name,
  routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'is_admin';

-- 5. Testar a função is_admin com o usuário atual para verificar se está funcionando corretamente
SELECT is_admin();
