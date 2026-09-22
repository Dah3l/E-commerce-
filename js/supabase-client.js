/**
 * CLIENTE DE SUPABASE
 * Inicializa y exporta el cliente de Supabase
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Validar que las credenciales estén configuradas
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('TU_PROYECTO') || SUPABASE_ANON_KEY.includes('TU_ANON_KEY')) {
  console.warn('⚠️ ADVERTENCIA: Debes configurar las credenciales de Supabase en js/config.js');
}

// Crear instancia del cliente
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Obtener URL pública de una imagen desde Storage
 * @param {string} path - Ruta de la imagen en el bucket
 * @returns {string} URL pública de la imagen
 */
export function getStorageUrl(path) {
  if (!path) return null;
  
  // Si ya es una URL completa, retornarla
  if (path.startsWith('http')) return path;
  
  // Construir URL desde Supabase Storage
  const { data } = supabase.storage.from('productos').getPublicUrl(path);
  return data?.publicUrl || null;
}

/**
 * Subir imagen a Supabase Storage
 * @param {File} file - Archivo de imagen
 * @param {string} fileName - Nombre del archivo
 * @returns {Promise<{url: string, error: any}>}
 */
export async function uploadImage(file, fileName) {
  try {
    const { data, error } = await supabase.storage
      .from('productos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) throw error;
    
    const url = getStorageUrl(data.path);
    return { url, error: null };
  } catch (error) {
    console.error('Error subiendo imagen:', error);
    return { url: null, error };
  }
}

/**
 * Eliminar imagen de Supabase Storage
 * @param {string} path - Ruta de la imagen en el bucket
 * @returns {Promise<{success: boolean, error: any}>}
 */
export async function deleteImage(path) {
  try {
    // Extraer solo el nombre del archivo si es una URL completa
    let fileName = path;
    if (path.includes('/storage/v1/object/public/productos/')) {
      fileName = path.split('/storage/v1/object/public/productos/')[1];
    }
    
    const { error } = await supabase.storage
      .from('productos')
      .remove([fileName]);
    
    if (error) throw error;
    
    return { success: true, error: null };
  } catch (error) {
    console.error('Error eliminando imagen:', error);
    return { success: false, error };
  }
}
