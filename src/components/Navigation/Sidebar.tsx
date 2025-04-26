import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { 
  Home, 
  Package, 
  History, 
  ClipboardCheck, 
  Users, 
  BarChart4,
  ChevronDown,
  X,
  AlertCircle,
  Bell
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  onClose?: () => void;
}

interface NavItem {
  title: string;
  path: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  subItems?: NavItem[];
  isExpanded?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { isAdmin } = useAuth();
  const [expandedItems, setExpandedItems] = React.useState<Record<string, boolean>>({});

  // Toggle submenu
  const toggleSubMenu = (title: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  // Navigation items
  const navItems: NavItem[] = [
    {
      title: 'Início',
      path: '/dashboard',
      icon: <Home size={20} />
    },
    {
      title: 'Registrar Troca/Quebra',
      path: '/record',
      icon: <Package size={20} />
    },
    {
      title: 'Histórico',
      path: '/history',
      icon: <History size={20} />
    },
    {
      title: 'Administração',
      path: '#admin',
      icon: <ClipboardCheck size={20} />,
      adminOnly: true,
      subItems: [
        {
          title: 'Aprovações',
          path: '/approvals',
          icon: <ClipboardCheck size={18} />,
          adminOnly: true,
        },
        {
          title: 'Produtos',
          path: '/products',
          icon: <Package size={18} />,
          adminOnly: true,
        },
        {
          title: 'Usuários',
          path: '/users',
          icon: <Users size={18} />,
          adminOnly: true,
        },
        {
          title: 'Relatórios',
          path: '/reports',
          icon: <BarChart4 size={18} />,
          adminOnly: true,
        }
      ]
    },
    {
      title: 'Diagnóstico',
      path: '/diagnostico',
      icon: <AlertCircle size={20} />,
      adminOnly: true
    }
  ];

  // Filter items based on user role
  const filteredItems = navItems.filter(item => !item.adminOnly || (item.adminOnly && isAdmin));

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-semibold">Gestão Q/T Gp</h1>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-1 rounded-md hover:bg-accent">
            <X size={20} />
          </button>
        )}
      </div>
      
      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        <p className="px-4 text-xs uppercase font-medium text-muted-foreground mb-2">Menu</p>
        <nav className="space-y-1">
          {filteredItems.map((item) => {
            const isExpanded = expandedItems[item.title];
            
            if (item.subItems) {
              return (
                <div key={item.title} className="nav-group">
                  <button
                    onClick={() => toggleSubMenu(item.title)}
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-2 text-sm text-muted-foreground hover:bg-accent/50 rounded-none hover:text-foreground transition-colors",
                      isExpanded && "font-medium bg-accent/50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span>{item.title}</span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={cn(
                        "transition-transform duration-200",
                        isExpanded ? "transform rotate-180" : ""
                      )}
                    />
                  </button>
                  
                  {isExpanded && item.subItems && (
                    <div className="pl-4 space-y-1 mt-1 animate-accordion-down">
                      {item.subItems.map((subItem) => (
                        <NavLink
                          key={subItem.path}
                          to={subItem.path}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-3 px-4 py-2 text-sm transition-colors rounded-none",
                              isActive 
                                ? "bg-accent/80 text-primary-foreground font-medium border-l-2 border-primary" 
                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                            )
                          }
                        >
                          {subItem.icon}
                          <span>{subItem.title}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  cn(
                    "flex items-center gap-3 px-4 py-2 text-sm transition-colors rounded-none",
                    isActive 
                      ? "bg-accent/80 text-primary-foreground font-medium border-l-2 border-primary" 
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )
                }
              >
                {item.icon}
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t text-xs text-center text-muted-foreground">
        <p>Gestão Q/T Gp &copy; {new Date().getFullYear()}</p>
        <p className="mt-1">Sistema de Gestão de Trocas e Quebras</p>
      </div>
    </div>
  );
};
