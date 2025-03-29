# Correção do Erro 400 ao Registrar Trocas/Quebras

## Problemas Identificados

Ao analisar o código e os logs do sistema, identificamos dois problemas principais:

1. **Erro 400 (Bad Request)** ao realizar a consulta de trocas/quebras no Supabase
2. **Erro de validação DOM** relacionado a um botão dentro de outro botão no componente de seleção de produtos

## Solução Implementada

### 1. Correção do Erro 400 no Supabase

O erro 400 (Bad Request) ocorre na consulta:

```typescript
const { data: exchangesData, error: exchangesError } = await supabase
  .from('exchanges')
  .select(`
    *,
    users!exchanges_user_id_fkey (id, name, registration)
  `)
  .order('created_at', { ascending: false });
```

**Causa**: O problema está relacionado à sintaxe da consulta aninhada que busca dados de usuários usando a notação `users!exchanges_user_id_fkey`. Esta sintaxe pode estar incorreta ou a relação pode não estar configurada corretamente no banco de dados.

**Solução implementada**:
1. Modificamos o código para fazer consultas separadas para buscar os dados de usuários:
   ```typescript
   // Primeiro, buscar as trocas/quebras
   const { data: exchangesData, error: exchangesError } = await supabase
     .from('exchanges')
     .select('*')
     .order('created_at', { ascending: false });
     
   // Para cada troca, buscar dados do usuário
   const { data: userData, error: userError } = await supabase
     .from('users')
     .select('id, name, registration')
     .eq('id', exchange.user_id)
     .single();
   ```

2. Criamos um script SQL (`corrigir_relacao_tabelas.sql`) que:
   - Diagnostica problemas nas relações entre tabelas
   - Cria uma view `exchanges_with_users` para facilitar consultas
   - Corrige políticas de RLS (Row Level Security)
   - Adiciona índices para melhorar o desempenho

### 2. Correção do Erro de Validação DOM

**Causa**: O erro "validateDOMNesting(...): <button> cannot appear as a descendant of <button>" ocorre porque no componente `ProductSelector.tsx` havia um botão dentro de outro botão (o que é inválido na estrutura HTML).

**Solução implementada**:
- Substituímos o botão interno por um elemento `<span>` com estilização similar:
  ```jsx
  <span
    className="inline-flex h-6 w-6 p-0 items-center justify-center rounded-full hover:bg-muted cursor-pointer"
    onClick={(e) => {
      e.stopPropagation();
      clearSelection();
    }}
  >
    <X className="h-3 w-3" />
  </span>
  ```

## Para Executar as Correções

### 1. Execute o Script SQL de Correção

1. Acesse o [Dashboard do Supabase](https://app.supabase.io)
2. Vá para "SQL Editor" e crie um novo script
3. Cole o conteúdo do arquivo `quebrastrocasgp/scripts/corrigir_relacao_tabelas.sql`
4. Execute o script

### 2. Reinicie a Aplicação

1. Reinicie o servidor da aplicação
2. Limpe o cache do navegador
3. Faça logout e login novamente para garantir que as mudanças sejam aplicadas

### 3. Teste o Registro de Troca/Quebra

Após realizar essas correções, você deve conseguir:
- Ver a lista de trocas/quebras no histórico
- Registrar novas trocas/quebras sem erros
- Aprovar trocas/quebras (se você for administrador)

## Verificação de Erros Adicionais

Se ainda houver erros, verifique o console do navegador (F12) para mensagens mais detalhadas.

### Logs Importantes para Monitorar

```javascript
console.log('========== INICIANDO BUSCA DE TROCAS/QUEBRAS ==========');
console.log('Usuário atual:', user);
console.log('Buscando trocas/quebras do Supabase...');
```

Estes logs ajudarão a identificar onde exatamente o processo está falhando, caso ainda haja problemas. 