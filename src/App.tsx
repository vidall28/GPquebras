import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { AppLayout } from "@/components/Layout/AppLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

// Interface para as props das rotas administrativas
interface AdminRouteProps {
  children: React.ReactNode;
}

// Interface para as props das rotas protegidas
interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Pages
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import RecordExchange from "@/pages/record-exchange";
import History from "@/pages/history";
import Approvals from "@/pages/approvals";
import Products from "@/pages/products";
import Users from "@/pages/users";
import Reports from "@/pages/reports";
import NotFound from "@/pages/NotFound";
import Diagnostics from "@/pages/diagnostics";
import CategoryEdit from '@/pages/categories/edit';
import CategoriesList from '@/pages/categories/list';
import DiagnosticsPage from '@/pages/diagnostics';
import NotificationsPage from "@/pages/notifications";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Componente de carregamento
const LoadingScreen = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="flex flex-col items-center space-y-4">
      <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      <h2 className="text-2xl font-medium text-foreground">{message}</h2>
    </div>
  </div>
);

// Componente de recuperação para erros críticos
const RecoveryMode = () => {
  const clearAndReload = () => {
    localStorage.removeItem('recovery_mode');
    const authToken = localStorage.getItem('sb-auth-token');
    localStorage.clear();
    if (authToken) {
      localStorage.setItem('sb-auth-token', authToken);
    }
    window.location.reload();
  };
  
  const clearAndLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  };
  
  const goToDiagnostics = () => {
    window.location.href = '/diagnostico';
  };
  
  const errorInfo = localStorage.getItem('last_error') || 'Erro desconhecido';
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="w-full max-w-md p-6 bg-white border rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-2 text-destructive">Modo de Recuperação</h1>
        <p className="mb-4 text-muted-foreground">
          Detectamos um problema ao renderizar a aplicação. Escolha uma opção abaixo:
        </p>
        
        <div className="bg-muted p-3 rounded text-xs mb-4">
          <p className="font-mono break-all">{errorInfo}</p>
        </div>
        
        <div className="space-y-2">
          <button 
            className="w-full px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
            onClick={clearAndReload}
          >
            Limpar Cache e Recarregar
          </button>
          
          <button 
            className="w-full px-4 py-2 bg-secondary text-primary rounded hover:bg-secondary/90"
            onClick={goToDiagnostics}
          >
            Página de Diagnóstico
          </button>
          
          <button 
            className="w-full px-4 py-2 bg-destructive text-white rounded hover:bg-destructive/90"
            onClick={clearAndLogout}
          >
            Sair e Reconectar
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente para rota protegida
const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const auth = useAuth();
  
  if (auth.isLoading) {
    return <LoadingScreen message="Verificando permissões..." />;
  }
  
  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Componente para rotas administrativas
const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen message="Verificando permissões administrativas..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    toast.error('Acesso restrito a administradores');
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Componente de conteúdo da aplicação com rotas
const AppContent = () => (
  <Router>
    <AuthProvider>
      <DataProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={
            <ErrorBoundary>
              <Login />
            </ErrorBoundary>
          } />
          <Route path="/register" element={
            <ErrorBoundary>
              <Register />
            </ErrorBoundary>
          } />
          <Route path="/diagnostico" element={<DiagnosticsPage />} />
          
          {/* Redirect root to login or dashboard based on auth */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* Protected Routes com ErrorBoundary para o AppLayout */}
          <Route path="/" element={
            <ErrorBoundary>
              <AppLayout />
            </ErrorBoundary>
          }>
            <Route 
              path="dashboard" 
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <Dashboard />
                  </ErrorBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="record" 
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <RecordExchange />
                  </ErrorBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="history" 
              element={
                <ProtectedRoute>
                  <History />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="approvals" 
              element={
                <ProtectedRoute>
                  <Approvals />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="products" 
              element={
                <AdminRoute>
                  <Products />
                </AdminRoute>
              } 
            />
            <Route 
              path="users" 
              element={
                <AdminRoute>
                  <Users />
                </AdminRoute>
              } 
            />
            <Route 
              path="reports" 
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="notifications" 
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              } 
            />
          </Route>
          
          {/* 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </DataProvider>
    </AuthProvider>
  </Router>
);

// Componente principal com verificação de modo de recuperação
const SafeAppContent = () => {
  // Verificar se estamos em modo de recuperação
  const isRecoveryMode = localStorage.getItem('recovery_mode') === 'true';
  
  // Em modo de recuperação, mostrar interface simplificada
  if (isRecoveryMode) {
    return <RecoveryMode />;
  }
  
  // Renderização normal se não estiver em modo de recuperação
  return <AppContent />;
};

// Componente principal da aplicação
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ErrorBoundary>
        <SafeAppContent />
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
