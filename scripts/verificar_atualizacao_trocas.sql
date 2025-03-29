-- Verificador de status de atualização de trocas/quebras
-- Execute este script para verificar se as aprovações/rejeições estão funcionando corretamente

-- 1. Mostrar estatísticas de trocas por status
SELECT 
    status, 
    COUNT(*) as quantidade, 
    (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM exchanges))::numeric(5,2) as porcentagem
FROM 
    exchanges 
GROUP BY 
    status 
ORDER BY 
    status;

-- 2. Verificar permissões do usuário atual
DO $$
DECLARE
    auth_id UUID;
    user_role TEXT;
BEGIN
    -- Obter ID do usuário autenticado
    SELECT auth.uid() INTO auth_id;
    
    -- Exibir informações sobre o usuário
    IF auth_id IS NOT NULL THEN
        -- Verificar papel do usuário
        SELECT role INTO user_role FROM public.users WHERE id = auth_id;
        
        RAISE NOTICE 'Usuário autenticado: %', auth_id;
        RAISE NOTICE 'Papel do usuário: %', user_role;
        
        -- Testar permissões de atualização
        RAISE NOTICE 'Testando permissões de atualização...';
        
        -- Verificar se usuário tem permissão para usar a função de atualização
        PERFORM can_update_exchange(
            (SELECT id FROM exchanges WHERE status = 'pending' LIMIT 1),
            auth_id
        );
        
        RAISE NOTICE 'Teste de função concluído sem erros.';
    ELSE
        RAISE NOTICE 'Usuário não autenticado. Faça login e tente novamente.';
    END IF;
END $$;

-- 3. Verificar políticas RLS atuais para a tabela exchanges
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM 
    pg_policies 
WHERE 
    tablename = 'exchanges';

-- 4. Mostrar detalhes das últimas 5 trocas atualizadas
SELECT 
    id,
    label,
    type,
    status,
    updated_at,
    updated_by,
    notes
FROM 
    exchanges
ORDER BY 
    updated_at DESC NULLS LAST
LIMIT 5;

-- 5. Verificar configuração da coluna updated_by
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM 
    information_schema.columns 
WHERE 
    table_name = 'exchanges' 
    AND column_name IN ('status', 'updated_by', 'notes'); 