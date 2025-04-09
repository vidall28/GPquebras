-- Script para verificar as relações entre as tabelas e integridade dos dados
-- Este script ajuda a identificar problemas de relações que poderiam causar falhas na exibição de dados

-- 1. Verificar integridade referencial entre as tabelas
DO $$
BEGIN
    RAISE NOTICE '=== VERIFICAÇÃO DE INTEGRIDADE REFERENCIAL ===';
    
    -- Verificar se há exchange_items sem exchanges
    RAISE NOTICE 'Itens órfãos (sem troca correspondente):';
END $$;

SELECT 
    ei.id AS item_id,
    ei.exchange_id,
    ei.product_id,
    p.name AS product_name
FROM 
    public.exchange_items ei
LEFT JOIN 
    public.exchanges e ON ei.exchange_id = e.id
LEFT JOIN
    public.products p ON ei.product_id = p.id
WHERE 
    e.id IS NULL
LIMIT 10;

DO $$
BEGIN
    -- Verificar se há exchange_photos sem exchange_items
    RAISE NOTICE 'Fotos órfãs (sem item correspondente):';
END $$;

SELECT 
    ep.id AS photo_id,
    ep.exchange_item_id,
    ep.photo_url
FROM 
    public.exchange_photos ep
LEFT JOIN 
    public.exchange_items ei ON ep.exchange_item_id = ei.id
WHERE 
    ei.id IS NULL
LIMIT 10;

DO $$
BEGIN
    -- Verificar se há exchanges sem usuário correspondente
    RAISE NOTICE 'Trocas sem usuário correspondente:';
END $$;

SELECT 
    e.id AS exchange_id,
    e.user_id,
    e.label,
    e.type,
    e.status,
    e.created_at
FROM 
    public.exchanges e
LEFT JOIN 
    public.users u ON e.user_id = u.id
WHERE 
    u.id IS NULL
LIMIT 10;

-- 2. Verificar campos que poderiam causar problemas
DO $$
BEGIN
    RAISE NOTICE '=== VERIFICAÇÃO DE DADOS INCONSISTENTES ===';
    
    -- Verificar trocas com status inválido
    RAISE NOTICE 'Trocas com status inválido:';
END $$;

SELECT 
    id, 
    status, 
    created_at
FROM 
    public.exchanges
WHERE 
    status NOT IN ('pending', 'approved', 'rejected')
LIMIT 10;

-- 3. Estatísticas de cada tabela
DO $$
BEGIN
    RAISE NOTICE '=== ESTATÍSTICAS DAS TABELAS ===';
END $$;

SELECT 
    'users' AS tabela, 
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE role = 'admin') AS admins,
    COUNT(*) FILTER (WHERE role = 'user') AS usuarios
FROM 
    public.users
UNION ALL
SELECT 
    'exchanges' AS tabela, 
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'pending') AS pendentes,
    COUNT(*) FILTER (WHERE status IN ('approved', 'rejected')) AS processados
FROM 
    public.exchanges
UNION ALL
SELECT 
    'exchange_items' AS tabela, 
    COUNT(*) AS total,
    0 AS campo1,
    0 AS campo2
FROM 
    public.exchange_items
UNION ALL
SELECT 
    'exchange_photos' AS tabela, 
    COUNT(*) AS total,
    0 AS campo1,
    0 AS campo2
FROM 
    public.exchange_photos;

-- 4. Reparar problemas de integridade referencial (se necessário)
-- Descomente estas linhas apenas se encontrar problemas acima
/*
-- Remover itens órfãos
DELETE FROM public.exchange_items
WHERE exchange_id NOT IN (SELECT id FROM public.exchanges);

-- Remover fotos órfãs
DELETE FROM public.exchange_photos
WHERE exchange_item_id NOT IN (SELECT id FROM public.exchange_items);
*/ 