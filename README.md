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

# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/ab9e6e6a-8741-4efa-b447-831fa39070c4

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/ab9e6e6a-8741-4efa-b447-831fa39070c4) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with .

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/ab9e6e6a-8741-4efa-b447-831fa39070c4) and click on Share -> Publish.

## I want to use a custom domain - is that possible?

We don't support custom domains (yet). If you want to deploy your project under your own domain then we recommend using Netlify. Visit our docs for more details: [Custom domains](https://docs.lovable.dev/tips-tricks/custom-domain/)
