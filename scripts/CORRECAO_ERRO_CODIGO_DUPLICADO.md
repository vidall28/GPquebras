# Correção do Erro de Coluna Duplicada no Script SQL

## Erro Encontrado

Ao executar o script `corrigir_relacao_tabelas.sql`, você encontrou o seguinte erro:

```
ERROR: 42701: column "user_id" specified more than once
```

## Causa do Problema

Este erro ocorre porque na criação da view `exchanges_with_users`, estávamos duplicando a coluna `user_id`:

1. A cláusula `e.*` já incluía a coluna `user_id` da tabela `exchanges`
2. E depois adicionávamos `u.id as user_id` novamente

```sql
-- Código original com problema
CREATE VIEW exchanges_with_users AS
SELECT 
  e.*,              -- Já inclui e.user_id
  u.id as user_id,  -- Duplicação da coluna user_id
  u.name as user_name,
  u.registration as user_registration
FROM 
  exchanges e
LEFT JOIN 
  users u ON e.user_id = u.id;
```

O PostgreSQL (que é o banco usado pelo Supabase) não permite que uma view contenha colunas com o mesmo nome.

## Solução Aplicada

Modificamos o script para listar explicitamente todas as colunas que queremos incluir na view, evitando a duplicação:

```sql
-- Código corrigido
CREATE VIEW exchanges_with_users AS
SELECT 
  e.id,
  e.label,
  e.type,
  e.status,
  e.notes,
  e.created_at,
  e.updated_at,
  e.updated_by,
  e.user_id,        -- Mantém apenas uma coluna user_id
  u.name as user_name,
  u.registration as user_registration
FROM 
  exchanges e
LEFT JOIN 
  users u ON e.user_id = u.id;
```

## Como Usar o Script Corrigido

1. O script corrigido está disponível em `quebrastrocasgp/scripts/corrigir_relacao_tabelas.sql`
2. Execute este script no SQL Editor do Supabase
3. Você não deve mais receber o erro de coluna duplicada

## Efeitos da Correção

Esta correção permitirá:

1. Criar a view `exchanges_with_users` com sucesso
2. Usar a view para consultar trocas/quebras com detalhes dos usuários
3. Completar o restante do script para corrigir as políticas RLS

## Verificação do Sucesso

Após executar o script corrigido, você pode verificar se a view foi criada corretamente executando:

```sql
SELECT * FROM exchanges_with_users LIMIT 5;
```

Você também pode testar se consegue registrar novas trocas/quebras na aplicação e visualizá-las no histórico após esta correção.

## Próximos Passos

Depois de corrigir este erro:

1. Limpe o cache do navegador
2. Faça logout e login novamente na aplicação
3. Tente registrar uma nova troca/quebra
4. Verifique se ela aparece na seção de histórico

Se você continuar encontrando problemas, verifique o console do navegador (F12) para mais detalhes sobre os erros. 