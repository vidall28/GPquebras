import React, { useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ArrowUpDown, ShieldCheck, ShieldOff, User, X, Search } from 'lucide-react';

interface UserData {
  id: string;
  name: string;
  registration: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
}

interface UsersTableProps {
  users: UserData[];
  filteredUsers: UserData[];
  search: string;
  toggleUserStatus: (userId: string, currentStatus: string) => void;
  toggleUserRole: (userId: string, currentRole: string) => void;
  confirmDeleteUser: (userId: string) => void;
  toggleSort: (field: 'name' | 'registration' | 'role' | 'status') => void;
  highlightSearchMatch: (text: string) => React.ReactNode;
}

const UsersTable: React.FC<UsersTableProps> = ({
  users,
  filteredUsers,
  search,
  toggleUserStatus,
  toggleUserRole,
  confirmDeleteUser,
  toggleSort,
  highlightSearchMatch
}) => {
  // Log para debug
  useEffect(() => {
    console.log('Usuários carregados na tabela:', filteredUsers.map(user => ({
      id: user.id,
      name: user.name,
      registration: user.registration
    })));
  }, [filteredUsers]);

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <User className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium">Nenhum usuário cadastrado</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Ainda não existem usuários no sistema.
        </p>
      </div>
    );
  }

  if (filteredUsers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium">Nenhum usuário encontrado</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Tente usar termos diferentes na busca ou ajustar os filtros.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <Button 
                variant="ghost" 
                className="flex items-center gap-1 -ml-3 font-medium p-0 h-auto"
                onClick={() => toggleSort('name')}
              >
                Nome
                <ArrowUpDown size={14} className="ml-1 text-muted-foreground" />
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                className="flex items-center gap-1 -ml-3 font-medium p-0 h-auto"
                onClick={() => toggleSort('registration')}
              >
                Matrícula
                <ArrowUpDown size={14} className="ml-1 text-muted-foreground" />
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                className="flex items-center gap-1 -ml-3 font-medium p-0 h-auto"
                onClick={() => toggleSort('role')}
              >
                Perfil
                <ArrowUpDown size={14} className="ml-1 text-muted-foreground" />
              </Button>
            </TableHead>
            <TableHead>
              <Button 
                variant="ghost" 
                className="flex items-center gap-1 -ml-3 font-medium p-0 h-auto"
                onClick={() => toggleSort('status')}
              >
                Status
                <ArrowUpDown size={14} className="ml-1 text-muted-foreground" />
              </Button>
            </TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.map((user) => {
            // Garantir que a matrícula nunca seja exibida como vazia
            const displayRegistration = user.registration || 'N/A';
            
            return (
              <TableRow key={user.id} className={search && (user.name.toLowerCase().includes(search.toLowerCase()) || 
                displayRegistration.toLowerCase().includes(search.toLowerCase())) 
                ? "bg-yellow-50 dark:bg-yellow-900/20" : ""}>
                <TableCell className="font-medium">{highlightSearchMatch(user.name)}</TableCell>
                <TableCell>{highlightSearchMatch(displayRegistration)}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      user.role === 'admin'
                        ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                        : 'bg-slate-100 text-slate-800 hover:bg-slate-100'
                    }
                    variant="outline"
                  >
                    {user.role === 'admin' ? 'Admin' : 'Usuário'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={user.status === 'active'}
                      onCheckedChange={() => toggleUserStatus(user.id, user.status)}
                    />
                    <span className={user.status === 'active' ? 'text-green-600' : 'text-red-600'}>
                      {user.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleUserRole(user.id, user.role)}
                      title={user.role === 'admin' ? 'Remover privilégios de administrador' : 'Tornar administrador'}
                      className={user.role === 'admin' ? 'text-blue-600 hover:text-blue-700' : 'text-slate-600 hover:text-slate-700'}
                    >
                      {user.role === 'admin' ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => confirmDeleteUser(user.id)}
                      title="Excluir usuário"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default UsersTable;
