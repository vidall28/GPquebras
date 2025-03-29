#!/bin/bash

# Este script executa as migrações SQL no banco de dados Supabase

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Mensagem de uso
usage() {
  echo -e "Uso: $0 [opções]"
  echo -e "Opções:"
  echo -e "  -u, --url URL      URL do projeto Supabase (obrigatório)"
  echo -e "  -k, --key KEY      Chave de serviço do projeto Supabase (obrigatório)"
  echo -e "  -f, --file FILE    Arquivo SQL específico para executar (opcional)"
  echo -e "  -h, --help         Mostra esta mensagem de ajuda"
  exit 1
}

# Verificar se as dependências estão instaladas
check_dependencies() {
  if ! command -v curl &> /dev/null; then
    echo -e "${RED}Erro: curl não está instalado. Por favor, instale-o e tente novamente.${NC}"
    exit 1
  fi
}

# Executar uma migração
run_migration() {
  local file=$1
  local url=$2
  local key=$3
  
  echo -e "${YELLOW}Executando migração: ${file}${NC}"
  
  # Ler conteúdo do arquivo
  local sql_content=$(cat "$file")
  
  # Executar SQL via REST API
  local response=$(curl -s -X POST "${url}/rest/v1/rpc/pg_query" \
    -H "apikey: ${key}" \
    -H "Authorization: Bearer ${key}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"${sql_content}\"}")
  
  # Verificar se ocorreu erro
  if [[ $response == *"error"* ]]; then
    echo -e "${RED}Erro ao executar migração ${file}:${NC}"
    echo -e "${RED}${response}${NC}"
    return 1
  else
    echo -e "${GREEN}Migração ${file} executada com sucesso!${NC}"
    return 0
  fi
}

# Inicializar variáveis
SUPABASE_URL=""
SUPABASE_KEY=""
SPECIFIC_FILE=""

# Parse argumentos
while [[ $# -gt 0 ]]; do
  case $1 in
    -u|--url)
      SUPABASE_URL="$2"
      shift 2
      ;;
    -k|--key)
      SUPABASE_KEY="$2"
      shift 2
      ;;
    -f|--file)
      SPECIFIC_FILE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo -e "${RED}Opção desconhecida: $1${NC}"
      usage
      ;;
  esac
done

# Verificar se os parâmetros obrigatórios foram fornecidos
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo -e "${RED}Erro: URL e KEY do Supabase são obrigatórios${NC}"
  usage
fi

# Verificar dependências
check_dependencies

# Diretório onde estão os scripts SQL
SCRIPTS_DIR="$(dirname "$0")"

# Executar migrações
if [ -n "$SPECIFIC_FILE" ]; then
  # Executar arquivo específico
  if [ -f "$SPECIFIC_FILE" ]; then
    run_migration "$SPECIFIC_FILE" "$SUPABASE_URL" "$SUPABASE_KEY"
    if [ $? -ne 0 ]; then
      exit 1
    fi
  else
    echo -e "${RED}Erro: Arquivo $SPECIFIC_FILE não encontrado${NC}"
    exit 1
  fi
else
  # Executar todos os arquivos .sql no diretório de scripts
  echo -e "${YELLOW}Executando todas as migrações...${NC}"
  
  # Ordem específica para garantir que tabelas sejam criadas antes das funções
  # Primeiro criar tabelas
  for file in "$SCRIPTS_DIR"/create_*_table.sql; do
    if [ -f "$file" ]; then
      run_migration "$file" "$SUPABASE_URL" "$SUPABASE_KEY"
      if [ $? -ne 0 ]; then
        echo -e "${RED}Erro ao executar migração. Abortando.${NC}"
        exit 1
      fi
    fi
  done
  
  # Depois executar funções e outros scripts
  for file in "$SCRIPTS_DIR"/*.sql; do
    # Pular arquivos que já foram executados (criação de tabelas)
    if [[ $file != *"create_"*"_table.sql" ]]; then
      if [ -f "$file" ]; then
        run_migration "$file" "$SUPABASE_URL" "$SUPABASE_KEY"
        if [ $? -ne 0 ]; then
          echo -e "${RED}Erro ao executar migração. Abortando.${NC}"
          exit 1
        fi
      fi
    fi
  done
fi

echo -e "${GREEN}Migrações concluídas com sucesso!${NC}"
exit 0 