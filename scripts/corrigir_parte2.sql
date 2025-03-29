-- PARTE 2: CORREÇÃO DAS POLÍTICAS RLS
-- Este script remove as políticas existentes e cria novas com permissões corretas

-- 1. Primeiro remover políticas existentes
DROP POLICY IF EXISTS "Usuarios podem ver apenas seus próprios registros" ON exchanges;
DROP POLICY IF EXISTS "Admins podem ver todos os registros" ON exchanges; 
DROP POLICY IF EXISTS "Admins podem inserir registros para qualquer usuário" ON exchanges;
DROP POLICY IF EXISTS "Usuarios só podem inserir seus próprios registros" ON exchanges;
DROP POLICY IF EXISTS "Admins podem atualizar qualquer registro" ON exchanges;
DROP POLICY IF EXISTS "Usuarios só podem atualizar seus próprios registros pendentes" ON exchanges;
DROP POLICY IF EXISTS "Admins podem deletar qualquer registro" ON exchanges;
DROP POLICY IF EXISTS "Usuarios só podem deletar seus próprios registros pendentes" ON exchanges;

-- 2. Desabilitar e reabilitar RLS para garantir que não haja políticas residuais
ALTER TABLE exchanges DISABLE ROW LEVEL SECURITY;
ALTER TABLE exchanges ENABLE ROW LEVEL SECURITY;

-- 3. Criar novas políticas corrigidas
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

-- 4. Verificar se as políticas foram criadas corretamente
SELECT 
    tablename,
    policyname,
    cmd,
    roles,
    qual
FROM 
    pg_policies
WHERE 
    tablename = 'exchanges'; 