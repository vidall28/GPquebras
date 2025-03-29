-- Script para verificar e corrigir problemas na tabela users

-- Etapa 1: Adicionar coluna de email se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'email') THEN
        ALTER TABLE public.users ADD COLUMN email TEXT;
        RAISE NOTICE 'Coluna email adicionada à tabela users';
    ELSE
        RAISE NOTICE 'Coluna email já existe na tabela users';
    END IF;
END $$;

-- Etapa 2: Criar índice para a coluna de email
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'users' 
                   AND indexname = 'idx_users_email') THEN
        CREATE INDEX idx_users_email ON public.users(email);
        RAISE NOTICE 'Índice idx_users_email criado com sucesso';
    ELSE
        RAISE NOTICE 'Índice idx_users_email já existe';
    END IF;
END $$;

-- Etapa 3: Sincronizar emails da tabela de autenticação para a tabela users
-- Esta etapa sincroniza emails da tabela auth.users com a tabela public.users
DO $$
DECLARE
    user_record RECORD;
    auth_email TEXT;
BEGIN
    -- Criar visualização temporária para acesso à tabela auth.users se não existir
    IF NOT EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'auth_users_view') THEN
        EXECUTE 'CREATE OR REPLACE VIEW auth_users_view AS 
                 SELECT id, email FROM auth.users';
        RAISE NOTICE 'Visualização auth_users_view criada com sucesso';
    END IF;

    -- Iterando sobre cada usuário na tabela users
    FOR user_record IN SELECT id, email FROM public.users WHERE email IS NULL OR email = ''
    LOOP
        -- Buscando email da tabela auth.users
        EXECUTE 'SELECT email FROM auth_users_view WHERE id = $1' 
        INTO auth_email
        USING user_record.id;
        
        -- Atualizando o email na tabela users se encontrado
        IF auth_email IS NOT NULL AND auth_email != '' THEN
            UPDATE public.users 
            SET email = auth_email 
            WHERE id = user_record.id;
            
            RAISE NOTICE 'Email atualizado para o usuário %: %', user_record.id, auth_email;
        ELSE
            RAISE NOTICE 'Não foi possível encontrar email para o usuário %', user_record.id;
        END IF;
    END LOOP;
END $$;

-- Etapa 4: Verificar registros na tabela users sem email definido
SELECT id, name, registration, email, role, status 
FROM public.users 
WHERE email IS NULL OR email = ''
ORDER BY created_at DESC
LIMIT 100;

-- Etapa 5: Verificar correspondência entre auth.users e public.users
-- Esta consulta lista usuários em auth.users que não têm correspondência em public.users
WITH auth_users AS (
    SELECT id, email FROM auth_users_view
),
public_users AS (
    SELECT id FROM public.users
)
SELECT au.id, au.email 
FROM auth_users au
LEFT JOIN public_users pu ON au.id = pu.id
WHERE pu.id IS NULL;

-- Etapa 6: Verificar usuários com discrepâncias entre registration e email
WITH users_with_email AS (
    SELECT 
        u.id,
        u.registration,
        u.email,
        CONCAT(u.registration, '@example.com') AS expected_email
    FROM public.users u
    WHERE u.email IS NOT NULL AND u.email != ''
)
SELECT 
    id,
    registration,
    email,
    expected_email,
    email != expected_email AS has_discrepancy
FROM users_with_email
WHERE email != expected_email
ORDER BY registration; 