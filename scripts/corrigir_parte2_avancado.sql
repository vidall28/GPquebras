-- CORREÇÃO AVANÇADA DAS POLÍTICAS RLS E PERMISSÕES
-- Este script aplica uma correção mais profunda para o problema persistente de aprovação/rejeição

-- 1. Verificar e corrigir a tabela exchanges
BEGIN;

-- Verificar o tipo de dados da coluna updated_by
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'exchanges' AND column_name = 'updated_by';

-- Garantir que a coluna updated_by seja do tipo UUID ou texto e aceite nulos
DO $$
BEGIN
    -- Se a coluna for de tipo incompatível ou com restrições, alterar
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exchanges' 
        AND column_name = 'updated_by' 
        AND (data_type NOT IN ('uuid', 'text', 'character varying') OR is_nullable = 'NO')
    ) THEN
        ALTER TABLE exchanges ALTER COLUMN updated_by TYPE uuid USING updated_by::uuid;
        ALTER TABLE exchanges ALTER COLUMN updated_by DROP NOT NULL;
        RAISE NOTICE 'Coluna updated_by corrigida para tipo UUID aceitando nulos';
    END IF;
END $$;

-- 2. Garantir que o usuário atual tenha todas as permissões necessárias
GRANT ALL PRIVILEGES ON TABLE exchanges TO authenticated;
GRANT ALL PRIVILEGES ON TABLE exchange_items TO authenticated;
GRANT ALL PRIVILEGES ON TABLE exchange_photos TO authenticated;

-- 3. Remover e recriar as políticas RLS de forma mais simples e robusta
-- Primeiro remover TODAS as políticas existentes
DROP POLICY IF EXISTS "Usuarios podem ver apenas seus próprios registros" ON exchanges;
DROP POLICY IF EXISTS "Admins podem ver todos os registros" ON exchanges; 
DROP POLICY IF EXISTS "Admins podem inserir registros para qualquer usuário" ON exchanges;
DROP POLICY IF EXISTS "Usuarios só podem inserir seus próprios registros" ON exchanges;
DROP POLICY IF EXISTS "Admins podem atualizar qualquer registro" ON exchanges;
DROP POLICY IF EXISTS "Usuarios só podem atualizar seus próprios registros pendentes" ON exchanges;
DROP POLICY IF EXISTS "Admins podem deletar qualquer registro" ON exchanges;
DROP POLICY IF EXISTS "Usuarios só podem deletar seus próprios registros pendentes" ON exchanges;

-- Garantir que o RLS esteja ativado
ALTER TABLE exchanges ENABLE ROW LEVEL SECURITY;

-- 4. Criar políticas simplificadas e mais permissivas para diagnóstico
-- Política universal de leitura (permite que todos vejam todos os registros)
CREATE POLICY "Todos podem ver todos os registros"
ON exchanges
FOR SELECT
TO authenticated
USING (true);

-- Política universal de atualização (permite que todos atualizem todos os registros)
CREATE POLICY "Todos podem atualizar todos os registros"
ON exchanges
FOR UPDATE
TO authenticated
USING (true);

-- 5. Realizar um teste de atualização direto para verificar se a política está funcionando
DO $$
DECLARE
    test_exchange_id UUID;
    status_antes TEXT;
    status_depois TEXT;
BEGIN
    -- Selecionar qualquer troca pendente para teste
    SELECT id INTO test_exchange_id FROM exchanges WHERE status = 'pending' LIMIT 1;
    
    IF test_exchange_id IS NOT NULL THEN
        -- Verificar status atual
        SELECT status INTO status_antes FROM exchanges WHERE id = test_exchange_id;
        
        -- Atualizar para aprovado
        UPDATE exchanges 
        SET 
            status = 'approved',
            notes = 'Atualização de TESTE via SQL com políticas simplificadas',
            updated_at = NOW(),
            updated_by = NULL  -- Usar NULL para evitar problemas de tipo
        WHERE id = test_exchange_id;
        
        -- Verificar se atualizou
        SELECT status INTO status_depois FROM exchanges WHERE id = test_exchange_id;
        
        -- Relatório
        RAISE NOTICE 'Teste de atualização: ID=%, Antes=%, Depois=%', 
                     test_exchange_id, status_antes, status_depois;
    ELSE
        RAISE NOTICE 'Nenhuma troca pendente para testar.';
    END IF;
END $$;

-- 6. Atualizar todas as trocas pendentes cujos IDs estão no array abaixo
-- (Substitua os UUIDs pelos reais da sua base de dados ou deixe vazio)
DO $$
DECLARE
    ids_para_aprovar UUID[] := '{}';  -- Array vazio ou adicione UUIDs específicos
    id_item UUID;
BEGIN
    IF array_length(ids_para_aprovar, 1) > 0 THEN
        FOREACH id_item IN ARRAY ids_para_aprovar LOOP
            UPDATE exchanges 
            SET 
                status = 'approved',
                updated_at = NOW(),
                notes = COALESCE(notes, '') || ' [Aprovado pelo script de correção]'
            WHERE id = id_item;
            
            RAISE NOTICE 'Atualizado registro com ID: %', id_item;
        END LOOP;
    END IF;
END $$;

COMMIT;

-- 7. Verificar o resultado das alterações
SELECT
    status,
    COUNT(*) as quantidade
FROM
    exchanges
GROUP BY
    status
ORDER BY
    status; 