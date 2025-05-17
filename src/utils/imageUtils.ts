import React from 'react';
import { toast } from '@/lib/toast';

// Constantes para configuração de imagens
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB (aumentado de 2MB)
const MAX_WIDTH = 600; // Reduzido de 800px para melhor desempenho
const IMAGE_QUALITY = 0.6; // Reduzido de 0.7 para melhor compressão

// Handle image file upload and convert to base64
export const handleImageUpload = (
  files: FileList | null, 
  setPhotos: React.Dispatch<React.SetStateAction<string[]>>
) => {
  if (!files || files.length === 0) return;
  
  console.log(`[ImageUtils] Processando ${files.length} imagens no dispositivo ${isMobileDevice() ? 'móvel' : 'desktop'}`);
  
  // Verificar se está em dispositivo móvel para otimizar ainda mais
  const targetWidth = isMobileDevice() ? Math.min(MAX_WIDTH, 400) : MAX_WIDTH;
  const targetQuality = isMobileDevice() ? Math.min(IMAGE_QUALITY, 0.5) : IMAGE_QUALITY;
  
  // Convert files to base64
  Array.from(files).forEach(file => {
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error(`A imagem ${file.name} é muito grande (máx. 10MB)`);
      return;
    }
    
    console.log(`[ImageUtils] Processando imagem: ${file.name}, tamanho: ${(file.size / 1024).toFixed(2)}KB`);
    
    // Otimizar a imagem antes de converter para base64
    compressImage(file, targetWidth, targetQuality)
      .then(compressedFile => {
        console.log(`[ImageUtils] Imagem comprimida: ${(compressedFile.size / 1024).toFixed(2)}KB (original: ${(file.size / 1024).toFixed(2)}KB)`);
        
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            const base64 = e.target.result as string;
            
            // Verificar se a string base64 não é muito grande
            if (base64.length > 500000 && isMobileDevice()) {
              // Se ainda for grande em dispositivo móvel, comprimir novamente
              console.log(`[ImageUtils] Imagem ainda grande em mobile (${(base64.length/1024).toFixed(2)}KB), comprimindo novamente`);
              
              // Criar uma imagem temporária para recomprimir
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement('canvas');
                // Reduzir ainda mais a resolução
                const width = img.width * 0.7;
                const height = img.height * 0.7;
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0, width, height);
                  // Usar qualidade ainda menor
                  const recompressedBase64 = canvas.toDataURL('image/jpeg', 0.4);
                  console.log(`[ImageUtils] Imagem recomprimida: ${(recompressedBase64.length/1024).toFixed(2)}KB`);
                  setPhotos(prev => [...prev, recompressedBase64]);
                } else {
                  // Usar a original se não conseguir recomprimir
                  setPhotos(prev => [...prev, base64]);
                }
              };
              img.src = base64;
            } else {
              console.log(`[ImageUtils] Imagem convertida para base64, tamanho: ${(base64.length / 1024).toFixed(2)}KB`);
              setPhotos(prev => [...prev, base64]);
            }
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
        
        // Tentar um fallback com a imagem original em caso de erro
        try {
          console.log(`[ImageUtils] Tentando fallback com imagem original`);
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              setPhotos(prev => [...prev, e.target!.result as string]);
            }
          };
          reader.readAsDataURL(file);
        } catch (fallbackError) {
          console.error(`[ImageUtils] Fallback também falhou:`, fallbackError);
        }
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
        
        // Usar timeout para evitar congelamento em dispositivos móveis
        setTimeout(() => {
          try {
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
          } catch (canvasError) {
            reject(canvasError);
          }
        }, 0);
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

// Detectar se é dispositivo móvel
const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
         (window.innerWidth <= 768);
};
