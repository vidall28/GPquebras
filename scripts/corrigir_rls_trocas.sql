-- Script para corrigir políticas RLS (Row Level Security) de trocas/quebras
-- Este script diagnostica e corrige problemas com as políticas RLS que podem estar
-- impedindo a atualização de status das trocas/quebras.

-- 1. Listar políticas RLS atuais para a tabela 'exchanges'
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

-- 2. Verificar a estrutura da tabela exchanges para confirmar tipos de dados
SELECT 
    column_name, 
    data_type, 
    character_maximum_length, 
    column_default, 
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_name = 'exchanges'
ORDER BY 
    ordinal_position;

-- 3. Verificar alguns registros para diagnóstico
SELECT id, user_id, status, notes, updated_at, updated_by
FROM exchanges
ORDER BY created_at DESC
LIMIT 10;

-- 4. Desabilitar temporariamente RLS para diagnóstico
ALTER TABLE exchanges DISABLE ROW LEVEL SECURITY;

-- 5. Testes manuais (executar um update para validar)
DO $$
DECLARE
    test_exchange_id UUID;
BEGIN
    -- Selecionar um exchange pendente para teste
    SELECT id INTO test_exchange_id FROM exchanges 
    WHERE status = 'pending' 
    LIMIT 1;
    
    IF test_exchange_id IS NOT NULL THEN
        RAISE NOTICE 'Testando atualização em exchange_id: %', test_exchange_id;
        
        -- Tentar atualizar
        UPDATE exchanges 
        SET 
            status = 'approved',
            notes = 'Teste de aprovação via SQL',
            updated_at = NOW(),
            updated_by = (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
        WHERE id = test_exchange_id;
        
        -- Verificar se atualizou
        IF FOUND THEN
            RAISE NOTICE 'Atualização bem-sucedida!';
        ELSE
            RAISE NOTICE 'Falha na atualização.';
        END IF;
    ELSE
        RAISE NOTICE 'Nenhum exchange pendente encontrado para teste.';
    END IF;
END $$;

-- 6. Restaurar e corrigir as políticas RLS
-- Primeiro remover políticas existentes
DROP POLICY IF EXISTS "Usuarios podem ver apenas seus próprios registros" ON exchanges;
DROP POLICY IF EXISTS "Admins podem ver todos os registros" ON exchanges; 
DROP POLICY IF EXISTS "Admins podem inserir registros para qualquer usuário" ON exchanges;
DROP POLICY IF EXISTS "Usuarios só podem inserir seus próprios registros" ON exchanges;
DROP POLICY IF EXISTS "Admins podem atualizar qualquer registro" ON exchanges;
DROP POLICY IF EXISTS "Usuarios só podem atualizar seus próprios registros pendentes" ON exchanges;
DROP POLICY IF EXISTS "Admins podem deletar qualquer registro" ON exchanges;
DROP POLICY IF EXISTS "Usuarios só podem deletar seus próprios registros pendentes" ON exchanges;

-- Reabilitar RLS
ALTER TABLE exchanges ENABLE ROW LEVEL SECURITY;

-- 7. Criar novas políticas corrigidas
-- Política de leitura para usuários normais
CREATE POLICY "Usuarios podem ver apenas seus próprios registros"
ON exchanges
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id OR
    auth.jwt() ->> 'role' = 'admin'
);

-- Política de leitura para administradores (redundante com a anterior, mas para clareza)
CREATE POLICY "Admins podem ver todos os registros"
ON exchanges
FOR SELECT
TO authenticated
USING (
    auth.jwt() ->> 'role' = 'admin'
);

-- Política de inserção para usuários normais
CREATE POLICY "Usuarios só podem inserir seus próprios registros"
ON exchanges
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
);

-- Política de inserção para administradores
CREATE POLICY "Admins podem inserir registros para qualquer usuário"
ON exchanges
FOR INSERT
TO authenticated
WITH CHECK (
    auth.jwt() ->> 'role' = 'admin'
);

-- Política de atualização para usuários normais
CREATE POLICY "Usuarios só podem atualizar seus próprios registros pendentes"
ON exchanges
FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id AND
    status = 'pending'
);

-- Política de atualização para administradores (MAIS IMPORTANTE - CORRIGIDA)
CREATE POLICY "Admins podem atualizar qualquer registro"
ON exchanges
FOR UPDATE
TO authenticated
USING (
    auth.jwt() ->> 'role' = 'admin'
);

-- Política de exclusão para usuários normais
CREATE POLICY "Usuarios só podem deletar seus próprios registros pendentes"
ON exchanges
FOR DELETE
TO authenticated
USING (
    auth.uid() = user_id AND
    status = 'pending'
);

-- Política de exclusão para administradores
CREATE POLICY "Admins podem deletar qualquer registro"
ON exchanges
FOR DELETE
TO authenticated
USING (
    auth.jwt() ->> 'role' = 'admin'
);

-- 8. Validar se as políticas foram criadas corretamente
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

-- 9. Contar registros antes/depois para confirmar que as políticas estão funcionando
SELECT 'Total de trocas/quebras' as info, COUNT(*) as contagem FROM exchanges;
SELECT 'Trocas/quebras pendentes' as info, COUNT(*) as contagem FROM exchanges WHERE status = 'pending';
SELECT 'Trocas/quebras aprovadas' as info, COUNT(*) as contagem FROM exchanges WHERE status = 'approved';
SELECT 'Trocas/quebras rejeitadas' as info, COUNT(*) as contagem FROM exchanges WHERE status = 'rejected'; 