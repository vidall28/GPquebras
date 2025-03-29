# Instruções para Resolver o Erro ao Adicionar Produto

## Problema

Quando você tenta adicionar um novo produto no sistema, aparece a mensagem "Erro ao adicionar produto".

## Causas e Soluções

Este problema geralmente ocorre devido a um dos seguintes motivos:

1. Seu usuário não tem permissão de administrador (role 'admin')
2. Há um problema na tabela de produtos (conflito de chaves)
3. A política de segurança RLS (Row Level Security) está impedindo a ação

## Passo a Passo para Resolução

### PASSO 1: Verificar e Corrigir seu Usuário Admin

1. Acesse o [Dashboard do Supabase](https://app.supabase.io)
2. Selecione seu projeto
3. Clique em "SQL Editor" na barra lateral
4. Crie um novo script clicando em "New Query"
5. Cole o conteúdo do arquivo `quebrastrocasgp/scripts/fix_admin_login.sql`
6. Execute o script clicando em "Run"

Este script irá:
- Verificar se o usuário admin com email 'vidalkaique.az@gmail.com' existe
- Criar ou atualizar o usuário admin com as permissões corretas
- Exibir a lista de produtos existentes para verificar possíveis duplicidades

### PASSO 2: Fazer Logout e Login Novamente

1. Saia do sistema (logout)
2. Faça login novamente com as seguintes credenciais:
   - Email: vidalkaique.az@gmail.com
   - Senha: senha_segura_admin

### PASSO 3: Tentar Adicionar Produto Novamente

1. Vá para a página de Produtos
2. Clique no botão "Novo Produto"
3. Preencha todos os campos:
   - **Nome**: Nome do produto (ex: "Água Mineral 500ml")
   - **Código**: Código único do produto (ex: "AGUA500")
   - **Capacidade**: Capacidade em ml (ex: "500")
4. Clique em "Adicionar Produto"

### PASSO 4: Se o Problema Persistir

Se após seguir os passos acima o erro persistir:

1. Abra o console do navegador (pressione F12 e vá para a aba "Console")
2. Tente adicionar um produto e observe os erros detalhados no console
3. Execute o arquivo `quebrastrocasgp/scripts/verificar_admin.sql` para diagnóstico adicional

## Erros Específicos e Soluções

### "Erro de permissão" ou "Apenas administradores podem adicionar produtos"

Este erro ocorre quando seu usuário não está configurado como administrador no sistema.

**Solução**: Execute o script `fix_admin_login.sql` conforme descrito no Passo 1.

### "Já existe um produto com este código"

Este erro ocorre quando você tenta cadastrar um produto com um código que já existe.

**Solução**: Use um código diferente para o produto ou verifique a lista de produtos existentes (o script `fix_admin_login.sql` mostra esses produtos).

### Erro técnico (no console do navegador)

Se aparecer um erro técnico no console do navegador, como:
- Erro 42501 (permissão negada)
- Erro 23505 (violação de chave única)

**Solução**: Faça uma captura de tela do erro e execute o script `verificar_admin.sql` para diagnóstico completo.

## Contato para Suporte

Se você seguiu todas as etapas acima e ainda está tendo problemas, entre em contato com o suporte técnico fornecendo:
- Captura de tela do erro no console do navegador
- Resultado da execução do script `verificar_admin.sql`
- Descrição exata dos passos que você seguiu 