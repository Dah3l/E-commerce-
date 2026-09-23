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
 * El comprador puede elegir la moneda de visualización (USD o CUP). Cuando lo
 * hace limpiamos la caché de configuración para que la próxima lectura traiga
 * fresca la tasa de cambio definida por el admin.
 */
window.addEventListener('currency-changed', () => {
  try { localStorage.removeItem(CACHE_KEY); } catch (_) { /* sin storage */ }
});

/**
 * Número de WhatsApp normalizado (solo dígitos) o '' si no está configurado
 */
export function getWhatsAppNumber(config) {
  const raw = (config?.whatsapp || '').replace(/\D/g, '');
  return raw;
}

/**
 * Normaliza el valor de moneda guardado en el panel de admin.
 * Acepta codigos ISO ('USD', 'cop', 'ARS') y simbolos ('$'), que Intl no
 * reconoce como codigo de moneda y provocarian un error al formatear precios.
 * @param {*} raw - Valor de la columna moneda (puede ser null/undefined)
 * @returns {string} Codigo ISO valido o DEFAULT_CURRENCY como fallback
 */
export function normalizeCurrency(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return DEFAULT_CURRENCY;

  // Si ya es un codigo ISO de 3 letras, usarlo tal cual (en mayusculas)
  if (/^[A-Za-z]{3}$/.test(value)) return value.toUpperCase();

  // Si el admin configuro un simbolo u otro texto no valido, mapearlo a
  // un codigo conocido para que los precios sigan mostrandose correctamente
  const symbolMap = {
    '$': 'USD',   // simbolo generico (muchos paises lo usan)
    'US$': 'USD',
    'Q': 'GTQ',
    'Bs': 'VES',
    '₡': 'CRC',
    'L': 'HNL',
    'C$': 'NIO',
    'B/.': 'PAB',
    '₲': 'PYG',
    'S/': 'PEN',
    '$U': 'UYU',
    'Bs.': 'BOB'
  };
  if (symbolMap[value]) return symbolMap[value];

  console.warn(`Moneda configurada "${value}" no es un codigo ISO valido (ej: USD, COP, MXN). Usando ${DEFAULT_CURRENCY}.`);
  return DEFAULT_CURRENCY;
}

/**
 * Moneda configurada con fallback (normalizada a codigo ISO valido)
 */
export function getCurrency(config) {
  return normalizeCurrency(config?.moneda);
}


/**
 * Tasa de cambio configurada por el admin: cuántos CUP equivalen a 1 USD
 * (columna tasa_cambio_cup). Devuelve 0 si no está configurada o es inválida,
 * en cuyo caso la tienda solo puede mostrar precios en la moneda base.
 * @param {Object} config - Configuración del negocio
 * @returns {number}
 */
export function getCupRate(config) {
  const rate = Number(config?.tasa_cambio_cup);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

/**
 * Texto legible de la tasa para mostrarlo en la tienda (ej: "1 USD ≈ 700 CUP")
 * @param {Object} config - Configuración del negocio
 * @param {string} [baseCurrency] - Moneda base de los precios
 * @returns {string} '' si no hay tasa configurada
 */
export function getRateLabel(config, baseCurrency = 'USD') {
  const rate = getCupRate(config);
  if (!rate) return '';
  const pretty = Number.isInteger(rate) ? rate.toLocaleString('en-US') : rate.toFixed(2);
  return `1 ${String(baseCurrency || 'USD').toUpperCase()} = ${pretty} CUP`;
}
