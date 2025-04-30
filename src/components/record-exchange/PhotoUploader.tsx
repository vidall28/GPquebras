import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Trash, Image as ImageIcon, X } from 'lucide-react';
import { 
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose
} from '@/components/ui/dialog';

interface PhotoUploaderProps {
  photos: string[];
  setPhotos: React.Dispatch<React.SetStateAction<string[]>>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removePhoto: (index: number) => void;
}

const PhotoUploader: React.FC<PhotoUploaderProps> = ({ 
  photos, 
  setPhotos, 
  handleFileChange, 
  removePhoto 
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Função para detectar se está em Android
  const isAndroid = () => {
    return /Android/i.test(navigator.userAgent);
  };
  
  // Função para abrir o seletor de opções em dispositivos Android
  const handlePhotoClick = () => {
    if (isAndroid()) {
      setIsDialogOpen(true);
    } else {
      // Em iOS e outros dispositivos, manter o comportamento atual
      fileInputRef.current?.click();
    }
  };
  
  // Função para abrir a câmera
  const openCamera = () => {
    cameraInputRef.current?.click();
    setIsDialogOpen(false);
  };
  
  // Função para abrir a galeria
  const openGallery = () => {
    fileInputRef.current?.click();
    setIsDialogOpen(false);
  };
  
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        Fotos
      </label>
      <div className="border rounded-md p-4">
        {photos.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {photos.map((photo, index) => (
              <div 
                key={index} 
                className="relative aspect-square rounded-md overflow-hidden border"
              >
                <img 
                  src={photo} 
                  alt={`Foto ${index + 1}`} 
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1"
                  aria-label="Remover foto"
                >
                  <Trash size={14} />
                </button>
              </div>
            ))}
            <div
              onClick={handlePhotoClick}
              className="flex items-center justify-center aspect-square rounded-md border border-dashed cursor-pointer hover:bg-accent/50 transition-colors"
            >
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
        ) : (
          <div
            onClick={handlePhotoClick}
            className="flex flex-col items-center justify-center p-6 border-dashed border-2 rounded-md cursor-pointer hover:bg-accent/50 transition-colors"
          >
            <Camera className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-muted-foreground">
              Clique para adicionar fotos
            </p>
          </div>
        )}
      </div>
      
      {/* Input para selecionar da galeria (hidden) */}
      <input
        id="photo-upload"
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      
      {/* Input para câmera (hidden) */}
      <input
        id="camera-upload"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        ref={cameraInputRef}
        onChange={handleFileChange}
      />
      
      {/* Diálogo de seleção para dispositivos Android */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogTitle>Escolha uma opção</DialogTitle>
          <DialogDescription>
            Como você deseja adicionar a foto?
          </DialogDescription>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <button
              onClick={openCamera}
              className="flex flex-col items-center justify-center p-4 border rounded-md hover:bg-accent/50 transition-colors"
            >
              <Camera className="h-10 w-10 text-primary mb-2" />
              <span>Usar Câmera</span>
            </button>
            
            <button
              onClick={openGallery}
              className="flex flex-col items-center justify-center p-4 border rounded-md hover:bg-accent/50 transition-colors"
            >
              <ImageIcon className="h-10 w-10 text-primary mb-2" />
              <span>Galeria</span>
            </button>
          </div>
          
          <DialogClose asChild>
            <Button type="button" variant="outline" className="w-full">
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhotoUploader;
