-- Script para corrigir relacionamentos entre tabelas de troca/quebra
-- Execute este script no SQL Editor do Supabase

-- 1. Diagnóstico do problema de relação entre tabelas
DO $$
BEGIN
  RAISE NOTICE '=== DIAGNÓSTICO DE RELACIONAMENTOS ENTRE TABELAS ===';
  
  -- Verificar se as chaves estrangeiras estão configuradas corretamente
  DECLARE
    fk_exchanges_users INT := 0;
    fk_items_exchanges INT := 0;
    fk_photos_items INT := 0;
  BEGIN
    -- Verificar FK exchanges -> users
    SELECT COUNT(*) INTO fk_exchanges_users
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'exchanges'
      AND kcu.column_name = 'user_id'
      AND tc.table_schema = 'public';
    
    -- Verificar FK exchange_items -> exchanges
    SELECT COUNT(*) INTO fk_items_exchanges
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'exchange_items'
      AND kcu.column_name = 'exchange_id'
      AND tc.table_schema = 'public';
    
    -- Verificar FK exchange_photos -> exchange_items
    SELECT COUNT(*) INTO fk_photos_items
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'exchange_photos'
      AND kcu.column_name = 'exchange_item_id'
      AND tc.table_schema = 'public';
    
    -- Mostrar resultados
    RAISE NOTICE 'FK exchanges.user_id -> users.id: %', CASE WHEN fk_exchanges_users > 0 THEN 'Existe' ELSE 'Não existe' END;
    RAISE NOTICE 'FK exchange_items.exchange_id -> exchanges.id: %', CASE WHEN fk_items_exchanges > 0 THEN 'Existe' ELSE 'Não existe' END;
    RAISE NOTICE 'FK exchange_photos.exchange_item_id -> exchange_items.id: %', CASE WHEN fk_photos_items > 0 THEN 'Existe' ELSE 'Não existe' END;
  END;
END $$;

-- 2. Verificar e corrigir sintaxe da consulta que causa o erro 400
-- O erro pode estar relacionado à forma como estamos consultando a relação users!exchanges_user_id_fkey
-- Vamos criar uma VIEW para facilitar a consulta:

-- Remover a view se já existir
DROP VIEW IF EXISTS exchanges_with_users;

-- Criar a view para simplificar a consulta - CORRIGIDA para evitar duplicação de colunas
CREATE VIEW exchanges_with_users AS
SELECT 
  e.id,
  e.label,
  e.type,
  e.status,
  e.notes,
  e.created_at,
  e.updated_at,
  e.updated_by,
  e.user_id,
  u.name as user_name,
  u.registration as user_registration
FROM 
  exchanges e
LEFT JOIN 
  users u ON e.user_id = u.id;

-- 3. Verificar se conseguimos buscar as trocas usando a nova view
SELECT 
  id, 
  label, 
  type, 
  status, 
  created_at, 
  user_name, 
  user_registration
FROM 
  exchanges_with_users
ORDER BY 
  created_at DESC
LIMIT 10;

-- 4. Verificar se a consulta aninhada está correta
-- Tente executar a consulta problemática de forma mais simples para verificar se há problemas
DO $$
BEGIN
  RAISE NOTICE 'Testando consulta original que pode estar causando erro 400:';
END $$;

SELECT 
  e.id,
  e.label,
  e.type,
  e.status,
  e.user_id,
  u.name as user_name,
  u.registration as user_registration
FROM 
  exchanges e
LEFT JOIN 
  users u ON e.user_id = u.id
ORDER BY 
  e.created_at DESC
LIMIT 10;

-- 5. Corrigir a consulta no frontend (instrução):
-- No arquivo DataContext.tsx, substitua a consulta problemática por:
/*
const { data: exchangesData, error: exchangesError } = await supabase
  .from('exchanges_with_users')  // Use a view criada
  .select('*')
  .order('created_at', { ascending: false });
*/

-- 6. Se ainda houver problemas, verifique os índices e restrições
CREATE INDEX IF NOT EXISTS idx_exchanges_user_id ON exchanges(user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_items_exchange_id ON exchange_items(exchange_id);
CREATE INDEX IF NOT EXISTS idx_exchange_photos_item_id ON exchange_photos(exchange_item_id);

-- 7. Verificar e corrigir as políticas RLS para todas as tabelas
ALTER TABLE public.exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_photos ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes
DROP POLICY IF EXISTS "Users can view exchanges" ON public.exchanges;
DROP POLICY IF EXISTS "Users can view exchange items" ON public.exchange_items;
DROP POLICY IF EXISTS "Users can view exchange photos" ON public.exchange_photos;

-- Adicionar políticas mais simples e permissivas para teste
CREATE POLICY "Users can view exchanges" ON public.exchanges
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can view exchange items" ON public.exchange_items
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can view exchange photos" ON public.exchange_photos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert exchanges" ON public.exchanges
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can insert exchange items" ON public.exchange_items
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can insert exchange photos" ON public.exchange_photos
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 8. Verifique novamente as políticas RLS
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd
FROM 
  pg_policies
WHERE 
  schemaname = 'public' 
  AND tablename IN ('exchanges', 'exchange_items', 'exchange_photos'); 