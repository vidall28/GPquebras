-- Funções RPC para gerenciamento de notificações

-- Função para criar uma notificação
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_type VARCHAR,
    p_title VARCHAR,
    p_message TEXT,
    p_data JSONB DEFAULT NULL,
    p_link VARCHAR DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, notification_id VARCHAR, error VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_notification_id VARCHAR;
    v_is_admin BOOLEAN;
BEGIN
    -- Verificar se o usuário atual é administrador
    SELECT is_admin INTO v_is_admin FROM users WHERE id = auth.uid();
    
    -- Se não for administrador, verificar se está criando para si mesmo
    IF (NOT v_is_admin AND auth.uid() <> p_user_id) THEN
        RETURN QUERY SELECT false, NULL::VARCHAR, 'Sem permissão para criar notificações para outros usuários'::VARCHAR;
        RETURN;
    END IF;

    -- Gerar ID único para a notificação
    v_notification_id := 'notif_' || gen_random_uuid()::VARCHAR;
    
    -- Inserir a notificação
    INSERT INTO notifications (
        id,
        user_id,
        type,
        title,
        message,
        data,
        link,
        read,
        created_at,
        updated_at
    ) VALUES (
        v_notification_id,
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_data,
        p_link,
        FALSE,
        NOW(),
        NOW()
    );
    
    RETURN QUERY SELECT true, v_notification_id, NULL::VARCHAR;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, NULL::VARCHAR, SQLERRM;
END;
$$;

-- Função para marcar uma notificação como lida
CREATE OR REPLACE FUNCTION public.mark_notification_as_read(
    p_notification_id VARCHAR,
    p_read BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (success BOOLEAN, error VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Verificar se o usuário atual é administrador
    SELECT is_admin INTO v_is_admin FROM users WHERE id = auth.uid();
    
    -- Obter o ID do usuário a quem pertence a notificação
    SELECT user_id INTO v_user_id FROM notifications WHERE id = p_notification_id;
    
    -- Se a notificação não existir
    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'Notificação não encontrada'::VARCHAR;
        RETURN;
    END IF;
    
    -- Se não for administrador, verificar se a notificação pertence ao usuário
    IF (NOT v_is_admin AND auth.uid() <> v_user_id) THEN
        RETURN QUERY SELECT false, 'Sem permissão para atualizar esta notificação'::VARCHAR;
        RETURN;
    END IF;

    -- Atualizar o status de leitura
    UPDATE notifications
    SET read = p_read,
        updated_at = NOW()
    WHERE id = p_notification_id;
    
    RETURN QUERY SELECT true, NULL::VARCHAR;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, SQLERRM;
END;
$$;

-- Função para marcar todas as notificações de um usuário como lidas
CREATE OR REPLACE FUNCTION public.mark_all_notifications_as_read(
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, count INTEGER, error VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
    v_user_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Definir o usuário alvo (administrador pode especificar outro usuário)
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Verificar se o usuário atual é administrador
    SELECT is_admin INTO v_is_admin FROM users WHERE id = auth.uid();
    
    -- Se não for administrador, verificar se está atualizando suas próprias notificações
    IF (NOT v_is_admin AND auth.uid() <> v_user_id) THEN
        RETURN QUERY SELECT false, 0, 'Sem permissão para atualizar notificações de outros usuários'::VARCHAR;
        RETURN;
    END IF;

    -- Marcar todas as notificações como lidas
    UPDATE notifications
    SET read = TRUE,
        updated_at = NOW()
    WHERE user_id = v_user_id AND read = FALSE;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN QUERY SELECT true, v_count, NULL::VARCHAR;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, 0, SQLERRM;
END;
$$;

-- Função para excluir uma notificação
CREATE OR REPLACE FUNCTION public.delete_notification(
    p_notification_id VARCHAR
)
RETURNS TABLE (success BOOLEAN, error VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Verificar se o usuário atual é administrador
    SELECT is_admin INTO v_is_admin FROM users WHERE id = auth.uid();
    
    -- Obter o ID do usuário a quem pertence a notificação
    SELECT user_id INTO v_user_id FROM notifications WHERE id = p_notification_id;
    
    -- Se a notificação não existir
    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'Notificação não encontrada'::VARCHAR;
        RETURN;
    END IF;
    
    -- Se não for administrador, verificar se a notificação pertence ao usuário
    IF (NOT v_is_admin AND auth.uid() <> v_user_id) THEN
        RETURN QUERY SELECT false, 'Sem permissão para excluir esta notificação'::VARCHAR;
        RETURN;
    END IF;

    -- Excluir a notificação
    DELETE FROM notifications
    WHERE id = p_notification_id;
    
    RETURN QUERY SELECT true, NULL::VARCHAR;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, SQLERRM;
END;
$$;

-- Função para limpar todas as notificações de um usuário
CREATE OR REPLACE FUNCTION public.clear_notifications(
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, count INTEGER, error VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
    v_user_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Definir o usuário alvo (administrador pode especificar outro usuário)
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Verificar se o usuário atual é administrador
    SELECT is_admin INTO v_is_admin FROM users WHERE id = auth.uid();
    
    -- Se não for administrador, verificar se está limpando suas próprias notificações
    IF (NOT v_is_admin AND auth.uid() <> v_user_id) THEN
        RETURN QUERY SELECT false, 0, 'Sem permissão para limpar notificações de outros usuários'::VARCHAR;
        RETURN;
    END IF;

    -- Remover todas as notificações do usuário
    DELETE FROM notifications
    WHERE user_id = v_user_id;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN QUERY SELECT true, v_count, NULL::VARCHAR;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, 0, SQLERRM;
END;
$$;

-- Função para contar notificações não lidas
CREATE OR REPLACE FUNCTION public.count_unread_notifications(
    p_user_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
    v_user_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Definir o usuário alvo (administrador pode especificar outro usuário)
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Verificar se o usuário atual é administrador
    SELECT is_admin INTO v_is_admin FROM users WHERE id = auth.uid();
    
    -- Se não for administrador, verificar se está consultando suas próprias notificações
    IF (NOT v_is_admin AND auth.uid() <> v_user_id) THEN
        RETURN 0;
    END IF;

    -- Contar notificações não lidas
    SELECT COUNT(*) INTO v_count
    FROM notifications
    WHERE user_id = v_user_id AND read = FALSE;
    
    RETURN v_count;
EXCEPTION WHEN OTHERS THEN
    RETURN 0;
END;
$$; 