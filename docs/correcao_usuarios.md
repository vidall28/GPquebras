# Correção de Problemas com Gerenciamento de Usuários

## Descrição do Problema

Foi identificado um problema que impede administradores de gerenciar usuários no sistema. As seguintes operações estavam falhando:

1. **Alteração de status de usuários** (ativar/desativar)
2. **Promoção de usuários para administrador**
3. **Exclusão de usuários**

Mesmo quando o usuário atual tem permissões de administrador, essas operações não funcionavam corretamente.

## Causas Identificadas

1. **Políticas RLS incorretas ou ausentes**: As políticas de segurança por linha (Row Level Security) para a tabela `users` podem estar mal configuradas no Supabase.

2. **Problema com permissões**: As permissões para a role `service_role` ou para usuários administradores podem estar faltando ou estar configuradas incorretamente.

3. **Implementação incompleta**: A função `deleteUser` estava mencionada no código, mas não estava completamente implementada.

4. **Tratamento inadequado de erros**: As funções não forneciam informações detalhadas sobre falhas durante as operações.

## Soluções Implementadas

### 1. Script SQL para diagnóstico e correção de permissões

Foi criado o script `verificar_corrigir_usuarios.sql` que:

- Verifica se o usuário atual tem papel de administrador
- Lista todas as políticas RLS existentes para a tabela `users`
- Recria corretamente as políticas RLS para garantir permissões adequadas
- Adiciona permissão explícita para a role `service_role` operar na tabela `users`
- Testa operações de atualização para identificar problemas

### 2. Melhorias no código da aplicação

#### 2.1 Funções de atualização aprimoradas

As funções `updateUserStatus` e `updateUserRole` foram aprimoradas com:

- Verificação explícita de permissões de administrador
- Logs de diagnóstico detalhados no console
- Tratamento específico para diferentes tipos de erros
- Mensagens de erro mais informativas para o usuário

#### 2.2 Implementação completa da exclusão de usuários

A função `deleteUser` foi completamente implementada com:

- Verificação se o usuário atual é administrador
- Verificação se está tentando excluir o próprio usuário (não permitido)
- Verificação se o usuário tem trocas/quebras associadas
- Validações de integridade referencial
- Tratamento de erros detalhado

### 3. Atualização da interface de usuário

O componente `Users` foi atualizado para utilizar a nova função `deleteUser` implementada, substituindo o comportamento anterior que apenas mostrava uma mensagem informativa.

## Como Verificar a Correção

1. Execute o script `verificar_corrigir_usuarios.sql` no SQL Editor do Supabase para corrigir as políticas de segurança
2. Limpe o cache do navegador (Ctrl+Shift+Del)
3. Faça login novamente no sistema como administrador
4. Acesse a página de Usuários
5. Tente alterar o status de um usuário (ativar/desativar)
6. Tente alterar o papel de um usuário (promover/rebaixar)
7. Tente excluir um usuário que não possui trocas/quebras associadas

## Limitações

- Não é possível excluir um usuário que possui trocas/quebras associadas
- Não é possível excluir o próprio usuário atual
- Apenas administradores podem gerenciar outros usuários

## Suporte adicional

Se os problemas persistirem, consulte o console do navegador (F12 > Console) para verificar mensagens de erro detalhadas que foram adicionadas ao código.

Caso necessário, entre em contato com o suporte técnico informando:
1. O ID do seu usuário
2. O papel (role) mostrado no script de diagnóstico
3. Qualquer mensagem de erro exibida no console
4. A ação específica que falhou (ativação, promoção ou exclusão) 