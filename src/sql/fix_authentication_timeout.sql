-- Corrigir problemas de timeout na autenticação e carregamento de dados do usuário

-- Nota: Execute este comando VACUUM separadamente, fora de qualquer transação
-- VACUUM ANALYZE public.users;

-- 1. Criar índices para acelerar consultas frequentes
DO $$
BEGIN
    -- Índice para pesquisa rápida por ID
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'users' 
        AND indexname = 'idx_users_id'
    ) THEN
        CREATE INDEX idx_users_id ON public.users(id);
        RAISE NOTICE 'Índice idx_users_id criado para otimizar consultas por ID';
    ELSE
        RAISE NOTICE 'Índice idx_users_id já existe';
    END IF;

    -- Índice para pesquisa rápida por email
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'users' 
        AND indexname = 'idx_users_email'
    ) THEN
        CREATE INDEX idx_users_email ON public.users(email);
        RAISE NOTICE 'Índice idx_users_email criado para otimizar consultas por email';
    ELSE
        RAISE NOTICE 'Índice idx_users_email já existe';
    END IF;

    -- Índice para pesquisa rápida por role
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'users' 
        AND indexname = 'idx_users_role'
    ) THEN
        CREATE INDEX idx_users_role ON public.users(role);
        RAISE NOTICE 'Índice idx_users_role criado para otimizar consultas de administrador';
    ELSE
        RAISE NOTICE 'Índice idx_users_role já existe';
    END IF;
END $$;

-- 2. Criar função otimizada para buscar usuário de forma eficiente (evitar timeout)
CREATE OR REPLACE FUNCTION get_user_by_id(user_id UUID)
RETURNS JSONB
SECURITY DEFINER 
SET statement_timeout = '3s'  -- Timeout máximo de 3 segundos
AS $$
DECLARE
    user_data JSONB;
BEGIN
    SELECT json_build_object(
        'id', id,
        'name', name,
        'registration', registration,
        'email', email,
        'role', role,
        'status', status,
        'created_at', created_at
    )::JSONB INTO user_data
    FROM public.users
    WHERE id = user_id;
    
    RETURN COALESCE(user_data, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- 3. Otimizar verificação de admin (resolver erro checkIfUserIsAdmin is not defined)
CREATE OR REPLACE FUNCTION check_if_admin(user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET statement_timeout = '1s'  -- Timeout reduzido para resposta rápida
AS $$
DECLARE
    is_admin BOOLEAN;
BEGIN
    SELECT (role = 'admin') INTO is_admin
    FROM public.users
    WHERE id = user_id;
    
    RETURN COALESCE(is_admin, FALSE);
END;
$$ LANGUAGE plpgsql;

-- 4. Função ping para verificação rápida de conectividade
CREATE OR REPLACE FUNCTION ping() 
RETURNS BOOLEAN 
SECURITY DEFINER
AS $$
BEGIN
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 5. Corrigir usuários que não têm entrada na tabela pública (resolver problema de usuários faltantes)
DO $$
DECLARE
    auth_user RECORD;
BEGIN
    FOR auth_user IN (
        SELECT 
            u.id, 
            u.email,
            u.raw_user_meta_data->>'name' AS meta_name,
            u.raw_user_meta_data->>'registration' AS meta_registration
        FROM 
            auth.users u
        LEFT JOIN 
            public.users p ON u.id = p.id
        WHERE 
            p.id IS NULL
    ) LOOP
        -- Inserir o registro faltante na tabela pública
        INSERT INTO public.users (
            id, 
            name, 
            registration, 
            email, 
            role, 
            status
        ) VALUES (
            auth_user.id,
            COALESCE(auth_user.meta_name, SPLIT_PART(auth_user.email, '@', 1)),
            COALESCE(auth_user.meta_registration, '00000000'),
            auth_user.email,
            'user',
            'active'
        );
        
        RAISE NOTICE 'Usuário criado na tabela pública: % (%)', 
            COALESCE(auth_user.meta_name, SPLIT_PART(auth_user.email, '@', 1)),
            auth_user.id;
    END LOOP;
END $$;

-- 6. Verificar e atualizar usuários com dados incompletos
DO $$
DECLARE
    incomplete_user RECORD;
BEGIN
    FOR incomplete_user IN (
        SELECT 
            p.id,
            p.email,
            u.raw_user_meta_data->>'name' AS auth_name,
            u.raw_user_meta_data->>'registration' AS auth_registration,
            p.name AS current_name,
            p.registration AS current_registration,
            p.role AS current_role,
            p.status AS current_status
        FROM 
            public.users p
        INNER JOIN 
            auth.users u ON p.id = u.id
        WHERE 
            p.name IS NULL OR 
            p.registration IS NULL OR
            p.role IS NULL OR
            p.status IS NULL
    ) LOOP
        -- Atualizar os dados incompletos
        UPDATE public.users
        SET 
            name = COALESCE(incomplete_user.current_name, incomplete_user.auth_name, SPLIT_PART(incomplete_user.email, '@', 1)),
            registration = COALESCE(incomplete_user.current_registration, incomplete_user.auth_registration, '00000000'),
            role = COALESCE(incomplete_user.current_role, 'user'),
            status = COALESCE(incomplete_user.current_status, 'active')
        WHERE 
            id = incomplete_user.id;
            
        RAISE NOTICE 'Usuário atualizado com dados completos: % (%)', 
            COALESCE(incomplete_user.current_name, incomplete_user.auth_name, SPLIT_PART(incomplete_user.email, '@', 1)),
            incomplete_user.id;
    END LOOP;
END $$;

-- 7. Criar trigger para manter os dados sincronizados entre auth e public
CREATE OR REPLACE FUNCTION sync_auth_user_to_public()
RETURNS TRIGGER AS $$
BEGIN
    -- Se não existe o registro na tabela public.users, cria um novo
    INSERT INTO public.users (id, email, name, registration, role, status)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'registration', '00000000'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        'active'
    )
    ON CONFLICT (id) DO UPDATE 
    SET 
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.users.name),
        registration = COALESCE(EXCLUDED.registration, public.users.registration),
        role = COALESCE(public.users.role, EXCLUDED.role)
    WHERE 
        public.users.id = EXCLUDED.id;
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar o trigger se não existir
DO $$
BEGIN
    -- Remover o trigger se já existir para garantir que esteja atualizado
    DROP TRIGGER IF EXISTS auth_user_sync_trigger ON auth.users;
    
    -- Criar o novo trigger
    CREATE TRIGGER auth_user_sync_trigger
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_auth_user_to_public();
    
    RAISE NOTICE 'Trigger de sincronização auth/public criado/atualizado';
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Permissões insuficientes para criar trigger em auth.users. Execute como superusuário.';
END $$; 