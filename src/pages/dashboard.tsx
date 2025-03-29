import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, History, ClipboardCheck, Users, BarChart4 } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { exchanges, products } = useData();
  
  // Count statistics
  const pendingCount = exchanges.filter(e => e.status === 'pending').length;
  const exchangeCount = exchanges.filter(e => e.type === 'exchange').length;
  const breakageCount = exchanges.filter(e => e.type === 'breakage').length;
  
  // Get user's exchanges
  const userExchanges = exchanges.filter(e => e.userId === user?.id);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Bem-vindo, {user?.name || 'Usuário'}</h1>
        <p className="text-muted-foreground">
          Gerencie trocas, quebras, produtos e usuários do sistema
        </p>
      </div>
      
      {/* Debug Information - Temporary */}
      <div className="p-4 border rounded-md bg-muted/20">
        <h2 className="text-lg font-semibold mb-2">Informações de Depuração</h2>
        <div className="space-y-1 text-sm">
          <p><strong>ID do Usuário:</strong> {user?.id || 'Não disponível'}</p>
          <p><strong>Nome:</strong> {user?.name || 'Não disponível'}</p>
          <p><strong>Email:</strong> {user?.email || 'Não disponível'}</p>
          <p><strong>Matrícula:</strong> {user?.registration || 'Não disponível'}</p>
          <p><strong>Função:</strong> {user?.role || 'Não disponível'}</p>
          <p><strong>Status:</strong> {user?.status || 'Não disponível'}</p>
        </div>
        <div className="mt-4 pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Nota:</strong> As informações acima mostram os dados do usuário logado.
            Se a matrícula está aparecendo corretamente aqui, mas não em outro lugar do sistema,
            pode haver um problema específico nesse componente. Se não estiver aparecendo aqui,
            o problema pode estar na forma como os dados são armazenados ou recuperados.
          </p>
        </div>
      </div>
      
      {/* Feature Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Record Exchange/Breakage */}
        <Card className="card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Registrar Troca/Quebra
            </CardTitle>
            <CardDescription>
              Adicione novos registros de trocas ou quebras de produtos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Registre trocas ou quebras de produtos de forma rápida e fácil.
            </p>
            <Button asChild className="w-full">
              <Link to="/record">Registrar</Link>
            </Button>
          </CardContent>
        </Card>
        
        {/* Card 2: History */}
        <Card className="card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico
            </CardTitle>
            <CardDescription>
              Visualize seu histórico de registros de trocas e quebras
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {userExchanges.length > 0 
                ? `Você tem ${userExchanges.length} registros no histórico.` 
                : 'Nenhum registro no histórico.'}
            </p>
            <Button asChild className="w-full">
              <Link to="/history">Acessar Histórico</Link>
            </Button>
          </CardContent>
        </Card>
        
        {/* Admin Cards */}
        {isAdmin && (
          <>
            {/* Card 3: Approvals */}
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Aprovações
                </CardTitle>
                <CardDescription>
                  Aprove ou rejeite solicitações de trocas e quebras
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {pendingCount > 0 
                    ? `${pendingCount} solicitações pendentes de aprovação.` 
                    : 'Nenhuma solicitação pendente.'}
                </p>
                <Button asChild className="w-full">
                  <Link to="/approvals">Gerenciar Aprovações</Link>
                </Button>
              </CardContent>
            </Card>
            
            {/* Card 4: Products */}
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Produtos
                </CardTitle>
                <CardDescription>
                  Gerencie o catálogo de produtos disponíveis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {products.length > 0 
                    ? `${products.length} produtos cadastrados no sistema.` 
                    : 'Nenhum produto cadastrado.'}
                </p>
                <Button asChild className="w-full">
                  <Link to="/products">Gerenciar Produtos</Link>
                </Button>
              </CardContent>
            </Card>
            
            {/* Card 5: Users */}
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Usuários
                </CardTitle>
                <CardDescription>
                  Gerencie as contas de usuários do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Defina permissões e gerencie status de usuários.
                </p>
                <Button asChild className="w-full">
                  <Link to="/users">Gerenciar Usuários</Link>
                </Button>
              </CardContent>
            </Card>
            
            {/* Card 6: Reports */}
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <BarChart4 className="h-5 w-5 text-primary" />
                  Relatórios
                </CardTitle>
                <CardDescription>
                  Visualize relatórios e estatísticas do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Acesse relatórios detalhados sobre trocas e quebras.
                </p>
                <Button asChild className="w-full">
                  <Link to="/reports">Acessar Relatórios</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      
      {/* Statistics Summary */}
      {isAdmin && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Resumo</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card rounded-lg p-4 border">
              <p className="text-sm text-muted-foreground">Total de Registros</p>
              <p className="text-2xl font-bold">{exchanges.length}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border">
              <p className="text-sm text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border">
              <p className="text-sm text-muted-foreground">Quebras</p>
              <p className="text-2xl font-bold">{breakageCount}</p>
            </div>
            <div className="bg-card rounded-lg p-4 border">
              <p className="text-sm text-muted-foreground">Trocas</p>
              <p className="text-2xl font-bold">{exchangeCount}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
