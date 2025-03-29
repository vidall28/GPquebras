-- Script para criar a tabela de notificações (VERSÃO CORRIGIDA)
-- Esta tabela armazena notificações para usuários como solicitações de troca, atualizações de status, etc.

CREATE TABLE IF NOT EXISTS public.notifications (
    id VARCHAR PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    link VARCHAR,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar comentários à tabela e colunas
COMMENT ON TABLE public.notifications IS 'Tabela para armazenar notificações do sistema para usuários';
COMMENT ON COLUMN public.notifications.id IS 'ID único da notificação';
COMMENT ON COLUMN public.notifications.user_id IS 'ID do usuário que recebe a notificação';
COMMENT ON COLUMN public.notifications.type IS 'Tipo da notificação (ex: info, warning, exchange_request)';
COMMENT ON COLUMN public.notifications.title IS 'Título da notificação';
COMMENT ON COLUMN public.notifications.message IS 'Mensagem da notificação';
COMMENT ON COLUMN public.notifications.data IS 'Dados adicionais relacionados à notificação em formato JSON';
COMMENT ON COLUMN public.notifications.link IS 'Link opcional para direcionar o usuário';
COMMENT ON COLUMN public.notifications.read IS 'Indica se a notificação foi lida pelo usuário';
COMMENT ON COLUMN public.notifications.created_at IS 'Data e hora de criação da notificação';
COMMENT ON COLUMN public.notifications.updated_at IS 'Data e hora da última atualização da notificação';

-- Criar índices para melhorar a performance das consultas comuns
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- Configurar RLS (Row Level Security) para garantir que os usuários só vejam suas próprias notificações
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Política para visualização - usuários só podem ver suas próprias notificações
CREATE POLICY "Usuários podem ver suas próprias notificações"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Política para inserção - usuários só podem inserir notificações para si mesmos
CREATE POLICY "Usuários podem inserir suas próprias notificações"
ON public.notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política para atualização - usuários só podem atualizar suas próprias notificações
CREATE POLICY "Usuários podem atualizar suas próprias notificações"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Política para exclusão - usuários só podem excluir suas próprias notificações
CREATE POLICY "Usuários podem excluir suas próprias notificações"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- Política especial para administradores - podem gerenciar todas as notificações
-- CORRIGIDO: Usa role = 'admin' em vez de is_admin = true
CREATE POLICY "Administradores podem gerenciar todas as notificações"
ON public.notifications
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    )
);

-- Criar função para limpar notificações antigas automaticamente (manter apenas últimos 90 dias)
CREATE OR REPLACE FUNCTION public.clean_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.notifications
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

-- Configurar gatilho para atualizar o timestamp updated_at
CREATE OR REPLACE FUNCTION public.update_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_notification_updated_at(); 