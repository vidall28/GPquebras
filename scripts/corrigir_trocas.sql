-- Script para diagnosticar e corrigir problemas com trocas/quebras
-- Execute este script no SQL Editor do Supabase

-- 1. Diagnosticar o problema atual de trocas/quebras
DO $$
BEGIN
  RAISE NOTICE '=== DIAGNÓSTICO DE TROCAS/QUEBRAS ===';
  
  -- Verificar se existem registros na tabela exchanges
  DECLARE
    total_exchanges INT;
    exchanges_with_items INT;
    exchanges_without_items INT;
    exchanges_without_photos INT;
    auth_id UUID;
  BEGIN
    -- Contar trocas totais
    SELECT COUNT(*) INTO total_exchanges FROM public.exchanges;
    
    -- Contar trocas com itens
    SELECT COUNT(DISTINCT e.id) INTO exchanges_with_items
    FROM public.exchanges e
    INNER JOIN public.exchange_items i ON e.id = i.exchange_id;
    
    -- Contar trocas sem itens
    exchanges_without_items := total_exchanges - exchanges_with_items;
    
    -- Contar trocas com itens, mas sem fotos
    SELECT COUNT(DISTINCT e.id) INTO exchanges_without_photos
    FROM public.exchanges e
    INNER JOIN public.exchange_items i ON e.id = i.exchange_id
    LEFT JOIN public.exchange_photos p ON i.id = p.exchange_item_id
    WHERE p.id IS NULL;
    
    -- Obter ID do usuário autenticado
    SELECT auth.uid() INTO auth_id;
    
    -- Mostrar resultados
    RAISE NOTICE 'Total de trocas/quebras: %', total_exchanges;
    RAISE NOTICE 'Trocas com itens: %', exchanges_with_items;
    RAISE NOTICE 'Trocas sem itens: %', exchanges_without_items;
    RAISE NOTICE 'Trocas com itens mas sem fotos: %', exchanges_without_photos;
    
    IF auth_id IS NOT NULL THEN
      DECLARE
        user_exchanges INT;
        user_role TEXT;
      BEGIN
        -- Verificar papel do usuário
        SELECT role INTO user_role FROM public.users WHERE id = auth_id;
        
        -- Contar trocas do usuário atual
        SELECT COUNT(*) INTO user_exchanges 
        FROM public.exchanges 
        WHERE user_id = auth_id;
        
        RAISE NOTICE 'Seu ID de usuário: %', auth_id;
        RAISE NOTICE 'Seu papel (role): %', user_role;
        RAISE NOTICE 'Suas trocas/quebras: %', user_exchanges;
      END;
    ELSE
      RAISE NOTICE 'Você não está autenticado. Faça login e tente novamente.';
    END IF;
  END;
END $$;

-- 2. Corrigir políticas RLS (Row Level Security) para visualização de trocas
-- Remover políticas existentes que podem estar causando problemas
DROP POLICY IF EXISTS "Users can view all exchanges" ON public.exchanges;
DROP POLICY IF EXISTS "Only admins can view any exchange" ON public.exchanges; 
DROP POLICY IF EXISTS "Users can view their own exchanges" ON public.exchanges;
DROP POLICY IF EXISTS "Users can view their own or all exchanges if admin" ON public.exchanges;

-- Criar nova política que permite que todos os usuários autenticados vejam trocas
-- (administradores veem todas, usuários comuns veem apenas as suas)
CREATE POLICY "Users can view any exchanges as admin or their own" ON public.exchanges
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 3. Verificar e corrigir RLS para itens de troca
DROP POLICY IF EXISTS "Users can view all exchange items" ON public.exchange_items;

CREATE POLICY "Users can view any exchange items" ON public.exchange_items
  FOR SELECT TO authenticated
  USING (true);

-- 4. Verificar e corrigir RLS para fotos de itens de troca
DROP POLICY IF EXISTS "Users can view all exchange photos" ON public.exchange_photos;

CREATE POLICY "Users can view any exchange photos" ON public.exchange_photos
  FOR SELECT TO authenticated
  USING (true);

-- 5. Verificar possíveis trocas com problemas (sem itens ou sem fotos) e mostrar detalhes
SELECT 
  e.id as exchange_id,
  e.label,
  e.type,
  e.status,
  e.created_at,
  u.name as user_name,
  COUNT(DISTINCT i.id) as item_count,
  COUNT(DISTINCT p.id) as photo_count,
  CASE 
    WHEN COUNT(DISTINCT i.id) = 0 THEN 'Erro: Sem itens'
    WHEN COUNT(DISTINCT p.id) = 0 THEN 'Erro: Sem fotos'
    ELSE 'OK'
  END as status_verificacao
FROM 
  public.exchanges e
LEFT JOIN 
  public.users u ON e.user_id = u.id
LEFT JOIN 
  public.exchange_items i ON e.id = i.exchange_id
LEFT JOIN 
  public.exchange_photos p ON i.id = p.exchange_item_id
GROUP BY 
  e.id, e.label, e.type, e.status, e.created_at, u.name
ORDER BY 
  e.created_at DESC;

-- 6. Mostrar as políticas RLS atualizadas
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd
FROM 
  pg_policies
WHERE 
  schemaname = 'public' 
  AND tablename IN ('exchanges', 'exchange_items', 'exchange_photos');

-- 7. Verificar agora se você pode ver as trocas/quebras
DO $$
DECLARE
  auth_id UUID;
  exchange_count INT;
BEGIN
  -- Obter ID do usuário autenticado
  SELECT auth.uid() INTO auth_id;
  
  IF auth_id IS NULL THEN
    RAISE NOTICE 'Você não está autenticado. Faça login e tente novamente.';
    RETURN;
  END IF;
  
  -- Contar trocas visíveis para o usuário atual após correções
  SELECT COUNT(*) INTO exchange_count FROM public.exchanges;
  
  RAISE NOTICE 'Após correções, você pode ver % trocas/quebras no total', exchange_count;
  
  -- Sugerir próximos passos
  RAISE NOTICE '';
  RAISE NOTICE 'PRÓXIMOS PASSOS:';
  RAISE NOTICE '1. Volte para a aplicação e verifique se as trocas/quebras agora aparecem';
  RAISE NOTICE '2. Caso ainda não apareçam, limpe o cache do navegador e faça logout/login';
  RAISE NOTICE '3. Se o problema persistir, verifique o console do navegador (F12) para erros';
END $$; 