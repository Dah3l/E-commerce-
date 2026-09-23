/**
 * UTILIDADES GENERALES
 * Funciones helper para formateo, validación y otras tareas comunes
 */

import { DEFAULT_CURRENCY } from './config.js';
import { getActiveCurrency, convertAmount } from './moneda.js';

/**
 * Formatea un número como precio aplicando la moneda elegida por el comprador.
 * Los importes se guardan en la BD en la moneda base del negocio (normalmente
 * USD) y aqui se convierten a CUP si el usuario selecciono esa moneda, usando
 * la tasa configurada por el admin (ej: 1 USD = 700 CUP).
 * @param {number} amount - Cantidad en la moneda base (USD)
 * @param {string} [fallbackCurrency] - Moneda base configurada (opcional)
 * @returns {string} Precio formateado
 */
export function formatPrice(amount, fallbackCurrency = DEFAULT_CURRENCY) {
  if (amount === null || amount === undefined) return '';

  // Moneda visible: la que eligio el comprador (USD o CUP). Si no hay
  // seleccion valida, se usa la moneda base indicada por quien llama.
  let code = String(getActiveCurrency() || fallbackCurrency || DEFAULT_CURRENCY)
    .trim().toUpperCase();
  // Normalizar codigo de moneda: debe ser ISO de 3 letras (USD, COP, MXN...).
  // Si el admin configuro algo invalido (simbolo "$", texto libre, etc.)
  // se cae al default para evitar que Intl lance RangeError.
  if (!/^[A-Z]{3}$/.test(code)) code = DEFAULT_CURRENCY;

  // Importe ya convertido (USD -> CUP segun la tasa del admin)
  const value = convertAmount(Number(amount) || 0);
  // En CUP los precios se muestran en pesos enteros (sin decimales)
  const isCup = code === 'CUP';

  const fmt = (cur) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: isCup ? 0 : 2,
    maximumFractionDigits: isCup ? 0 : 2
  }).format(value);

  try {
    return withCurrencyCode(fmt(code), code);
  } catch (_) {
    // Moneda con formato ISO valido pero inexistente (ej: "ABC")
    return withCurrencyCode(fmt(DEFAULT_CURRENCY), DEFAULT_CURRENCY);
  }
}

/**
 * Garantiza que el precio formateado muestre tambien el codigo ISO de la
 * moneda DETRAS del importe (formato correcto: "100 CUP", no "CUP 100").
 * Si Intl ya incluyo el codigo delante (p. ej. "CUP 100,00"), se reordena
 * colocando primero el simbolo y despues el codigo: "$100.00 CUP".
 */
function withCurrencyCode(formatted, code) {
  // Quitar el codigo ISO si Intl lo puso pegado al numero (delante o detras)
  const stripped = formatted
    .replace(new RegExp(`\\s*${code}\\s*`, 'g'), ' ')
    .trim();
  // Reconstruir: importe con simbolo + codigo ISO al final (ej: "$100.00 CUP")
  return `${stripped} ${code}`;
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
 * - Los saltos de línea simples se respetan (se convierten en <br>).
 * - Los párrafos (separados por doble salto de línea) se envuelven en <p>.
 * Todo el contenido se escapa primero, por lo que es seguro insertarlo con innerHTML.
 * @param {string} text - Texto plano (posible multilinea)
 * @returns {string} HTML escapado y formateado
 */
export function formatPlainText(text) {
  if (!text || !String(text).trim()) return '';

  const escaped = escapeHtml(String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')).replace(/\n/g, '<br>');
  // Separar párrafos (doble salto de línea) en bloques <p>
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
