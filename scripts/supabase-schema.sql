-- Criar tabela de usuários
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  registration TEXT NOT NULL UNIQUE,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Criar índice para busca rápida por matrícula
CREATE INDEX IF NOT EXISTS idx_users_registration ON public.users(registration);

-- Criar índice para busca por email
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Configurar RLS (Row Level Security) para a tabela users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Política para permitir que qualquer usuário autenticado leia todos os usuários
CREATE POLICY "Users can view all users" ON public.users
  FOR SELECT TO authenticated USING (true);

-- Política para permitir que apenas admins modifiquem usuários (corrigido)
CREATE POLICY "Only admins can insert users" ON public.users
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Only admins can update users" ON public.users
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Criar tabela de produtos
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Configurar RLS para a tabela products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Política para permitir que qualquer usuário autenticado leia produtos
CREATE POLICY "Users can view all products" ON public.products
  FOR SELECT TO authenticated USING (true);

-- Política para permitir que apenas admins insiram produtos (corrigido)
CREATE POLICY "Only admins can insert products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para permitir que apenas admins atualizem produtos
CREATE POLICY "Only admins can update products" ON public.products
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para permitir que apenas admins excluam produtos
CREATE POLICY "Only admins can delete products" ON public.products
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Criar tabela de trocas/quebras
CREATE TABLE IF NOT EXISTS public.exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('exchange', 'breakage')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  updated_by UUID REFERENCES public.users(id)
);

-- Configurar RLS para a tabela exchanges
ALTER TABLE public.exchanges ENABLE ROW LEVEL SECURITY;

-- Política para permitir que qualquer usuário autenticado leia trocas
CREATE POLICY "Users can view all exchanges" ON public.exchanges
  FOR SELECT TO authenticated USING (true);

-- Política para permitir que usuários criem suas próprias trocas (corrigido)
CREATE POLICY "Users can create their own exchanges" ON public.exchanges
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Política para permitir que apenas admins atualizem qualquer troca
CREATE POLICY "Only admins can update any exchange" ON public.exchanges
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para permitir que usuários comuns atualizem apenas suas próprias trocas pendentes
CREATE POLICY "Users can update their own pending exchanges" ON public.exchanges
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid() AND status = 'pending'
  );

-- Política para permitir que apenas admins excluam trocas
CREATE POLICY "Only admins can delete exchanges" ON public.exchanges
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Criar tabela de itens de troca
CREATE TABLE IF NOT EXISTS public.exchange_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id UUID NOT NULL REFERENCES public.exchanges(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Configurar RLS para a tabela exchange_items
ALTER TABLE public.exchange_items ENABLE ROW LEVEL SECURITY;

-- Política para permitir que qualquer usuário autenticado leia itens de troca
CREATE POLICY "Users can view all exchange items" ON public.exchange_items
  FOR SELECT TO authenticated USING (true);

-- Política para permitir que usuários criem itens para suas próprias trocas (corrigido)
CREATE POLICY "Users can create items for their own exchanges" ON public.exchange_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exchanges
      WHERE id = exchange_id AND user_id = auth.uid()
    )
  );

-- Política para permitir que apenas admins excluam itens de troca
CREATE POLICY "Only admins can delete exchange items" ON public.exchange_items
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Criar tabela de fotos de itens de troca
CREATE TABLE IF NOT EXISTS public.exchange_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_item_id UUID NOT NULL REFERENCES public.exchange_items(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Configurar RLS para a tabela exchange_photos
ALTER TABLE public.exchange_photos ENABLE ROW LEVEL SECURITY;

-- Política para permitir que qualquer usuário autenticado leia fotos
CREATE POLICY "Users can view all exchange photos" ON public.exchange_photos
  FOR SELECT TO authenticated USING (true);

-- Política para permitir que usuários adicionem fotos aos seus próprios itens (corrigido)
CREATE POLICY "Users can add photos to their own exchange items" ON public.exchange_photos
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exchange_items ei
      JOIN public.exchanges e ON ei.exchange_id = e.id
      WHERE ei.id = exchange_item_id AND e.user_id = auth.uid()
    )
  );

-- Política para permitir que apenas admins excluam fotos
CREATE POLICY "Only admins can delete exchange photos" ON public.exchange_photos
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Função para verificar se um usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Criar bucket de Storage para fotos, se necessário
-- (Isso deve ser feito manualmente no console do Supabase, 
-- mas deixamos aqui como lembrete) 