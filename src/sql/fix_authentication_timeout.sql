-- Corrigir problemas de timeout na autenticação e carregamento de dados do usuário

-- Nota: Execute este comando VACUUM separadamente, fora de qualquer transação
-- VACUUM ANALYZE public.users;

-- 2. Criar um índice para pesquisa rápida por ID
DO $$
BEGIN
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
END $$;

-- 3. Criar uma função para buscar usuário de forma eficiente
CREATE OR REPLACE FUNCTION get_user_by_id(user_id UUID)
RETURNS JSONB
SECURITY DEFINER 
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
    
    RETURN user_data;
END;
$$ LANGUAGE plpgsql;

-- 4. Verificar se há usuários sem dados completos
SELECT 
    u.id, 
    u.email, 
    COALESCE(p.name, 'Sem nome') AS name,
    COALESCE(p.registration, 'Não registrado') AS registration,
    COALESCE(p.role, 'user') AS role,
    COALESCE(p.status, 'active') AS status
FROM 
    auth.users u
LEFT JOIN 
    public.users p ON u.id = p.id
WHERE 
    p.id IS NULL OR p.role IS NULL OR p.status IS NULL
LIMIT 10;

-- 5. Corrigir usuários que não têm entrada na tabela pública
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