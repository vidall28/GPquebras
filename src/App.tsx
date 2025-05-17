import React, { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
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

// Componente de LoadingScreen
const LoadingScreen: React.FC<{ message?: string }> = ({ message = 'Carregando...' }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
      <div className="text-center">
        <div className="mb-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

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

  // Verificar se o usuário está autenticado
  if (!auth.isAuthenticated && !auth.isLoading) {
    console.log('[ProtectedRoute] Não autenticado, redirecionando para login.');
    // Preserva a rota de origem para redirecionar de volta após o login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Renderizar o conteúdo mesmo durante o carregamento, sem mostrar a tela de "verificando permissões"
  return <>{children}</>;
};

// Componente para rotas administrativas
const AdminRoute = ({ children }: AdminRouteProps) => {
  const auth = useAuth();
  const location = useLocation();
  
  // Verificar se o usuário está autenticado e é admin
  if (!auth.isAuthenticated && !auth.isLoading) {
    console.log('[AdminRoute] Não autenticado, redirecionando para login.');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Se autenticado mas não é admin, redireciona para dashboard
  if (auth.isAuthenticated && !auth.isAdmin && !auth.isLoading) {
    console.log('[AdminRoute] Sem permissão de administrador, redirecionando.');
    toast.error('Você não tem permissão para acessar esta área');
    return <Navigate to="/dashboard" replace />;
  }
  
  // Renderizar o conteúdo mesmo durante o carregamento
  return <>{children}</>;
};

// Componente de conteúdo da aplicação (RESTAURANDO LAYOUT E PROTEÇÃO, PÁGINAS SIMPLES)
const AppContent = ({ hasSession }: { hasSession: boolean | null }) => {
  // Se hasSession for null, ainda estamos verificando
  // Se for false, redirecionamos para login
  const defaultRedirect = hasSession === false ? "/login" : "/dashboard";

  return (
  <Router>
      <AuthProvider>
        <DataProvider>
          <Toaster />
          <Sonner />
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={
              <ErrorBoundary>
                <Login /> {/* Manter Login real */}
              </ErrorBoundary>
            } />
             <Route path="/register" element={
              <ErrorBoundary>
                <Register /> {/* Manter Register real */}
              </ErrorBoundary>
            } />
            <Route path="/diagnostico" element={<DiagnosticsPage />} />

            {/* Main Route */}
            <Route 
              path="/" 
              element={
                hasSession === false ? 
                  <Navigate to="/login" replace /> : 
                  <Navigate to="/dashboard" replace /> 
              } 
            />

            {/* Protected Routes com AppLayout (RESTAURADO) */}
            <Route
              path="/" // Rota pai para todas as rotas autenticadas
              element={
                <ProtectedRoute> { /* Proteger a área interna */}
                  {/* Restaurar AppLayout real */}
                   <ErrorBoundary>
                     <AppLayout />
                   </ErrorBoundary>
                </ProtectedRoute>
              }
            >
              {/* Rotas aninhadas (filhas do AppLayout) - RESTAURADAS */}
              <Route
                index // Rota padrão -> dashboard
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
              {/* Rota Admin */}
              <Route
                path="products"
                element={
                  <AdminRoute>
                    <Products />
                  </AdminRoute>
                }
              />
               {/* Rota Admin */}
              <Route
                path="users"
                element={
                  <AdminRoute>
                    <Users />
                  </AdminRoute>
                }
              />
              {/* Rota Protegida */}
              <Route
                path="reports"
                element={<Reports />}
              />
               {/* Rota Protegida */}
              <Route
                path="notifications"
                 element={<NotificationsPage />}
              />
              {/* Adicione outras rotas aqui se necessário */}
            </Route>

            {/* Rota Catch-all para Not Found (mantida) */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </DataProvider>
      </AuthProvider>
  </Router>
  );
};

// NOVO: Componente Inicializador
const AppInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    console.log('[AppInitializer] Starting initial session check...');

    const checkInitialSession = async () => {
      try {
        // Verificar se estamos em uma página de autenticação
        const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';
        
        // Se estivermos em uma página de autenticação, não forçar redirecionamento
        if (isAuthPage) {
          console.log('[AppInitializer] Auth page detected, not forcing redirect');
          if (isMounted) {
            setHasSession(false);
            setIsInitializing(false);
          }
          return;
        }
        
        // Verifica a sessão 
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[AppInitializer] Error checking initial session:', error.message);
          toast.error(`Erro ao verificar sessão inicial: ${error.message}`);
          if (isMounted) {
            setHasSession(false);
            setIsInitializing(false);
          }
          // Forçar redirecionamento para login em caso de erro
          window.location.href = '/login';
          return;
        }
        
        if (!session) {
           console.log('[AppInitializer] No initial session found, redirecting to login');
           if (isMounted) setHasSession(false);
           
           // Se não estamos na página de login, redirecionar automaticamente
           if (window.location.pathname !== '/login') {
             console.log('[AppInitializer] Not on login page, forcing redirect');
             window.location.href = '/login';
             return;
           }
        } else {
           console.log('[AppInitializer] Initial session found.');
           if (isMounted) setHasSession(true);
           
           // Inicializar sistemas dependentes
           try {
             // Importação dinâmica para evitar dependências circulares
             const notificationsModule = await import('@/lib/notifications');
             const offlineManagerModule = await import('@/lib/offlineManager');
             
             if (session.user.id) {
               console.log('[AppInitializer] Initializing dependent systems with user ID:', session.user.id);
               notificationsModule.useNotifications.init(session.user.id);
               offlineManagerModule.ensureOfflineManagerInitialized(session.user.id);
             }
           } catch (e) {
             console.error('[AppInitializer] Error initializing dependent systems:', e);
           }
           
           // Verificar se precisamos tentar redirecionar o usuário para o dashboard
           if (window.location.pathname === '/' || window.location.pathname === '') {
             console.log('[AppInitializer] User on root path, redirecting to dashboard');
             window.location.href = '/dashboard';
             return;
           }
        }
      } catch (e) {
        console.error('[AppInitializer] Critical error during initial session check:', e);
        toast.error('Erro crítico na inicialização da autenticação.');
        if (isMounted) setHasSession(false);
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

  // Verificar se está inicializando - mostrar indicação de carregamento se necessário
  if (isInitializing) {
    return <LoadingScreen message="Verificando sessão..." />;
  }

  // Passar o estado hasSession para o AppContent
  return React.cloneElement(children as React.ReactElement, { hasSession });
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
            <AppContent hasSession={null} />
          </AppInitializer>
        </QueryClientProvider>
      </TooltipProvider>
    </React.StrictMode>
  );
}

export default App;
