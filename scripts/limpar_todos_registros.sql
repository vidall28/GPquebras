-- Script para limpar TODOS os registros de trocas/quebras do sistema
-- ATENÇÃO: Este script EXCLUIRÁ PERMANENTEMENTE todos os dados de trocas/quebras
-- Faça backup antes de executar!

-- Este é um script destrutivo - ele removerá TODAS as trocas, quebras e fotos do sistema
-- Certifique-se de que realmente deseja executar esta operação

DO $$
DECLARE
  total_fotos INT := 0;
  total_itens INT := 0;
  total_trocas INT := 0;
BEGIN
  RAISE NOTICE '!!! ATENÇÃO: OPERAÇÃO DESTRUTIVA !!!';
  RAISE NOTICE 'Este script excluirá TODOS os registros de trocas e quebras do sistema.';
  RAISE NOTICE 'Esta operação NÃO pode ser desfeita.';
  RAISE NOTICE '';
  
  -- Contagem de registros atuais para confirmação
  SELECT COUNT(*) INTO total_trocas FROM exchanges;
  SELECT COUNT(*) INTO total_itens FROM exchange_items;
  SELECT COUNT(*) INTO total_fotos FROM exchange_photos;
  
  RAISE NOTICE 'Registros que serão excluídos:';
  RAISE NOTICE '- Trocas/Quebras: %', total_trocas;
  RAISE NOTICE '- Itens: %', total_itens;
  RAISE NOTICE '- Fotos: %', total_fotos;
  RAISE NOTICE '';
  
  RAISE NOTICE 'Para executar a limpeza, remova os comentários do código abaixo.';
  RAISE NOTICE 'REPITA: Esta operação destruirá todos os dados históricos de trocas e quebras.';
  RAISE NOTICE '';
  
  -- Código de exclusão (comentado para segurança)
  /*
  -- 1. Desabilitar temporariamente as verificações de integridade referencial
  SET session_replication_role = 'replica';
  
  -- 2. Excluir todas as fotos
  DELETE FROM exchange_photos;
  GET DIAGNOSTICS total_fotos = ROW_COUNT;
  RAISE NOTICE 'Fotos excluídas: %', total_fotos;
  
  -- 3. Excluir todos os itens
  DELETE FROM exchange_items;
  GET DIAGNOSTICS total_itens = ROW_COUNT;
  RAISE NOTICE 'Itens excluídos: %', total_itens;
  
  -- 4. Excluir todas as trocas/quebras
  DELETE FROM exchanges;
  GET DIAGNOSTICS total_trocas = ROW_COUNT;
  RAISE NOTICE 'Trocas/quebras excluídas: %', total_trocas;
  
  -- 5. Reabilitar as verificações de integridade referencial
  SET session_replication_role = 'origin';
  
  RAISE NOTICE '';
  RAISE NOTICE 'Operação concluída. Todos os registros foram removidos.';
  RAISE NOTICE 'Agora você pode excluir qualquer produto sem restrições.';
  */

END $$; 