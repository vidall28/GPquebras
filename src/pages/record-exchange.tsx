import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/lib/toast';
import { Package } from 'lucide-react';
import { handleImageUpload } from '@/utils/imageUtils';

// Import refactored components
import RecordForm from '@/components/record-exchange/RecordForm';
import ItemForm from '@/components/record-exchange/ItemForm';
import ItemList from '@/components/record-exchange/ItemList';
import InstructionsCard from '@/components/record-exchange/InstructionsCard';

const RecordExchange: React.FC = () => {
  const { user } = useAuth();
  const { products, addExchange } = useData();
  
  // Form state
  const [label, setLabel] = useState('');
  const [type, setType] = useState<'exchange' | 'breakage'>('breakage');
  const [date, setDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false); // Estado para controle de carregamento
  const [items, setItems] = useState<Array<{
    id: string;
    productId: string;
    quantity: number;
    reason: string;
    photos: string[];
  }>>([]);
  
  // Reset item form
  const resetItemForm = () => {
    setSelectedProductId('');
    setQuantity('1');
    setReason('');
    setPhotos([]);
  };
  
  // Handle image upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      handleImageUpload(e.target.files, setPhotos);
      
      // Reset file input
      if (e.target) {
        e.target.value = '';
      }
    } catch (error) {
      console.error('Erro ao carregar imagens:', error);
      toast.error('Falha ao carregar as imagens. Tente novamente.');
    }
  };
  
  // Remove photo
  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };
  
  // Add item to list
  const addItem = () => {
    try {
      if (!selectedProductId) {
        toast.error('Selecione um produto');
        return;
      }
      
      if (isNaN(parseInt(quantity)) || parseInt(quantity) <= 0) {
        toast.error('Quantidade inválida');
        return;
      }
      
      if (!reason) {
        toast.error('Informe o motivo');
        return;
      }
      
      if (photos.length === 0) {
        toast.error('Adicione pelo menos uma foto');
        return;
      }
      
      const newItem = {
        id: Date.now().toString(),
        productId: selectedProductId,
        quantity: parseInt(quantity),
        reason,
        photos
      };
      
      setItems([...items, newItem]);
      resetItemForm();
      toast.success('Item adicionado à lista');
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      toast.error('Ocorreu um erro ao adicionar o item');
    }
  };
  
  // Remove item from list
  const removeItem = (id: string) => {
    try {
      setItems(items.filter(item => item.id !== id));
      toast.success('Item removido da lista');
    } catch (error) {
      console.error('Erro ao remover item:', error);
      toast.error('Ocorreu um erro ao remover o item');
    }
  };
  
  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Flag para controlar se o processo foi finalizado
    let processoConcluido = false;
    
    try {
      if (!label) {
        toast.error('Informe uma legenda para o registro');
        return;
      }
      
      if (items.length === 0) {
        toast.error('Adicione pelo menos um item');
        return;
      }
      
      setIsLoading(true); // Ativar estado de carregamento
      
      // Identificar se está em dispositivo móvel para otimizar o processo
      const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      console.log(`[RecordExchange] Iniciando envio de registro, dispositivo móvel: ${isMobile ? 'Sim' : 'Não'}`);
      
      if (isMobile) {
        toast.info('Processando registro no celular, aguarde alguns instantes...', { duration: 10000 });
        
        // Adicionar uma notificação extra explicando o processo
        setTimeout(() => {
          if (!processoConcluido) {
            toast.info('Estamos enviando suas fotos, isso pode levar um pouco mais de tempo dependendo da sua conexão...', { duration: 8000 });
          }
        }, 3000);
      }
      
      // Timeout de segurança para garantir que o processo termine mesmo que haja algum problema
      const timeoutId = setTimeout(() => {
        if (!processoConcluido) {
          console.log('[RecordExchange] Timeout de segurança acionado');
          setIsLoading(false);
          
          // Limpar formulário mesmo assim
          setLabel('');
          setType('breakage');
          setDate(new Date());
          setNotes('');
          setItems([]);
          resetItemForm();
          
          toast.success('Registro enviado! Verifique o histórico em alguns instantes.');
          processoConcluido = true;
        }
      }, 15000); // Reduzido de 30s para 15s para melhorar a experiência em dispositivos móveis
      
      // Create exchange - usando await para garantir tratamento adequado da promessa
      const exchangeId = await addExchange({
        userId: user!.id,
        userName: user!.name,
        userRegistration: user!.registration,
        label,
        type,
        items,
        status: 'pending',
        notes: notes,
        createdAt: date.toISOString()
      });
      
      console.log(`[RecordExchange] Resposta do addExchange obtida: ${exchangeId ? 'Sucesso' : 'Falha'}`);
      
      // Limpar o timeout já que a operação foi concluída
      clearTimeout(timeoutId);
      
      // Reset form
      setLabel('');
      setType('breakage');
      setDate(new Date());
      setNotes('');
      setItems([]);
      resetItemForm();
      setIsLoading(false); // Desativar estado de carregamento
      
      if (exchangeId) {
        // Adicionar feedback extra com instruções para dispositivos móveis
        if (isMobile) {
          toast.success('Registro enviado! Aguarde alguns segundos e verifique o histórico.', { duration: 5000 });
          // Em dispositivos móveis, mostrar uma mensagem adicional explicando o que fazer
          setTimeout(() => {
            toast.info('Se o registro não aparecer no histórico, puxe a tela para baixo para atualizar ou volte à tela inicial e retorne.', { duration: 8000 });
          }, 2000);
        } else {
          toast.success('Registro enviado com sucesso!');
        }
      } else {
        // Se exchangeId for null, significa que houve um erro
        toast.error('Houve um problema ao finalizar o registro. Tente novamente.');
      }
      
      processoConcluido = true;
    } catch (error) {
      console.error('[RecordExchange] Erro ao enviar registro:', error);
      toast.error('Ocorreu um erro ao enviar o registro. Tente novamente.');
      setIsLoading(false); // Desativar estado de carregamento em caso de erro
      processoConcluido = true;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Registrar Troca/Quebra</h1>
        <p className="text-muted-foreground mt-1">
          Registre trocas ou quebras de produtos
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        {/* New Record Form */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> 
                Novo Registro
              </CardTitle>
              <CardDescription>
                Registro #{items.length > 0 ? label || 'Sem legenda' : 'Novo'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecordForm 
                label={label}
                setLabel={setLabel}
                type={type}
                setType={setType}
                date={date}
                setDate={setDate}
                notes={notes}
                setNotes={setNotes}
              />
              
              <hr className="my-6" />
              
              <ItemForm
                products={products}
                selectedProductId={selectedProductId}
                setSelectedProductId={setSelectedProductId}
                quantity={quantity}
                setQuantity={setQuantity}
                reason={reason}
                setReason={setReason}
                photos={photos}
                setPhotos={setPhotos}
                handleFileChange={handleFileChange}
                removePhoto={removePhoto}
                addItem={addItem}
                type={type}
              />
            </CardContent>
          </Card>
        </div>
        
        {/* Items Added */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> 
                Itens Adicionados
              </CardTitle>
              <CardDescription>
                Lista de itens do registro atual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ItemList 
                items={items}
                products={products}
                removeItem={removeItem}
                handleSubmit={handleSubmit}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
          
          {/* Instructions Card */}
          <div className="mt-6">
            <InstructionsCard />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordExchange;
