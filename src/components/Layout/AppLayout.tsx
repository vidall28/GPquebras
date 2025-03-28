import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Navigation/Sidebar';
import { LogOut } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export const AppLayout: React.FC = () => {
  const { isAuthenticated, user, logout, isAdmin } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const isMobile = useIsMobile();
  
  // Close sidebar on mobile by default
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    } else {
      setIsSidebarOpen(true);
    }
  }, [isMobile]);
  
  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);
  
  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out bg-white border-r border-border shadow-sm",
          isMobile ? (isSidebarOpen ? "translate-x-0" : "-translate-x-full") : "translate-x-0",
          isMobile ? "md:relative" : "relative"
        )}
      >
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </div>
      
      {/* Mobile Overlay */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Main Content */}
      <div className={cn(
        "flex flex-col flex-1 overflow-hidden transition-all duration-300 ease-in-out",
        isMobile ? "w-full" : (isSidebarOpen ? "ml-64" : "ml-0")
      )}>
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 border-b bg-background/90 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            {/* Mobile sidebar toggle */}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="md:hidden p-2 rounded-md hover:bg-accent flex items-center justify-center"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            
            {/* Logo - visible only on desktop when sidebar is closed */}
            {!isMobile && !isSidebarOpen && (
              <h1 className="text-xl font-semibold">LogiSwap</h1>
            )}
          </div>
          
          {/* User Info */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col justify-center">
              <span className="text-sm">{user?.name || 'Usuário'}</span>
              <span className="text-xs text-muted-foreground">Matrícula: {user?.registration || 'N/A'}</span>
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded-full">
              {isAdmin ? 'Administrador' : 'Usuário'}
            </span>
            <button 
              onClick={logout}
              className="p-2 rounded-full hover:bg-accent flex items-center justify-center"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="container py-6 max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
