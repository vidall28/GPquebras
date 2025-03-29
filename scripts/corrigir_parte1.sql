-- PARTE 1: DIAGNÓSTICO DO PROBLEMA DE RLS
-- Este script verifica a estrutura da tabela, políticas atuais e registros

-- 1. Verificar a estrutura da tabela exchanges
SELECT 
    column_name, 
    data_type, 
    character_maximum_length, 
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_name = 'exchanges'
ORDER BY 
    ordinal_position;

-- 2. Listar políticas RLS atuais para a tabela 'exchanges'
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

-- 3. Verificar alguns registros para diagnóstico
SELECT id, user_id, status, notes, updated_at, updated_by
FROM exchanges
ORDER BY created_at DESC
LIMIT 10;

-- 4. Contar registros por status
SELECT 'Total de trocas/quebras' as info, COUNT(*) as contagem FROM exchanges;
SELECT 'Trocas/quebras pendentes' as info, COUNT(*) as contagem FROM exchanges WHERE status = 'pending';
SELECT 'Trocas/quebras aprovadas' as info, COUNT(*) as contagem FROM exchanges WHERE status = 'approved';
SELECT 'Trocas/quebras rejeitadas' as info, COUNT(*) as contagem FROM exchanges WHERE status = 'rejected'; 