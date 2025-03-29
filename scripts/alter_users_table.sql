-- Adicionar a coluna email à tabela users se não existir
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;

-- Criar índice para busca por email
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Verificar se a coluna foi adicionada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'email'; 