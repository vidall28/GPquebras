import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Product } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { 
  Search, 
  X, 
  History as HistoryIcon, 
  Package, 
  Eye, 
  Calendar, 
  Download,
  Image,
  FileSpreadsheet
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { utils, write } from 'xlsx';
import { toast } from '@/lib/toast';

const History: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { exchanges, products } = useData();
  
  // Filter and search state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Detail view state
  const [selectedExchange, setSelectedExchange] = useState<typeof exchanges[0] | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  // Filter exchanges by user if not admin
  const userExchanges = isAdmin 
    ? exchanges 
    : exchanges.filter(exchange => exchange.userId === user?.id);
  
  // Apply filters and search
  const filteredExchanges = userExchanges.filter(exchange => {
    // Status filter
    if (statusFilter !== 'all' && exchange.status !== statusFilter) {
      return false;
    }
    
    // Type filter
    if (typeFilter !== 'all' && exchange.type !== typeFilter) {
      return false;
    }
    
    // Date filter
    if (startDate && new Date(exchange.createdAt) < new Date(startDate)) {
      return false;
    }
    
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      if (new Date(exchange.createdAt) > endDateTime) {
        return false;
      }
    }
    
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      
      // Check label and user info
      if (
        exchange.label.toLowerCase().includes(searchLower) ||
        exchange.userName.toLowerCase().includes(searchLower) ||
        exchange.userRegistration.toLowerCase().includes(searchLower)
      ) {
        return true;
      }
      
      // Check items
      for (const item of exchange.items) {
        const product = products.find(p => p.id === item.productId);
        if (
          product?.name.toLowerCase().includes(searchLower) ||
          product?.code.toLowerCase().includes(searchLower) ||
          item.reason.toLowerCase().includes(searchLower)
        ) {
          return true;
        }
      }
      
      return false;
    }
    
    return true;
  });
  
  // Sort exchanges by date (newest first)
  const sortedExchanges = [...filteredExchanges].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  // View exchange details
  const viewExchangeDetails = (exchange: typeof exchanges[0]) => {
    setSelectedExchange(exchange);
    setDetailsOpen(true);
  };
  
  // Helper to get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pendente</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-100 text-green-800 hover:bg-green-100">Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-800 hover:bg-red-100">Rejeitado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  // Helper to get type badge
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'exchange':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Troca</Badge>;
      case 'breakage':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800 hover:bg-purple-100">Quebra</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };
  
  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { 
      addSuffix: true,
      locale: ptBR
    });
  };
  
  // Download single image
  const downloadImage = (dataUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Download all images as zip
  const downloadAllImages = async (exchange: typeof exchanges[0]) => {
    const zip = new JSZip();
    const images = zip.folder('images');
    
    // Add each image to the zip
    exchange.items.forEach((item, itemIndex) => {
      const product = products.find(p => p.id === item.productId);
      const productName = product ? product.name.replace(/\s+/g, '_').toLowerCase() : 'unknown';
      
      item.photos.forEach((photo, photoIndex) => {
        // Convert base64 to blob
        const base64Data = photo.split(',')[1];
        // Novo formato de nome: ita_269ml_15un
        const fileName = `${productName}_${product?.capacity || 0}ml_${item.quantity}un.jpg`;
        
        images?.file(fileName, base64Data, { base64: true });
      });
    });
    
    // Generate zip
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `LogiSwap_${exchange.label.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.zip`);
  };
  
  // Export to Excel function for a single exchange
  const exportExchangeToExcel = (exchange: typeof exchanges[0], products: Product[]) => {
    try {
      // Preparar dados para planilha
      const rows = exchange.items.map(item => {
        const product = products.find(p => p.id === item.productId);
        return {
          "Produto": product?.name || "Produto não encontrado",
          "Código": product?.code || "N/A",
          "Capacidade (ml)": product?.capacity || 0,
          "Quantidade (un)": item.quantity,
          "Motivo": item.reason,
          "Fotos": item.photos.length
        };
      });

      // Adicionar informações do registro
      const additionalInfo = [
        { "Informação": "Legenda", "Valor": exchange.label },
        { "Informação": "Tipo", "Valor": exchange.type === 'exchange' ? 'Troca' : 'Quebra' },
        { "Informação": "Status", "Valor": exchange.status === 'approved' ? 'Aprovado' : (exchange.status === 'rejected' ? 'Rejeitado' : 'Pendente') },
        { "Informação": "Data", "Valor": new Date(exchange.createdAt).toLocaleDateString('pt-BR') },
        { "Informação": "Usuário", "Valor": exchange.userName },
        { "Informação": "Registro", "Valor": exchange.userRegistration },
        { "Informação": "Observações", "Valor": exchange.notes || "Nenhuma observação" }
      ];

      // Criar workbook com duas planilhas
      const wb = utils.book_new();
      
      // Planilha de informações gerais
      const wsInfo = utils.json_to_sheet(additionalInfo);
      utils.book_append_sheet(wb, wsInfo, "Informações");
      
      // Definir a largura das colunas para a planilha de produtos
      const wsProducts = utils.json_to_sheet(rows);
      
      // Ajustar largura das colunas para melhor visualização
      const wscols = [
        { wch: 30 }, // Produto
        { wch: 15 }, // Código
        { wch: 15 }, // Capacidade
        { wch: 15 }, // Quantidade
        { wch: 50 }, // Motivo
        { wch: 10 }, // Fotos
      ];
      
      wsProducts['!cols'] = wscols;
      
      utils.book_append_sheet(wb, wsProducts, "Produtos");
      
      // Gerar arquivo
      const wbout = write(wb, { 
        bookType: 'xlsx', 
        type: 'array',
        bookSST: false,
        cellStyles: true
      });
      
      // Converter para blob e baixar
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      saveAs(blob, `${exchange.label.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.success('Planilha exportada com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar para Excel:', error);
      toast.error('Erro ao exportar planilha. Tente novamente.');
    }
  };

  // Função para exportar todos os registros para Excel
  const exportAllToExcel = () => {
    try {
      // Criar workbook
      const wb = utils.book_new();
      
      // Preparar dados para planilha
      const rows = filteredExchanges.map(exchange => {
        return {
          "Legenda": exchange.label,
          "Tipo": exchange.type === 'exchange' ? 'Troca' : 'Quebra',
          "Status": exchange.status === 'approved' ? 'Aprovado' : 
                    exchange.status === 'rejected' ? 'Rejeitado' : 'Pendente',
          "Data": new Date(exchange.createdAt).toLocaleDateString('pt-BR'),
          "Usuário": exchange.userName,
          "Registro": exchange.userRegistration,
          "Produtos": exchange.items.length,
          "Total Itens": exchange.items.reduce((acc, item) => acc + item.quantity, 0),
          "Observações": exchange.notes || ""
        };
      });

      // Adicionar planilha ao workbook
      const ws = utils.json_to_sheet(rows);
      
      // Ajustar largura das colunas para melhor visualização
      const wscols = [
        { wch: 20 }, // Legenda
        { wch: 10 }, // Tipo
        { wch: 10 }, // Status
        { wch: 12 }, // Data
        { wch: 20 }, // Usuário
        { wch: 15 }, // Registro
        { wch: 10 }, // Produtos
        { wch: 12 }, // Total Itens
        { wch: 50 }, // Observações
      ];
      
      ws['!cols'] = wscols;
      
      utils.book_append_sheet(wb, ws, "Histórico de Registros");
      
      // Gerar arquivo
      const wbout = write(wb, { 
        bookType: 'xlsx', 
        type: 'array',
        bookSST: false,
        cellStyles: true
      });
      
      // Converter para blob e baixar
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      saveAs(blob, `historico_registros_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.success('Histórico exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar para Excel:', error);
      toast.error('Erro ao exportar planilha. Tente novamente.');
    }
  };

  // Export to CSV
  const exportToCsv = () => {
    // Create CSV content
    let csvContent = 'Data,Legenda,Tipo,Status,Usuário,Matrícula,Produto,Código,Capacidade (ml),Quantidade,Motivo\n';
    
    sortedExchanges.forEach(exchange => {
      exchange.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        
        // Format fields, ensuring proper CSV escaping
        const row = [
          formatDate(exchange.createdAt),
          `"${exchange.label.replace(/"/g, '""')}"`,
          exchange.type === 'exchange' ? 'Troca' : 'Quebra',
          exchange.status === 'pending' ? 'Pendente' : (exchange.status === 'approved' ? 'Aprovado' : 'Rejeitado'),
          `"${exchange.userName.replace(/"/g, '""')}"`,
          exchange.userRegistration,
          product ? `"${product.name.replace(/"/g, '""')}"` : '',
          product ? product.code : '',
          product ? product.capacity : '',
          item.quantity,
          `"${item.reason.replace(/"/g, '""')}"`
        ].join(',');
        
        csvContent += row + '\n';
      });
    });
    
    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `LogiSwap_Histórico_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Histórico de Registros</h1>
          <p className="text-muted-foreground mt-1">
            Visualize e gerencie todos os registros de trocas e quebras
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCsv} className="gap-1">
            <Download size={16} /> Exportar CSV
          </Button>
          <Button variant="outline" onClick={exportAllToExcel} className="gap-1">
            <FileSpreadsheet size={16} /> Exportar XLSX
          </Button>
        </div>
      </div>
      
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-4 w-4" /> Filtros e Busca
          </CardTitle>
          <CardDescription>
            Use os filtros para encontrar registros específicos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Search */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID, legenda ou usuário..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {/* Status Filter */}
            <div>
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="approved">Aprovados</SelectItem>
                  <SelectItem value="rejected">Rejeitados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Type Filter */}
            <div>
              <Select
                value={typeFilter}
                onValueChange={setTypeFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Tipos</SelectItem>
                  <SelectItem value="exchange">Trocas</SelectItem>
                  <SelectItem value="breakage">Quebras</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Date Filters */}
            <div>
              <Input
                type="date"
                placeholder="Data Inicial"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Input
                type="date"
                placeholder="Data Final"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <HistoryIcon className="h-4 w-4" /> Registros ({sortedExchanges.length})
          </CardTitle>
          <CardDescription>
            Lista completa de registros de trocas e quebras
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedExchanges.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <HistoryIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">Nenhum registro disponível</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Não foram encontrados registros com os filtros atuais.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Legenda</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Usuário</TableHead>}
                    <TableHead>Itens</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedExchanges.map((exchange) => (
                    <TableRow key={exchange.id}>
                      <TableCell>
                        <div className="font-medium">{formatDate(exchange.createdAt)}</div>
                        <div className="text-xs text-muted-foreground">{formatTimeAgo(exchange.createdAt)}</div>
                      </TableCell>
                      <TableCell>{exchange.label}</TableCell>
                      <TableCell>{getTypeBadge(exchange.type)}</TableCell>
                      <TableCell>{getStatusBadge(exchange.status)}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="font-medium">{exchange.userName}</div>
                          <div className="text-xs text-muted-foreground">{exchange.userRegistration}</div>
                        </TableCell>
                      )}
                      <TableCell>{exchange.items.length} item(ns)</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => viewExchangeDetails(exchange)}
                          title="Ver Detalhes"
                        >
                          <Eye size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Registro</DialogTitle>
            <DialogDescription>
              Informações completas sobre o registro
            </DialogDescription>
          </DialogHeader>
          
          {selectedExchange && (
            <div className="space-y-6 pt-4">
              {/* Header Info */}
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Legenda</p>
                  <p className="font-medium">{selectedExchange.label}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar size={14} /> {formatDate(selectedExchange.createdAt)}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p>{getStatusBadge(selectedExchange.status)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p>{getTypeBadge(selectedExchange.type)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Usuário</p>
                  <p className="font-medium">{selectedExchange.userName}</p>
                  <p className="text-xs text-muted-foreground">{selectedExchange.userRegistration}</p>
                </div>
                {selectedExchange.notes && (
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-sm text-muted-foreground">Observações</p>
                    <p>{selectedExchange.notes}</p>
                  </div>
                )}
              </div>
              
              {/* Export to Excel button */}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => exportExchangeToExcel(selectedExchange, products)}
                >
                  <FileSpreadsheet size={16} /> Exportar para Planilha
                </Button>
              </div>
              
              {/* Items */}
              <div>
                <h3 className="text-lg font-medium mb-4">Itens do Registro</h3>
                
                <div className="space-y-6">
                  {selectedExchange.items.map((item, index) => {
                    const product = products.find(p => p.id === item.productId);
                    
                    return (
                      <Card key={item.id} className="overflow-hidden">
                        <CardHeader className="bg-accent/50">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Package size={16} />
                            {product?.name || 'Produto não encontrado'}
                          </CardTitle>
                          <CardDescription>
                            {product?.code} - {product?.capacity}ml
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <p className="text-sm text-muted-foreground">Quantidade</p>
                                  <p className="font-medium">{item.quantity} unidade(s)</p>
                                </div>
                              </div>
                              
                              <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Motivo</p>
                                <p>{item.reason}</p>
                              </div>
                              
                              {item.photos.length > 0 && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm text-muted-foreground">Fotos</p>
                                    <div className="flex gap-2">
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-7 gap-1"
                                        onClick={() => downloadAllImages(selectedExchange)}
                                      >
                                        <Download size={14} /> Baixar todas
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {item.photos.length > 0 && (
                              <div className="grid grid-cols-2 gap-2">
                                {item.photos.map((photo, photoIndex) => (
                                  <div key={photoIndex} className="relative aspect-square rounded-md overflow-hidden border">
                                    <img
                                      src={photo}
                                      alt={`Foto ${photoIndex + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="absolute bottom-1 right-1 bg-black/50 text-white hover:bg-black/70"
                                      onClick={() => {
                                        const product = products.find(p => p.id === item.productId);
                                        const fileName = `${product?.name.replace(/\s+/g, '_').toLowerCase() || 'produto'}_${product?.capacity || 0}ml_${item.quantity}un.jpg`;
                                        downloadImage(photo, fileName);
                                      }}
                                    >
                                      <Download size={14} />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
              
              {/* Extra info for approved/rejected items */}
              {(selectedExchange.status === 'approved' || selectedExchange.status === 'rejected') && selectedExchange.updatedAt && (
                <div className="text-sm text-muted-foreground pt-2 border-t">
                  <p>
                    {selectedExchange.status === 'approved' ? 'Aprovado' : 'Rejeitado'} em {formatDate(selectedExchange.updatedAt)} ({formatTimeAgo(selectedExchange.updatedAt)})
                    {selectedExchange.updatedBy && ` por ${selectedExchange.updatedBy}`}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default History;
