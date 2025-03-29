# Correção do Erro no Script SQL

## Problema Encontrado

Ao executar o script SQL original `corrigir_rls_trocas.sql`, ocorreu o seguinte erro:

```
ERROR: 42601: syntax error at or near "\"
LINE 20: \d exchanges
         ^
```

## Causa do Erro

O erro ocorreu porque o comando `\d exchanges` é um comando específico do cliente PostgreSQL `psql` e não uma instrução SQL padrão reconhecida pelo SQL Editor do Supabase.

## Solução

Dividimos o script original em três partes menores e mais focadas, substituindo os comandos específicos do `psql` por consultas SQL padrão compatíveis com o Supabase SQL Editor:

1. **corrigir_parte1.sql**: Diagnóstico - verifica a estrutura da tabela, políticas existentes e registros
2. **corrigir_parte2.sql**: Correção - remove políticas existentes e cria novas com as permissões corretas
3. **corrigir_parte3_teste.sql**: Teste - verifica se as políticas corrigidas estão funcionando

## Como Executar os Scripts

Siga estas etapas para corrigir o problema das aprovações:

### 1. Diagnóstico Inicial

1. Acesse o painel do Supabase (https://app.supabase.com)
2. Navegue até o Editor SQL da sua organização/projeto
3. Crie uma nova consulta
4. Cole o conteúdo do arquivo `corrigir_parte1.sql`
5. Execute a consulta e analise os resultados para entender o estado atual

### 2. Aplicar Correções

1. Crie uma nova consulta no Editor SQL
2. Cole o conteúdo do arquivo `corrigir_parte2.sql`
3. Execute a consulta para remover as políticas antigas e criar as novas
4. Verifique na parte final da execução se as políticas foram criadas corretamente

### 3. Testar as Correções

1. Crie uma nova consulta no Editor SQL
2. Cole o conteúdo do arquivo `corrigir_parte3_teste.sql`
3. Execute a consulta para testar a atualização de uma troca pendente
4. Verifique o resultado da atualização e as novas contagens de registros por status

## Verificação na Aplicação

Após executar os scripts, você deve:

1. Retornar à aplicação e limpar o cache do navegador (Ctrl+F5)
2. Tentar aprovar ou rejeitar uma troca/quebra
3. Verificar se:
   - A mensagem de sucesso aparece
   - O item desaparece da lista de pendentes
   - O item aparece na seção de aprovados/rejeitados

## Notas Importantes

- Os scripts foram projetados para serem executados em sequência (1, 2, 3)
- Se você encontrar qualquer outro erro durante a execução, verifique as mensagens de erro para identificar o problema específico
- O uso de `RAISE NOTICE` nos scripts SQL pode não mostrar as mensagens no SQL Editor do Supabase, mas o processamento ainda ocorre

## Suporte Adicional

Se você continuar enfrentando problemas após aplicar estas correções, consulte o documento `README_CORRECAO_APROVACOES.md` para uma explicação técnica mais detalhada ou entre em contato com a equipe de suporte técnico. 