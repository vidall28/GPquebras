import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Product } from '@/context/DataContext';
import { Plus } from 'lucide-react';
import ProductSelector from './ProductSelector';
import PhotoUploader from './PhotoUploader';
import { getReasonsByType, ReasonOption } from '@/lib/reasonOptions';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ItemFormProps {
  products: Product[];
  selectedProductId: string;
  setSelectedProductId: (id: string) => void;
  quantity: string;
  setQuantity: (quantity: string) => void;
  reason: string;
  setReason: (reason: string) => void;
  photos: string[];
  setPhotos: React.Dispatch<React.SetStateAction<string[]>>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removePhoto: (index: number) => void;
  addItem: () => void;
  type: 'exchange' | 'breakage';
}

const ItemForm: React.FC<ItemFormProps> = ({
  products,
  selectedProductId,
  setSelectedProductId,
  quantity,
  setQuantity,
  reason,
  setReason,
  photos,
  setPhotos,
  handleFileChange,
  removePhoto,
  addItem,
  type
}) => {
  const [useCustomReason, setUseCustomReason] = useState(false);
  const [reasonOptions, setReasonOptions] = useState<ReasonOption[]>([]);
  const [selectedReasonCode, setSelectedReasonCode] = useState<string>('');
  
  useEffect(() => {
    // Carregar as opções de motivos com base no tipo selecionado
    setReasonOptions(getReasonsByType(type));
  }, [type]);
  
  const handleReasonSelect = (value: string) => {
    if (value === 'custom') {
      setUseCustomReason(true);
      setSelectedReasonCode('custom');
      setReason('');
    } else {
      setUseCustomReason(false);
      setSelectedReasonCode(value);
      
      // Encontrar a opção selecionada para obter o texto completo
      const selectedOption = reasonOptions.find(option => option.code === value);
      if (selectedOption) {
        // Salvar o código e a descrição juntos para facilitar a identificação
        setReason(`${selectedOption.code} - ${selectedOption.label}`);
      }
    }
  };
  
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Adicionar Item</h3>
      
      <ProductSelector
        products={products}
        selectedProductId={selectedProductId}
        setSelectedProductId={setSelectedProductId}
      />
      
      <div className="space-y-2">
        <label htmlFor="quantity" className="text-sm font-medium">
          Quantidade
        </label>
        <Input
          id="quantity"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => {
            const value = e.target.value;
            // Validar entrada para permitir apenas números positivos
            if (value === '' || (!isNaN(parseInt(value)) && parseInt(value) > 0)) {
              setQuantity(value);
            }
          }}
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="reason" className="text-sm font-medium">
          Motivo
        </label>
        <Select 
          onValueChange={handleReasonSelect} 
          value={selectedReasonCode}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione um motivo" />
          </SelectTrigger>
          <SelectContent>
            {reasonOptions.map((option) => (
              <SelectItem key={option.code} value={option.code}>
                {option.code} - {option.label}
              </SelectItem>
            ))}
            <SelectItem value="custom">Outro (personalizado)</SelectItem>
          </SelectContent>
        </Select>
        
        {useCustomReason && (
          <Textarea
            id="custom-reason"
            placeholder="Descreva o motivo da quebra ou troca"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mt-2"
          />
        )}
      </div>
      
      <PhotoUploader
        photos={photos}
        setPhotos={setPhotos}
        handleFileChange={handleFileChange}
        removePhoto={removePhoto}
      />
      
      <Button 
        type="button" 
        className="w-full" 
        onClick={addItem}
        disabled={!selectedProductId || !reason || photos.length === 0}
      >
        <Plus size={16} className="mr-1" /> Adicionar Item
      </Button>
    </div>
  );
};

export default ItemForm;
