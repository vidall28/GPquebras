import React from 'react';
import { toast } from '@/lib/toast';

// Handle image file upload and convert to base64
export const handleImageUpload = (
  files: FileList | null, 
  setPhotos: React.Dispatch<React.SetStateAction<string[]>>
) => {
  if (!files || files.length === 0) return;
  
  const maxSize = 5 * 1024 * 1024; // 5MB
  const maxFilesCount = 10; // Limite máximo de arquivos
  
  // Verificar se não excede o limite de arquivos
  if (files.length > maxFilesCount) {
    toast.error(`Limite máximo de ${maxFilesCount} fotos excedido`);
    return;
  }
  
  console.log(`[ImageUtils] Processando ${files.length} imagens`);
  
  // Convert files to base64
  Array.from(files).forEach(file => {
    if (file.size > maxSize) {
      toast.error(`A imagem ${file.name} é muito grande (máx. 5MB)`);
      return;
    }
    
    console.log(`[ImageUtils] Processando imagem: ${file.name}, tamanho: ${(file.size / 1024).toFixed(2)}KB`);
    
    // Otimizar a imagem antes de converter para base64
    compressImage(file, 800, 0.7)
      .then(compressedFile => {
        console.log(`[ImageUtils] Imagem comprimida: ${(compressedFile.size / 1024).toFixed(2)}KB (original: ${(file.size / 1024).toFixed(2)}KB)`);
        
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            const base64 = e.target.result as string;
            console.log(`[ImageUtils] Imagem convertida para base64, tamanho: ${(base64.length / 1024).toFixed(2)}KB`);
            setPhotos(prev => [...prev, base64]);
          }
        };
        reader.onerror = (e) => {
          console.error(`[ImageUtils] Erro ao ler arquivo:`, e);
          toast.error(`Erro ao processar a imagem ${file.name}`);
        };
        reader.readAsDataURL(compressedFile);
      })
      .catch(error => {
        console.error(`[ImageUtils] Erro ao comprimir imagem:`, error);
        toast.error(`Erro ao processar a imagem ${file.name}`);
      });
  });
};

// Função para comprimir imagem
const compressImage = (file: File, maxWidth: number, quality: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Redimensionar se a largura for maior que o máximo
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível obter contexto 2D do canvas'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          blob => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Falha ao converter canvas para Blob'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Erro ao carregar a imagem'));
      };
    } catch (error) {
      reject(error);
    }
  });
};
