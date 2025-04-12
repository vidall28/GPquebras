import React, { useState, useEffect } from 'react';
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
import { supabase } from '@/lib/supabase'; // Importar supabase

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
  const location = useLocation();

  // Espera AuthProvider terminar sua própria carga interna SE AINDA estiver carregando
  // A carga inicial GERAL da sessão já foi feita pelo AppInitializer
  if (auth.isLoading) {
    console.log('[ProtectedRoute] Auth context is loading...');
    return <LoadingScreen message="Verificando permissões..." />;
  }

  if (!auth.isAuthenticated) {
    console.log('[ProtectedRoute] Not authenticated, redirecting to login.');
    // Preserva a rota de origem para redirecionar de volta após o login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log('[ProtectedRoute] Authenticated, rendering children.');
  return <>{children}</>;
};

// Componente para rotas administrativas
const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const location = useLocation();

  // Espera AuthProvider terminar sua própria carga interna
  if (isLoading) {
    console.log('[AdminRoute] Auth context is loading...');
    return <LoadingScreen message="Verificando permissões administrativas..." />;
  }

  if (!isAuthenticated) {
    console.log('[AdminRoute] Not authenticated, redirecting to login.');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    console.log('[AdminRoute] Authenticated but not admin, redirecting to dashboard.');
    toast.error('Acesso restrito a administradores');
    return <Navigate to="/dashboard" replace />;
  }

  console.log('[AdminRoute] Authenticated and admin, rendering children.');
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
          
          {/* Redirect root to login or dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          {/* Protected Routes com AppLayout */}
          <Route path="/" element={
            <ProtectedRoute>
              <ErrorBoundary>
                <AppLayout />
              </ErrorBoundary>
            </ProtectedRoute>
          }>
            <Route
              index
              element={<Navigate to="dashboard" replace />}
            />
            <Route
              path="dashboard"
              element={
                <ErrorBoundary>
                  <Dashboard />
                </ErrorBoundary>
              }
            />
            <Route
              path="record"
              element={
                <ErrorBoundary>
                  <RecordExchange />
                </ErrorBoundary>
              }
            />
            <Route
              path="history"
              element={<History />}
            />
            <Route
              path="approvals"
              element={<Approvals />}
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
              element={<Reports />}
            />
            <Route
              path="notifications"
              element={<NotificationsPage />}
            />
          </Route>
          
          {/* Rota Catch-all para Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </DataProvider>
    </AuthProvider>
  </Router>
);

// NOVO: Componente Inicializador
const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let isMounted = true;
    console.log('[AppInitializer] Starting initial session check...');

    const checkInitialSession = async () => {
      try {
        // Apenas verifica a sessão, não busca perfil aqui
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[AppInitializer] Error checking initial session:', error.message);
          toast.error(`Erro ao verificar sessão inicial: ${error.message}`);
        }
        if (session) {
           console.log('[AppInitializer] Initial session found.');
           // O AuthProvider cuidará de buscar o perfil via onAuthStateChange
        } else {
           console.log('[AppInitializer] No initial session found.');
        }
      } catch (e) {
        console.error('[AppInitializer] Critical error during initial session check:', e);
        toast.error('Erro crítico na inicialização da autenticação.');
      } finally {
        if (isMounted) {
          console.log('[AppInitializer] Initial check finished.');
          setIsInitializing(false);
        }
      }
    };

    checkInitialSession();

    return () => {
      isMounted = false;
      console.log('[AppInitializer] Unmounted.');
    };
  }, []);

  if (isInitializing) {
    return <LoadingScreen message="Inicializando aplicação..." />;
  }

  return <>{children}</>;
};

// Componente principal da aplicação
function App() {
  // Modo de Recuperação Básico
  if (localStorage.getItem('recovery_mode') === 'true') {
    return <RecoveryMode />;
  }

  return (
    <React.StrictMode>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <AppInitializer>
            <AppContent />
          </AppInitializer>
        </QueryClientProvider>
      </TooltipProvider>
    </React.StrictMode>
  );
}

export default App;
