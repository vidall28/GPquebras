# Correção de Problemas com Produtos

## Descrição do Problema

Foi identificado um problema que impede administradores de atualizar ou excluir produtos no sistema. Mesmo com as permissões corretas, as ações de editar ou excluir produtos não estão funcionando como esperado.

## Causas Possíveis

1. **Políticas RLS incorretas ou ausentes**: As políticas de segurança por linha (Row Level Security) podem estar mal configuradas no Supabase, impedindo as operações de UPDATE e DELETE.

2. **Problema com permissões de usuário**: O usuário atual pode não ter o papel de 'admin' corretamente configurado no banco de dados.

3. **Bloqueio devido a integridade referencial**: Pode haver registros em `exchange_items` referenciando os produtos, impedindo sua exclusão.

4. **Problemas de sessão no Supabase**: A sessão do usuário pode não estar transmitindo corretamente as credenciais de administrador.

## Solução

Para resolver este problema, foram criados scripts de diagnóstico e correção que devem ser executados na ordem a seguir:

### 1. Executar o script de diagnóstico e correção

Execute o script `verificar_corrigir_produtos.sql` no SQL Editor do Supabase. Este script:

- Verifica se o usuário atual é administrador
- Lista todas as políticas RLS existentes para produtos
- Recria as políticas RLS para garantir configuração correta
- Testa as permissões de edição e exclusão
- Identifica produtos em uso por trocas (que não podem ser excluídos)

### 2. Verificar e corrigir o papel do usuário

Se o script indicar que você não tem permissões de administrador, execute o seguinte comando (substituindo `SEU_ID` pelo ID exibido no script):

```sql
UPDATE public.users SET role = 'admin' WHERE id = 'SEU_ID';
```

### 3. Limpar o cache do navegador

Após executar as correções:

1. Pressione Ctrl+Shift+Del para abrir a janela de limpeza de cache
2. Selecione "Cookies e dados do site"
3. Marque "Cookies e dados do site" e "Imagens e arquivos em cache"
4. Limpe os dados
5. Feche completamente o navegador e abra novamente
6. Faça login novamente no sistema

### 4. Tentar editar ou excluir produtos

Agora você deve conseguir editar e excluir produtos normalmente, desde que:
- Você esteja com a função de admin corretamente configurada
- O produto não esteja sendo usado em nenhuma troca/quebra

## Nota sobre exclusão de produtos em uso

Se um produto estiver sendo usado em alguma troca/quebra, não será possível excluí-lo para manter a integridade referencial. Nestes casos, você verá a mensagem: "Não é possível excluir este produto pois ele está sendo usado em registros de trocas".

## Suporte adicional

Se os problemas persistirem, por favor consulte o log de console (F12 > Console) para verificar mensagens de erro específicas e entre em contato com o suporte técnico, informando:

1. O ID do seu usuário
2. O papel (role) mostrado pelo script
3. Qualquer mensagem de erro exibida no console
4. A ação específica que falhou (edição ou exclusão) 