# Instruções para Administradores

## Correção de Problemas com Registro e Email de Usuários

### Contexto
Identificamos que o sistema está enfrentando problemas com o armazenamento correto dos emails e números de registro dos usuários. Isso acontece porque a tabela `users` não foi configurada corretamente para armazenar emails ou ocorreram problemas durante o processo de registro.

### Passo a Passo para Solução

#### 1. Execute o script para adicionar a coluna de email

Acesse o console do Supabase e siga estes passos:

1. Faça login no [Supabase Dashboard](https://app.supabase.io/)
2. Selecione o projeto correto
3. No menu lateral, clique em "SQL Editor"
4. Crie um novo script clicando em "New Query"
5. Cole o seguinte código SQL:

```sql
-- Adicionar coluna de email se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'users' 
                   AND column_name = 'email') THEN
        ALTER TABLE public.users ADD COLUMN email TEXT;
        CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
        RAISE NOTICE 'Coluna email adicionada à tabela users';
    ELSE
        RAISE NOTICE 'Coluna email já existe na tabela users';
    END IF;
END $$;

-- Verificar se a coluna foi adicionada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'users';
```

6. Clique no botão "Run" para executar o script
7. Verifique os resultados para confirmar que a coluna `email` foi adicionada ou já existe

#### 2. Criar funções auxiliares para diagnóstico

Execute o seguinte script para criar funções que ajudarão a identificar e corrigir problemas:

```sql
-- Criar função para listar colunas de uma tabela
CREATE OR REPLACE FUNCTION table_columns_info(table_name text)
RETURNS TABLE (column_name text, data_type text, is_nullable boolean) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    cols.column_name::text, 
    cols.data_type::text,
    cols.is_nullable::boolean
  FROM 
    information_schema.columns cols
  WHERE 
    cols.table_schema = 'public'
    AND cols.table_name = table_name
  ORDER BY
    cols.ordinal_position;
END;
$$ LANGUAGE plpgsql;

-- Criar função para sincronizar emails
CREATE OR REPLACE FUNCTION sync_auth_emails()
RETURNS TABLE (user_id text, email text, success boolean)
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  auth_email TEXT;
  success BOOLEAN;
BEGIN
  -- Criar visualização temporária para acesso à tabela auth.users
  CREATE OR REPLACE VIEW auth_users_view AS 
    SELECT id, email FROM auth.users;
  
  -- Iterando sobre cada usuário na tabela users
  FOR user_record IN 
    SELECT id, email, registration 
    FROM public.users 
    WHERE email IS NULL OR email = ''
  LOOP
    -- Buscando email da tabela auth.users
    SELECT email INTO auth_email 
    FROM auth_users_view 
    WHERE id = user_record.id;
    
    -- Tentando atualizar o registro com o email encontrado
    IF auth_email IS NOT NULL AND auth_email != '' THEN
      UPDATE public.users 
      SET email = auth_email 
      WHERE id = user_record.id;
      
      -- Verificar se a atualização foi bem-sucedida
      success := FOUND;
    ELSE
      -- Se não encontrou na tabela auth.users, tentar usar o formato padrão
      auth_email := user_record.registration || '@example.com';
      
      UPDATE public.users 
      SET email = auth_email 
      WHERE id = user_record.id;
      
      success := FOUND;
    END IF;
    
    -- Retornar o resultado para o cliente
    user_id := user_record.id;
    email := auth_email;
    RETURN NEXT;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Diagnóstico completo de problemas de registro
CREATE OR REPLACE FUNCTION diagnose_registration_issues()
RETURNS TEXT
SECURITY DEFINER
AS $$
DECLARE
  output TEXT := '';
  missing_email_count INTEGER;
  auth_mismatch_count INTEGER;
  missing_column BOOLEAN := FALSE;
BEGIN
  -- Verificar se a coluna email existe
  PERFORM 1 
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'email';
  
  IF NOT FOUND THEN
    output := output || 'PROBLEMA CRÍTICO: Coluna email não existe na tabela users.' || E'\n';
    missing_column := TRUE;
  ELSE
    output := output || 'OK: Coluna email existe na tabela users.' || E'\n';
  END IF;
  
  -- Verificar registros sem email (apenas se a coluna existir)
  IF NOT missing_column THEN
    SELECT COUNT(*) INTO missing_email_count
    FROM public.users
    WHERE email IS NULL OR email = '';
    
    IF missing_email_count > 0 THEN
      output := output || 'PROBLEMA: ' || missing_email_count || ' usuários sem email definido.' || E'\n';
    ELSE
      output := output || 'OK: Todos os usuários têm email definido.' || E'\n';
    END IF;
  END IF;
  
  -- Verificar correspondência entre auth.users e public.users
  CREATE TEMP TABLE IF NOT EXISTS temp_auth_users AS
  SELECT id, email FROM auth.users;
  
  SELECT COUNT(*) INTO auth_mismatch_count
  FROM temp_auth_users au
  LEFT JOIN public.users pu ON au.id = pu.id
  WHERE pu.id IS NULL;
  
  IF auth_mismatch_count > 0 THEN
    output := output || 'PROBLEMA: ' || auth_mismatch_count || ' usuários na auth.users sem correspondência em public.users.' || E'\n';
  ELSE
    output := output || 'OK: Todos os usuários de auth.users têm correspondência em public.users.' || E'\n';
  END IF;
  
  -- Adicionar recomendações
  output := output || E'\n' || 'RECOMENDAÇÕES:' || E'\n';
  
  IF missing_column THEN
    output := output || '- Execute o script para adicionar a coluna email à tabela users.' || E'\n';
  END IF;
  
  IF missing_email_count > 0 THEN
    output := output || '- Execute a função sync_auth_emails() para sincronizar emails faltantes.' || E'\n';
  END IF;
  
  IF auth_mismatch_count > 0 THEN
    output := output || '- Verifique os usuários em auth.users que não possuem entrada em public.users.' || E'\n';
  END IF;
  
  RETURN output;
END;
$$ LANGUAGE plpgsql;
```

#### 3. Execute o diagnóstico para identificar problemas

Execute o seguinte comando SQL:

```sql
SELECT diagnose_registration_issues();
```

Isso fornecerá um relatório detalhado dos problemas e as recomendações para resolvê-los.

#### 4. Sincronizar emails para usuários existentes

Para atualizar os emails de usuários existentes que estão com o campo vazio:

```sql
SELECT * FROM sync_auth_emails();
```

#### 5. Verificar usuários específicos (caso necessário)

Se você precisa verificar um usuário específico, use:

```sql
-- Consulta para verificar detalhes de um usuário pelo número de registro
SELECT 
  u.id, 
  u.name, 
  u.registration, 
  u.email AS users_email, 
  au.email AS auth_email
FROM 
  public.users u
JOIN 
  auth_users_view au ON u.id = au.id
WHERE 
  u.registration = '00123456';  -- Substitua pelo número de registro do usuário

-- OU para verificar por email
SELECT 
  u.id, 
  u.name, 
  u.registration, 
  u.email AS users_email, 
  au.email AS auth_email
FROM 
  public.users u
JOIN 
  auth_users_view au ON u.id = au.id
WHERE 
  au.email = 'vidalkaique.az@gmail.com';  -- Substitua pelo email a verificar
```

#### 6. Atualizar um usuário específico (caso necessário)

Se precisar atualizar o email de um usuário específico:

```sql
-- Atualizar email para um usuário específico
UPDATE public.users
SET email = 'vidalkaique.az@gmail.com'  -- Substitua pelo email correto
WHERE registration = '00123456';  -- Substitua pelo número de registro do usuário

-- Verifique se a atualização foi bem-sucedida
SELECT id, name, registration, email
FROM public.users
WHERE registration = '00123456';  -- Mesmo número de registro
```

### Passos para Testes de Validação

Após concluir os passos acima, faça os seguintes testes:

1. **Teste de Login**: Tente fazer login com o usuário administrador
2. **Teste de Registro**: Crie um novo usuário e verifique se o email e número de registro são salvos corretamente
3. **Consulte os Dados**: Verifique se os dados foram atualizados corretamente executando:

```sql
-- Para visualizar todos os usuários com seus emails
SELECT id, name, registration, email, status
FROM public.users
ORDER BY created_at DESC;
```

### Melhorias Futuras Recomendadas

Para evitar problemas semelhantes no futuro:

1. Considere atualizar o processo de registro para validar explicitamente o email antes de concluir o cadastro
2. Adicione verificações adicionais para garantir que o número de registro e email sejam armazenados corretamente
3. Implemente um sistema de recuperação de senha baseado em email real

### Contato para Suporte

Em caso de dificuldades ao executar estes procedimentos, entre em contato com:
- **Email**: suporte@logiswap.com.br
- **Telefone**: (11) 1234-5678

---

## Registro Atual do Usuário Administrador

Como referência, o usuário administrador tem os seguintes detalhes:

- **Registro**: 00123456
- **Email**: vidalkaique.az@gmail.com
- **Senha**: senha_segura_admin
- **Função**: admin 