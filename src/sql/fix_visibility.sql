-- Habilitar a política para todos verem os registros de trocas

-- Remover a política existente problemática
DROP POLICY IF EXISTS "Users can view all exchanges" ON public.exchanges;

-- Criar nova política corrigida permitindo que usuários vejam todas as trocas
CREATE POLICY "Users can view all exchanges" ON public.exchanges
  FOR SELECT TO authenticated USING (true);

-- Verificar se existem outras políticas que possam estar causando problemas
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

-- Garantir que as políticas de leitura em tabelas relacionadas também estejam corretas
DROP POLICY IF EXISTS "Users can view all exchange items" ON public.exchange_items;
CREATE POLICY "Users can view all exchange items" ON public.exchange_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can view all exchange photos" ON public.exchange_photos;
CREATE POLICY "Users can view all exchange photos" ON public.exchange_photos
  FOR SELECT TO authenticated USING (true); 