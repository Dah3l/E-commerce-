/**
 * CONFIGURACIÓN DEL NEGOCIO
 * Lee la tabla config_negocio desde Supabase y la cachea en localStorage.
 * Permite que todas las páginas usen nombre, teléfono, WhatsApp, moneda, etc.
 */

import { supabase } from './supabase-client.js';
import { DEFAULT_CURRENCY } from './config.js';

const CACHE_KEY = 'biz_config_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

let memoryConfig = null;

/**
 * Obtiene la configuración del negocio (con caché)
 * @param {boolean} forceRefresh - Forzar lectura fresca de Supabase
 * @returns {Promise<Object>} Configuración (objeto vacío si no hay)
 */
export async function getBizConfig(forceRefresh = false) {
  if (!forceRefresh && memoryConfig) return memoryConfig;

  if (!forceRefresh) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        memoryConfig = cached.data;
        return memoryConfig;
      }
    } catch (_) { /* ignorar caché corrupta */ }
  }

  try {
    const { data, error } = await supabase
      .from('config_negocio')
      .select('*')
      .eq('id', 1)
      .single();

    if (!error && data) {
      memoryConfig = data;
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
      return data;
    }
  } catch (error) {
    console.error('Error obteniendo configuración del negocio:', error);
  }

  // Fallback: usar caché vieja si existe
  if (memoryConfig) return memoryConfig;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached?.data) return cached.data;
  } catch (_) { /* nada */ }
  return {};
}

/**
 * Limpia todas las cachés de configuración/categorías (tras guardar cambios en admin)
 */
export function clearConfigCaches() {
  memoryConfig = null;
  localStorage.removeItem(CACHE_KEY);
  sessionStorage.removeItem('categories_cache');
}

/**
 * Número de WhatsApp normalizado (solo dígitos) o '' si no está configurado
 */
export function getWhatsAppNumber(config) {
  const raw = (config?.whatsapp || '').replace(/\D/g, '');
  return raw;
}

/**
 * Moneda configurada con fallback
 */
export function getCurrency(config) {
  return config?.moneda || DEFAULT_CURRENCY;
}
