-- Script para verificar e diagnosticar problemas na tabela de produtos
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar a estrutura da tabela products
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products'
ORDER BY ordinal_position;

-- 2. Verificar chaves primárias e restrições
SELECT 
    tc.constraint_name, 
    tc.constraint_type, 
    kcu.column_name
FROM 
    information_schema.table_constraints tc
JOIN 
    information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE 
    tc.table_schema = 'public' 
    AND tc.table_name = 'products';

-- 3. Verificar se existem triggers na tabela
SELECT 
    trigger_name, 
    event_manipulation, 
    action_statement
FROM 
    information_schema.triggers
WHERE 
    event_object_schema = 'public' 
    AND event_object_table = 'products';

-- 4. Verificar produtos existentes
SELECT id, name, code, capacity, created_at
FROM products
ORDER BY created_at DESC;

-- 5. Tentar inserir um produto de teste
DO $$
BEGIN
    -- Verificar se já existe um produto com o código "TESTE001"
    IF NOT EXISTS (SELECT 1 FROM products WHERE code = 'TESTE001') THEN
        INSERT INTO products (name, code, capacity)
        VALUES ('Produto de Teste', 'TESTE001', 500);
        
        RAISE NOTICE 'Produto de teste inserido com sucesso!';
    ELSE
        RAISE NOTICE 'Produto de teste já existe. Tentando outro código...';
        
        -- Gerar código único baseado em timestamp
        DECLARE
            unique_code TEXT;
        BEGIN
            unique_code := 'TESTE' || to_char(extract(epoch from now()), 'FM999999');
            
            INSERT INTO products (name, code, capacity)
            VALUES ('Produto de Teste', unique_code, 500);
            
            RAISE NOTICE 'Produto de teste inserido com código %', unique_code;
        END;
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Erro ao inserir produto de teste: %', SQLERRM;
END $$;

-- 6. Verificar se o produto de teste foi inserido
SELECT id, name, code, capacity, created_at
FROM products
WHERE name LIKE 'Produto de Teste%'
ORDER BY created_at DESC; 