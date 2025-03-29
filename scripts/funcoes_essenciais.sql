-- Script SQL simplificado com apenas as funções essenciais
-- Execute este script no SQL Editor do Supabase

-- Adicionar coluna de email se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'email') THEN
        ALTER TABLE public.users ADD COLUMN email TEXT;
        CREATE INDEX idx_users_email ON public.users(email);
        RAISE NOTICE 'Coluna email adicionada à tabela users';
    ELSE
        RAISE NOTICE 'Coluna email já existe na tabela users';
    END IF;
END $$;

-- Função para corrigir dados de usuários específicos
CREATE OR REPLACE FUNCTION fix_user_data(
  user_id uuid, 
  user_name text, 
  user_registration text, 
  user_email text
)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
  success BOOLEAN;
BEGIN
  UPDATE public.users 
  SET 
    name = user_name,
    registration = user_registration,
    email = user_email
  WHERE id = user_id;
  
  success := FOUND;
  RETURN success;
END;
$$ LANGUAGE plpgsql;

-- Criar view para acessar emails dos usuários de autenticação
CREATE OR REPLACE VIEW auth_users_view AS 
  SELECT id, email FROM auth.users;

-- Verificar usuários com dados incompletos
SELECT 
  u.id, 
  u.name, 
  u.registration, 
  u.email AS users_email, 
  au.email AS auth_email,
  u.status,
  u.created_at
FROM 
  public.users u
LEFT JOIN 
  auth_users_view au ON u.id = au.id
WHERE 
  u.email IS NULL OR
  u.name = 'Novo Usuário' OR 
  u.registration IS NULL OR 
  u.registration = '';

-- Exemplo de como atualizar um usuário específico (descomente e substitua os valores)
-- SELECT fix_user_data(
--   'ID_DO_USUARIO'::uuid, -- substitua pelo ID do usuário
--   'Nome Completo',       -- substitua pelo nome correto
--   '00123456',            -- substitua pela matrícula correta
--   'email@exemplo.com'    -- substitua pelo email correto
-- ); 