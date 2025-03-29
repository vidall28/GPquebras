# Solução para Problema: Trocas/Quebras Não Aparecem nas Listas

## Problema

Ao registrar uma troca/quebra no sistema, ela não aparece nas seções de:
- Histórico
- Aprovações
- Relatórios

## Causas do Problema

Após análise, identificamos que o problema pode ser causado por:

1. **Políticas RLS (Row Level Security)** configuradas incorretamente, impedindo a visualização dos registros
2. **Problemas na relação entre tabelas** de trocas, itens e fotos
3. **Cache do navegador** mantendo dados desatualizados

## Solução Passo a Passo

### 1. Execute o Script de Correção

Este script irá diagnosticar e corrigir as políticas RLS:

1. Acesse o [Dashboard do Supabase](https://app.supabase.io)
2. Clique em "SQL Editor" na barra lateral
3. Crie um novo script clicando em "New Query"
4. Cole o conteúdo do arquivo `quebrastrocasgp/scripts/corrigir_trocas.sql`
5. Execute o script clicando em "Run"

O script irá:
- Verificar quantas trocas/quebras existem no sistema
- Corrigir as políticas RLS para todos os objetos relacionados a trocas
- Identificar possíveis registros com problemas (sem itens ou sem fotos)

### 2. Verifique os Resultados do Script

Após executar o script, você verá na tela:
- Diagnóstico das trocas/quebras existentes
- Novas políticas RLS aplicadas
- Lista de trocas com possíveis problemas

Analise esses resultados para entender a situação atual.

### 3. Reinicie a Aplicação e Limpe o Cache

1. Saia da aplicação (faça logout)
2. Limpe o cache do navegador:
   - Chrome/Edge: Pressione Ctrl+Shift+Delete
   - Firefox: Pressione Ctrl+Shift+Delete
   - Selecione "Limpar dados de navegação" incluindo cookies e cache
3. Feche o navegador completamente
4. Abra novamente e faça login

### 4. Teste a Visibilidade das Trocas

Após fazer login novamente:
1. Verifique a seção "Histórico" para ver se as trocas/quebras aparecem
2. Se você é administrador, verifique também a seção "Aprovações"
3. Tente registrar uma nova troca/quebra e confirme se ela aparece nas listas

### 5. Solução para Problemas Específicos

#### Se algumas trocas aparecem e outras não:

Pode haver problemas específicos com certos registros. No SQL Editor, execute:

```sql
-- Verificar detalhes de uma troca específica
SELECT 
  e.id, e.label, e.type, e.status, e.user_id,
  COUNT(i.id) as num_items,
  COUNT(p.id) as num_photos
FROM 
  public.exchanges e
LEFT JOIN 
  public.exchange_items i ON e.id = i.exchange_id
LEFT JOIN 
  public.exchange_photos p ON i.id = p.exchange_item_id
WHERE 
  e.id = 'ID_DA_TROCA' -- Substitua pelo ID da troca
GROUP BY 
  e.id, e.label, e.type, e.status, e.user_id;
```

#### Se nenhuma troca aparece:

Verifique o console do navegador (F12) para ver se há erros durante o carregamento. Problemas comuns incluem:
- Erros de CORS
- Problemas de autenticação
- Falhas na busca de dados do Supabase

## Verificação dos Consoles

### Console do Navegador
1. Abra as ferramentas de desenvolvedor (F12)
2. Vá para a aba "Console"
3. Observe erros relacionados a operações de busca ou permissões

### Logs do Supabase
1. No Dashboard do Supabase, vá para "Database" > "Logs"
2. Procure por erros relacionados às tabelas: `exchanges`, `exchange_items` ou `exchange_photos`

## Contato para Suporte

Se você seguiu todas as etapas acima e ainda está com problemas, forneça:
- Capturas de tela do console do navegador
- Resultados do script de diagnóstico
- ID de um registro específico que não está aparecendo 