-- Corrigir as políticas da tabela de usuários e trocas

-- 1. Adicionar uma política para permitir que o usuário inicial de registro possa inserir dados na tabela users
DROP POLICY IF EXISTS "Users can register" ON public.users;
CREATE POLICY "Users can register" ON public.users
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- 2. Corrigir a política de visualização de exchanges
DROP POLICY IF EXISTS "Users can view all exchanges" ON public.exchanges;
CREATE POLICY "Users can view all exchanges" ON public.exchanges
  FOR SELECT TO authenticated USING (true);

-- 3. Verificar se cada troca está corretamente associada ao seu usuário
SELECT 
  e.id AS exchange_id, 
  e.user_id,
  u.id AS user_table_id,
  u.name AS user_name,
  e.label,
  e.status,
  e.created_at
FROM 
  exchanges e
LEFT JOIN 
  users u ON e.user_id = u.id
LIMIT 10;

-- 4. Verificar se cada item de troca está corretamente associado à sua troca
SELECT 
  ei.id AS item_id,
  ei.exchange_id,
  e.id AS exchange_table_id,
  e.user_id,
  p.name AS product_name,
  ei.quantity,
  ei.reason
FROM 
  exchange_items ei
LEFT JOIN 
  exchanges e ON ei.exchange_id = e.id
LEFT JOIN
  products p ON ei.product_id = p.id
LIMIT 10; 