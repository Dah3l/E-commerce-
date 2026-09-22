/**
 * UTILIDADES GENERALES
 * Funciones helper para formateo, validación y otras tareas comunes
 */

import { DEFAULT_CURRENCY } from './config.js';

/**
 * Formatea un número como precio en la moneda configurada
 * @param {number} amount - Cantidad a formatear
 * @param {string} currency - Código de moneda (opcional)
 * @returns {string} Precio formateado
 */
export function formatPrice(amount, currency = DEFAULT_CURRENCY) {
  if (amount === null || amount === undefined) return '';
  
  return new Intl.NumberFormat('es-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
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
