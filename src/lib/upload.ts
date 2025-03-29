import { supabase } from './supabase';

/**
 * Faz o upload de uma imagem para o Supabase Storage
 * @param file Arquivo de imagem a ser enviado
 * @param bucket Nome do bucket no Storage (default: 'photos')
 * @param folder Nome da pasta dentro do bucket (opcional)
 * @returns URL pública da imagem ou null em caso de erro
 */
export async function uploadImage(
  file: File,
  bucket: string = 'photos',
  folder?: string
): Promise<string | null> {
  try {
    // Verificar se o arquivo é uma imagem
    if (!file.type.startsWith('image/')) {
      throw new Error('O arquivo deve ser uma imagem');
    }
    
    // Limitar o tamanho da imagem (5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('A imagem deve ter no máximo 5MB');
    }
    
    // Gerar um nome de arquivo único
    const fileExt = file.name.split('.').pop();
    const fileName = `${new Date().getTime()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    
    // Construir o caminho completo da imagem
    const filePath = folder 
      ? `${folder}/${fileName}`
      : fileName;
    
    // Fazer o upload para o Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      throw error;
    }
    
    // Obter a URL pública da imagem
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);
    
    return publicUrl;
  } catch (error) {
    console.error('Erro ao fazer upload da imagem:', error);
    return null;
  }
}

/**
 * Converte uma imagem base64 em File para upload
 * @param base64 String base64 da imagem
 * @param filename Nome do arquivo
 * @returns Objeto File
 */
export function base64ToFile(base64: string, filename: string): File {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], filename, { type: mime });
}

/**
 * Converte uma imagem File em string base64
 * @param file Arquivo de imagem
 * @returns Promise com string base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Exclui uma imagem do Supabase Storage
 * @param url URL pública da imagem
 * @param bucket Nome do bucket no Storage (default: 'photos')
 * @returns true se foi excluída com sucesso, false caso contrário
 */
export async function deleteImage(url: string, bucket: string = 'photos'): Promise<boolean> {
  try {
    // Extrair o caminho da imagem da URL usando a URL pública do bucket
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`));
    
    if (!pathMatch || !pathMatch[1]) {
      console.error('Formato de URL inválido');
      return false;
    }
    
    const path = decodeURIComponent(pathMatch[1]);
    
    // Excluir a imagem
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);
    
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao excluir imagem:', error);
    return false;
  }
} 