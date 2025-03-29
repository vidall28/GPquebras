-- Script para excluir todos os registros (trocas/quebras) que utilizam um produto específico
-- ATENÇÃO: Este script EXCLUIRÁ permanentemente os dados. Faça backup antes de executar.

-- Substitua 'CODIGO_DO_PRODUTO' pelo código do produto que deseja excluir
-- Por exemplo: 'SKU123', 'COCA355' etc.
DECLARE
  produto_codigo TEXT := 'CODIGO_DO_PRODUTO';
  produto_id UUID;
  total_trocas INT := 0;
  total_itens INT := 0;
  total_fotos INT := 0;
BEGIN
  RAISE NOTICE '=== INICIANDO EXCLUSÃO DE REGISTROS DO PRODUTO ===';
  
  -- 1. Identificar o ID do produto pelo código
  SELECT id INTO produto_id
  FROM products
  WHERE code = produto_codigo;
  
  IF produto_id IS NULL THEN
    RAISE EXCEPTION 'Produto com código % não encontrado', produto_codigo;
  END IF;
  
  RAISE NOTICE 'Produto encontrado: ID=%', produto_id;
  
  -- 2. Identificar todas as trocas que usam este produto
  CREATE TEMP TABLE trocas_para_excluir AS
  SELECT DISTINCT e.id
  FROM exchanges e
  JOIN exchange_items ei ON e.id = ei.exchange_id
  WHERE ei.product_id = produto_id;
  
  SELECT COUNT(*) INTO total_trocas FROM trocas_para_excluir;
  RAISE NOTICE 'Total de trocas/quebras que usam o produto: %', total_trocas;
  
  -- Mostrar detalhes das trocas que serão excluídas
  RAISE NOTICE 'Lista de trocas/quebras que serão excluídas:';
  FOR r IN (
    SELECT e.id, e.label, e.type, e.status, u.name as usuario, e.created_at
    FROM exchanges e
    JOIN users u ON e.user_id = u.id
    WHERE e.id IN (SELECT id FROM trocas_para_excluir)
    ORDER BY e.created_at DESC
  ) LOOP
    RAISE NOTICE 'ID: %, Label: %, Tipo: %, Status: %, Usuário: %, Data: %',
      r.id, r.label, r.type, r.status, r.usuario, r.created_at;
  END LOOP;
  
  -- 3. Confirmar exclusão com uma contagem
  RAISE NOTICE '';
  RAISE NOTICE 'CONFIRMAÇÃO: Você está prestes a excluir % trocas/quebras.', total_trocas;
  RAISE NOTICE 'Para continuar, remova os comentários do código abaixo.';
  RAISE NOTICE '';

  -- 4. Excluir todas as fotos dos itens associados a estas trocas
  /*
  WITH itens_para_remover AS (
    SELECT ei.id
    FROM exchange_items ei
    JOIN trocas_para_excluir tpe ON ei.exchange_id = tpe.id
  )
  DELETE FROM exchange_photos ep
  WHERE ep.exchange_item_id IN (SELECT id FROM itens_para_remover)
  RETURNING 1 INTO total_fotos;
  
  RAISE NOTICE 'Fotos excluídas: %', total_fotos;
  
  -- 5. Excluir todos os itens destas trocas
  DELETE FROM exchange_items ei
  WHERE ei.exchange_id IN (SELECT id FROM trocas_para_excluir)
  RETURNING 1 INTO total_itens;
  
  RAISE NOTICE 'Itens excluídos: %', total_itens;
  
  -- 6. Excluir as trocas
  DELETE FROM exchanges e
  WHERE e.id IN (SELECT id FROM trocas_para_excluir);
  
  RAISE NOTICE 'Trocas/quebras excluídas: %', total_trocas;
  
  -- 7. Verificar se o produto ainda está sendo usado
  IF EXISTS (
    SELECT 1
    FROM exchange_items ei
    WHERE ei.product_id = produto_id
    LIMIT 1
  ) THEN
    RAISE NOTICE 'ALERTA: Ainda existem referências ao produto em outros registros!';
  ELSE
    RAISE NOTICE 'Produto %: Todas as referências foram removidas', produto_codigo;
    RAISE NOTICE 'Agora você pode excluir o produto com segurança.';
  END IF;
  */
  
  RAISE NOTICE '';
  RAISE NOTICE '=== INSTRUÇÕES PARA EXCLUSÃO ===';
  RAISE NOTICE '1. Verifique a lista de trocas/quebras acima que serão excluídas';
  RAISE NOTICE '2. Se estiver seguro, remova os comentários /* */ do código acima';
  RAISE NOTICE '3. Altere o código do produto no início do script para: ''%''', produto_codigo;
  RAISE NOTICE '4. Execute o script novamente para realizar a exclusão';
END; 