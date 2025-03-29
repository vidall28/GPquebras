import React, { useState, useEffect } from 'react';
import { Search, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { 
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Product } from '@/context/DataContext';

interface ProductSelectorProps {
  products: Product[];
  selectedProductId: string;
  setSelectedProductId: (value: string) => void;
}

const ProductSelector: React.FC<ProductSelectorProps> = ({ 
  products, 
  selectedProductId, 
  setSelectedProductId 
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Filtra produtos com base na consulta
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = products.filter(product => 
      product.name.toLowerCase().includes(query) ||
      product.code.toLowerCase().includes(query)
    );

    setFilteredProducts(filtered);
  }, [searchQuery, products]);

  // Limpa a seleção atual
  const clearSelection = () => {
    setSelectedProductId("");
    setSearchQuery("");
  };

  // Destaca o texto correspondente à busca
  const highlightMatch = (text: string) => {
    if (!searchQuery.trim()) return text;
    
    const lowerText = text.toLowerCase();
    const lowerSearchQuery = searchQuery.toLowerCase();
    const index = lowerText.indexOf(lowerSearchQuery);
    
    if (index === -1) return text;
    
    const before = text.substring(0, index);
    const match = text.substring(index, index + searchQuery.length);
    const after = text.substring(index + searchQuery.length);
    
    return (
      <>
        {before}
        <span className="bg-yellow-200 dark:bg-yellow-800">{match}</span>
        {after}
      </>
    );
  };

  return (
    <div className="space-y-2">
      <label htmlFor="product" className="text-sm font-medium">
        Produto
      </label>
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedProduct ? (
              <div className="flex items-center justify-between w-full gap-2">
                <span className="truncate">{selectedProduct.name} - {selectedProduct.capacity}ml</span>
                {selectedProductId && (
                  <span
                    className="inline-flex h-6 w-6 p-0 items-center justify-center rounded-full hover:bg-muted cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearSelection();
                    }}
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">Busque pelo nome do produto</span>
            )}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="p-0 w-[300px]">
          <Command shouldFilter={false}>
            <div className="flex items-center border-b px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <CommandInput
                placeholder="Buscar produto..."
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="flex-1 h-9 border-0 outline-none focus:ring-0"
              />
            </div>
            <CommandList>
              {filteredProducts.length === 0 && (
                <CommandEmpty>Nenhum produto encontrado</CommandEmpty>
              )}
              <CommandGroup>
                {filteredProducts.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.id}
                    onSelect={() => {
                      setSelectedProductId(product.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <div>{highlightMatch(product.name)}</div>
                      <div className="text-xs text-muted-foreground">
                        {product.capacity}ml
                      </div>
                    </div>
                    {product.id === selectedProductId && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default ProductSelector;
