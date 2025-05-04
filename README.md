# Sistema de Gestão de Trocas e Quebras

Aplicação para gerenciamento de quebras e trocas de produtos, permitindo registrar, acompanhar e aprovar solicitações.

## Tecnologias

- React 18.x
- TypeScript
- Vite
- React Router
- React Query
- Shadcn/UI
- Tailwind CSS
- Supabase (Autenticação e Banco de Dados)

## Requisitos

- Node.js 18 ou superior
- NPM ou Yarn
- Conta no Supabase

## Configuração do Supabase

1. Crie uma conta gratuita no [Supabase](https://supabase.com/).
2. Crie um novo projeto.
3. Anote a URL e a Chave Anônima do projeto (encontradas em Project Settings > API).
4. Crie um arquivo `.env` na raiz do projeto com base no `.env.example`:

```bash
# Supabase
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anon_do_supabase
```

5. Execute o script SQL para criar o esquema do banco de dados:
   - Copie o conteúdo do arquivo `scripts/supabase-schema.sql`
   - No Supabase, vá para SQL Editor e cole o script
   - Execute o script para criar todas as tabelas e políticas de segurança

6. Configurar o primeiro usuário administrador:
   - Adicione as seguintes variáveis ao arquivo `.env`:

```bash
SUPABASE_SERVICE_KEY=sua_chave_service_role # Encontrada em Settings > API > service_role
ADMIN_EMAIL=email_do_admin
ADMIN_PASSWORD=senha_do_admin
ADMIN_NAME=nome_do_admin
ADMIN_REGISTRATION=matricula_do_admin # 8 dígitos
```

   - Execute o script para criar o administrador:

```bash
npm run create-admin
```

## Instalação e Execução

1. Clone o repositório:

```bash
git clone https://github.com/seu-usuario/quebrastrocasgp.git
cd quebrastrocasgp
```

2. Instale as dependências:

```bash
npm install
# ou
yarn install
```

3. Execute o projeto em modo de desenvolvimento:

```bash
npm run dev
# ou
yarn dev
```

A aplicação estará disponível em `http://localhost:5173`

## Estrutura do Projeto

```
quebrastrocasgp/
├── public/
├── scripts/
│   ├── create-admin.js        # Script para criar usuário admin
│   └── supabase-schema.sql    # Esquema SQL do Supabase
├── src/
│   ├── components/            # Componentes reutilizáveis
│   ├── context/               # Contextos do React (Auth, Data)
│   ├── hooks/                 # Custom hooks
│   ├── lib/                   # Bibliotecas e utilitários
│   │   ├── supabase.ts        # Cliente e tipos do Supabase
│   │   └── toast.ts           # Utilitário de notificações
│   ├── pages/                 # Páginas da aplicação
│   └── utils/                 # Funções utilitárias
├── .env.example               # Exemplo de variáveis de ambiente
├── package.json
└── README.md
```

## Recursos

- Autenticação com Supabase
- Gerenciamento de usuários (admin)
- Registro de quebras e trocas de produtos
- Visualização de histórico de registros
- Aprovação/rejeição de solicitações
- Cadastro e gestão de produtos
- Relatórios

## Licença

Este projeto está licenciado sob a licença MIT.


