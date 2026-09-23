/**
 * CLIENTE DE SUPABASE
 * Inicializa y exporta el cliente de Supabase
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET } from './config.js';

/**
 * Extrae la ruta relativa de un archivo dentro del bucket "productos"
 * a partir de una URL completa o una ruta ya relativa.
 */
export function extractStoragePath(pathOrUrl) {
  if (!pathOrUrl) return null;
  const s = String(pathOrUrl).trim();
  const marker = `/object/public/${STORAGE_BUCKET}/`;
  if (s.includes(marker)) return s.split(marker)[1];
  const signed = `/object/sign/${STORAGE_BUCKET}/`;
  if (s.includes(signed)) return s.split(signed)[1].split('?')[0];
  const privateUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${STORAGE_BUCKET}/`;
  if (s.startsWith(privateUrl)) return s.slice(privateUrl.length);
  // Ruta relativa: quitar slash inicial
  return s.replace(/^\/+/, '');
}

// Validar que las credenciales estén configuradas
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('TU_PROYECTO') || SUPABASE_ANON_KEY.includes('TU_ANON_KEY')) {
  console.warn('⚠️ ADVERTENCIA: Debes configurar las credenciales de Supabase en js/config.js');
}

// Crear instancia del cliente
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Obtener URL publica de una imagen desde Storage.
 * Acepta rutas relativas ("123-foto.jpg") o URLs completas de Supabase.
 * @param {string} path - Ruta o URL de la imagen en el bucket
 * @returns {string|null} URL publica de la imagen
 */
export function getStorageUrl(path) {
  if (!path) return null;

  // Si es una URL externa (no de nuestro Storage), dejarla tal cual
  if (/^https?:\/\//i.test(path) && !path.includes('/storage/v1/object/')) return path;

  // Extraer la ruta relativa dentro del bucket (acepta URLs publicas, firmadas o rutas)
  const rel = extractStoragePath(path);
  if (!rel) return null;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(rel);
  return data?.publicUrl || null;
}

/**
 * Subir imagen a Supabase Storage
 * @param {File} file - Archivo de imagen
 * @param {string} fileName - Nombre del archivo
 * @returns {Promise<{url: string, path: string, error: any}>}
 */
export async function uploadImage(file, fileName) {
  try {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) throw error;

    const url = getStorageUrl(data.path);
    return { url, path: data.path, error: null };
  } catch (error) {
    console.error('Error subiendo imagen:', error);
    // Enriquecer el mensaje con las causas mas frecuentes para que el admin
    // sepa exactamente que corregir en Supabase.
    const status = error?.statusCode || error?.status;
    const msg = String(error?.message || '');
    let hint = '';
    if (status === 400 && /could not find the bucket/i.test(msg)) {
      hint = ` El bucket "${STORAGE_BUCKET}" no existe o esta mal escrito (verifica minusculas).`;
    } else if (status === 403 || /row-level security|policy|unauthorized/i.test(msg)) {
      hint = ' Te esta bloqueando una policy de storage.objects: hace falta una politica INSERT con check (bucket_id = \'' + STORAGE_BUCKET + '\') y debes haber iniciado sesion como usuario autenticado.';
    } else if (/size|too large|payload/i.test(msg)) {
      hint = ' La imagen es demasiado grande para el limite del bucket (revisa Storage > Settings > File size limit).';
    }
    return { url: null, path: null, error: Object.assign(new Error(msg + hint), { cause: error }) };
  }
}

/**
 * Eliminar imagen de Supabase Storage
 * @param {string} path - Ruta o URL completa de la imagen en el bucket
 * @returns {Promise<{success: boolean, error: any}>}
 */
export async function deleteImage(path) {
  try {
    const fileName = extractStoragePath(path);
    if (!fileName) return { success: false, error: new Error('Ruta de imagen no valida') };

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([fileName]);

    if (error) throw error;

    return { success: true, error: null };
  } catch (error) {
    console.error('Error eliminando imagen:', error);
    return { success: false, error };
  }
}
