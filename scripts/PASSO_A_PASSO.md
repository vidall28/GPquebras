# Passo a Passo para Corrigir Problema de Registro

## Problema

Ao se registrar no sistema, os dados fornecidos (nome, matrícula e email) não estão sendo salvos corretamente na tabela `users`.

## Solução

Siga estes passos para corrigir o problema:

### 1. Acesse o Console do Supabase

1. Faça login no [Dashboard do Supabase](https://app.supabase.io)
2. Selecione o projeto correto
3. Clique em "SQL Editor" no menu lateral

### 2. Execute o Script de Funções Essenciais

1. Crie um novo script clicando em "New Query"
2. Cole o conteúdo do arquivo `funcoes_essenciais.sql`
3. Clique em "Run" para executar o script

O script irá:
- Verificar e adicionar a coluna `email` se não existir
- Criar a função `fix_user_data` para corrigir dados de usuários
- Criar a view `auth_users_view` para acessar emails dos usuários
- Listar os usuários com dados incompletos

### 3. Corrigir Usuários Específicos

Depois de executar o script anterior, você verá a lista de usuários com dados incompletos. Para cada usuário que precisa ser corrigido:

1. Copie o ID do usuário da lista
2. Crie um novo script SQL com o seguinte comando (substitua os valores):

```sql
SELECT fix_user_data(
  'ID_DO_USUARIO'::uuid, -- substitua pelo ID do usuário
  'Nome Completo',       -- substitua pelo nome correto
  '00123456',            -- substitua pela matrícula correta
  'email@exemplo.com'    -- substitua pelo email correto
);
```

3. Execute o script para cada usuário

### 4. Verificar se a Correção Funcionou

Execute o seguinte SQL para verificar se os dados foram corrigidos:

```sql
SELECT 
  id, 
  name, 
  registration, 
  email, 
  status, 
  created_at
FROM 
  public.users
ORDER BY 
  created_at DESC
LIMIT 10;
```

### 5. Teste o Registro de Novos Usuários

1. Tente registrar um novo usuário no sistema
2. Verifique no banco de dados se os dados foram salvos corretamente

## Dados do Usuário Admin

Para referência, o usuário admin tem os seguintes dados:

- **Matrícula**: 00123456
- **Email**: vidalkaique.az@gmail.com
- **Senha**: senha_segura_admin

Se você tiver problemas ao executar os scripts ou precisar de mais instruções, consulte o arquivo `SOLUCAO_REGISTRO.md` para informações detalhadas. 