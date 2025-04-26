import React, { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Calendar, BarChart4, PieChart as PieChartIcon } from 'lucide-react';
import { saveAs } from 'file-saver';
import { Navigate } from 'react-router-dom';

const Reports: React.FC = () => {
  const { isAdmin } = useAuth();
  const { exchanges, products } = useData();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // If not admin, redirect to dashboard
  if (!isAdmin) {
    return <Navigate to="/dashboard" />;
  }
  
  // Filter exchanges by date
  const filteredExchanges = useMemo(() => {
    return exchanges.filter(exchange => {
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
      
      return true;
    });
  }, [exchanges, startDate, endDate]);
  
  // Prepare summary data
  const summary = useMemo(() => {
    const total = filteredExchanges.length;
    const pending = filteredExchanges.filter(e => e.status === 'pending').length;
    const approved = filteredExchanges.filter(e => e.status === 'approved').length;
    const rejected = filteredExchanges.filter(e => e.status === 'rejected').length;
    const breakages = filteredExchanges.filter(e => e.type === 'breakage').length;
    const exchanges = filteredExchanges.filter(e => e.type === 'exchange').length;
    
    return { total, pending, approved, rejected, breakages, exchanges };
  }, [filteredExchanges]);
  
  // Prepare status chart data
  const statusChartData = useMemo(() => {
    return [
      { name: 'Pendentes', value: summary.pending },
      { name: 'Aprovados', value: summary.approved },
      { name: 'Rejeitados', value: summary.rejected }
    ];
  }, [summary]);
  
  // Prepare type chart data
  const typeChartData = useMemo(() => {
    return [
      { name: 'Quebras', value: summary.breakages },
      { name: 'Trocas', value: summary.exchanges }
    ];
  }, [summary]);
  
  // Prepare top products data
  const topProductsData = useMemo(() => {
    const productCounts: Record<string, { count: number, name: string }> = {};
    
    filteredExchanges.forEach(exchange => {
      exchange.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          if (productCounts[product.id]) {
            productCounts[product.id].count += item.quantity;
          } else {
            productCounts[product.id] = { 
              count: item.quantity, 
              name: product.name 
            };
          }
        }
      });
    });
    
    return Object.values(productCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(product => ({
        name: product.name,
        value: product.count
      }));
  }, [filteredExchanges, products]);
  
  // Export to CSV
  const exportToCsv = () => {
    // Create CSV content
    let csvContent = 'Data,Legenda,Tipo,Status,Usuário,Matrícula,Produto,Código,Capacidade (ml),Quantidade,Motivo\n';
    
    filteredExchanges.forEach(exchange => {
      exchange.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        
        // Format fields, ensuring proper CSV escaping
        const row = [
          new Date(exchange.createdAt).toLocaleDateString('pt-BR'),
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
    saveAs(blob, `GP_Relatório_${new Date().toISOString().split('T')[0]}.csv`);
  };
  
  // Color arrays for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
  const STATUS_COLORS = ['#FFBB28', '#00C49F', '#FF8042'];
  const TYPE_COLORS = ['#8884d8', '#0088FE'];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground mt-1">
            Visualize relatórios e estatísticas do sistema
          </p>
        </div>
        <Button variant="outline" onClick={exportToCsv} className="gap-1">
          <Download size={16} /> Exportar CSV
        </Button>
      </div>
      
      {/* Date Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Filtros
          </CardTitle>
          <CardDescription>
            Selecione o período para análise
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="start-date" className="text-sm font-medium block mb-2">
                Data Inicial
              </label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="end-date" className="text-sm font-medium block mb-2">
                Data Final
              </label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                className="gap-1"
                onClick={exportToCsv}
              >
                <Download size={16} /> Exportar CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Summary Data */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total de Registros</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-500">{summary.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Quebras</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-500">{summary.breakages}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Trocas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-500">{summary.exchanges}</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts */}
      <Tabs defaultValue="status" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="status" className="gap-1">
            <PieChartIcon size={16} /> Distribuição por Status
          </TabsTrigger>
          <TabsTrigger value="type" className="gap-1">
            <PieChartIcon size={16} /> Distribuição por Tipo
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-1">
            <BarChart4 size={16} /> Produtos mais afetados
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Status</CardTitle>
              <CardDescription>
                Registros divididos por status de aprovação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="type">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Tipo</CardTitle>
              <CardDescription>
                Registros divididos por tipo (trocas e quebras)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {typeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={TYPE_COLORS[index % TYPE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Top 10 Produtos com mais ocorrências</CardTitle>
              <CardDescription>
                Produtos com maior número de registros
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProductsData}
                    margin={{
                      top: 20,
                      right: 30,
                      left: 20,
                      bottom: 120,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={80} 
                      interval={0}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar 
                      dataKey="value" 
                      name="Quantidade" 
                      fill="#0088ff" 
                      radius={[4, 4, 0, 0]} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;
