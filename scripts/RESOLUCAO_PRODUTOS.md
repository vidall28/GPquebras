# Resolução do Problema: Erro ao Adicionar Produto

Este documento contém as instruções para resolver o problema de "Erro ao adicionar produto" no sistema.

## Diagnóstico do Problema

O erro ao adicionar produtos pode ocorrer por um dos seguintes motivos:

1. **Permissões insuficientes**: Apenas usuários com role 'admin' podem adicionar produtos (conforme políticas RLS do Supabase).
2. **Problemas de autenticação**: Seu usuário pode não estar sendo corretamente identificado como administrador.
3. **Erros de validação**: Problemas com os dados do produto (código duplicado, campos inválidos).

## Soluções

### 1. Verificar e Corrigir Status de Administrador

Execute o script SQL `verificar_admin.sql` no SQL Editor do Supabase:

1. Acesse o [Dashboard do Supabase](https://app.supabase.io)
2. Clique em "SQL Editor" na barra lateral
3. Crie um novo script clicando em "New Query"
4. Cole o conteúdo do arquivo `quebrastrocasgp/scripts/verificar_admin.sql`
5. Execute o script clicando em "Run"

O script irá:
- Mostrar todos os usuários existentes e seus roles
- Verificar as políticas RLS na tabela de produtos

Para promover seu usuário a administrador, descomente e modifique a linha:
```sql
SELECT promote_to_admin('00123456'); -- Substitua pelo seu número de matrícula
```

### 2. Verifique o Funcionamento da Aplicação

Após executar o script:

1. Faça logout e login novamente na aplicação
2. Verifique no console do navegador (F12) se seu usuário tem role 'admin'
3. Tente adicionar um produto novamente

### 3. Problemas Comuns e Soluções

#### "Apenas administradores podem adicionar produtos"
- Indica que seu usuário não está com role 'admin' na tabela users
- Solução: Use o script acima para definir sua role como 'admin'

#### "Erro de permissão"
- Problema com as políticas RLS no Supabase
- Verifique as políticas listadas pelo script e confirme que elas estão corretas

#### "Já existe um produto com este código"
- Código de produto duplicado
- Use um código diferente ou verifique os produtos existentes

## Verificação Adicional

Se os passos acima não resolverem, verifique se:

1. Seu token de autenticação está válido (tente fazer logout e login novamente)
2. O Supabase está acessível (verifique a conexão com a API)

## Contato para Suporte

Se o problema persistir, entre em contato com o administrador do sistema, fornecendo:
- O erro exato que aparece no console (F12)
- Sua matrícula de usuário
- Os passos que já tentou para resolver o problema 