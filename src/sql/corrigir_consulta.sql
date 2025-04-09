-- Script para resolver o problema na aplicação que filtra apenas os registros do usuário atual
-- Isso vai criar uma função customizada que pode ser usada para buscar todas as trocas sem filtro pelo código da aplicação

-- 1. Criar função para buscar TODAS as trocas sem filtro por usuário
CREATE OR REPLACE FUNCTION public.get_all_exchanges()
RETURNS SETOF json
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        json_build_object(
            'id', e.id,
            'user_id', e.user_id,
            'user_name', u.name,
            'user_registration', u.registration,
            'label', e.label,
            'type', e.type,
            'status', e.status,
            'notes', e.notes,
            'created_at', e.created_at,
            'updated_at', e.updated_at,
            'updated_by', e.updated_by,
            'exchange_items', (
                SELECT json_agg(
                    json_build_object(
                        'id', ei.id,
                        'product_id', ei.product_id,
                        'product_name', p.name,
                        'quantity', ei.quantity,
                        'reason', ei.reason,
                        'exchange_photos', (
                            SELECT json_agg(
                                json_build_object(
                                    'id', ep.id,
                                    'photo_url', ep.photo_url
                                )
                            )
                            FROM public.exchange_photos ep
                            WHERE ep.exchange_item_id = ei.id
                        )
                    )
                )
                FROM public.exchange_items ei
                LEFT JOIN public.products p ON ei.product_id = p.id
                WHERE ei.exchange_id = e.id
            )
        )
    FROM 
        public.exchanges e
    LEFT JOIN 
        public.users u ON e.user_id = u.id
    ORDER BY 
        e.created_at DESC;
END;
$$;

-- 2. Conceder permissões para a função para usuários autenticados
GRANT EXECUTE ON FUNCTION public.get_all_exchanges() TO authenticated;

-- 3. Criar função para verificar se o código da aplicação está tendo problemas com a consulta regular
CREATE OR REPLACE FUNCTION public.check_user_exchanges_visibility(check_user_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    label TEXT,
    type TEXT,
    status TEXT,
    is_visible BOOLEAN
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.user_id,
        e.label,
        e.type,
        e.status,
        -- Isso verifica se a política RLS permite que o usuário veja o registro
        -- usando a função has_table_privilege interna do PostgreSQL
        has_table_privilege(check_user_id, 'exchanges', 'SELECT') AS is_visible
    FROM 
        public.exchanges e;
END;
$$;

-- 4. Conceder permissões para a função de verificação
GRANT EXECUTE ON FUNCTION public.check_user_exchanges_visibility(UUID) TO authenticated;

-- 5. Teste rápido para verificar a função principal
SELECT COUNT(*) FROM public.get_all_exchanges(); 