-- PARTE 3: TESTE DAS POLÍTICAS CORRIGIDAS
-- Este script testa se agora é possível atualizar o status de uma troca como administrador

-- 1. Atualizar uma troca pendente para aprovada como teste
DO $$
DECLARE
    test_exchange_id UUID;
    admin_id UUID;
    status_anterior TEXT;
    status_atual TEXT;
BEGIN
    -- Selecionar um exchange pendente para teste
    SELECT id INTO test_exchange_id FROM exchanges 
    WHERE status = 'pending' 
    LIMIT 1;
    
    -- Obter ID de um administrador
    SELECT id INTO admin_id FROM users WHERE role = 'admin' LIMIT 1;
    
    IF test_exchange_id IS NOT NULL THEN
        -- Guardar status anterior
        SELECT status INTO status_anterior 
        FROM exchanges 
        WHERE id = test_exchange_id;
        
        -- Tentar atualizar
        UPDATE exchanges 
        SET 
            status = 'approved',
            notes = 'Teste de aprovação após correção das políticas',
            updated_at = NOW(),
            updated_by = admin_id
        WHERE id = test_exchange_id;
        
        -- Verificar status após atualização
        SELECT status INTO status_atual 
        FROM exchanges 
        WHERE id = test_exchange_id;
        
        -- Exibir resultados
        RAISE NOTICE 'Resultado do teste:';
        RAISE NOTICE '- ID da troca testada: %', test_exchange_id;
        RAISE NOTICE '- Status anterior: %', status_anterior;
        RAISE NOTICE '- Status atual: %', status_atual;
        RAISE NOTICE '- Sucesso da atualização: %', (status_atual = 'approved');
    ELSE
        RAISE NOTICE 'Não foi possível realizar o teste: nenhuma troca pendente encontrada.';
    END IF;
END $$;

-- 2. Verificar novamente as contagens por status para confirmar as mudanças
SELECT 'Total de trocas/quebras' as info, COUNT(*) as contagem FROM exchanges;
SELECT 'Trocas/quebras pendentes' as info, COUNT(*) as contagem FROM exchanges WHERE status = 'pending';
SELECT 'Trocas/quebras aprovadas' as info, COUNT(*) as contagem FROM exchanges WHERE status = 'approved';
SELECT 'Trocas/quebras rejeitadas' as info, COUNT(*) as contagem FROM exchanges WHERE status = 'rejected'; 