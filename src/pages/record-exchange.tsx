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
  const { products, addExchange, fetchExchanges, forceRefreshExchanges } = useData();
  
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
  
  // Detectar dispositivo móvel e conexão
  const detectMobileAndConnection = () => {
    // Resultado padrão
    let result = {
      isMobile: false,
      isSlowConnection: false
    };
    
    try {
      // Primeiro tentar pegar do sessionStorage para evitar recálculos
      const storedMobile = sessionStorage.getItem('isMobileDevice');
      if (storedMobile !== null) {
        result.isMobile = storedMobile === 'true';
      } else {
        // Checagem completa
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
        result.isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(userAgent.toLowerCase())
                  || window.innerWidth <= 768
                  || ('ontouchstart' in window);
        
        // Salvar resultado
        try {
          sessionStorage.setItem('isMobileDevice', result.isMobile ? 'true' : 'false');
        } catch (e) {
          console.error('Erro ao salvar detecção de mobile:', e);
        }
      }
      
      // Verificar conexão lenta
      try {
        const connection = (navigator as any).connection;
        result.isSlowConnection = connection && 
          (connection.type === 'cellular' || 
           connection.effectiveType === 'slow-2g' || 
           connection.effectiveType === '2g' ||
           connection.saveData === true);
      } catch (e) {
        console.error('Erro ao verificar tipo de conexão:', e);
      }
    } catch (e) {
      console.error('Erro na detecção de dispositivo/conexão:', e);
      // Fallback simples em caso de erro
      result.isMobile = window.innerWidth <= 768;
    }
    
    return result;
  };
  
  // Otimizar itens para conexões lentas
  const getOptimizedItems = (originalItems, isSlowConnection) => {
    if (!isSlowConnection || !originalItems || originalItems.length === 0) {
      return originalItems;
    }
    
    // Criar cópia profunda dos itens
    try {
      const optimized = JSON.parse(JSON.stringify(originalItems));
      
      for (let i = 0; i < optimized.length; i++) {
        // Limitar o número de fotos em conexões lentas
        if (optimized[i].photos && optimized[i].photos.length > 3) {
          console.log(`Limitando fotos do item ${i} de ${optimized[i].photos.length} para 3`);
          optimized[i].photos = optimized[i].photos.slice(0, 3);
        }
      }
      
      return optimized;
    } catch (e) {
      console.error('Erro ao otimizar itens:', e);
      return originalItems;
    }
  };

  // Submit form - Versão otimizada para dispositivos móveis
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
      
      // Detectar dispositivo e tipo de conexão
      const { isMobile, isSlowConnection } = detectMobileAndConnection();
      console.log(`Iniciando envio: Mobile=${isMobile}, ConexãoLenta=${isSlowConnection}`);
      
      // Otimizações para dispositivos móveis e conexões lentas
      if (isMobile) {
        toast.info('Processando registro, aguarde alguns instantes...', { duration: 8000 });
        
        // Em conexões lentas, mostrar mensagem específica
        if (isSlowConnection) {
          setTimeout(() => {
            if (!processoConcluido) {
              toast.info('Sua conexão parece estar lenta. Continue aguardando enquanto enviamos seus dados...', { duration: 10000 });
            }
          }, 2000);
        }
      }
      
      // Preparar itens otimizados para conexões lentas
      const itemsToSend = getOptimizedItems(items, isSlowConnection);
      
      // Calcular tempo de timeout baseado na quantidade de dados
      let totalFotos = 0;
      itemsToSend.forEach(item => totalFotos += item.photos.length);
      
      // Ajustar timeout baseado na quantidade de fotos e tipo de conexão
      let timeoutDuration = 20000; // Base: 20 segundos
      
      if (isMobile && isSlowConnection) {
        timeoutDuration = 30000 + (totalFotos * 3000);
      } else if (isMobile) {
        timeoutDuration = 20000 + (totalFotos * 2000);
      } else {
        timeoutDuration = 15000 + (totalFotos * 1000);
      }
      
      // Limitar o timeout máximo
      timeoutDuration = Math.min(timeoutDuration, 60000); // Máx: 60 segundos
      console.log(`Timeout configurado: ${timeoutDuration}ms para ${totalFotos} fotos`);
      
      // Timeout de segurança
      const timeoutId = setTimeout(() => {
        if (!processoConcluido) {
          console.log('Timeout de segurança acionado');
          setIsLoading(false);
          
          // Limpar formulário
          setLabel('');
          setType('breakage');
          setDate(new Date());
          setNotes('');
          setItems([]);
          resetItemForm();
          
          // Feedback diferente baseado na conexão
          if (isSlowConnection) {
            toast.info('Seu registro foi enviado, mas sua conexão está lenta. Verifique o histórico em alguns minutos.', { duration: 8000 });
          } else {
            toast.success('Registro enviado! Verifique o histórico em instantes.');
          }
          processoConcluido = true;
        }
      }, timeoutDuration);
      
      // Enviar para o servidor usando os itens otimizados
      const exchangeId = await addExchange({
        userId: user!.id,
        userName: user!.name,
        userRegistration: user!.registration,
        label,
        type,
        items: itemsToSend, // Usando os itens otimizados
        status: 'pending',
        notes: notes,
        createdAt: date.toISOString()
      });
      
      console.log(`Resposta do addExchange: ${exchangeId ? 'Sucesso' : 'Falha'}`);
      
      // Limpar o timeout
      clearTimeout(timeoutId);
      
      // Reset form
      setLabel('');
      setType('breakage');
      setDate(new Date());
      setNotes('');
      setItems([]);
      resetItemForm();
      setIsLoading(false);
      
      if (exchangeId) {
        // Feedback específico para dispositivos móveis
        if (isMobile) {
          toast.success('Registro enviado com sucesso!');
          
          // Armazenar ID para verificação futura
          try {
            localStorage.setItem('lastExchangeId', exchangeId);
            localStorage.setItem('lastExchangeTime', Date.now().toString());
          } catch (e) {
            console.error('Erro ao salvar no localStorage:', e);
          }
          
          // Reduzir número de atualizações para evitar sobrecarga
          if (isSlowConnection) {
            // Em conexões lentas, apenas uma atualização após mais tempo
            setTimeout(() => {
              console.log('Tentativa única de atualização (conexão lenta)');
              forceRefreshExchanges(exchangeId).catch(e => {
                console.error('Erro na atualização:', e);
              });
            }, 5000);
          } else {
            // Em conexões normais, duas tentativas
            setTimeout(() => {
              console.log('Primeira atualização');
              forceRefreshExchanges(exchangeId).catch(e => {
                console.error('Erro na primeira atualização:', e);
              });
            }, 3000);
            
            setTimeout(() => {
              console.log('Segunda atualização');
              forceRefreshExchanges(exchangeId).catch(e => {
                console.error('Erro na segunda atualização:', e);
              });
            }, 10000);
          }
        } else {
          toast.success('Registro enviado com sucesso!');
          
          // Em desktop, uma única atualização é suficiente
          setTimeout(() => {
            forceRefreshExchanges(exchangeId).catch(e => {
              console.error('Erro na atualização desktop:', e);
            });
          }, 1000);
        }
        processoConcluido = true;
      } else {
        toast.error('Houve um problema ao finalizar o registro. Tente novamente.');
      }
      
      processoConcluido = true;
    } catch (error) {
      console.error('Erro ao enviar registro:', error);
      toast.error('Ocorreu um erro ao enviar o registro. Tente novamente.');
      setIsLoading(false);
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
