/**
 * UTILIDADES GENERALES
 * Funciones helper para formateo, validación y otras tareas comunes
 */

import { DEFAULT_CURRENCY, ALT_CURRENCY } from './config.js';

const MONEDA_PREF_KEY = 'preferred_currency';

// Tasa de cambio configurada por el admin: cuantos CUP equivalen a 1 USD.
let cupPerUsd = 0;

/**
 * Define la tasa de conversión USD -> CUP (desde config_negocio.tasa_cup).
 * @param {number|string} rate - CUP por 1 USD (0/null la desactiva)
 */
export function setCupRate(rate) {
  const n = parseFloat(String(rate ?? '').replace(',', '.'));
  cupPerUsd = Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * ¿Conversión a CUP disponible? (tasa válida configurada por el admin)
 */
export function isCupAvailable() {
  return cupPerUsd > 0;
}

/**
 * Convierte un monto base (USD) a la moneda destino usando la tasa del admin.
 * @param {number} amountUSD - Monto en moneda base
 * @param {string} targetCode - Moneda destino ('USD' | 'CUP')
 * @returns {number} Monto convertido
 */
export function convertAmount(amountUSD, targetCode) {
  const code = normalizeCurrencyCode(targetCode);
  if (code === ALT_CURRENCY && cupPerUsd > 0) return amountUSD * cupPerUsd;
  return amountUSD; // sin tasa válida: mostrar la base sin convertir
}

/**
 * Moneda preferida por el comprador (persistida en localStorage).
 * Solo devuelve CUP si el admin configuró una tasa válida; si la tasa se
 * quita después, cae automáticamente a la moneda base (USD).
 * @returns {string} Código ISO ('USD' | 'CUP')
 */
export function getPreferredCurrency() {
  let saved = '';
  try { saved = localStorage.getItem(MONEDA_PREF_KEY) || ''; } catch (_) { /* noop */ }
  if (saved === ALT_CURRENCY && cupPerUsd > 0) return ALT_CURRENCY;
  return DEFAULT_CURRENCY;
}

/**
 * Guarda la moneda elegida por el comprador. Intentar elegir 'CUP' sin tasa
 * configurada se ignora y se queda en la base.
 * @param {string} code - 'USD' | 'CUP'
 * @returns {string} moneda finalmente activa
 */
export function setPreferredCurrency(code) {
  const normalized = normalizeCurrencyCode(code);
  const final = (normalized === ALT_CURRENCY && cupPerUsd <= 0) ? DEFAULT_CURRENCY : normalized;
  try { localStorage.setItem(MONEDA_PREF_KEY, final); } catch (_) { /* noop */ }
  return final;
}

/**
 * Normaliza un código de moneda a ISO mayúsculas válido o cae al default.
 * @param {string} currency - Código crudo
 * @returns {string} ISO de 3 letras o DEFAULT_CURRENCY
 */
function normalizeCurrencyCode(currency) {
  let code = String(currency || DEFAULT_CURRENCY).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) code = DEFAULT_CURRENCY;
  return code;
}

/**
 * Formatea un número (precio base en USD) como precio en la moneda pedida,
 * aplicando la conversión USD -> CUP cuando corresponde.
 * @param {number} amount - Cantidad en moneda base (USD)
 * @param {string} currency - Código de moneda destino (opcional)
 * @returns {string} Precio formateado (ej: "$1.99 USD" / "1,393.00 CUP")
 */
export function formatPrice(amount, currency = DEFAULT_CURRENCY) {
  if (amount === null || amount === undefined) return '';

  // Normalizar codigo de moneda: debe ser ISO de 3 letras (USD, CUP, COP...).
  // Si el admin configuro algo invalido (simbolo "$", texto libre, etc.)
  // se cae al default para evitar que Intl lance RangeError.
  const code = normalizeCurrencyCode(currency);
  const value = convertAmount(Number(amount), code);

  // CUP se expresa en unidades enteras (no tiene decimales practicos a esta tasa)
  const decimals = code === ALT_CURRENCY ? 0 : 2;

  const fmt = (cur, val, d) => new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: d,
    maximumFractionDigits: d
  }).format(val);

  let num;
  try {
    num = fmt(code, value, decimals);
  } catch (_) {
    // Moneda con formato ISO valido pero inexistente para Intl (ej: "ABC"):
    // formatear el numero igualmente y mostrar solo el codigo como sufijo.
    num = fmt('USD', value, decimals);
  }
  return `$${num} ${code}`;
}

/**
 * Convierte un texto a slug URL-friendly
 * @param {string} text - Texto original
 * @returns {string} Slug lowercase sin caracteres especiales
 */
export function slugify(text) {
  if (!text) return '';
  
  return text
    .toString()
    .normalize('NFD')                   // Separar caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '')   // Eliminar diacríticos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')              // Reemplazar espacios con guiones
    .replace(/[^\w-]+/g, '')           // Eliminar caracteres especiales
    .replace(/--+/g, '-');             // Evitar guiones múltiples
}

/**
 * Genera un UUID v4 simple
 * @returns {string} UUID aleatorio
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Valida que un email tenga formato correcto
 * @param {string} email - Email a validar
 * @returns {boolean} True si es válido
 */
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Valida que un teléfono tenga formato básico (mínimo 7 dígitos)
 * @param {string} phone - Teléfono a validar
 * @returns {boolean} True si es válido
 */
export function isValidPhone(phone) {
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  return /^\d{7,15}$/.test(cleaned);
}

/**
 * Trunca un texto a una longitud máxima añadiendo ellipsis
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Longitud máxima
 * @returns {string} Texto truncado
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Obtiene el parámetro de URL por nombre
 * @param {string} name - Nombre del parámetro
 * @returns {string|null} Valor del parámetro o null
 */
export function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

/**
 * Debounce para funciones que se ejecutan frecuentemente
 * @param {Function} func - Función a ejecutar
 * @param {number} wait - Tiempo de espera en ms
 * @returns {Function} Función con debounce
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle para limitar ejecución de funciones
 * @param {Function} func - Función a ejecutar
 * @param {number} limit - Límite de tiempo en ms
 * @returns {Function} Función con throttle
 */
export function throttle(func, limit = 1000) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Formatea una fecha a formato legible en español
 * @param {Date|string} date - Fecha a formatear
 * @returns {string} Fecha formateada
 */
export function formatDate(date) {
  if (!date) return '';
  
  const d = new Date(date);
  return d.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Formatea una fecha y hora a formato legible en español
 * @param {Date|string} date - Fecha a formatear
 * @returns {string} Fecha y hora formateadas
 */
export function formatDateTime(date) {
  if (!date) return '';
  
  const d = new Date(date);
  return d.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Escapa caracteres HTML para prevenir XSS
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado
 */
export function escapeHtml(text) {
  if (!text) return '';
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Convierte texto plano en HTML seguro preservando su formato:
 * - Los saltos de l�nea simples se respetan (se convierten en <br>).
 * - Los p�rrafos (separados por doble salto de l�nea) se envuelven en <p>.
 * Todo el contenido se escapa primero, por lo que es seguro insertarlo con innerHTML.
 * @param {string} text - Texto plano (posible multilinea)
 * @returns {string} HTML escapado y formateado
 */
export function formatPlainText(text) {
  if (!text || !String(text).trim()) return '';

  const escaped = escapeHtml(String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')).replace(/\n/g, '<br>');
  // Separar p�rrafos (doble salto de l�nea) en bloques <p>
  return escaped
    .split(/(?:<br>\s*){2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${p}</p>`)
    .join('');
}

/**
 * Copia texto al portapapeles
 * @param {string} text - Texto a copiar
 * @returns {Promise<boolean>} True si se copió exitosamente
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Error copiando al portapapeles:', err);
    return false;
  }
}

/**
 * Comprueba si estamos en dispositivo móvil
 * @returns {boolean} True si es móvil
 */
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Obtiene el dominio actual
 * @returns {string} Dominio actual
 */
export function getCurrentDomain() {
  return window.location.origin;
}

/**
 * Retrasa la ejecución por un tiempo determinado
 * @param {number} ms - Milisegundos a esperar
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
