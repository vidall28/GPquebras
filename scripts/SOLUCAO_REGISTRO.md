# Solução para Problemas de Registro de Usuários

## Problema identificado

Identificamos que ao se registrar no sistema, as informações fornecidas pelos usuários (nome, email e matrícula) não estão sendo salvas corretamente na tabela `users` do Supabase. Em vez disso:

1. O nome aparece como "Novo Usuário" em vez do nome real informado
2. A matrícula não aparece corretamente
3. O campo email permanece como "null"

## Causa do problema

Este problema ocorre devido a:

1. A coluna `email` pode não existir ou não estar configurada corretamente na tabela `users`
2. Os dados fornecidos durante o registro não estão sendo transferidos corretamente entre o sistema de autenticação (`auth.users`) e a tabela customizada (`public.users`)
3. O sistema estava substituindo automaticamente dados em branco com valores padrão

## Solução implementada

Implementamos as seguintes correções no sistema:

1. **Modificação no processo de registro:** O código agora verifica e insiste que os dados sejam salvos corretamente, com várias tentativas alternativas se a primeira falhar.

2. **Correção da substituição do nome:** O sistema agora não substitui automaticamente o nome por "Novo Usuário", mas sim tenta obter o nome correto dos metadados de autenticação.

3. **Funções auxiliares no banco de dados:** Criamos novas funções para diagnóstico e correção de problemas:
   - `table_columns_info`: Para verificar a estrutura da tabela
   - `sync_auth_emails`: Para sincronizar emails entre auth.users e public.users
   - `fix_user_data`: Para corrigir dados de usuários específicos
   - `diagnose_registration_issues`: Para diagnosticar problemas de registro

4. **Tratamento de casos especiais:** O sistema agora trata melhor os casos onde um usuário existe no Auth mas não na tabela users.

## Instruções para executar scripts de correção

### 1. Execute o script para adicionar/verificar a coluna email

No Console do Supabase (SQL Editor), execute:

```sql
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
```

### 2. Execute o script para criar as funções auxiliares

```sql
-- Função para listar colunas de uma tabela
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

-- Função para atualizar diretamente um usuário específico
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
```

### 3. Corrigir usuários existentes com dados incompletos

Para corrigir dados de usuários existentes, você pode usar a seguinte consulta:

```sql
-- Identificar usuários com dados incompletos
SELECT id, name, registration, email, status, created_at
FROM public.users
WHERE 
  email IS NULL OR 
  name = 'Novo Usuário' OR 
  registration IS NULL OR 
  registration = '';

-- Atualizar um usuário específico
SELECT fix_user_data(
  'ID_DO_USUARIO'::uuid, -- substitua pelo ID do usuário
  'Nome Completo',       -- substitua pelo nome correto
  '00123456',            -- substitua pela matrícula correta
  'email@exemplo.com'    -- substitua pelo email correto
);
```

## Como verificar se a correção funcionou

1. **Registre um novo usuário** de teste no sistema
2. Execute a seguinte consulta SQL para verificar se os dados foram salvos corretamente:

```sql
SELECT id, name, registration, email, status, created_at
FROM public.users
ORDER BY created_at DESC
LIMIT 10;
```

3. **Tente fazer login** com o usuário recém-registrado para verificar se o processo funciona corretamente

## Para administradores: usuário admin de referência

Para fins de referência, o usuário administrador tem os seguintes detalhes:

- **Registro**: 00123456
- **Email**: vidalkaique.az@gmail.com
- **Senha**: senha_segura_admin
- **Função**: admin

## Melhorias futuras recomendadas

Para melhorar ainda mais o sistema de registro, sugerimos:

1. Adicionar validação de email por confirmação
2. Implementar um sistema de recuperação de senha mais robusto
3. Adicionar logs detalhados para monitorar o processo de registro
4. Implementar testes automatizados para o processo de registro

---

Caso ainda enfrente problemas, entre em contato com o suporte:
**Email:** suporte@logiswap.com.br 