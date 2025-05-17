import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Check, Info, Trash, Loader2 } from 'lucide-react';
import { Product, ExchangeItem } from '@/context/DataContext';

interface ItemListProps {
  items: ExchangeItem[];
  products: Product[];
  removeItem: (id: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  isLoading?: boolean;
}

const ItemList: React.FC<ItemListProps> = ({ 
  items, 
  products, 
  removeItem,
  handleSubmit,
  isLoading = false
}) => {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Info className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium">Nenhum item adicionado ainda</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          Preencha os dados do item no formulário ao lado e clique em "Adicionar Item" para incluí-lo na lista.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Qtd</TableHead>
              <TableHead>Fotos</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const product = products.find(p => p.id === item.productId);
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{product?.name || 'Produto não encontrado'}</div>
                    <div className="text-sm text-muted-foreground">{product?.code}</div>
                  </TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{item.photos.length} foto(s)</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      className="text-destructive"
                      disabled={isLoading}
                    >
                      <Trash size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      
      <div className="flex justify-between items-center pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? 'item adicionado' : 'itens adicionados'}
        </div>
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 size={16} className="mr-1 animate-spin" /> Processando...
            </>
          ) : (
            <>
              <Check size={16} className="mr-1" /> Finalizar Registro
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ItemList;
