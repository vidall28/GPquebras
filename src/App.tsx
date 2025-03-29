import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { AppLayout } from "@/components/Layout/AppLayout";

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Router>
        <AuthProvider>
          <DataProvider>
            <Toaster />
            <Sonner />
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Rota de diagnóstico - acessível publicamente para ajudar a solucionar problemas de conexão */}
              <Route 
                path="/diagnostico" 
                element={<Diagnostics />} 
              />
              
              {/* Redirect root to login or dashboard based on auth */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              
              {/* Protected Routes */}
              <Route path="/" element={<AppLayout />}>
                <Route 
                  path="dashboard" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="record" 
                  element={
                    <ProtectedRoute>
                      <RecordExchange />
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
              </Route>
              
              {/* 404 Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </DataProvider>
        </AuthProvider>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
