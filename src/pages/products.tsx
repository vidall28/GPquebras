import React, { useState, useEffect, useRef } from 'react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Plus, 
  Edit, 
  Trash, 
  Box, 
  Search, 
  X,
  Check,
  Download,
  Upload,
  AlertCircle,
  FileText,
  RefreshCw
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { CommandInput, CommandList, CommandItem, CommandGroup, Command } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const Products: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct, exportProductsToCSV, importProductsFromCSV, reloadProducts } = useData();
  const { user, isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<typeof products>([]);
  const [openSearchPopover, setOpenSearchPopover] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [capacity, setCapacity] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; errors: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search functionality
  useEffect(() => {
    if (search.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    const lowerSearch = search.toLowerCase();
    const results = products.filter(product => 
      product.name.toLowerCase().includes(lowerSearch) ||
      product.code.toLowerCase().includes(lowerSearch)
    );
    
    setSearchResults(results);
    setOpenSearchPopover(results.length > 0);
  }, [search, products]);

  const handleSelectSearchResult = (product: typeof products[0]) => {
    setSearch(product.name);
    setOpenSearchPopover(false);
  };
  
  const filteredProducts = search.trim() === '' 
    ? products 
    : products.filter(product => 
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.code.toLowerCase().includes(search.toLowerCase())
      );
  
  const resetForm = () => {
    setName('');
    setCode('');
    setCapacity('');
    setEditingProductId(null);
  };
  
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast.error('Apenas administradores podem adicionar produtos');
      return;
    }
    
    if (!name || !code || !capacity) {
      toast.error('Preencha todos os campos');
      return;
    }
    
    const capacityValue = parseInt(capacity);
    if (isNaN(capacityValue) || capacityValue <= 0) {
      toast.error('Capacidade inválida');
      return;
    }
    
    if (products.some(p => p.code === code)) {
      toast.error('Já existe um produto com este código');
      return;
    }
    
    try {
      setIsLoading(true);
      await addProduct({
        name,
        code,
        capacity: capacityValue
      });
      
      // Recarregar produtos após adicionar
      console.log('Recarregando produtos após adicionar novo produto');
      await reloadProducts();
      
      resetForm();
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEditProduct = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast.error('Apenas administradores podem editar produtos');
      return;
    }
    
    if (!editingProductId || !name || !code || !capacity) {
      toast.error('Preencha todos os campos');
      return;
    }
    
    const capacityValue = parseInt(capacity);
    if (isNaN(capacityValue) || capacityValue <= 0) {
      toast.error('Capacidade inválida');
      return;
    }
    
    if (products.some(p => p.code === code && p.id !== editingProductId)) {
      toast.error('Já existe um produto com este código');
      return;
    }
    
    updateProduct(editingProductId, {
      name,
      code,
      capacity: capacityValue
    });
    
    resetForm();
    setIsEditDialogOpen(false);
  };
  
  const confirmDeleteProduct = (id: string) => {
    if (!isAdmin) {
      toast.error('Apenas administradores podem excluir produtos');
      return;
    }
    
    if (window.confirm('Tem certeza que deseja excluir este produto?')) {
      deleteProduct(id);
    }
  };
  
  const startEditingProduct = (product: typeof products[0]) => {
    setEditingProductId(product.id);
    setName(product.name);
    setCode(product.code);
    setCapacity(product.capacity.toString());
    setIsEditDialogOpen(true);
  };

  const handleExportProducts = () => {
    exportProductsToCSV();
  };
  
  const handleImportProducts = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast.error('Apenas administradores podem importar produtos');
      return;
    }
    
    if (!fileInputRef.current?.files?.length) {
      toast.error('Selecione um arquivo para importar');
      return;
    }
    
    const file = fileInputRef.current.files[0];
    
    // Validar tipo de arquivo
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('O arquivo deve estar no formato CSV');
      return;
    }
    
    // Ler o arquivo
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csvData = event.target?.result as string;
        
        // Importar produtos
        const result = await importProductsFromCSV(csvData);
        
        setImportResult({
          success: result.success,
          errors: result.errors
        });
        
        if (result.errorDetails.length > 0) {
          setImportErrors(result.errorDetails);
        } else {
          setIsImportDialogOpen(false);
        }
        
        // Limpar o input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error('Erro ao processar arquivo CSV:', error);
        toast.error('Erro ao processar arquivo CSV');
      }
    };
    
    reader.readAsText(file);
  };

  const highlightSearchMatch = (text: string) => {
    if (!search.trim()) return text;
    
    const lowerText = text.toLowerCase();
    const lowerSearch = search.toLowerCase();
    const index = lowerText.indexOf(lowerSearch);
    
    if (index === -1) return text;
    
    const before = text.substring(0, index);
    const match = text.substring(index, index + search.length);
    const after = text.substring(index + search.length);
    
    return (
      <>
        {before}
        <span className="bg-yellow-200 dark:bg-yellow-800">{match}</span>
        {after}
      </>
    );
  };

  // Função para atualizar a lista de produtos manualmente
  const handleRefreshProducts = async () => {
    try {
      setIsLoading(true);
      await reloadProducts();
      toast.success('Lista de produtos atualizada');
    } catch (error) {
      console.error('Erro ao atualizar produtos:', error);
      toast.error('Erro ao atualizar produtos');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground mt-1">
            Gerenciamento de produtos do sistema
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              className="gap-1"
              onClick={handleExportProducts}
            >
              <Download size={16} /> Exportar Produtos
            </Button>
            
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-1">
                  <Upload size={16} /> Importar Produtos
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Importar Produtos</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleImportProducts} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label htmlFor="csvFile" className="text-sm font-medium">
                      Arquivo CSV
                    </label>
                    <Input
                      id="csvFile"
                      type="file"
                      accept=".csv"
                      ref={fileInputRef}
                      required
                    />
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground">
                        Formato esperado: nome,codigo,capacidade_ml
                      </p>
                      <a 
                        href="/exemplo_produtos/exemplo_produtos.csv" 
                        download
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <FileText size={12} />
                        Baixar exemplo
                      </a>
                    </div>
                  </div>
                  
                  {importResult && (
                    <Alert variant={importResult.errors === 0 ? "success" : "warning"}>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Resultado da importação</AlertTitle>
                      <AlertDescription>
                        <p>Produtos importados com sucesso: {importResult.success}</p>
                        <p>Erros encontrados: {importResult.errors}</p>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {importErrors.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-destructive">Erros encontrados:</p>
                      <div className="max-h-40 overflow-y-auto bg-muted p-2 rounded text-xs">
                        {importErrors.map((error, index) => (
                          <p key={index}>{error}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsImportDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit">Importar</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-1">
                  <Plus size={16} /> Novo Produto
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Produto</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddProduct} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">
                      Nome
                    </label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nome do produto"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="code" className="text-sm font-medium">
                      Código
                    </label>
                    <Input
                      id="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Código do produto"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="capacity" className="text-sm font-medium">
                      Capacidade (ml)
                    </label>
                    <Input
                      id="capacity"
                      type="number"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      placeholder="Capacidade em ml"
                      min="1"
                      required
                    />
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button type="submit">Adicionar Produto</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            
            <Button 
              variant="outline" 
              className="gap-1"
              onClick={handleRefreshProducts}
              disabled={isLoading}
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} /> Atualizar Lista
            </Button>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2 max-w-md">
        <div className="relative w-full">
          <Popover open={openSearchPopover && search.length > 0} onOpenChange={setOpenSearchPopover}>
            <PopoverTrigger asChild>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setOpenSearchPopover(false);
                    }}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[300px]" align="start">
              <Command>
                <CommandList>
                  <CommandGroup heading="Sugestões">
                    {searchResults.length > 0 ? (
                      searchResults.map((product) => (
                        <CommandItem 
                          key={product.id} 
                          onSelect={() => handleSelectSearchResult(product)}
                          className="flex items-start justify-between"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{highlightSearchMatch(product.name)}</span>
                            <span className="text-xs text-muted-foreground">{product.code} - {product.capacity}ml</span>
                          </div>
                          <span className="inline-flex h-6 w-6 items-center justify-center text-primary">
                            <Check className="h-3 w-3" />
                          </span>
                        </CommandItem>
                      ))
                    ) : (
                      <p className="p-2 text-sm text-muted-foreground">Nenhum produto encontrado</p>
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Lista de Produtos</h2>
          <p className="text-sm text-muted-foreground">
            {products.length} produtos cadastrados no sistema
          </p>
        </div>
        
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Box className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Nenhum produto cadastrado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Clique em "Novo Produto" para adicionar o primeiro produto.
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Nenhum produto encontrado</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Tente usar termos diferentes na busca.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Capacidade (ml)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} className={search && (product.name.toLowerCase().includes(search.toLowerCase()) || 
                    product.code.toLowerCase().includes(search.toLowerCase())) 
                    ? "bg-yellow-50 dark:bg-yellow-900/20" : ""}>
                    <TableCell className="font-medium">{highlightSearchMatch(product.name)}</TableCell>
                    <TableCell>{highlightSearchMatch(product.code)}</TableCell>
                    <TableCell>{product.capacity} ml</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => startEditingProduct(product)}
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => confirmDeleteProduct(product.id)}
                              title="Excluir"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditProduct} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label htmlFor="edit-name" className="text-sm font-medium">
                Nome
              </label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do produto"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-code" className="text-sm font-medium">
                Código
              </label>
              <Input
                id="edit-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Código do produto"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="edit-capacity" className="text-sm font-medium">
                Capacidade (ml)
              </label>
              <Input
                id="edit-capacity"
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Capacidade em ml"
                min="1"
                required
              />
            </div>
            <div className="flex justify-end pt-4">
              <Button type="submit">Salvar Alterações</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
