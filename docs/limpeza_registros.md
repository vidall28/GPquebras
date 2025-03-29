# Guia para Limpeza de Registros de Trocas/Quebras

## ATENÇÃO: PROCEDIMENTO IRREVERSÍVEL

As instruções neste documento descrevem como excluir registros de trocas/quebras no sistema. Estas operações são **IRREVERSÍVEIS** e os dados excluídos não poderão ser recuperados a menos que você tenha um backup.

## 1. Por que excluir registros?

A exclusão de registros pode ser necessária em algumas situações:

- Necessidade de remover produtos que estão sendo referenciados em trocas/quebras
- Limpeza de dados em ambiente de testes
- Correção de registros incorretos ou duplicados

## 2. Opções disponíveis

Existem duas opções para excluir registros:

### 2.1. Excluir registros específicos de um produto

Use esta opção quando quiser remover apenas as trocas/quebras relacionadas a um produto específico.

1. Abra o SQL Editor no Supabase
2. Abra o arquivo `limpar_registros_produto.sql`
3. Substitua `'CODIGO_DO_PRODUTO'` pelo código do produto que deseja limpar
4. Execute o script - ele mostrará quais registros serão afetados
5. Revise a lista de registros que serão excluídos
6. Se estiver seguro, remova os comentários `/*...*/` do código
7. Execute o script novamente para fazer a exclusão efetiva

### 2.2. Excluir TODOS os registros

Use esta opção apenas quando quiser limpar completamente o sistema de todos os registros de trocas/quebras.

**ATENÇÃO: Esta opção excluirá TODOS os registros históricos!**

1. Abra o SQL Editor no Supabase
2. Abra o arquivo `limpar_todos_registros.sql`
3. Execute o script - ele mostrará quantos registros serão afetados
4. Revise os números e certifique-se de que realmente deseja prosseguir
5. Se estiver absolutamente seguro, remova os comentários `/*...*/` do código
6. Execute o script novamente para fazer a exclusão efetiva

## 3. Considerações importantes

Antes de executar qualquer um desses scripts, considere:

- **Backup**: Faça um backup completo do banco de dados antes de executar
- **Impacto**: Uma vez excluídos, os dados de trocas/quebras são perdidos para sempre
- **Usuários**: Certifique-se de que nenhum usuário esteja usando o sistema durante a exclusão
- **Alternativas**: Avaliar a possibilidade de marcar produtos como "Descontinuados" em vez de excluí-los

## 4. Após a exclusão

Depois de executar a limpeza:

1. Verifique se a exclusão de produtos agora funciona corretamente
2. Notifique outros usuários sobre a limpeza realizada
3. Monitore o sistema para garantir que tudo continue funcionando corretamente

## 5. Suporte

Se tiver dúvidas ou precisar de ajuda durante este processo, entre em contato com o suporte técnico antes de executar qualquer script. 