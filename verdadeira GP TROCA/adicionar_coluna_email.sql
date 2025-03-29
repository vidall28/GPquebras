-- SQL para adicionar a coluna email à tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- SQL para verificar se a coluna foi adicionada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'email'; 